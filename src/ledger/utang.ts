/*
 * utang.ts — Money borrowed from or lent to someone, worked out from entries only:
 *   borrow  "I owe Mia ₱200"      money came in, but it isn't the student's to spend
 *   lend    "Carlo owes me ₱100"  money went out, but it isn't spending
 *   repay / collect point to their borrow / lend (linkedId); partial payments add up.
 * What the student still owes is held back from the daily budget (like a school set-aside),
 * so borrowed money never looks like free money. Money a friend owes isn't counted until it's back.
 */
import { daysBetween } from '../budget/days.ts'
import type { Transaction } from './ledger.ts'

/** One utang with what's paid so far. `left` never goes below 0. */
export interface Utang {
  tx: Transaction // the borrow or lend entry
  owe: boolean // true = the student owes; false = someone owes the student
  paid: number
  left: number
}

/** Every utang (borrow/lend), oldest first, with what's been paid back. */
export function utangList(txs: Transaction[]): Utang[] {
  const paid = new Map<string, number>()
  for (const tx of txs) {
    if ((tx.kind === 'repay' || tx.kind === 'collect') && tx.linkedId) paid.set(tx.linkedId, (paid.get(tx.linkedId) ?? 0) + tx.amountCentavos)
  }
  return txs
    .filter((tx) => tx.kind === 'borrow' || tx.kind === 'lend')
    .map((tx) => {
      const p = paid.get(tx.id) ?? 0
      return { tx, owe: tx.kind === 'borrow', paid: p, left: Math.max(0, tx.amountCentavos - p) }
    })
}

/**
 * When an utang is due, as a chip: "Anytime" (no date), "In 3 days", "Tomorrow", "Today" or
 * "2 days late". `late`/`today` get the heads-up color. `days` = days until due (negative = late).
 */
export function dueStatus(dueDate: string | undefined, today: string): { kind: 'none' | 'later' | 'today' | 'late'; days: number } {
  if (!dueDate) return { kind: 'none', days: 0 }
  const days = daysBetween(today, dueDate)
  return { kind: days > 0 ? 'later' : days === 0 ? 'today' : 'late', days }
}

/** What the student still owes in total: held back from the daily budget. */
export function owedTotal(txs: Transaction[]): number {
  return utangList(txs).reduce((sum, u) => (u.owe ? sum + u.left : sum), 0)
}
