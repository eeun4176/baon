/*
 * vault.ts — The encrypted record store the rest of the app uses.
 * Combines crypto.ts (encryption) and db.ts (IndexedDB) so screens never touch
 * keys or ciphertext directly:
 *
 *   const vault = await openVault(userId)
 *   await vault.put('transaction', id, { amountCentavos: 1500, note: 'Jeep' })
 *   const all = await vault.list('transaction')
 *   vault.lock()
 *
 * Two ways the account key (DEK) is locked on the phone; the records are the same in both:
 * - My phone mode: by a device key stored next to it, so Baon opens right away.
 * - Shared phone mode: by a key made from the student's passphrase, which is never stored,
 *   so Baon can't open without it (openVault(userId, passphrase); vault.protect switches modes).
 *   Forgot it? resetPassphrase with the key from the Recovery Kit or from the account (sync).
 *
 * Sync (sync/sync.ts): every put/remove also notes the record id in the outbox, in the
 * same database transaction, so a change can never be saved without being queued for upload.
 */
import { decryptJson, encryptJson, generateDek, generateDeviceKey, PASSPHRASE_ROUNDS, passphraseKey, recordAad, unwrapDek, wrapDek, type Sealed } from '../crypto/crypto.ts'
import Dexie from 'dexie'
import { deviceDb, openAccountDb, type AccountDb, type DeviceMode, type StoredRecord, type VaultMeta } from '../db/db.ts'

const savedListeners = new Set<() => void>()

/** Calls `listener` after every local save or delete (sync uses it to upload soon). Returns an unsubscribe. */
export function onLocalChange(listener: () => void): () => void {
  savedListeners.add(listener)
  return () => savedListeners.delete(listener)
}

/**
 * Current record schema version; bump it when records gain something older versions can't read.
 * Older Baon skips newer records while syncing; after it updates it downloads everything again (sync.ts).
 *   1  first version
 *   2  money-in sources, "make it last until", utang (borrow/repay/lend/collect)
 */
export const SCHEMA_VERSION = 2

/** Shared phone mode, opened without the passphrase: show the lock screen. */
export class PassphraseNeeded extends Error {}
/** The passphrase typed doesn't open this account. */
export class WrongPassphrase extends Error {}

/** An unlocked account. All methods throw after lock(). */
export interface Vault {
  userId: string
  /** Encrypts and saves a record (insert or replace). */
  put(type: string, id: string, data: unknown): Promise<void>
  /** Loads and decrypts one record, or undefined if it doesn't exist. */
  get(id: string): Promise<unknown>
  /** Loads and decrypts every record of one type. */
  list(type: string): Promise<unknown[]>
  /** Deletes one record. */
  remove(id: string): Promise<void>
  /** True if a stored-format record (e.g. one downloaded by sync) opens with this account's key. */
  canOpen(row: StoredRecord): Promise<boolean>
  /** Uses another account key from now on (sync, after it re-encrypted every record with it). */
  replaceKey(dek: CryptoKey): void
  /** True in Shared phone mode (Baon asks for the passphrase every time it opens). */
  shared(): boolean
  /** The key that locks the DEK on this phone (device key or passphrase key), for re-locking it (sync, Recovery Kit). */
  wrappingKey(): CryptoKey
  /** Switches to Shared phone mode with this passphrase (or changes it); null switches back to My phone mode. */
  protect(passphrase: string | null): Promise<void>
  /** Whether the passphrase is this account's current passphrase (before changing it or turning it off). */
  checkPassphrase(passphrase: string): Promise<boolean>
  /** Forgets the key and closes the database. Used on lock and account switch. */
  lock(): void
}

/**
 * First-time setup of an account on this device (My phone mode):
 * new DEK → wrapped by a new non-extractable device key → saved, then the
 * account is listed in `sbt_device`. Refuses to overwrite an existing vault,
 * because a new DEK would make the old records unreadable.
 */
export async function createVault(userId: string, label: string): Promise<Vault> {
  const db = openAccountDb(userId)
  if ((await db.meta.get('vault')) || (await deviceDb.accounts.get(userId))) {
    db.close()
    throw new Error('This account already has a vault on this device')
  }

  const dek = await generateDek()
  const deviceKey = await generateDeviceKey()
  const wrappedDek = await wrapDek(dek, deviceKey)
  await db.meta.add({ key: 'vault', deviceMode: 'my-phone', wrappedDek, deviceKey, schemaVersion: SCHEMA_VERSION })
  await deviceDb.accounts.add({ userId, label, deviceMode: 'my-phone', enrolledAt: new Date().toISOString() })

  // Use a non-extractable copy for daily use, same as openVault.
  return unlocked(userId, db, await unwrapDek(wrappedDek, deviceKey), deviceKey, false)
}

/** Opens an existing account on this device (works offline). Shared phone mode needs the passphrase. */
export async function openVault(userId: string, passphrase?: string): Promise<Vault> {
  const db = openAccountDb(userId)
  const meta = await db.meta.get('vault')
  if (!meta) {
    db.close()
    throw new Error('No vault for this account on this device')
  }
  if (meta.deviceMode === 'shared') {
    if (passphrase === undefined || !meta.passphrase) {
      db.close()
      throw new PassphraseNeeded()
    }
    const key = await passphraseKey(passphrase, meta.passphrase.salt, meta.passphrase.rounds)
    try {
      return unlocked(userId, db, await unwrapDek(meta.wrappedDek, key), key, true)
    } catch {
      db.close()
      throw new WrongPassphrase()
    }
  }
  return unlocked(userId, db, await unwrapDek(meta.wrappedDek, meta.deviceKey!), meta.deviceKey!, false)
}

