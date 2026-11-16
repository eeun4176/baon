/*
 * school.ts — School expenses: money set aside for printing, projects, org fees….
 *
 * Status flow: Planned → Set aside → Paid.
 *   - Only "Set aside" items are subtracted from safe-to-spend (the money stays in the wallet).
 *   - "Paid" is NOT stored: an item is paid when an expense points to it (linkedId).
 *     So paying creates the expense and releases the reservation in one step, it can
 *     never be counted twice, and deleting that expense in History puts it back to "Set aside".
 * Repeating items (every week / every month: load promo, subscription, dorm rent): paying one adds
 * the next copy with the next due date. Items due within 3 days show on Home ("Due soon").
 */
import * as z from 'zod/mini'
import { addDays, addMonth } from '../budget/days.ts'
import type { Transaction } from '../ledger/ledger.ts'
import type { Vault } from '../vault/vault.ts'
import { tr } from '../i18n/i18n.ts'

export const TEMPLATES = [
  { id: 'printing', label: tr('Printing') },
  { id: 'project', label: tr('Project materials') },
  { id: 'org', label: tr('Org / class fee') },
  { id: 'uniform', label: tr('Uniform / PE') },
  { id: 'trip', label: tr('Field trip') },
  { id: 'thesis', label: tr('Thesis / research') },
  { id: 'other', label: tr('Other') },
] as const

export const SchoolExpenseSchema = z.object({
  id: z.string().check(z.minLength(1)),
  title: z.string().check(z.trim(), z.minLength(1), z.maxLength(60)),
  template: z.enum(['printing', 'project', 'org', 'uniform', 'trip', 'thesis', 'other']),
  estimatedCentavos: z.int().check(z.positive()),
  dueDate: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)),
  status: z.enum(['planned', 'setAside']), // "paid" is derived, see paidWith()
  repeat: z.optional(z.enum(['weekly', 'monthly'])), // load promo, subscription, rent: paying it adds the next one
})
export type SchoolExpense = z.infer<typeof SchoolExpenseSchema>
export type Status = SchoolExpense['status'] | 'paid'

/** The next copy of a repeating item, due a week or a month after this one (null if it doesn't repeat). */
export function nextRepeat(item: SchoolExpense): SchoolExpense | null {
  if (!item.repeat) return null
  const dueDate = item.repeat === 'weekly' ? addDays(item.dueDate, 7) : addMonth(item.dueDate)
  return { ...item, id: crypto.randomUUID(), dueDate }
}

/** Unpaid items due within `days` days (or overdue), soonest first: Home's "Due soon" reminder. */
export function dueSoon(items: SchoolExpense[], txs: Transaction[], today: string, days = 3): SchoolExpense[] {
  const until = addDays(today, days)
  return sortForList(items, txs).filter((i) => statusOf(i, txs) !== 'paid' && i.dueDate <= until)
}

/** Template label for an id, e.g. "Org / class fee". */
export function templateLabel(id: SchoolExpense['template']): string {
  return TEMPLATES.find((t) => t.id === id)!.label
}

/** The expense that paid this item, if any. */
export function paidWith(item: SchoolExpense, txs: Transaction[]): Transaction | undefined {
  return txs.find((tx) => tx.kind === 'expense' && tx.linkedId === item.id)
}

/** Planned, Set aside or Paid. */
export function statusOf(item: SchoolExpense, txs: Transaction[]): Status {
  return paidWith(item, txs) ? 'paid' : item.status
}

/** Money reserved right now: every unpaid "Set aside" item (goes into safe-to-spend). */
export function setAsideTotal(items: SchoolExpense[], txs: Transaction[]): number {
  return items.reduce((sum, item) => (statusOf(item, txs) === 'setAside' ? sum + item.estimatedCentavos : sum), 0)
}

/** List order: unpaid by due date (soonest first), then paid (latest payment first). */
export function sortForList(items: SchoolExpense[], txs: Transaction[]): SchoolExpense[] {
  const paidAt = (i: SchoolExpense) => paidWith(i, txs)?.occurredAt
  return [...items].sort((a, b) => {
    const pa = paidAt(a), pb = paidAt(b)
    if (!pa !== !pb) return pa ? 1 : -1
    if (pa && pb) return Date.parse(pb) - Date.parse(pa)
    return a.dueDate.localeCompare(b.dueDate)
  })
}

/** Validates and saves a school expense (insert or update). */
export async function saveSchoolExpense(vault: Vault, item: SchoolExpense): Promise<void> {
  await vault.put('school', item.id, SchoolExpenseSchema.parse(item))
}

/** Loads and validates every school expense. */
export async function loadSchoolExpenses(vault: Vault): Promise<SchoolExpense[]> {
  return z.array(SchoolExpenseSchema).parse(await vault.list('school'))
}
