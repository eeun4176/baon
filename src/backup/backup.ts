/*
 * backup.ts — Encrypted export and import (plan §7.4, §9: "Export → clear site data →
 * import restores all records exactly").
 *
 * The file holds the account's records exactly as stored on the phone (already AES-GCM
 * encrypted with the DEK and tied to the account by AAD) plus a copy of the DEK wrapped
 * by a key made from the Recovery Kit code. Without the code nobody can open the file,
 * not even us. The code itself is never saved anywhere; the student keeps it.
 */
import * as z from 'zod/mini'
import { decryptJson, generateDeviceKey, recordAad, unwrapDek, wrapDek } from '../crypto/crypto.ts'
import { deviceDb, openAccountDb, type StoredRecord } from '../db/db.ts'
import { SCHEMA_VERSION, type Vault } from '../vault/vault.ts'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32: no I, L, O or U to misread
const NAME_ID = 'account-name' // the display name travels inside the backup as an encrypted record
const encoder = new TextEncoder()

/** New Recovery Kit code: 32 random characters (160 bits), shown as 8 groups of 4. */
export function newRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]).join('') // 256 is a multiple of 32, so no bias
  return chars.match(/.{4}/g)!.join('-')
}

/** Cleans a typed code (case, spaces and dashes don't matter; O→0, I/L→1); null if it can't be a code. */
export function normalizeCode(typed: string): string | null {
  const code = typed.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  return code.length === 32 && [...code].every((c) => ALPHABET.includes(c)) ? code : null
}

