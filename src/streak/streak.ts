/*
 * streak.ts — Day snapshots and the logging streak. Logging honestly is what
 * counts, even over budget:
 *
 *   on      class day, something logged (or "No spending today"), spent ≤ that day's budget → +1
 *   over    class day, logged, spent > budget → +1 too (shown dark on the map)
 *   none    class day, nothing logged        → breaks, unless this week's free pass covers it
 *   pass    a "none" day covered by a saved free pass, used automatically. +1 pass every Monday;
 *           unused ones are kept, up to 1, then 3 at a 10+ day streak, then 5 at 100+
 *   off     not a class day                  → neither adds nor breaks
 *   break   inside a "No classes" break      → frozen: neither adds nor breaks
 *   pending today, nothing logged yet        → the day isn't over, so no effect
 *
 * A day's budget is stored in a snapshot when the app is open that day, so editing an
 * old expense re-checks the day against ITS budget instead of today's.
 */
import * as z from 'zod/mini'
import { breakOn, type Allowance } from '../budget/allowance.ts'
import { addDays, manilaDate, weekday } from '../budget/days.ts'
import { counts } from '../budget/safeToSpend.ts'
import type { Transaction } from '../ledger/ledger.ts'
import type { Vault } from '../vault/vault.ts'

export const DaySnapshotSchema = z.object({
  date: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)), // Manila day
  dailyBudgetCentavos: z.int().check(z.minimum(0)),
  isClassDay: z.boolean(),
  noSpend: z.optional(z.boolean()), // "No spending today" tapped
})
export type DaySnapshot = z.infer<typeof DaySnapshotSchema>
export type DayStatus = 'on' | 'over' | 'none' | 'pass' | 'off' | 'break' | 'pending'

export interface Day {
  status: DayStatus
  spent: number // expenses − refunds that day (centavos)
  budget: number | undefined // that day's saved budget, if the app was open that day
}

export interface Streak {
  current: number
  best: number
  passLeft: number // free passes saved right now
  pending: boolean // today is a class day with nothing logged yet (the flame stays gray until it is)
  days: Map<string, Day> // every day from the first record to today
}

/** Most free passes a streak of `streak` days can keep saved: longer streaks can save more. */
export const passesFor = (streak: number) => (streak >= 100 ? 5 : streak >= 10 ? 3 : 1)

/** Walks every day from the first record to today and applies the rules above. */
export function streakSummary(input: { today: string; snapshots: DaySnapshot[]; transactions: Transaction[]; allowance: Allowance }): Streak {
  const { today, allowance } = input
  const snaps = new Map(input.snapshots.map((s) => [s.date, s]))
  const logged = new Map<string, number>() // day → net spending (present = something was logged)
  for (const tx of input.transactions) {
    const day = manilaDate(tx.occurredAt)
    const delta = tx.kind === 'expense' ? tx.amountCentavos : tx.kind === 'refund' ? -tx.amountCentavos : 0
    logged.set(day, (logged.get(day) ?? 0) + delta)
  }

  const firsts = [...snaps.keys(), ...logged.keys()].sort()
  const start = firsts[0] && firsts[0] < today ? firsts[0] : today
  const days = new Map<string, Day>()
  let passes = 1 // saved free passes; everyone starts with one
  let current = 0
  let best = 0

  for (let d = start; d <= today; d = addDays(d, 1)) {
    const snap = snaps.get(d)
    const spent = logged.get(d) ?? 0
    if (weekday(d) === 1) passes = Math.min(passes + 1, passesFor(current)) // Monday refill, lost if already full
    let status: DayStatus
    if (breakOn(d, allowance)) status = 'break'
    else if (!(snap ? snap.isClassDay : counts(d, allowance))) status = 'off'
    else if (!logged.has(d) && !snap?.noSpend) status = d === today ? 'pending' : 'none'
    else if (snap && spent > snap.dailyBudgetCentavos) status = 'over'
    else status = 'on' // includes days with entries but no saved budget (app wasn't open): benefit of the doubt

    if (status === 'none') {
      if (passes > 0) {
        passes--
        status = 'pass'
      } else current = 0
    }
    if (status === 'on' || status === 'over') best = Math.max(best, ++current)
    days.set(d, { status, spent, budget: snap?.dailyBudgetCentavos })
  }
  return { current, best, passLeft: passes, pending: days.get(today)?.status === 'pending', days }
}

/** Spending-map shade 0–3 (0 = gray) or 'over', by share of that day's budget used. */
export function mapLevel(day: Day | undefined): 0 | 1 | 2 | 3 | 'over' {
  if (!day) return 0
  if (day.status === 'over') return 'over'
  if (day.status !== 'on') return 0
  const share = day.budget ? day.spent / day.budget : 0
  return share < 0.4 ? 1 : share < 0.7 ? 2 : 3
}

/** Validates and saves a day snapshot (one per day). */
export async function saveSnapshot(vault: Vault, snap: DaySnapshot): Promise<void> {
  await vault.put('day', `day-${snap.date}`, DaySnapshotSchema.parse(snap))
}

/** Loads every day snapshot. */
export async function loadSnapshots(vault: Vault): Promise<DaySnapshot[]> {
  return z.array(DaySnapshotSchema).parse(await vault.list('day'))
}
