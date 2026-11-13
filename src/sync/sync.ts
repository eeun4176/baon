/*
 * sync.ts — Sync across devices: always on for every signed-in account (no switch, no code).
 *
 * What goes online: each record exactly as the phone stores it (scrambled with the account key,
 * tied to the account, id, type and version), plus the account key itself, so any device the
 * student signs in on can open them. Only the signed-in account can reach its rows (sql/sync.sql).
 * The account sign-in protects the online copy (see docs/architecture.md).
 *
 * How a sync runs (syncNow):
 *   0. owner — the online sign-in must be this Baon's owner. A browser keeps one sign-in, so on a
 *              phone with two accounts it may be the other student's: then nothing is sent or read
 *              ("Sign in again"), so records can never go to the wrong account.
 *   1. key   — no key online yet: this is the first device, upload its key and every record.
 *              A device with a different key (set up on its own before syncing) switches to the
 *              account's key and merges: same record id → the online version; the rest is added.
 *   2. push  — upload every record in the outbox (vault.ts queues each save/delete there);
 *              a deleted record is uploaded as a "deleted" marker so other devices delete it too
 *   3. pull  — download what changed since this device last looked; each record must open with
 *              the account key before it is saved (a bad or foreign row is never stored)
 * Conflicts: a record changed here AND elsewhere before syncing keeps this device's version
 * (it was just uploaded, so every device ends up with it).
 * A new device gets everything with joinSync (onboarding), without the setup questions.
 *
 * The server side is sql/sync.sql; the real connection is neonRemote.ts (loaded on demand).
 */
import { fromB64, toB64 } from '../backup/backup.ts'
import { loadAllowance } from '../budget/allowance.ts'
import { decryptJson, encryptJson, exportDek, generateDeviceKey, importDek, recordAad, unwrapDek, wrapDek } from '../crypto/crypto.ts'
import { deviceDb, openAccountDb, type AccountDb, type StoredRecord, type SyncMeta, type VaultMeta } from '../db/db.ts'
import { deleteAccountFromDevice, openVault, renameAccount, SCHEMA_VERSION, type Vault } from '../vault/vault.ts'

/** One record as it travels (binary parts as base64). `deleted` = the record was removed. */
export interface WireRecord {
  id: string
  type: string
  v: number
  iv: string
  ciphertext: string
  deleted: boolean
}

/** A record as the server returns it: plus the server's change time. */
export interface CloudRecord extends WireRecord {
  updated_at: string
}

/** The account key as kept online: base64 of its 32 raw bytes. */
export interface CloudKey {
  dek: string
}

/** Why a sync couldn't run: no internet, not signed in, the server refused, or the account was deleted elsewhere. */
export type SyncProblem = 'offline' | 'signin' | 'server' | 'deleted'

/** Error with a problem kind the screens can explain. */
export class SyncError extends Error {
  problem: SyncProblem
  constructor(problem: SyncProblem, message?: string) {
    super(message ?? problem)
    this.problem = problem
  }
}

/** The cloud, as sync needs it (neonRemote.ts in the app, a fake in tests). Rows are always the signed-in user's. */
export interface Remote {
  /** Who is signed in online (null = nobody). Throws SyncError('offline') without a connection. */
  signedInAs(): Promise<string | null>
  push(rows: WireRecord[]): Promise<void>
  /** Changes after `after` (by server time, then id), oldest first, at most `limit`. */
  pull(after: { at: string; id: string } | null, limit: number): Promise<CloudRecord[]>
  getKey(): Promise<CloudKey | null>
  /** Saves `key` as the account key unless one is already there; returns the key now online. */
  claimKey(key: CloudKey): Promise<CloudKey>
  deleteAll(): Promise<void>
}

const PAGE = 500
const OVERLAP_MS = 60_000 // re-read the last minute each time, in case a slow save landed just behind the cursor

/** Opens this account's database for one job, then closes it. */
async function withDb<T>(userId: string, job: (db: AccountDb) => Promise<T>): Promise<T> {
  const db = openAccountDb(userId)
  try {
    return await job(db)
  } finally {
    db.close()
  }
}

/** Stored record → wire format. */
function toWire(row: StoredRecord): WireRecord {
  return { id: row.id, type: row.type, v: row.v, iv: toB64(row.iv), ciphertext: toB64(row.ciphertext), deleted: false }
}

/** Wire format → stored record. */
function fromWire(r: WireRecord): StoredRecord {
  return { id: r.id, type: r.type, v: r.v, iv: fromB64(r.iv), ciphertext: fromB64(r.ciphertext).buffer }
}

/** Puts every record on this device in the outbox (uploaded by the next push). */
async function queueAll(db: AccountDb, except = new Set<string>()): Promise<void> {
  const ids = (await db.records.toCollection().primaryKeys()).filter((id) => !except.has(id))
  await db.outbox.bulkPut(ids.map((id) => ({ id, n: crypto.randomUUID() })))
}