/** Wrapping key from the code. HKDF is enough: the code is already random, not a password. */
export async function recoveryKey(code: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const clean = normalizeCode(code)
  if (!clean) throw new Error('That isn’t a recovery code. It has 8 groups of 4 letters and numbers.')
  const base = await crypto.subtle.importKey('raw', encoder.encode(clean), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('baon recovery v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

/** Bytes → base64 text for the JSON file. */
export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  let text = ''
  for (const b of new Uint8Array(bytes)) text += String.fromCharCode(b)
  return btoa(text)
}

/** Base64 text → bytes. */
export function fromB64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

const b64 = z.string().check(z.regex(/^[A-Za-z0-9+/]*={0,2}$/))
const BackupFileSchema = z.object({
  app: z.literal('baon'),
  kind: z.literal('backup'),
  format: z.literal(1),
  userId: z.string().check(z.minLength(1), z.maxLength(200)),
  createdAt: z.string().check(z.maxLength(40)),
  recovery: z.object({ salt: b64, iv: b64, ciphertext: b64 }),
  records: z.array(z.object({ id: z.string().check(z.maxLength(200)), type: z.string().check(z.maxLength(40)), v: z.number(), iv: b64, ciphertext: b64 })),
})
export type BackupFile = z.infer<typeof BackupFileSchema>

const DAY = 86_400_000

/**
 * Whether Home should nudge for a backup (plan §9 "backup reminder"): never backed up once
 * there are 3+ entries, or the last backup is 7+ days old and entries were added after it.
 */
export function backupDue(lastBackupAt: string | undefined, entryTimes: string[], now = Date.now()): 'never' | 'old' | null {
  if (!lastBackupAt) return entryTimes.length >= 3 ? 'never' : null
  const last = Date.parse(lastBackupAt)
  return now - last >= 7 * DAY && entryTimes.some((t) => Date.parse(t) > last) ? 'old' : null
}

/** Whether this account has a Recovery Kit yet, and when it was last exported. */
export async function backupStatus(userId: string): Promise<{ hasCode: boolean; lastBackupAt?: string }> {
  const db = openAccountDb(userId)
  try {
    const meta = await db.meta.get('vault')
    return { hasCode: Boolean(meta?.recovery), lastBackupAt: meta?.lastBackupAt }
  } finally {
    db.close()
  }
}

/** Creates the Recovery Kit: wraps a copy of the DEK with the code (call once the student has saved it). */
export async function saveRecoveryCode(userId: string, code: string): Promise<void> {
  const db = openAccountDb(userId)
  try {
    const meta = await db.meta.get('vault')
    if (!meta) throw new Error('No vault for this account on this device')
    const dek = await unwrapDek(meta.wrappedDek, meta.deviceKey, true) // extractable only for this re-wrap
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const wrapped = await wrapDek(dek, await recoveryKey(code, salt))
    await db.meta.update('vault', { recovery: { salt, ...wrapped } })
  } finally {
    db.close()
  }
}

/** Builds the backup file (needs a Recovery Kit) and records the export time. */
export async function makeBackup(vault: Vault, name: string): Promise<Blob> {
  await vault.put('settings', NAME_ID, { name })
  const db = openAccountDb(vault.userId)
  try {
    const meta = await db.meta.get('vault')
    if (!meta?.recovery) throw new Error('Make your Recovery Kit first.')
    const createdAt = new Date().toISOString()
    const rows = await db.records.toArray()
    const file: BackupFile = {
      app: 'baon',
      kind: 'backup',
      format: 1,
      userId: vault.userId,
      createdAt,
      recovery: { salt: toB64(meta.recovery.salt), iv: toB64(meta.recovery.iv), ciphertext: toB64(meta.recovery.ciphertext) },
      records: rows.map((r) => ({ id: r.id, type: r.type, v: r.v, iv: toB64(r.iv), ciphertext: toB64(r.ciphertext) })),
    }
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
    await db.meta.update('vault', { lastBackupAt: createdAt })
    return blob
  } finally {
    db.close()
  }
}

/** Reads a chosen file; throws a friendly message if it isn't a baon backup. */
export async function readBackupFile(file: Blob): Promise<BackupFile> {
  try {
    return BackupFileSchema.parse(JSON.parse(await file.text()))
  } catch {
    throw new Error('That file isn’t a baon backup. Pick the backup file baon saved — its name starts with “baon-backup”.')
  }
}

/**
 * Replaces this account's records on this phone with the backup's. Everything is checked
 * first (right account, right code, every record opens), so a bad file or code changes nothing.
 * Returns the display name saved in the backup (or `fallbackName`).
 */
export async function restoreBackup(file: BackupFile, code: string, userId: string, fallbackName: string): Promise<string> {
  if (file.userId !== userId) throw new Error('This backup belongs to a different account. Sign in with the account that made it.')
  if (file.records.some((r) => r.v > SCHEMA_VERSION)) throw new Error('This backup is from a newer version of baon. Update the app, then try again.')

  const recovery = { salt: fromB64(file.recovery.salt), iv: fromB64(file.recovery.iv), ciphertext: fromB64(file.recovery.ciphertext).buffer }
  const key = await recoveryKey(code, recovery.salt) // throws its own message for a mistyped code
  let dek: CryptoKey
  try {
    dek = await unwrapDek(recovery, key, true)
  } catch {
    throw new Error('That code doesn’t open this backup. Check it and try again.')
  }

  const rows: StoredRecord[] = file.records.map((r) => ({ id: r.id, type: r.type, v: r.v, iv: fromB64(r.iv), ciphertext: fromB64(r.ciphertext).buffer }))
  let name = fallbackName
  try {
    for (const row of rows) {
      const data = await decryptJson(dek, recordAad(userId, row.id, row.type, row.v), row)
      if (row.id === NAME_ID) name = z.object({ name: z.string().check(z.minLength(1)) }).parse(data).name
    }
  } catch {
    throw new Error('This backup file is damaged and can’t be restored.')
  }

  const deviceKey = await generateDeviceKey()
  const wrappedDek = await wrapDek(dek, deviceKey)
  const db = openAccountDb(userId)
  try {
    // One transaction: if storage fails midway, the phone keeps its old records.
    await db.transaction('rw', db.records, db.meta, async () => {
      await db.records.clear()
      await db.records.bulkAdd(rows)
      await db.meta.put({ key: 'vault', deviceMode: 'my-phone', wrappedDek, deviceKey, schemaVersion: SCHEMA_VERSION, recovery, lastBackupAt: file.createdAt })
    })
    const existing = await deviceDb.accounts.get(userId)
    await deviceDb.accounts.put({ userId, label: name, deviceMode: 'my-phone', enrolledAt: existing?.enrolledAt ?? new Date().toISOString() })
  } catch {
    throw new Error('Couldn’t save on this phone. Check that storage isn’t full, then try again.')
  } finally {
    db.close()
  }
  return name
}
