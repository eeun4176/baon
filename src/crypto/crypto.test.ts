/*
 * crypto.test.ts — Unit tests for crypto.ts (security and isolation).
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { decryptJson, encryptJson, generateDek, generateDeviceKey, recordAad, unwrapDek, wrapDek } from './crypto.ts'

const aad = recordAad('user-a', 'rec-1', 'transaction', 1)

describe('record encryption', () => {
  it('decrypts back to exactly what was encrypted', async () => {
    const dek = await generateDek()
    const data = { amountCentavos: 1550, note: 'Jeep ₱15.50', date: '2026-11-10' }
    expect(await decryptJson(dek, aad, await encryptJson(dek, aad, data))).toEqual(data)
  })

  it('uses a fresh IV every time (same data → different ciphertext)', async () => {
    const dek = await generateDek()
    const a = await encryptJson(dek, aad, 'same')
    const b = await encryptJson(dek, aad, 'same')
    expect(a.iv).not.toEqual(b.iv)
    expect(new Uint8Array(a.ciphertext)).not.toEqual(new Uint8Array(b.ciphertext))
  })

  it('fails if one byte of ciphertext is tampered with', async () => {
    const dek = await generateDek()
    const sealed = await encryptJson(dek, aad, { amountCentavos: 1500 })
    const bytes = new Uint8Array(sealed.ciphertext)
    bytes[0] ^= 1
    await expect(decryptJson(dek, aad, { iv: sealed.iv, ciphertext: bytes.buffer })).rejects.toThrow()
  })

  it('fails if the record is moved to another account, id, or type (AAD)', async () => {
    const dek = await generateDek()
    const sealed = await encryptJson(dek, aad, { amountCentavos: 1500 })
    for (const wrong of [
      recordAad('user-b', 'rec-1', 'transaction', 1),
      recordAad('user-a', 'rec-2', 'transaction', 1),
      recordAad('user-a', 'rec-1', 'wallet', 1),
    ]) {
      await expect(decryptJson(dek, wrong, sealed)).rejects.toThrow()
    }
  })

  it('fails with another account\'s key', async () => {
    const sealed = await encryptJson(await generateDek(), aad, 'secret')
    await expect(decryptJson(await generateDek(), aad, sealed)).rejects.toThrow()
  })
})

describe('DEK wrapping', () => {
  it('unwrapped DEK can read data written with the original', async () => {
    const dek = await generateDek()
    const deviceKey = await generateDeviceKey()
    const sealed = await encryptJson(dek, aad, 'hello')
    const restored = await unwrapDek(await wrapDek(dek, deviceKey), deviceKey)
    expect(await decryptJson(restored, aad, sealed)).toBe('hello')
  })

  it('cannot unwrap with a different device key', async () => {
    const wrapped = await wrapDek(await generateDek(), await generateDeviceKey())
    await expect(unwrapDek(wrapped, await generateDeviceKey())).rejects.toThrow()
  })

  it('device key and daily-use DEK cannot be exported as raw bytes', async () => {
    const deviceKey = await generateDeviceKey()
    const dailyDek = await unwrapDek(await wrapDek(await generateDek(), deviceKey), deviceKey)
    await expect(crypto.subtle.exportKey('raw', deviceKey)).rejects.toThrow()
    await expect(crypto.subtle.exportKey('raw', dailyDek)).rejects.toThrow()
  })
})
