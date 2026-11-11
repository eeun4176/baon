/*
 * limits.test.ts — Category limits count one allowance cycle (from the latest allowance entry). Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../ledger/ledger.ts'
import { cycleStart, limitStatuses, spentThisCycle } from './limits.ts'

let n = 0
/** A transaction at noon (Manila) on `day`. */
const tx = (kind: Transaction['kind'], pesos: number, day: string, categoryId?: string): Transaction =>
  ({ id: `t${++n}`, kind, amountCentavos: pesos * 100, walletId: 'cash', occurredAt: `${day}T12:00:00+08:00`, ...(categoryId ? { categoryId } : {}) })

const history = [
  tx('expense', 90, '2026-11-08', 'snacks'), // last cycle: not counted
  tx('income', 1500, '2026-11-09'), // allowance came Monday → cycle starts
  tx('expense', 60, '2026-11-09', 'snacks'),
  tx('expense', 110, '2026-11-11', 'snacks'),
  tx('refund', 20, '2026-11-11', 'snacks'),
  tx('expense', 45, '2026-11-10', 'fare'),
  tx('transfer', 100, '2026-11-10'),
]

describe('category limits', () => {
  it('the cycle starts the day the latest allowance came in', () => {
    expect(cycleStart(history)).toBe('2026-11-09')
    expect(cycleStart([tx('expense', 5, '2026-11-01', 'food')])).toBeNull()
  })

  it('counts this cycle only: expenses minus refunds', () => {
    const spent = spentThisCycle(history)
    expect(spent.get('snacks')).toBe(15000) // 60 + 110 − 20
    expect(spent.get('fare')).toBe(4500)
    expect(spentThisCycle(history, history[3].id).get('snacks')).toBe(4000) // editing the ₱110 entry
  })

  it('before any allowance entry, everything counts', () => {
    expect(spentThisCycle([tx('expense', 30, '2026-11-01', 'food')]).get('food')).toBe(3000)
  })

  it('ok under 80%, close from 80%, over above the limit — most urgent first', () => {
    const s = limitStatuses({ fare: 20000, snacks: 18000, food: 10000 }, [...history, tx('expense', 120, '2026-11-11', 'food')])
    expect(s.map((x) => [x.categoryId, x.level, x.left])).toEqual([
      ['food', 'over', -2000],
      ['snacks', 'close', 3000],
      ['fare', 'ok', 15500],
    ])
  })
})
