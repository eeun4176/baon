/*
 * goals.test.ts — Savings goal progress and the weekly pace. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { goalProgress } from './goals.ts'

const today = '2026-11-16'

describe('savings goals', () => {
  it('₱5,000 of ₱20,000, 10 weeks left → 25% and ₱1,500 a week', () => {
    expect(goalProgress(500000, 2000000, '2027-01-25', today)).toEqual({ left: 1500000, percent: 25, perWeek: 150000, late: false })
  })

  it('the weekly amount rounds up to whole pesos, so it is always enough', () => {
    // ₱100 left over 3 weeks (15 days → 3 weeks) = ₱33.33… → ₱34
    expect(goalProgress(0, 10000, '2026-12-01', today).perWeek).toBe(3400)
  })

  it('no date: just what is left; reached: nothing left, 100%', () => {
    expect(goalProgress(100000, 300000, undefined, today)).toEqual({ left: 200000, percent: 33, perWeek: null, late: false })
    expect(goalProgress(350000, 300000, '2027-01-01', today)).toEqual({ left: 0, percent: 100, perWeek: null, late: false })
  })

  it('due this week counts as 1 week; a passed date is late', () => {
    expect(goalProgress(0, 50000, today, today).perWeek).toBe(50000)
    expect(goalProgress(0, 50000, '2026-11-01', today)).toMatchObject({ late: true, perWeek: null })
  })

  it('a negative balance shows 0%', () => {
    expect(goalProgress(-500, 10000, undefined, today).percent).toBe(0)
  })
})