/** The DEK locked for one mode: by a new passphrase key, or (null) by a new device key. Plus that key. */
async function lockFor(dek: CryptoKey, passphrase: string | null): Promise<{ fields: Partial<VaultMeta> & { deviceMode: DeviceMode; wrappedDek: Sealed }; key: CryptoKey }> {
  if (passphrase === null) {
    const key = await generateDeviceKey()
    return { key, fields: { deviceMode: 'my-phone', wrappedDek: await wrapDek(dek, key), deviceKey: key, passphrase: undefined } }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await passphraseKey(passphrase, salt)
  return { key, fields: { deviceMode: 'shared', wrappedDek: await wrapDek(dek, key), passphrase: { salt, rounds: PASSPHRASE_ROUNDS }, deviceKey: undefined } }
}

/** Same bytes? (to notice the stored DEK changed while a slow step ran) */
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Forgot the passphrase: the key (extractable) came from the Recovery Kit or the account online.
 * It must open this phone's records; then it's locked with the new passphrase and the vault opens.
 * Throws WrongPassphrase if that key doesn't belong to these records.
 */
export async function resetPassphrase(userId: string, dek: CryptoKey, passphrase: string): Promise<Vault> {
  const db = openAccountDb(userId)
  try {
    const row = await db.records.toCollection().first()
    if (row) await decryptJson(dek, recordAad(userId, row.id, row.type, row.v), row)
  } catch {
    db.close()
    throw new WrongPassphrase()
  }
  const next = await lockFor(dek, passphrase)
  await db.meta.update('vault', next.fields)
  await deviceDb.accounts.update(userId, { deviceMode: 'shared' })
  return unlocked(userId, db, await unwrapDek(next.fields.wrappedDek, next.key), next.key, true)
}

/** Lists accounts enrolled on this device, for the lock screen / account picker. */
export function listDeviceAccounts() {
  return deviceDb.accounts.toArray()
}

/** Changes the display name shown for this account on this device (Me → Profile). */
export async function renameAccount(userId: string, label: string): Promise<void> {
  await deviceDb.accounts.update(userId, { label })
}

/** Deletes this account's encrypted records and its entry on this device (Help → Delete). Lock the vault first. */
export async function deleteAccountFromDevice(userId: string): Promise<void> {
  await Dexie.delete(`sbt_${userId}`)
  await deviceDb.accounts.delete(userId)
}

/** Builds the Vault object around an unlocked DEK and the key that locks it on this phone. */
function unlocked(userId: string, db: AccountDb, dek: CryptoKey, wrapping: CryptoKey, isShared: boolean): Vault {
  let key: CryptoKey | null = dek

  /** Returns the DEK, or throws if the vault was locked. */
  function requireKey(): CryptoKey {
    if (!key) throw new Error('Vault is locked')
    return key
  }

  /** Decrypts a stored row; its AAD is rebuilt from this account + the row's own id/type/version. */
  function open(row: StoredRecord): Promise<unknown> {
    return decryptJson(requireKey(), recordAad(userId, row.id, row.type, row.v), row)
  }

  return {
    userId,
    async put(type, id, data) {
      const sealed = await encryptJson(requireKey(), recordAad(userId, id, type, SCHEMA_VERSION), data)
      await db.transaction('rw', db.records, db.outbox, async () => {
        await db.records.put({ id, type, v: SCHEMA_VERSION, ...sealed })
        await db.outbox.put({ id, n: crypto.randomUUID() })
      })
      savedListeners.forEach((l) => l())
    },
    async get(id) {
      requireKey()
      const row = await db.records.get(id)
      return row && open(row)
    },
    async list(type) {
      requireKey()
      const rows = await db.records.where('type').equals(type).toArray()
      return Promise.all(rows.map(open))
    },
    async remove(id) {
      requireKey()
      await db.transaction('rw', db.records, db.outbox, async () => {
        await db.records.delete(id)
        await db.outbox.put({ id, n: crypto.randomUUID() })
      })
      savedListeners.forEach((l) => l())
    },
    replaceKey(dek) {
      requireKey()
      key = dek
    },
    async canOpen(row) {
      try {
        await open(row)
        return true
      } catch {
        return false
      }
    },
    shared: () => isShared,
    wrappingKey() {
      requireKey()
      return wrapping
    },
    async protect(passphrase) {
      requireKey()
      const before = (await db.meta.get('vault'))!
      const next = await lockFor(await unwrapDek(before.wrappedDek, wrapping, true), passphrase) // extractable only for this re-lock
      // Save only if sync didn't re-lock the DEK meanwhile (it would be lost otherwise).
      const saved = await db.transaction('rw', db.meta, async () => {
        const now = await db.meta.get('vault')
        if (!now || !sameBytes(now.wrappedDek.iv, before.wrappedDek.iv)) return false
        await db.meta.update('vault', next.fields)
        return true
      })
      if (!saved) throw new Error('The account key changed while saving; try again')
      await deviceDb.accounts.update(userId, { deviceMode: next.fields.deviceMode })
      wrapping = next.key
      isShared = passphrase !== null
    },
    async checkPassphrase(passphrase) {
      const meta = await db.meta.get('vault')
      if (!meta?.passphrase) return false
      try {
        await unwrapDek(meta.wrappedDek, await passphraseKey(passphrase, meta.passphrase.salt, meta.passphrase.rounds))
        return true
      } catch {
        return false
      }
    },
    lock() {
      key = null // Dexie would silently reopen a closed db, so the null key is the real lock
      db.close()
    },
  }
}
