/*
 * setupAccount.test.ts — Onboarding's final step, end to end through the vault:
 * the design's sample answers must produce the design's Home number. Run: npm test
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { loadAllowance } from '../budget/allowance.ts'
import { safeToSpend } from '../budget/safeToSpend.ts'
import { loadTransactions, loadWallets } from '../ledger/repo.ts'
import { listDeviceAccounts } from '../vault/vault.ts'
import { setupAccount } from './setupAccount.ts'

beforeEach(async () => {
  for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
})

const jasmine = {
  userId: 'user-a',
  name: 'Jasmine',
  allowance: { amountCentavos: 150000, frequency: 'weekly', nextDate: '2026-11-15', countClassDays: true, classWeekdays: [1, 2, 3, 4, 5, 6] },
  cashCentavos: 65000,
  eWallets: [{ id: 'gcash', name: 'GCash', centavos: 40000 }],
} as const

describe('setupAccount', () => {
  it('turns the design\'s onboarding answers into Wed\'s ₱1,050 in wallets', async () => {
    const vault = await setupAccount({ ...jasmine, allowance: { ...jasmine.allowance, classWeekdays: [...jasmine.allowance.classWeekdays] }, eWallets: [...jasmine.eWallets] })
    const wallets = await loadWallets(vault)
    expect(wallets.map((w) => w.name).sort()).toEqual(['Cash', 'GCash', 'Savings'])

    const r = safeToSpend({
      wallets,
      transactions: await loadTransactions(vault),
      allowance: (await loadAllowance(vault))!,
      setAsideCentavos: 0,
      now: new Date('2026-11-11T08:00:00+08:00'),
    })
    expect([r.inWallets, r.budgetDays, r.dailyBudget]).toEqual([105000, 4, 26200]) // ₱1,050 ÷ 4 = ₱262
  })

  it('lists the account on this device under the student\'s name', async () => {
    ;(await setupAccount({ ...jasmine, allowance: { ...jasmine.allowance, classWeekdays: [1] }, eWallets: [] })).lock()
    expect((await listDeviceAccounts()).map((a) => [a.userId, a.label, a.deviceMode])).toEqual([['user-a', 'Jasmine', 'my-phone']])
  })

  it('refuses bad input WITHOUT leaving a half-made vault (so the student can retry)', async () => {
    const bad = { ...jasmine, allowance: { ...jasmine.allowance, classWeekdays: [1], nextDate: 'soon' }, eWallets: [] }
    await expect(setupAccount(bad)).rejects.toThrow()
    await expect(setupAccount({ ...bad, cashCentavos: -5 })).rejects.toThrow()
    expect(await listDeviceAccounts()).toEqual([])

    // Fixing the input and trying again works.
    const vault = await setupAccount({ ...bad, allowance: { ...bad.allowance, nextDate: '2026-11-15' } })
    expect(vault.userId).toBe('user-a')
  })
})