/**
 * Shows the account's synced display name (the 'account-name' record) on this device:
 * the name screens use is the device's account label, which sync must keep in step. True if it changed.
 */
async function applyAccountName(vault: Vault): Promise<boolean> {
  const saved = (await vault.get('account-name')) as { name?: unknown } | undefined
  const name = typeof saved?.name === 'string' ? saved.name.trim() : ''
  if (!name || (await deviceDb.accounts.get(vault.userId))?.label === name) return false
  await renameAccount(vault.userId, name)
  return true
}

/** When this device last synced (undefined = not yet). */
export async function lastSyncedAt(userId: string): Promise<string | undefined> {
  return (await withDb(userId, (db) => db.meta.get('vault')))?.sync?.lastSyncedAt
}

/** Whether this account already has records online (used right after sign-in on a new device). */
export async function cloudHasAccount(remote: Remote): Promise<boolean> {
  return (await remote.getKey()) !== null
}

/**
 * Switches this device to the account's key: re-encrypts every record with it and marks the merge
 * (finished by the full download in syncNow). False if records changed meanwhile (next sync retries).
 */
async function adoptKey(db: AccountDb, vault: Vault, meta: VaultMeta, oldDek: CryptoKey, cloudDek: string): Promise<boolean> {
  const dek = await importDek(fromB64(cloudDek))
  const rows = await db.records.toArray()
  const moved: StoredRecord[] = []
  for (const row of rows) {
    const aad = recordAad(vault.userId, row.id, row.type, row.v)
    try {
      moved.push({ id: row.id, type: row.type, v: row.v, ...(await encryptJson(dek, aad, await decryptJson(oldDek, aad, row))) })
    } catch {
      // damaged here already: nothing to carry over
    }
  }
  const wrappedDek = await wrapDek(dek, vault.wrappingKey()) // keeps this phone's mode (device key or passphrase)
  const done = await db.transaction('rw', db.records, db.outbox, db.meta, async () => {
    const now = await db.records.toArray()
    if (now.length !== rows.length || now.some((r, i) => r.id !== rows[i].id || toB64(r.iv) !== toB64(rows[i].iv))) return false
    if (toB64((await db.meta.get('vault'))!.wrappedDek.iv) !== toB64(meta.wrappedDek.iv)) return false // passphrase changed meanwhile
    await db.records.clear()
    await db.records.bulkPut(moved)
    await db.outbox.clear()
    // The Recovery Kit locks the old key, so it couldn't open new backups: a new one is made at the next export.
    await db.meta.update('vault', { wrappedDek, recovery: undefined, sync: { merging: true } })
    return true
  })
  // Known limit: a save started in the few milliseconds before this line still uses the old key; fine for a one-time merge.
  if (done) vault.replaceKey(await unwrapDek(wrappedDek, vault.wrappingKey()))
  return done
}

/** Uploads every record waiting in the outbox (deleted ones as markers). */
async function push(db: AccountDb, remote: Remote): Promise<void> {
  const pending = await db.outbox.toArray()
  for (let i = 0; i < pending.length; i += PAGE) {
    const batch = pending.slice(i, i + PAGE)
    const rows = await db.records.bulkGet(batch.map((p) => p.id))
    await remote.push(batch.map((p, j) => rows[j] ? toWire(rows[j]) : { id: p.id, type: 'deleted', v: SCHEMA_VERSION, iv: '', ciphertext: '', deleted: true }))
    // Clear only entries not changed again while uploading.
    await db.transaction('rw', db.outbox, async () => {
      for (const p of batch) if ((await db.outbox.get(p.id))?.n === p.n) await db.outbox.delete(p.id)
    })
  }
}

/**
 * Applies one downloaded change. `changed`: this device's records changed. `valid`: the account
 * really has this record online (it opens, is a deleted marker, or is from a newer baon).
 */
async function applyRemote(db: AccountDb, vault: Vault, r: CloudRecord): Promise<{ changed: boolean; valid: boolean }> {
  if (!r.deleted) {
    if (r.v > SCHEMA_VERSION) return { changed: false, valid: true } // picked up after this device updates
    if (!(await vault.canOpen(fromWire(r)))) return { changed: false, valid: false } // not this account's key, or damaged: never store it
  }
  const changed = await db.transaction('rw', db.records, db.outbox, async () => {
    if (await db.outbox.get(r.id)) return false // changed here too: this device's version wins (already uploaded)
    const local = await db.records.get(r.id)
    if (r.deleted) {
      if (!local) return false
      await db.records.delete(r.id)
      return true
    }
    if (local && toB64(local.iv) === r.iv) return false // already have this exact version
    await db.records.put(fromWire(r))
    return true
  })
  return { changed, valid: true }
}

