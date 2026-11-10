/*
 * db.ts — IndexedDB layout via Dexie (plan §7.3).
 *
 * Two kinds of databases on each phone:
 * - `sbt_device`: the list of accounts enrolled on this device (for the lock screen).
 *   No money, no streak, nothing financial.
 * - `sbt_<userId>`: one per account. Holds only encrypted records plus the
 *   wrapped DEK. Plaintext columns are limited to id, type and schema version.
 */
import Dexie, { type EntityTable } from 'dexie'
import type { Sealed } from '../crypto/crypto.ts'

/** How the account's DEK is protected on this device (plan §7.2). */
export type DeviceMode = 'my-phone' | 'shared'

/** One enrolled account in `sbt_device`. */
export interface DeviceAccount {
  userId: string
  label: string // display name, or "Hidden account"
  deviceMode: DeviceMode
  enrolledAt: string // ISO timestamp
}

/** One encrypted record. Amounts, notes, dates etc. are inside `ciphertext`. */
export interface StoredRecord extends Sealed {
  id: string
  type: string // e.g. "transaction", "wallet", "day_snapshot"
  v: number // schema version, part of the AAD
}

/** Vault settings for one account: how to get the DEK back on this device. */
export interface VaultMeta {
  key: 'vault'
  deviceMode: DeviceMode
  wrappedDek: Sealed
  deviceKey: CryptoKey // non-extractable; IndexedDB can store it without exposing its bytes
  schemaVersion: number
}

/** Device-wide account list (`sbt_device`). */
export const deviceDb = new Dexie('sbt_device') as Dexie & {
  accounts: EntityTable<DeviceAccount, 'userId'>
}
deviceDb.version(1).stores({ accounts: '&userId' })

/** Per-account database type (`sbt_<userId>`). */
export type AccountDb = Dexie & {
  records: EntityTable<StoredRecord, 'id'>
  meta: EntityTable<VaultMeta, 'key'>
}

/** Opens (or creates) one account's database. Indexes only id and type. */
export function openAccountDb(userId: string): AccountDb {
  const db = new Dexie(`sbt_${userId}`) as AccountDb
  db.version(1).stores({ records: '&id, type', meta: '&key' })
  return db
}
