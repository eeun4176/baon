/*
 * summary.ts — The daily summary line on Home's "Today's entries" card: how money moved today in
 * one short read ("₱135 spent · ₱15 under budget · ₱500 came in"). Pure, so it can be tested.
 */
import { formatPeso } from '../ledger/money.ts'
import type { Transaction } from '../ledger/ledger.ts'
import { manilaDate } from '../budget/days.ts'
import type { SafeToSpend } from '../budget/safeToSpend.ts'
import { tr } from '../i18n/i18n.ts'

/** Today's summary from the day's numbers and entries. Money in counts every source (allowance, gifts…). */
export function daySummary(r: Pick<SafeToSpend, 'today' | 'spentToday' | 'leftToday' | 'isClassDay' | 'dailyBudget'>, transactions: Transaction[]): string {
  const cameIn = transactions.reduce((s, tx) => (tx.kind === 'income' && manilaDate(tx.occurredAt) === r.today ? s + tx.amountCentavos : s), 0)
  const parts = [tr('{0} spent', formatPeso(Math.max(0, r.spentToday)))]
  if (!r.isClassDay) parts.push(tr('no class today'))
  else if (r.leftToday > 0) parts.push(tr('{0} under budget', formatPeso(r.leftToday)))
  else if (r.leftToday < 0) parts.push(tr('{0} over budget', formatPeso(-r.leftToday)))
  else if (r.dailyBudget > 0) parts.push(tr('right on budget'))
  if (cameIn) parts.push(tr('{0} came in', formatPeso(cameIn)))
  return parts.join(' · ')
}
