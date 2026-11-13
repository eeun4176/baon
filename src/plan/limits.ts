/*
 * limits.ts — Category limits (Plan → Category limits): a cap per category for one allowance
 * cycle, e.g. "Snacks under ₱200 until my next baon". The cycle starts on the day the latest
 * allowance came in (its "Allowance" entry), so a late baon starts the cycle late too.
 * Before the first allowance entry, everything logged so far counts.
 * Saved as one encrypted 'settings' record, so limits sync like everything else.
 */
import * as z from 'zod/mini'
import { manilaDate } from '../budget/days.ts'
import { isAllowance, type Transaction } from '../ledger/ledger.ts'
import { MAX_CENTAVOS } from '../ledger/money.ts'
import type { Vault } from '../vault/vault.ts'

/** categoryId → cap in centavos for the current allowance cycle. */
export type Limits = Record<string, number>

const LimitsSchema = z.record(z.string().check(z.maxLength(40)), z.int().check(z.positive(), z.maximum(MAX_CENTAVOS)))
const RECORD_ID = 'category-limits'
const CLOSE = 0.8 // "close to the limit" from 80% spent

/** Validates and saves the limits (an empty object = no limits). */
export async function saveLimits(vault: Vault, limits: Limits): Promise<void> {
  await vault.put('settings', RECORD_ID, LimitsSchema.parse(limits))
}

/** Loads the limits (none set yet = {}). */
export async function loadLimits(vault: Vault): Promise<Limits> {
  const raw = await vault.get(RECORD_ID)
  return raw === undefined ? {} : LimitsSchema.parse(raw)
}

/** First Manila day of this allowance cycle: the day the latest allowance came in, or null before any. */
export function cycleStart(transactions: Transaction[]): string | null {
  let start: string | null = null
  for (const tx of transactions) if (isAllowance(tx)) { // a scholarship or salary doesn't start a new cycle
    const day = manilaDate(tx.occurredAt)
    if (!start || day > start) start = day
  }
  return start
}

/** Spent per category this cycle: expenses minus refunds. `skipId` leaves out an entry being edited. */
export function spentThisCycle(transactions: Transaction[], skipId?: string): Map<string, number> {
  const start = cycleStart(transactions)
  const spent = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.id === skipId || !tx.categoryId || (start && manilaDate(tx.occurredAt) < start)) continue
    const sign = tx.kind === 'expense' ? 1 : tx.kind === 'refund' ? -1 : 0
    if (sign) spent.set(tx.categoryId, (spent.get(tx.categoryId) ?? 0) + sign * tx.amountCentavos)
  }
  return spent
}

/** How one limited category is doing. `level`: under 80% ok, then close, then over. */
export interface LimitStatus {
  categoryId: string
  limit: number
  spent: number
  left: number // negative = over by that much
  level: 'ok' | 'close' | 'over'
}

/** Status of every category that has a limit, most urgent first. */
export function limitStatuses(limits: Limits, transactions: Transaction[]): LimitStatus[] {
  const spent = spentThisCycle(transactions)
  return Object.entries(limits)
    .map(([categoryId, limit]): LimitStatus => {
      const s = Math.max(0, spent.get(categoryId) ?? 0)
      return { categoryId, limit, spent: s, left: limit - s, level: s > limit ? 'over' : s >= limit * CLOSE ? 'close' : 'ok' }
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
}
