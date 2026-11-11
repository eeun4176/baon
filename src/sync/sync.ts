/*
 * sync.ts — "Sync across devices" (opt-in, turned on per device on Me → Backup).
 *
 * What goes to the cloud: each record exactly as the phone stores it (already scrambled with
 * the account key, tied to the account, id, type and version), plus the account key locked with
 * the student's recovery code. The server can't read either. A new device unlocks the key with
 * the recovery code, then downloads everything.
 *
 * How a sync runs (syncNow):
 *   1. key   — stop if sync was turned off everywhere; share or adopt a new recovery code
 *   2. push  — upload every record in the outbox (vault.ts queues each save/delete there);
 *              a deleted record is uploaded as a "deleted" marker so other devices delete it too
 *   3. pull  — download what changed since this device last looked; each record must open with
 *              this account's key before it is saved (a bad or foreign row is never stored)
 * Conflicts: a record changed here AND elsewhere before syncing keeps this device's version
 * (it was just uploaded, so every device ends up with it). Records are small and separate
 * (each expense is its own record), so real clashes are rare.
 *
 * The server side is sql/sync.sql; the real connection is neonRemote.ts (loaded on demand).
 */
import { fromB64, recoveryKey, toB64 } from '../backup/backup.ts'
import { generateDeviceKey, unwrapDek, wrapDek } from '../crypto/crypto.ts'
import { deviceDb, openAccountDb, type AccountDb, type StoredRecord, type VaultMeta } from '../db/db.ts'
import { openVault, renameAccount, SCHEMA_VERSION, type Vault } from '../vault/vault.ts'

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

/** The account key locked with the recovery code, plus a key check (see keyCheck). */
export interface CloudKey {
  salt: string
  iv: string
  ciphertext: string
  check_iv: string
  check_ciphertext: string
}

/** Why a sync couldn't run: no internet, the sign-in expired, or the server refused. */
export type SyncProblem = 'offline' | 'signin' | 'server'

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
  push(rows: WireRecord[]): Promise<void>
  /** Changes after `after` (by server time, then id), oldest first, at most `limit`. */
  pull(after: { at: string; id: string } | null, limit: number): Promise<CloudRecord[]>
  getKey(): Promise<CloudKey | null>
  putKey(key: CloudKey): Promise<void>
  deleteAll(): Promise<void>
}

const PAGE = 500
const OVERLAP_MS = 60_000 // re-read the last minute each time, in case a slow save landed just behind the cursor
// shortcut: the key check is sealed with SCHEMA_VERSION; when that version changes, compare with the old one too.
const CHECK = { id: 'key-check', type: 'key-check' }

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

/** The locked key from this device's Recovery Kit, in wire form. */
function lockedKey(recovery: NonNullable<VaultMeta['recovery']>) {
  return { salt: toB64(recovery.salt), iv: toB64(recovery.iv), ciphertext: toB64(recovery.ciphertext) }
}

/** A small value sealed with the account key: another device can tell "same key" by opening it. */
async function keyCheck(vault: Vault) {
  const row = await vault.seal(CHECK.type, CHECK.id, 'baon')
  return { check_iv: toB64(row.iv), check_ciphertext: toB64(row.ciphertext) }
}

/** True if the cloud key is this account's key on this device. */
function sameKey(vault: Vault, cloud: CloudKey): Promise<boolean> {
  return vault.canOpen({ ...CHECK, v: SCHEMA_VERSION, iv: fromB64(cloud.check_iv), ciphertext: fromB64(cloud.check_ciphertext).buffer })
}

/** Whether sync is on for this device, and when it last worked. */
export async function syncState(userId: string): Promise<{ on: boolean; lastSyncedAt?: string }> {
  const meta = await withDb(userId, (db) => db.meta.get('vault'))
  return { on: Boolean(meta?.sync), lastSyncedAt: meta?.sync?.lastSyncedAt }
}

/** Whether this account already syncs from some device (used at sign-in on a new device). */
export async function cloudHasAccount(remote: Remote): Promise<boolean> {
  return (await remote.getKey()) !== null
}

/**
 * Turns sync on for this device.
 *   'needs-kit'  make a Recovery Kit first (the code is what unlocks the key on other devices)
 *   'other-key'  this account already syncs with records from another device (different key):
 *                use joinSync with that recovery code to switch this device to them
 *   'on'         done; first device uploads everything, a returning device uploads its changes
 */
export async function turnOnSync(vault: Vault, remote: Remote, name: string): Promise<'on' | 'needs-kit' | 'other-key'> {
  const meta = await withDb(vault.userId, (db) => db.meta.get('vault'))
  if (!meta?.recovery) return 'needs-kit'
  const cloud = await remote.getKey()
  if (cloud && !(await sameKey(vault, cloud))) return 'other-key'

  await vault.put('settings', 'account-name', { name }) // so a new device shows the same name
  const mine = lockedKey(meta.recovery)
  if (!cloud || cloud.salt !== mine.salt) await remote.putKey({ ...mine, ...(await keyCheck(vault)) })
  await withDb(vault.userId, (db) =>
    db.transaction('rw', db.records, db.outbox, db.meta, async () => {
      // First device: upload everything. Returning device: the outbox already holds every change since.
      if (!cloud) await db.outbox.bulkPut((await db.records.toCollection().primaryKeys()).map((id) => ({ id, n: crypto.randomUUID() })))
      await db.meta.update('vault', { sync: { keySalt: mine.salt } })
    }),
  )
  await syncNow(vault, remote)
  return 'on'
}

