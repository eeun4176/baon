/*
 * streak.test.ts — Streak rules: on +1, over +1 too, a missed day breaks unless the
 * saved free pass covers it (+1 every Monday), no-class days and breaks freeze it, today is never final.
 * Week of Sun Nov 1 – Sat Nov 7 and Sun Nov 8 – Sat Nov 14, 2026; classes Mon–Fri.
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Allowance } from '../budget/allowance.ts'
import { addDays, weekday } from '../budget/days.ts'
import type { Transaction } from '../ledger/ledger.ts'
import { mapLevel, passesFor, streakSummary, type DaySnapshot } from './streak.ts'

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
    expect([one.days.get('2026-11-04')!.status, one.current, one.passLeft]).toEqual(['pass', 4, 0])
    const two = run('2026-11-06', week1.filter((t) => !/2026-11-0[34]/.test(t.occurredAt)))
    expect([two.days.get('2026-11-04')!.status, two.current, two.best]).toEqual(['none', 2, 2])
  })

  it('the free pass comes back on Monday', () => {
    const r = run('2026-11-09', week1.filter((t) => !t.occurredAt.startsWith('2026-11-04')))
    expect(r.passLeft).toBe(1)
  })

  it('passes are saved, +1 every Monday: up to 3 at a 10+ day streak, 5 at 100+', () => {
    expect([0, 9, 10, 99, 100].map(passesFor)).toEqual([1, 1, 3, 3, 5])
    // Four class weeks logged (Nov 2–27, 20 days). The streak reaches 10 on Fri Nov 13,
    // so Mondays Nov 16 and 23 save a 2nd and 3rd pass; Mon Nov 30 is lost (already full).
    const month: string[] = []
    for (let d = '2026-11-02'; d <= '2026-11-27'; d = addDays(d, 1)) if (weekday(d) >= 1 && weekday(d) <= 5) month.push(d)
    const at = (today: string, extra: string[]) =>
      streakSummary({ today, snapshots: [], transactions: [...month, ...extra].map((d) => spend(d, 50)), allowance })

    expect(at('2026-11-30', ['2026-11-30']).passLeft).toBe(3)
    // Mon–Wed missed: all three saved passes cover them; Thu logged → 21, none left.
    const saved = at('2026-12-03', ['2026-12-03'])
    expect([saved.days.get('2026-12-02')!.status, saved.current, saved.passLeft]).toEqual(['pass', 21, 0])
    // They come back one a week, not three.
    expect(at('2026-12-07', ['2026-12-03', '2026-12-04', '2026-12-07']).passLeft).toBe(1)
    // A fourth missed day (Thu) has no pass left: the streak breaks.
    const broke = at('2026-12-04', ['2026-12-04'])
    expect([broke.days.get('2026-12-03')!.status, broke.current, broke.best]).toEqual(['none', 1, 20])
  })

  it('today with nothing logged yet is pending, not a break', () => {
    const r = run('2026-11-09', week1)
    expect([r.days.get('2026-11-09')!.status, r.current, r.pending]).toEqual(['pending', 5, true])
    expect(run('2026-11-06', week1).pending).toBe(false) // logged today
  })

  it('"No spending today" counts as logged', () => {
    const snaps = [...['2026-11-02', '2026-11-03'].map((d) => snap(d)), snap('2026-11-04', { noSpend: true })]
    expect(run('2026-11-04', week1.slice(0, 2), { snaps }).current).toBe(3)
  })

  it('a "No classes" break freezes the streak, even with nothing logged', () => {
    const r = run('2026-11-12', [...week1, spend('2026-11-12', 30)], { allowance: { breaks: [{ from: '2026-11-09', to: '2026-11-11' }] } })
    expect(r.days.get('2026-11-10')!.status).toBe('break')
    expect([r.current, r.passLeft]).toEqual([6, 1])
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
