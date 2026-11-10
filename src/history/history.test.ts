/*
 * history.test.ts — Tests for History grouping, search and chart numbers, using the
 * design's sample week (page 9/19). Run: npm test
 */
import { describe as group, expect, it } from 'vitest'
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import { describe, filterEntries, groupByDay, spentByCategory, spentPerDay, spentThisWeek } from './history.ts'

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'spending', openingCentavos: 0, archived: false },
  { id: 'gcash', name: 'GCash', type: 'spending', openingCentavos: 0, archived: false },
  { id: 'savings', name: 'Savings', type: 'savings', openingCentavos: 0, archived: false },
]

let n = 0
/** Transaction at a Manila day/time. */
const tx = (kind: Transaction['kind'], pesos: number, at: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, kind, amountCentavos: pesos * 100, walletId: 'cash', occurredAt: `${at}:00+08:00`, ...extra,
})

// Design week: Sun Nov 8 allowance + snacks, Mon Nov 9, Tue Nov 10.
const week = [
  tx('income', 1500, '2026-11-08T08:00', { note: 'Weekly allowance' }),
  tx('expense', 135, '2026-11-08T15:00', { categoryId: 'snacks' }),
  tx('expense', 50, '2026-11-09T09:00', { categoryId: 'load', walletId: 'gcash' }),
  tx('expense', 75, '2026-11-09T12:00', { categoryId: 'food' }),
  tx('expense', 15, '2026-11-10T07:10', { categoryId: 'fare', note: 'Jeep' }),
  tx('expense', 80, '2026-11-10T12:20', { categoryId: 'food', note: 'Lunch' }),
  tx('expense', 50, '2026-11-10T13:00', { categoryId: 'school', walletId: 'gcash', note: 'Thesis printing' }),
  tx('expense', 15, '2026-11-10T17:30', { categoryId: 'fare', note: 'Jeep' }),
  tx('transfer', 200, '2026-11-10T18:00', { toWalletId: 'gcash' }),
]

group('groupByDay', () => {
  it('newest day first, with each day\'s spending (₱160, ₱125, ₱135)', () => {
    const days = groupByDay(week)
    expect(days.map((d) => [d.day, d.spent / 100])).toEqual([['2026-11-10', 160], ['2026-11-09', 125], ['2026-11-08', 135]])
    expect(days[0].txs[0].kind).toBe('transfer') // newest entry first within the day
  })
})

group('describe', () => {
  it('reads like the design', () => {
    expect(describe(week[6], wallets)).toEqual({ title: 'Thesis printing', detail: 'School · GCash', amount: '−₱50', tone: 'out' })
    expect(describe(week[0], wallets)).toEqual({ title: 'Weekly allowance', detail: 'Allowance · Cash', amount: '+₱1,500', tone: 'in' })
    expect(describe(week[8], wallets)).toMatchObject({ detail: 'Cash → GCash', tone: 'move' })
  })
})

group('filterEntries', () => {
  it('searches titles, categories and wallets, case-insensitively', () => {
    expect(filterEntries(week, wallets, 'jeep', null)).toHaveLength(2)
    expect(filterEntries(week, wallets, 'GCASH', null)).toHaveLength(3) // load, printing, transfer
    expect(filterEntries(week, wallets, '', 'food')).toHaveLength(2)
    expect(filterEntries(week, wallets, 'lunch', 'fare')).toHaveLength(0)
  })
})

group('charts', () => {
  it('spent per day: last 7 days, oldest first, zero for quiet days', () => {
    const days = spentPerDay(week, '2026-11-10')
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.spent / 100)).toEqual([0, 0, 0, 0, 135, 125, 160])
  })

  it('by category: biggest first (design: Food ₱155, Snacks ₱135, Fare ₱30…)', () => {
    expect(spentByCategory(week, '2026-11-08', '2026-11-10').map((c) => [c.label, c.spent / 100])).toEqual([
      ['Food', 155], ['Snacks', 135], ['Load', 50], ['School', 50], ['Fare', 30],
    ])
  })

  it('spent since Sunday: ₱420 over 3 days = ₱140 a day', () => {
    expect(spentThisWeek(week, '2026-11-10')).toEqual({ since: '2026-11-08', total: 42000, perDay: 14000 })
  })

  it('a refund lowers that day\'s spending; transfers never count', () => {
    const r = [...week, tx('refund', 30, '2026-11-10T19:00', { linkedId: 't6' })]
    expect(spentPerDay(r, '2026-11-10').at(-1)!.spent).toBe(13000)
  })
})
