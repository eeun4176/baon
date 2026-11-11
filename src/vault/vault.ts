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
 * For now only My phone mode (device key). Shared mode (passphrase + Recovery Kit)
 * is added later and only changes how the DEK is wrapped, not the records.
 */
import { decryptJson, encryptJson, generateDek, generateDeviceKey, recordAad, unwrapDek, wrapDek } from '../crypto/crypto.ts'
import Dexie from 'dexie'
import { deviceDb, openAccountDb, type AccountDb, type StoredRecord } from '../db/db.ts'

/** Current record schema version; bump it with a migration when record shapes change. */
export const SCHEMA_VERSION = 1

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
  return unlocked(userId, db, await unwrapDek(wrappedDek, deviceKey))
}

/** Opens an existing account on this device (works offline). */
export async function openVault(userId: string): Promise<Vault> {
  const db = openAccountDb(userId)
  const meta = await db.meta.get('vault')
  if (!meta) {
    db.close()
    throw new Error('No vault for this account on this device')
  }
  return unlocked(userId, db, await unwrapDek(meta.wrappedDek, meta.deviceKey))
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

/** Builds the Vault object around an unlocked DEK. */
function unlocked(userId: string, db: AccountDb, dek: CryptoKey): Vault {
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
      await db.records.put({ id, type, v: SCHEMA_VERSION, ...sealed })
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
      await db.records.delete(id)
    },
    lock() {
      key = null // Dexie would silently reopen a closed db, so the null key is the real lock
      db.close()
    },
  }
}
