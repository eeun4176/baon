/*
 * summary.test.ts — The daily summary line on Home's "Today's entries". Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../ledger/ledger.ts'
import { daySummary } from './summary.ts'

const today = '2026-11-16'
const base = { today, spentToday: 13500, leftToday: 1500, isClassDay: true, dailyBudget: 15000 }
const allowance: Transaction = { id: 'a', kind: 'income', source: 'allowance', amountCentavos: 50000, walletId: 'cash', occurredAt: `${today}T07:00:00+08:00` }

describe('daily summary', () => {
  it('spent, against the budget, and money that came in today', () => {
    expect(daySummary(base, [allowance])).toBe('₱135 spent · ₱15 under budget · ₱500 came in')
    expect(daySummary({ ...base, spentToday: 17000, leftToday: -2000 }, [])).toBe('₱170 spent · ₱20 over budget')
    expect(daySummary({ ...base, spentToday: 15000, leftToday: 0 }, [])).toBe('₱150 spent · right on budget')
  })

  it('a day off says so instead of comparing; yesterday’s money in is left out', () => {
    expect(daySummary({ ...base, isClassDay: false, leftToday: 0 }, [{ ...allowance, occurredAt: '2026-11-15T07:00:00+08:00' }])).toBe('₱135 spent · no class today')
  })
})
