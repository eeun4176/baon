/*
 * safeToSpend.test.ts — Scenario table for the safe-to-spend engine
 * (each checked against a hand calculation; 20+ scenarios).
 * Base data is the design's sample student, Jasmine:
 *   Cash ₱650 + GCash ₱400 = ₱1,050, ₱330 set aside → ₱720 ready to spend,
 *   weekly ₱1,500 allowance next Sunday Nov 15, class days Mon–Sat.
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import type { Allowance } from './allowance.ts'
import { safeToSpend } from './safeToSpend.ts'

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'spending', openingCentavos: 65000, archived: false },
  { id: 'gcash', name: 'GCash', type: 'spending', openingCentavos: 40000, archived: false },
  { id: 'savings', name: 'Savings', type: 'savings', openingCentavos: 0, archived: false },
]
const weekly: Allowance = {
  amountCentavos: 150000,
  frequency: 'weekly',
  nextDate: '2026-11-15', // Sunday
  countClassDays: true,
  classWeekdays: [1, 2, 3, 4, 5, 6], // Mon–Sat
}

/** A Manila-time instant, e.g. at('2026-11-10', '08:00'). */
const at = (day: string, time = '08:00') => new Date(`${day}T${time}:00+08:00`)

let n = 0
/** Builds a transaction at a Manila day/time. */
function tx(kind: Transaction['kind'], pesos: number, day: string, extra: Partial<Transaction> = {}): Transaction {
  return {
    id: `t${++n}`, kind, amountCentavos: pesos * 100, walletId: 'cash',
    occurredAt: `${day}T12:00:00+08:00`, ...extra,
  }
}

/** Runs the engine with Jasmine's defaults, overriding only what a scenario changes. */
function run(o: { now: Date; txs?: Transaction[]; allowance?: Partial<Allowance>; setAside?: number }) {
  return safeToSpend({
    wallets,
    transactions: o.txs ?? [],
    allowance: { ...weekly, ...o.allowance },
    setAsideCentavos: o.setAside ?? 33000,
    now: o.now,
  })
}

describe('safe-to-spend: design and plan numbers', () => {
  it('1. Mon Nov 9: ₱720 ÷ 6 class days = ₱120 (worked example)', () => {
    const r = run({ now: at('2026-11-09') })
    expect([r.readyToSpend, r.budgetDays, r.dailyBudget]).toEqual([72000, 6, 12000])
  })

  it('2. Tue Nov 10: ₱720 ÷ 5 = ₱144 (design: Home)', () => {
    expect(run({ now: at('2026-11-10') }).dailyBudget).toBe(14400)
  })

  it('3. Wed Nov 11: ₱720 ÷ 4 = ₱180 (design: How it\'s counted)', () => {
    const r = run({ now: at('2026-11-11') })
    expect([r.inWallets, r.setAside, r.readyToSpend, r.budgetDays, r.dailyBudget]).toEqual([105000, 33000, 72000, 4, 18000])
  })

  it('4. Wed overspend: ₱210 spent of ₱180 → "₱30 over" (design: Over today)', () => {
    const r = run({ now: at('2026-11-11', '19:40'), txs: [tx('expense', 210, '2026-11-11')] })
    expect([r.dailyBudget, r.leftToday]).toEqual([18000, -3000])
  })

  it('5. …and Thursday adjusts: ₱510 ÷ 3 = ₱170 (design: "Tomorrow you can spend ₱170")', () => {
    expect(run({ now: at('2026-11-12'), txs: [tx('expense', 210, '2026-11-11')] }).dailyBudget).toBe(17000)
  })
})

describe('safe-to-spend: everyday cases', () => {
  it('6. Sat Nov 14 (last class day): everything left is for today', () => {
    expect(run({ now: at('2026-11-14') }).dailyBudget).toBe(72000)
  })

  it('6b. "Not yet" on allowance day: what\'s left is split until the day it\'s expected', () => {
    const waiting = (days: string) => run({ now: at('2026-11-15'), allowance: { countClassDays: false, nextDate: days, lateFrom: '2026-11-15' } })
    expect(waiting('2026-11-16').dailyBudget).toBe(72000) // tomorrow: all ₱720 today
    expect(waiting('2026-11-18').dailyBudget).toBe(24000) // in 3 days: ₱720 ÷ 3
    expect(waiting('2026-11-22').dailyBudget).toBe(10200) // in a week: ₱720 ÷ 7, rounded down to whole pesos
    expect(waiting('2026-11-18').allowanceDue).toBe(false) // asks again on the 18th, not today
  })

  it('7. logging an expense lowers "left for today", not today\'s budget', () => {
    const r = run({ now: at('2026-11-10'), txs: [tx('expense', 15, '2026-11-10')] })
    expect([r.dailyBudget, r.spentToday, r.leftToday]).toEqual([14400, 1500, 12900])
  })

  it('8. yesterday\'s spending lowers today\'s budget', () => {
    // ₱720 − ₱160 = ₱560 ÷ 5 = ₱112
    expect(run({ now: at('2026-11-10'), txs: [tx('expense', 160, '2026-11-09')] }).dailyBudget).toBe(11200)
  })

  it('9. a refund today counts as less spending today', () => {
    const r = run({ now: at('2026-11-10'), txs: [tx('expense', 80, '2026-11-10'), tx('refund', 30, '2026-11-10', { linkedId: 't0' })] })
    expect([r.spentToday, r.leftToday]).toEqual([5000, 9400])
  })

  it('10. a transfer Cash → GCash changes nothing', () => {
    const r = run({ now: at('2026-11-10'), txs: [tx('transfer', 200, '2026-11-10', { toWalletId: 'gcash' })] })
    expect([r.inWallets, r.dailyBudget, r.spentToday]).toEqual([105000, 14400, 0])
  })

  it('11. moving ₱100 to savings lowers today\'s budget, but is not spending', () => {
    // (₱720 − ₱100) ÷ 5 = ₱124
    const r = run({ now: at('2026-11-10'), txs: [tx('save', 100, '2026-11-10', { toWalletId: 'savings' })] })
    expect([r.dailyBudget, r.spentToday]).toEqual([12400, 0])
  })

  it('12. rounds DOWN to whole pesos (₱720 ÷ 7 = ₱102.85 → ₱102)', () => {
    const r = run({ now: at('2026-11-08'), allowance: { countClassDays: false } })
    expect([r.budgetDays, r.dailyBudget]).toEqual([7, 10200])
  })

  it('13. class-days mode off counts every day until the allowance', () => {
    expect(run({ now: at('2026-11-10'), allowance: { countClassDays: false } }).budgetDays).toBe(5)
  })
})

