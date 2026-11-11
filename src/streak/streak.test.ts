/*
 * streak.test.ts — Streak rules: on +1, over +1 too, a missed day breaks unless the
 * weekly free pass covers it, no-class days and breaks freeze it, today is never final.
 * Week of Sun Nov 1 – Sat Nov 7 and Sun Nov 8 – Sat Nov 14, 2026; classes Mon–Fri.
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Allowance } from '../budget/allowance.ts'
import type { Transaction } from '../ledger/ledger.ts'
import { mapLevel, streakSummary, type DaySnapshot } from './streak.ts'

const allowance: Allowance = { amountCentavos: 150000, frequency: 'weekly', nextDate: '2026-11-15', countClassDays: true, classWeekdays: [1, 2, 3, 4, 5] }

/** A ₱100-budget class-day snapshot. */
const snap = (date: string, extra: Partial<DaySnapshot> = {}): DaySnapshot => ({ date, dailyBudgetCentavos: 10000, isClassDay: true, ...extra })
/** An expense of `pesos` on `day`. */
const spend = (day: string, pesos: number): Transaction =>
  ({ id: `${day}-${pesos}`, kind: 'expense', amountCentavos: pesos * 100, walletId: 'cash', occurredAt: `${day}T12:00:00+08:00` })

/** Runs the summary for Mon Nov 2 … `today` with ₱100 budgets every class day. */
function run(today: string, txs: Transaction[], opts: { allowance?: Partial<Allowance>; snaps?: DaySnapshot[] } = {}) {
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
  const snapshots = opts.snaps ?? days.filter((d) => d <= today).map((d) => snap(d))
  return streakSummary({ today, snapshots, transactions: txs, allowance: { ...allowance, ...opts.allowance } })
}

const week1 = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => spend(d, 50))

describe('streak', () => {
  it('counts logged on-budget class days; weekends neither add nor break', () => {
    const r = run('2026-11-09', [...week1, spend('2026-11-09', 80)])
    expect([r.current, r.best]).toEqual([6, 6])
    expect(r.days.get('2026-11-07')!.status).toBe('off')
  })

  it('an over-budget day still counts (logging honestly is what matters)', () => {
    const r = run('2026-11-09', [...week1, spend('2026-11-04', 500), spend('2026-11-09', 20)])
    expect(r.days.get('2026-11-04')!.status).toBe('over')
    expect(r.current).toBe(6)
  })

  it('the first missed day of a week uses the free pass; the second breaks it', () => {
    const one = run('2026-11-06', week1.filter((t) => !t.occurredAt.startsWith('2026-11-04')))
    expect([one.days.get('2026-11-04')!.status, one.current, one.passLeft]).toEqual(['pass', 4, false])
    const two = run('2026-11-06', week1.filter((t) => !/2026-11-0[34]/.test(t.occurredAt)))
    expect([two.days.get('2026-11-04')!.status, two.current, two.best]).toEqual(['none', 2, 2])
  })

  it('the free pass comes back on Monday', () => {
    const r = run('2026-11-09', week1.filter((t) => !t.occurredAt.startsWith('2026-11-04')))
    expect(r.passLeft).toBe(true)
  })

  it('today with nothing logged yet is pending, not a break', () => {
    const r = run('2026-11-09', week1)
    expect([r.days.get('2026-11-09')!.status, r.current]).toEqual(['pending', 5])
  })

  it('"No spending today" counts as logged', () => {
    const snaps = [...['2026-11-02', '2026-11-03'].map((d) => snap(d)), snap('2026-11-04', { noSpend: true })]
    expect(run('2026-11-04', week1.slice(0, 2), { snaps }).current).toBe(3)
  })

  it('a "No classes" break freezes the streak, even with nothing logged', () => {
    const r = run('2026-11-12', [...week1, spend('2026-11-12', 30)], { allowance: { breaks: [{ from: '2026-11-09', to: '2026-11-11' }] } })
    expect(r.days.get('2026-11-10')!.status).toBe('break')
    expect([r.current, r.passLeft]).toEqual([6, true])
  })

  it('days logged without a saved budget get the benefit of the doubt', () => {
    expect(run('2026-11-03', [spend('2026-11-02', 999), spend('2026-11-03', 10)], { snaps: [] }).current).toBe(2)
  })

  it('map shades by share of the budget used', () => {
    const r = run('2026-11-05', [spend('2026-11-02', 10), spend('2026-11-03', 50), spend('2026-11-04', 90), spend('2026-11-05', 101)])
    expect(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => mapLevel(r.days.get(d)))).toEqual([1, 2, 3, 'over'])
  })
})

describe('share caption', () => {
  it('names the streak, never an amount', async () => {
    const { shareCaption } = await import('./share.ts')
    expect(shareCaption(12)).toBe('12-day streak on Baon — logging my baon every class day.')
    expect(shareCaption(0)).toContain('Starting my Baon streak')
    expect(shareCaption(5)).not.toMatch(/₱|\d+\.\d\d/)
  })
})
