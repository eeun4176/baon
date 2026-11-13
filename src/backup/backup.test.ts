/*
 * backup.test.ts — Export → wipe the phone → import gives back every record exactly
 *, and a wrong code, another account or a damaged file changes nothing.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createVault, listDeviceAccounts, openVault, type Vault } from '../vault/vault.ts'
import { backupDue, backupStatus, makeBackup, newRecoveryCode, normalizeCode, readBackupFile, restoreBackup, saveRecoveryCode, type BackupFile } from './backup.ts'

/** Wipes every IndexedDB database ("clear site data"). */
async function wipePhone() {
  for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
}

/** An account with a few records and a Recovery Kit; returns the vault, code and parsed backup. */
async function exported(): Promise<{ vault: Vault; code: string; file: BackupFile }> {
  const vault = await createVault('user-a', 'Jasmine')
  await vault.put('transaction', 't1', { amountCentavos: 1500, note: 'Jeep' })
  await vault.put('day', 'day-2026-11-10', { date: '2026-11-10', dailyBudgetCentavos: 15000, isClassDay: true })
  const code = newRecoveryCode()
  await saveRecoveryCode(vault, code)
  const file = await readBackupFile(await makeBackup(vault, 'Jas'))
  return { vault, code, file }
}

describe('backup', () => {
  beforeEach(wipePhone)

  it('makes 5 groups of 4, still takes older 32-character codes, and forgives case, spaces and look-alike letters', () => {
    const code = newRecoveryCode()
    expect(code).toMatch(/^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$/)
    expect(normalizeCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code.replace(/-/g, ''))
    expect(normalizeCode('O'.repeat(32))).toBe('0'.repeat(32))
    expect(normalizeCode('ABCD')).toBeNull()
    expect(normalizeCode('A'.repeat(24))).toBeNull()
  })

  it('restores every record exactly after the phone is wiped', async () => {
    const { vault, code, file } = await exported()
    vault.lock()
    await wipePhone()

    expect(await restoreBackup(file, code, 'user-a', 'Fallback')).toBe('Jas')
    const back = await openVault('user-a')
    expect(await back.get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
    expect(await back.list('day')).toEqual([{ date: '2026-11-10', dailyBudgetCentavos: 15000, isClassDay: true }])
    expect((await listDeviceAccounts()).map((a) => a.label)).toEqual(['Jas'])
    expect(await backupStatus('user-a')).toEqual({ hasCode: true, lastBackupAt: file.createdAt })
    // The same code still works for the next export.
    const again = await readBackupFile(await makeBackup(back, 'Jas'))
    await expect(restoreBackup(again, code, 'user-a', 'x')).resolves.toBe('Jas')
    back.lock()
  })

  it('replaces records already on the phone', async () => {
    const { vault, code, file } = await exported()
    await vault.put('transaction', 't2', { amountCentavos: 999 })
    vault.lock()

    await restoreBackup(file, code, 'user-a', 'x')
    const back = await openVault('user-a')
    expect(await back.get('t2')).toBeUndefined()
    expect(await back.get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
    back.lock()
  })

  it('refuses a wrong code, another account and a damaged file without touching the phone', async () => {
    const { vault, code, file } = await exported()
    vault.lock()

    await expect(restoreBackup(file, newRecoveryCode(), 'user-a', 'x')).rejects.toThrow('doesn’t open')
    await expect(restoreBackup(file, 'nope', 'user-a', 'x')).rejects.toThrow('isn’t a recovery code')
    await expect(restoreBackup(file, code, 'user-b', 'x')).rejects.toThrow('different account')
    const damaged = { ...file, records: file.records.map((r) => ({ ...r, ciphertext: r.ciphertext.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')) })) }
    await expect(restoreBackup(damaged, code, 'user-a', 'x')).rejects.toThrow('damaged')
    await expect(readBackupFile(new Blob(['{"hello":1}']))).rejects.toThrow('isn’t a Baon backup')

    const still = await openVault('user-a')
    expect(await still.get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
    still.lock()
  })

  it('a new code opens new backups; old backups still need the old code', async () => {
    const { vault, code, file: old } = await exported()
    const fresh = newRecoveryCode()
    await saveRecoveryCode(vault, fresh)
    const file = await readBackupFile(await makeBackup(vault, 'Jas'))
    vault.lock()
    await expect(restoreBackup(file, code, 'user-a', 'x')).rejects.toThrow('doesn’t open')
    await expect(restoreBackup(old, fresh, 'user-a', 'x')).rejects.toThrow('doesn’t open')
    await expect(restoreBackup(file, fresh, 'user-a', 'x')).resolves.toBe('Jas')
    await expect(restoreBackup(old, code, 'user-a', 'x')).resolves.toBe('Jas')
  })

  it('reminds only when a backup is missing or old with newer entries', () => {
    const now = Date.parse('2026-11-20T12:00:00+08:00')
    const entries = ['2026-11-01T08:00:00+08:00', '2026-11-02T08:00:00+08:00']
    expect(backupDue(undefined, entries, now)).toBeNull() // too new to nag
    expect(backupDue(undefined, [...entries, '2026-11-03T08:00:00+08:00'], now)).toBe('never')
    expect(backupDue('2026-11-10T12:00:00+08:00', entries, now)).toBeNull() // nothing new since
    expect(backupDue('2026-11-10T12:00:00+08:00', [...entries, '2026-11-12T08:00:00+08:00'], now)).toBe('old')
    expect(backupDue('2026-11-15T12:00:00+08:00', [...entries, '2026-11-16T08:00:00+08:00'], now)).toBeNull() // under a week
  })

  it('needs a Recovery Kit before exporting', async () => {
    const vault = await createVault('user-a', 'Jasmine')
    await expect(makeBackup(vault, 'Jasmine')).rejects.toThrow('Recovery Kit')
    expect(await backupStatus('user-a')).toEqual({ hasCode: false, lastBackupAt: undefined })
    vault.lock()
  })
})
