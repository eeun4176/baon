/*
 * categories.ts — Expense categories and the starter one-tap presets (plan §4.2).
 * Quick Add shows the 5 most-used categories plus "More" (design: Fare, Food,
 * Load, School, Snacks, More).
 */
import type { Transaction } from '../ledger/ledger.ts'
import type { IconName } from '../ui/kit.tsx'

export interface Category {
  id: string
  label: string
  icon: IconName
}

export const CATEGORIES: Category[] = [
  { id: 'fare', icon: 'bus', label: 'Fare' },
  { id: 'food', icon: 'utensils', label: 'Food' },
  { id: 'load', icon: 'phone', label: 'Load' },
  { id: 'school', icon: 'book', label: 'School' },
  { id: 'snacks', icon: 'cup', label: 'Snacks' },
  { id: 'shopping', icon: 'wallet', label: 'Shopping' },
  { id: 'health', icon: 'help', label: 'Health' },
  { id: 'gifts', icon: 'piggy', label: 'Gifts' },
  { id: 'fun', icon: 'flame', label: 'Fun' },
  { id: 'other', icon: 'dots', label: 'Other' },
]

/** Category label for an id (falls back to "Other" for unknown ids). */
export function categoryLabel(id: string | undefined): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}

/** Categories ordered by how often the student used them; ties keep the default order. */
export function byMostUsed(transactions: Transaction[]): Category[] {
  const uses = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.kind === 'expense' && tx.categoryId) uses.set(tx.categoryId, (uses.get(tx.categoryId) ?? 0) + 1)
  }
  return [...CATEGORIES].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0))
}

/** A one-tap button on Home: logs this expense immediately. */
export interface Preset {
  id: string
  label: string
  amountCentavos: number
  categoryId: string
  icon: 'bus' | 'utensils' | 'printer' | 'phone'
}

// shortcut: everyone starts with the design's four presets and can't edit them yet;
// add create/edit (and "suggest after 3 same expenses", plan §4.2) in a later branch.
export const DEFAULT_PRESETS: Preset[] = [
  { id: 'jeep', label: 'Jeep', amountCentavos: 1500, categoryId: 'fare', icon: 'bus' },
  { id: 'lunch', label: 'Lunch', amountCentavos: 8000, categoryId: 'food', icon: 'utensils' },
  { id: 'print', label: 'Print', amountCentavos: 500, categoryId: 'school', icon: 'printer' },
  { id: 'load', label: 'Load', amountCentavos: 5000, categoryId: 'load', icon: 'phone' },
]

/** Wallet the student used for their latest expense, so it's the default next time. */
export function lastUsedWalletId(transactions: Transaction[], fallback: string): string {
  for (let i = transactions.length - 1; i >= 0; i--) {
    if (transactions[i].kind === 'expense') return transactions[i].walletId
  }
  return fallback
}
