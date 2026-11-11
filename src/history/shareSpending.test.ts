/*
 * shareSpending.test.ts — The spending picture's numbers: period start, total (expenses minus refunds),
 * same-named items added up, biggest first. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../ledger/ledger.ts'
import { periodStart, spendingSummary } from './shareSpending.ts'

let n = 0
/** A transaction at noon (Manila) on `day`. */
const tx = (kind: Transaction['kind'], pesos: number, day: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++n}`, kind, amountCentavos: pesos * 100, walletId: 'cash', occurredAt: `${day}T12:00:00+08:00`, ...extra })

const today = '2026-11-11' // a Wednesday
const txs = [
  tx('expense', 13, '2026-11-11', { categoryId: 'fare', note: 'Jeep' }),
  tx('expense', 13, '2026-11-11', { categoryId: 'fare', note: 'jeep ' }), // same item, other spelling
  tx('expense', 110, '2026-11-11', { categoryId: 'own-x' }), // no note → category name
  tx('expense', 85, '2026-11-09', { categoryId: 'food', note: 'Lunch' }), // Monday: this week, not today
  tx('refund', 20, '2026-11-11', { categoryId: 'food' }),
  tx('income', 1500, '2026-11-11'), // not spending
  tx('expense', 50, '2026-10-31', { categoryId: 'fun' }), // last month
]

describe('spending picture', () => {
  it('periods start today, on Sunday, or on the 1st', () => {
    expect(periodStart('today', today)).toBe(today)
    expect(periodStart('week', today)).toBe('2026-11-08')
    expect(periodStart('month', today)).toBe('2026-11-01')
  })

  it('today: adds up same-named items, biggest first, refunds lower the total', () => {
    const s = spendingSummary(txs, 'today', today)
    expect(s.count).toBe(3)
    expect(s.total).toBe((13 + 13 + 110 - 20) * 100)
    expect(s.items.map((i) => [i.title, i.amount / 100, i.times])).toEqual([['Other', 110, 1], ['Jeep', 26, 2]])
  })

  it('this week and this month count from their start', () => {
    expect(spendingSummary(txs, 'week', today).total).toBe((13 + 13 + 110 + 85 - 20) * 100)
    expect(spendingSummary(txs, 'month', today).count).toBe(4)
  })
})