/** One full sync (key → push → pull). Returns how many local records changed (the screens reload when > 0). Throws SyncError. */
export async function syncNow(vault: Vault, remote: Remote): Promise<{ changed: number }> {
  if ((await remote.signedInAs()) !== vault.userId) throw new SyncError('signin') // 0. owner
  return withDb(vault.userId, async (db) => {
    const meta = await db.meta.get('vault')
    if (!meta) return { changed: 0 }
    let sync: SyncMeta = meta.sync ?? {}

    // 1. Key
    const myDek = await unwrapDek(meta.wrappedDek, vault.wrappingKey(), true)
    const mine = toB64(await exportDek(myDek))
    let cloud = await remote.getKey()
    if (!cloud) {
      // Synced before and now nothing online: the account was deleted on another device. Never
      // upload it again (that would undo the deletion); the records stay on this device.
      if (sync.lastSyncedAt) throw new SyncError('deleted')
      cloud = await remote.claimKey({ dek: mine })
      // First device: upload everything and read it all back.
      if (cloud.dek === mine) {
        await queueAll(db)
        sync = { ...sync, cursor: undefined }
      }
    }
    if (cloud.dek !== mine) {
      if (!(await adoptKey(db, vault, meta, myDek, cloud.dek))) return { changed: 0 }
      sync = { merging: true }
    }

    // 2. Push
    await push(db, remote)

    // 3. Pull
    let after = sync.cursor ? { at: new Date(Date.parse(sync.cursor.at) - OVERLAP_MS).toISOString(), id: '' } : null
    let cursor = sync.cursor
    let changed = 0
    const online = new Set<string>()
    for (;;) {
      const page = await remote.pull(after, PAGE)
      for (const r of page) {
        const result = await applyRemote(db, vault, r)
        if (result.changed) changed++
        if (result.valid) online.add(r.id)
      }
      if (page.length) after = cursor = { at: page[page.length - 1].updated_at, id: page[page.length - 1].id }
      if (page.length < PAGE) break
    }

    // Merge (that was a full download): add this device's own records the account doesn't have.
    if (sync.merging) {
      await queueAll(db, online)
      await push(db, remote)
    }
    await db.meta.update('vault', { sync: { cursor, lastSyncedAt: new Date().toISOString() } })
    if (await applyAccountName(vault)) changed++ // renamed on another device
    return { changed }
  })
}

/**
 * "Remove Baon from this phone": deletes this account's records here (they stay in the account).
 * Uploads first if anything isn't online yet (or it never synced); already all saved → works offline.
 * Throws SyncError if something couldn't be uploaded; then nothing is removed.
 */
export async function removeFromDevice(vault: Vault, remote: () => Promise<Remote>): Promise<void> {
  const unsaved = () => withDb(vault.userId, async (db) => (await db.outbox.count()) > 0 || !(await db.meta.get('vault'))?.sync?.lastSyncedAt)
  if (await unsaved()) {
    await syncNow(vault, await remote())
    if (await unsaved()) throw new SyncError('server', 'changes still waiting to upload')
  }
  vault.lock()
  await deleteAccountFromDevice(vault.userId)
}

/**
 * Sets a new device up with the account's records (onboarding, right after sign-in): takes the
 * account key from online, downloads everything and returns the open vault and display name —
 * or null if the account has no usable records online (then the normal setup runs).
 * If the download fails, nothing is left behind on this device.
 */
export async function joinSync(userId: string, fallbackName: string, remote: Remote): Promise<{ vault: Vault; name: string } | null> {
  const cloud = await remote.getKey()
  if (!cloud) return null
  const deviceKey = await generateDeviceKey()
  const wrappedDek = await wrapDek(await importDek(fromB64(cloud.dek)), deviceKey)
  await withDb(userId, (db) =>
    db.transaction('rw', db.records, db.outbox, db.meta, async () => {
      await db.records.clear()
      await db.outbox.clear()
      await db.meta.put({ key: 'vault', deviceMode: 'my-phone', wrappedDek, deviceKey, schemaVersion: SCHEMA_VERSION, sync: {} })
    }),
  )
  await deviceDb.accounts.put({ userId, label: fallbackName, deviceMode: 'my-phone', enrolledAt: new Date().toISOString() })

  const vault = await openVault(userId)
  try {
    await syncNow(vault, remote)
    if (!(await loadAllowance(vault))) throw new Error('nothing to open') // only a key online: set up as new
  } catch (e) {
    vault.lock()
    await deleteAccountFromDevice(userId)
    if (e instanceof SyncError) throw e
    return null
  }
  return { vault, name: (await deviceDb.accounts.get(userId))?.label ?? fallbackName } // syncNow applied the synced name
}