describe('safe-to-spend: edge cases', () => {
  it('14. Sunday is not a class day → ₱0 planned, but spending is still allowed', () => {
    const r = run({ now: at('2026-11-08'), txs: [tx('expense', 50, '2026-11-08')] })
    expect([r.isClassDay, r.dailyBudget, r.leftToday, r.budgetDays]).toEqual([false, 0, -5000, 6])
  })

  it('15. spending on a non-class day lowers the next class day\'s budget', () => {
    // (₱720 − ₱60) ÷ 6 = ₱110
    expect(run({ now: at('2026-11-09'), txs: [tx('expense', 60, '2026-11-08')] }).dailyBudget).toBe(11000)
  })

  it('16. allowance day: asks "Did your baon arrive?"', () => {
    const r = run({ now: at('2026-11-15') })
    expect([r.allowanceDue, r.budgetDays]).toEqual([true, 1])
  })

  it('17. allowance date passed and not answered yet: still asks, budget days = 1', () => {
    const r = run({ now: at('2026-11-17'), allowance: { countClassDays: false } })
    expect([r.allowanceDue, r.budgetDays, r.dailyBudget]).toEqual([true, 1, 72000])
  })

  it('18. allowance arrives → next week: (₱720 + ₱1,500) ÷ 6 = ₱370', () => {
    const r = run({
      now: at('2026-11-16'),
      txs: [tx('income', 1500, '2026-11-15')],
      allowance: { nextDate: '2026-11-22' },
    })
    expect([r.allowanceDue, r.budgetDays, r.dailyBudget]).toEqual([false, 6, 37000])
  })

  it('19. allowance arriving mid-day updates today\'s budget right away', () => {
    // Late allowance on Tue; next date already moved to Nov 22. Tue–Sat + Mon–Sat = 11 class days.
    const r = run({
      now: at('2026-11-10', '15:00'),
      txs: [tx('income', 1500, '2026-11-10')],
      allowance: { nextDate: '2026-11-22' },
    })
    expect([r.readyToSpend, r.budgetDays, r.dailyBudget]).toEqual([222000, 11, 20100])
  })

  it('20. set-asides bigger than money: warns and never shows a positive budget', () => {
    const r = run({ now: at('2026-11-10'), setAside: 120000 })
    expect([r.setAsidesExceedMoney, r.readyToSpend, r.dailyBudget]).toEqual([true, -15000, 0])
  })

  it('21. no money at all → ₱0, not an error', () => {
    const r = run({ now: at('2026-11-10'), setAside: 0, txs: [tx('expense', 1050, '2026-11-09')] })
    expect([r.inWallets, r.dailyBudget]).toEqual([0, 0])
  })

  it('22. irregular allowance uses the "Make it last until" date', () => {
    // Tue Nov 10 → last until Fri Nov 20, every day counts: 10 days → ₱72
    const r = run({ now: at('2026-11-10'), allowance: { frequency: 'irregular', nextDate: '2026-11-20', countClassDays: false } })
    expect([r.budgetDays, r.dailyBudget]).toEqual([10, 7200])
  })

  it('23. no class days left before the allowance → minimum 1 day, ₱0 today', () => {
    const r = run({ now: at('2026-11-14'), allowance: { classWeekdays: [1, 2, 3, 4, 5] } }) // Saturday, Mon–Fri classes
    expect([r.isClassDay, r.budgetDays, r.dailyBudget]).toEqual([false, 1, 0])
  })

  it('24. uses Manila midnight, not the phone\'s time zone (00:30 Manila = 16:30 UTC)', () => {
    const r = run({ now: new Date('2026-11-10T16:30:00Z') }) // Wed 00:30 in Manila
    expect([r.today, r.dailyBudget]).toEqual(['2026-11-11', 18000])
  })

  it('25. an expense at 11:30 PM belongs to that day, not the next', () => {
    const late = { ...tx('expense', 100, '2026-11-10'), occurredAt: '2026-11-10T23:30:00+08:00' }
    expect(run({ now: at('2026-11-11'), txs: [late] }).spentToday).toBe(0)
    expect(run({ now: at('2026-11-10', '23:45'), txs: [late] }).spentToday).toBe(10000)
  })

  it('26. a no-classes break counts every day, so a break Saturday gets a budget', () => {
    const allowance = { classWeekdays: [1, 2, 3, 4, 5], breaks: [{ from: '2026-11-13', to: '2026-11-14' }] }
    const wed = run({ now: at('2026-11-11'), allowance }) // We Th Fr + break Sa
    expect([wed.budgetDays, wed.dailyBudget]).toEqual([4, 18000])
    expect(run({ now: at('2026-11-14'), allowance }).isClassDay).toBe(true)
  })
})