/** Applies one downloaded change. Returns 1 if this device's records changed. */
async function applyRemote(db: AccountDb, vault: Vault, r: CloudRecord): Promise<number> {
  if (!r.deleted) {
    if (r.v > SCHEMA_VERSION) return 0 // from a newer baon; picked up after this device updates
    if (!(await vault.canOpen(fromWire(r)))) return 0 // not this account's key, or damaged: never store it
  }
  return db.transaction('rw', db.records, db.outbox, async () => {
    if (await db.outbox.get(r.id)) return 0 // changed here too: this device's version wins (already uploaded)
    const local = await db.records.get(r.id)
    if (r.deleted) {
      if (!local) return 0
      await db.records.delete(r.id)
      return 1
    }
    if (local && toB64(local.iv) === r.iv) return 0 // already have this exact version
    await db.records.put(fromWire(r))
    return 1
  })
}

/**
 * One full sync (key → push → pull). Returns how many local records changed (the screens
 * reload when > 0) and `stopped` if sync was turned off everywhere. Throws SyncError.
 */
export async function syncNow(vault: Vault, remote: Remote): Promise<{ changed: number; stopped?: boolean }> {
  return withDb(vault.userId, async (db) => {
    const meta = await db.meta.get('vault')
    if (!meta?.sync) return { changed: 0 }
    let sync = meta.sync

    // 1. Key
    const cloud = await remote.getKey()
    const localSalt = meta.recovery && toB64(meta.recovery.salt)
    if (!cloud) {
      await db.meta.update('vault', { sync: undefined }) // turned off everywhere (or account data deleted)
      return { changed: 0, stopped: true }
    }
    if (cloud.salt !== localSalt) {
      if (meta.recovery && localSalt !== sync.keySalt) {
        await remote.putKey({ ...lockedKey(meta.recovery), ...(await keyCheck(vault)) }) // new code made on this device
        sync = { ...sync, keySalt: localSalt }
      } else if (await sameKey(vault, cloud)) {
        // New code made on another device: use it here too, so Backup asks for the same code everywhere.
        await db.meta.update('vault', { recovery: { salt: fromB64(cloud.salt), iv: fromB64(cloud.iv), ciphertext: fromB64(cloud.ciphertext).buffer } })
        sync = { ...sync, keySalt: cloud.salt }
      } else {
        await db.meta.update('vault', { sync: undefined }) // the cloud now holds a different account key
        return { changed: 0, stopped: true }
      }
    }

    // 2. Push
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

    // 3. Pull
    let after = sync.cursor ? { at: new Date(Date.parse(sync.cursor.at) - OVERLAP_MS).toISOString(), id: '' } : null
    let cursor = sync.cursor
    let changed = 0
    for (;;) {
      const page = await remote.pull(after, PAGE)
      for (const r of page) changed += await applyRemote(db, vault, r)
      if (page.length) after = cursor = { at: page[page.length - 1].updated_at, id: page[page.length - 1].id }
      if (page.length < PAGE) break
    }
    await db.meta.update('vault', { sync: { ...sync, cursor, lastSyncedAt: new Date().toISOString() } })
    return { changed }
  })
}

/**
 * Brings the synced account to this device (new device, or switching a device that had its own
 * separate records): unlocks the cloud key with the recovery code, sets this device up with it
 * (replacing any records already here), then downloads everything. Returns the display name.
 * A wrong code changes nothing. `beforeReplace` runs once the code is right, just before this
 * device's records are replaced (an open session locks its old key there).
 */
export async function joinSync(userId: string, fallbackName: string, code: string, remote: Remote, beforeReplace?: () => void): Promise<string> {
  const cloud = await remote.getKey()
  if (!cloud) throw new Error('Sync isn’t turned on for this account yet.')
  const recovery = { salt: fromB64(cloud.salt), iv: fromB64(cloud.iv), ciphertext: fromB64(cloud.ciphertext).buffer }
  const key = await recoveryKey(code, recovery.salt) // throws its own message for a mistyped code
  let dek: CryptoKey
  try {
    dek = await unwrapDek(recovery, key, true)
  } catch {
    throw new Error('That code doesn’t match. Use the recovery code you saved.')
  }

  const deviceKey = await generateDeviceKey()
  const wrappedDek = await wrapDek(dek, deviceKey)
  beforeReplace?.()
  await withDb(userId, (db) =>
    db.transaction('rw', db.records, db.outbox, db.meta, async () => {
      await db.records.clear()
      await db.outbox.clear()
      await db.meta.put({ key: 'vault', deviceMode: 'my-phone', wrappedDek, deviceKey, schemaVersion: SCHEMA_VERSION, recovery, sync: { keySalt: cloud.salt } })
    }),
  )
  const existing = await deviceDb.accounts.get(userId)
  await deviceDb.accounts.put({ userId, label: existing?.label ?? fallbackName, deviceMode: 'my-phone', enrolledAt: existing?.enrolledAt ?? new Date().toISOString() })

  const vault = await openVault(userId)
  try {
    await syncNow(vault, remote)
    const saved = (await vault.get('account-name')) as { name?: unknown } | undefined // the name travels as a record
    const name = typeof saved?.name === 'string' && saved.name ? saved.name : existing?.label ?? fallbackName
    await renameAccount(userId, name)
    return name
  } finally {
    vault.lock()
  }
}

/** Turns sync off on this device; with `everywhere`, also deletes the cloud copies (other devices then stop). */
export async function turnOffSync(userId: string, remote?: Remote): Promise<void> {
  if (remote) await remote.deleteAll() // first, so a failure leaves sync honestly on
  await withDb(userId, (db) => db.meta.update('vault', { sync: undefined }))
}
