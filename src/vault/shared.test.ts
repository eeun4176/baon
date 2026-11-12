/*
 * shared.test.ts — Shared phone mode (vault.ts): the passphrase is the only way in, nothing that
 * opens the records is left on the phone, changing/turning it off works, "Forgot?" with the
 * Recovery Kit (or the account key) keeps every record, and an in-app restore stays locked.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { keyFromRecoveryCode, makeBackup, newRecoveryCode, readBackupFile, restoreBackup, saveRecoveryCode } from '../backup/backup.ts'
import { generateDek } from '../crypto/crypto.ts'
import { deviceDb, openAccountDb } from '../db/db.ts'
import { passphraseProblem } from '../lock/passphrase.ts'
import { createVault, openVault, PassphraseNeeded, resetPassphrase, WrongPassphrase } from './vault.ts'

const PASS = 'jeep ako every morning'

/** A fresh phone with one account (a record in it) switched to Shared phone mode. */
async function sharedPhone() {
  for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
  const vault = await createVault('user-a', 'Jasmine')
  await vault.put('transaction', 't1', { amountCentavos: 1500, note: 'Jeep' })
  await vault.protect(PASS)
  return vault
}

describe('shared phone mode', { timeout: 30_000 }, () => { // each passphrase check is slow on purpose (PBKDF2)
  beforeEach(async () => {
    for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
  })

  it('opens only with the passphrase, and keeps no key that could open it without one', async () => {
    const vault = await sharedPhone()
    expect(vault.shared()).toBe(true)
    await vault.put('transaction', 't2', { amountCentavos: 900 }) // still works right after switching
    vault.lock()

    const db = openAccountDb('user-a')
    const meta = (await db.meta.get('vault'))!
    db.close()
    expect(meta.deviceMode).toBe('shared')
    expect(meta.deviceKey).toBeUndefined()
    expect(JSON.stringify(meta)).not.toContain(PASS)
    expect((await deviceDb.accounts.get('user-a'))?.deviceMode).toBe('shared')

    await expect(openVault('user-a')).rejects.toBeInstanceOf(PassphraseNeeded)
    await expect(openVault('user-a', 'jeep ako every mornin')).rejects.toBeInstanceOf(WrongPassphrase)
    const open = await openVault('user-a', PASS)
    expect(await open.get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
    expect(await open.get('t2')).toEqual({ amountCentavos: 900 })
    open.lock()
  })

  it('changes the passphrase, then turns back into My phone mode', async () => {
    const vault = await sharedPhone()
    expect(await vault.checkPassphrase(PASS)).toBe(true)
    expect(await vault.checkPassphrase('wrong one')).toBe(false)
    await vault.protect('bagong passphrase ko')
    vault.lock()
    await expect(openVault('user-a', PASS)).rejects.toBeInstanceOf(WrongPassphrase)

    const again = await openVault('user-a', 'bagong passphrase ko')
    await again.protect(null)
    expect(again.shared()).toBe(false)
    again.lock()
    expect(await (await openVault('user-a')).get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
  })

  it('forgot it: the Recovery Kit code sets a new passphrase and keeps the records; a stranger key does not', async () => {
    const vault = await sharedPhone()
    const code = newRecoveryCode()
    await saveRecoveryCode(vault, code)
    vault.lock()

    await expect(keyFromRecoveryCode('user-a', newRecoveryCode())).rejects.toThrow('isn’t right')
    await expect(resetPassphrase('user-a', await generateDek(), 'something new')).rejects.toBeInstanceOf(WrongPassphrase)
    const reset = await resetPassphrase('user-a', await keyFromRecoveryCode('user-a', code), 'something new')
    expect(await reset.get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
    reset.lock()
    await expect(openVault('user-a', PASS)).rejects.toBeInstanceOf(WrongPassphrase)
    ;(await openVault('user-a', 'something new')).lock()
  })

  it('restoring a backup from inside the app keeps the passphrase', async () => {
    const vault = await sharedPhone()
    const code = newRecoveryCode()
    await saveRecoveryCode(vault, code)
    const file = await readBackupFile(await makeBackup(vault, 'Jasmine'))
    await restoreBackup(file, code, 'user-a', 'Jasmine', vault)
    vault.lock()
    await expect(openVault('user-a')).rejects.toBeInstanceOf(PassphraseNeeded)
    expect(await (await openVault('user-a', PASS)).get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
  })

  it('asks for at least 8 characters, typed the same twice', () => {
    expect(passphraseProblem('maikli', 'maikli')).toMatch('at least 8')
    expect(passphraseProblem('jeep ako', 'jeep ak0')).toMatch('don’t match')
    expect(passphraseProblem('jeep ako', 'jeep ako')).toBeNull()
  })
})
