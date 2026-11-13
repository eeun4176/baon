/*
 * demo.test.ts — The dev-only demo data passes the app's own checks, and "clear" removes exactly
 * what "add" added (the student's own entries and days stay). Run: npm test
 */
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import type { Allowance } from '../budget/allowance.ts'
import { addDays, manilaDate } from '../budget/days.ts'
import { loadTransactions, saveTransaction, saveWallet } from '../ledger/repo.ts'
import { owedTotal } from '../ledger/utang.ts'
import { loadSnapshots, saveSnapshot } from '../streak/streak.ts'
import { createVault } from '../vault/vault.ts'
import { runDemo } from './demo.ts'

const allowance: Allowance = { amountCentavos: 150000, frequency: 'weekly', nextDate: addDays(manilaDate(), 5), countClassDays: true, classWeekdays: [1, 2, 3, 4, 5] }

describe('dev demo data', () => {
  it('adds valid sample data once, and clear leaves the student\'s own records alone', async () => {
    for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
    const vault = await createVault('demo-user', 'Ana')
    const cash = { id: 'cash', name: 'Cash', type: 'spending' as const, openingCentavos: 50000, archived: false }
    await saveWallet(vault, cash)
    const mine = { id: 'mine', kind: 'expense' as const, amountCentavos: 1500, walletId: 'cash', categoryId: 'fare', occurredAt: new Date().toISOString() }
    await saveTransaction(vault, mine, [cash])
    const ownDay = addDays(manilaDate(), -1)
    await saveSnapshot(vault, { date: ownDay, dailyBudgetCentavos: 9900, isClassDay: true })

    expect(await runDemo(vault, allowance, 'add')).toMatch(/added/)
    expect(await runDemo(vault, allowance, 'add')).toMatch(/already/)
    const txs = await loadTransactions(vault)
    expect(txs.some((t) => t.id === 'demo-scholarship')).toBe(true)
    expect(owedTotal(txs)).toBe(15000) // borrowed ₱200 from Rei, ₱50 paid back

    expect(await runDemo(vault, allowance, 'clear')).toMatch(/removed/)
    expect((await loadTransactions(vault)).map((t) => t.id)).toEqual(['mine'])
    expect((await loadSnapshots(vault)).map((s) => [s.date, s.dailyBudgetCentavos])).toEqual([[ownDay, 9900]]) // own day kept as it was
    vault.lock()
  })
})
