/*
 * crypto.ts — Baon's only encryption code. Thin wrapper over the
 * browser's built-in Web Crypto API; no custom crypto, no extra libraries.
 *
 * Key ideas:
 * - Each account has one random DEK (data encryption key, AES-256-GCM).
 *   Every record is encrypted with it.
 * - On the phone the DEK is never stored as-is. It is "wrapped" (encrypted) by another key:
 *   the device key in My phone mode, the student's passphrase in Shared phone mode,
 *   or the Recovery Kit code inside backups.
 *   Sync keeps a plain copy with the account online, so any signed-in device can open
 *   the records (sync/sync.ts).
 * - Each record is bound to its owner and identity through AAD (extra data the
 *   cipher authenticates). A record copied to another account or renamed fails to open.
 */

const AES = { name: 'AES-GCM', length: 256 } as const
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** An encrypted value: the random IV used plus the ciphertext bytes. */
export interface Sealed {
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
}

/** Fresh random 96-bit IV. AES-GCM must never reuse an IV with the same key. */
function randomIv(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(12))
}

/**
 * Creates a new account DEK. It must be extractable so it can be wrapped
 * for storage; after unwrapping for daily use it is non-extractable (see unwrapDek).
 */
export function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES, true, ['encrypt', 'decrypt'])
}

/**
 * Creates the My-phone-mode device key. Non-extractable: JavaScript (including
 * injected scripts) can use it but can never read its raw bytes.
 */
export function generateDeviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES, false, ['wrapKey', 'unwrapKey'])
}

// PBKDF2 is the only slow password hash built into browsers; 600,000 rounds (OWASP 2023) makes
// every wrong guess slow. Known limit: no Argon2 without a library; revisit if Web Crypto gets one.
export const PASSPHRASE_ROUNDS = 600_000

/** Shared-phone-mode wrapping key from the passphrase (+ a random salt saved next to it). Non-extractable. */
export async function passphraseKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, rounds = PASSPHRASE_ROUNDS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base, AES, false, ['wrapKey', 'unwrapKey'])
}

/** Encrypts (wraps) the DEK with a wrapping key so it can be stored safely. */
export async function wrapDek(dek: CryptoKey, wrappingKey: CryptoKey): Promise<Sealed> {
  const iv = randomIv()
  const ciphertext = await crypto.subtle.wrapKey('raw', dek, wrappingKey, { name: 'AES-GCM', iv })
  return { iv, ciphertext }
}

/**
 * Decrypts (unwraps) a stored DEK. Default is non-extractable for daily use;
 * pass extractable=true only when re-wrapping it (e.g. switching device mode).
 * Throws if the wrapping key is wrong or the stored bytes were changed.
 */
export function unwrapDek(wrapped: Sealed, wrappingKey: CryptoKey, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped.ciphertext,
    wrappingKey,
    { name: 'AES-GCM', iv: wrapped.iv },
    AES,
    extractable,
    ['encrypt', 'decrypt'],
  )
}

/** The DEK's raw bytes (for sync). Needs an extractable DEK. */
export async function exportDek(dek: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', dek))
}

/** A DEK from raw bytes (the account's key from sync). Extractable, so it can be wrapped for storage. */
export function importDek(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, AES, true, ['encrypt', 'decrypt'])
}

/** Builds the AAD string that ties a record to its account, id, type and schema version. */
export function recordAad(userId: string, recordId: string, type: string, version: number): string {
  return `${userId}|${recordId}|${type}|${version}`
}

/** Encrypts any JSON-safe value (amounts, notes, dates…) with the DEK. */
export async function encryptJson(dek: CryptoKey, aad: string, data: unknown): Promise<Sealed> {
  const iv = randomIv()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
    dek,
    encoder.encode(JSON.stringify(data)),
  )
  return { iv, ciphertext }
}

/**
 * Decrypts a value made by encryptJson. Throws if the key or AAD is wrong
 * or if a single byte was tampered with. Callers validate the result's shape (Zod).
 */
export async function decryptJson(dek: CryptoKey, aad: string, sealed: Sealed): Promise<unknown> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv, additionalData: encoder.encode(aad) },
    dek,
    sealed.ciphertext,
  )
  return JSON.parse(decoder.decode(plaintext))
}
