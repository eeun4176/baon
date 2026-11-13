/*
 * savings.test.ts — Ipon outlook (from logged class days) and tipid tip picking. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Allowance } from '../budget/allowance.ts'
import { addDays } from '../budget/days.ts'
import type { Transaction } from '../ledger/ledger.ts'
import type { Day } from '../streak/streak.ts'
import { iponOutlook, MIN_DAYS, pickTip, TIPS } from './savings.ts'

const monFri: Allowance = { amountCentavos: 150000, frequency: 'weekly', nextDate: '2026-11-22', countClassDays: true, classWeekdays: [1, 2, 3, 4, 5] }
const today = '2026-11-16' // Monday

/** `n` past class days before today, each with this budget and spending. */
function days(n: number, budget: number, spent: number, status: Day['status'] = 'on'): Map<string, Day> {
  return new Map(Array.from({ length: n }, (_, i) => [addDays(today, -1 - i), { status, budget, spent }]))
}

describe('ipon outlook', () => {
  it('needs 5 logged class days before it estimates anything', () => {
    expect(iponOutlook(days(MIN_DAYS - 1, 12000, 10000), monFri, today)).toMatchObject({ count: 4 })
  })

  it('₱20 left each day × the class days in the next 30 days', () => {
    const o = iponOutlook(days(10, 12000, 10000), monFri, today)
    // Nov 16 – Dec 15, Mon–Fri: 22 class days
    expect([o.count, o.perDay, o.daysPerMonth, o.perMonth, o.sixMonths]).toEqual([10, 2000, 22, 44000, 264000])
  })

  it('over budget on average → a negative pace; days off, empty days and old days are left out', () => {
    const mix = days(6, 10000, 13000, 'over')
    mix.set(addDays(today, -40), { status: 'on', budget: 50000, spent: 0 }) // older than 4 weeks
    mix.set(addDays(today, -8), { status: 'off', budget: 0, spent: 0 })
    mix.set(addDays(today, -9), { status: 'on', budget: undefined, spent: 0 }) // no saved budget
    expect(iponOutlook(mix, monFri, today)).toMatchObject({ count: 6, perDay: -3000, over: true })
  })

  it('exactly on budget, or under ₱1 a day left, is not "over" even though perDay is ₱0', () => {
    expect(iponOutlook(days(10, 15000, 15000), monFri, today)).toMatchObject({ perDay: 0, over: false })
    expect(iponOutlook(days(10, 15000, 14950), monFri, today)).toMatchObject({ perDay: 0, over: false }) // ₱0.50 left a day
    expect(iponOutlook(days(10, 15000, 15050, 'over'), monFri, today)).toMatchObject({ over: true }) // ₱0.50 over a day (perDay is -0 there; never shown)
  })
})

describe('tipid tips', () => {
  const food = (day: string): Transaction => ({ id: day, kind: 'expense', amountCentavos: 9000, walletId: 'cash', categoryId: 'food', occurredAt: `${day}T12:00:00+08:00` })
  const foodTips = TIPS.filter((t) => t.category === 'food').map((t) => t.text)
  const general = TIPS.filter((t) => !t.category).map((t) => t.text)

  it('picks a tip for the top category of the last 7 days', () => {
    expect(foodTips).toContain(pickTip([food('2026-11-14')], today))
  })

  it('changes by day and with "Another tip"', () => {
    const txs = [food('2026-11-14')]
    expect(pickTip(txs, today, 1)).not.toBe(pickTip(txs, today))
    expect(pickTip(txs, '2026-11-17')).toBe(pickTip(txs, today, 1))
  })

  it('general tips when nothing was spent this week', () => {
    expect(general).toContain(pickTip([food('2026-11-01')], today))
  })
})
