/*
 * categories.ts — Expense categories and the starter one-tap presets (plan §4.2).
 * Quick Add shows the 5 most-used categories plus "More" (design: Fare, Food,
 * Load, School, Snacks, More). One-tap buttons live in presets.ts.
 * Students can add their own categories (e.g. "Milk tea", from Plan → Category limits). They're
 * one encrypted 'settings' record, so they sync; a removed one is kept (marked removed) so old
 * entries still show its name.
 */
import * as z from 'zod/mini'
import type { Transaction } from '../ledger/ledger.ts'
import type { IconName } from '../ui/kit.tsx'
import type { Vault } from '../vault/vault.ts'
import { tr } from '../i18n/i18n.ts'

export interface Category {
  id: string
  label: string
  icon: IconName
}

export const CATEGORIES: Category[] = [
  { id: 'fare', icon: 'bus', label: tr('Fare') },
  { id: 'food', icon: 'utensils', label: tr('Food') },
  { id: 'load', icon: 'phone', label: tr('Load') },
  { id: 'school', icon: 'book', label: tr('School') },
  { id: 'snacks', icon: 'cup', label: tr('Snacks') },
  { id: 'shopping', icon: 'wallet', label: tr('Shopping') },
  { id: 'health', icon: 'help', label: tr('Health') },
  { id: 'gifts', icon: 'piggy', label: tr('Gifts') },
  { id: 'fun', icon: 'flame', label: tr('Fun') },
  { id: 'other', icon: 'dots', label: tr('Other') },
]

export const MAX_OWN = 10
export const OWN_NAME_MAX = 20
const OwnSchema = z.array(z.object({
  id: z.string().check(z.regex(/^own-[\w-]{1,36}$/)),
  label: z.string().check(z.minLength(1), z.maxLength(OWN_NAME_MAX)),
  removed: z.optional(z.boolean()),
}))
export type OwnCategory = z.infer<typeof OwnSchema>[number]
const RECORD_ID = 'own-categories'

let own: OwnCategory[] = [] // set by the session (setOwnCategories) whenever they load or change

/** Tells every label lookup about the student's own categories. */
export function setOwnCategories(list: OwnCategory[]) {
  own = list
}

/** Validates and saves the student's own categories. */
export async function saveOwnCategories(vault: Vault, list: OwnCategory[]): Promise<void> {
  await vault.put('settings', RECORD_ID, OwnSchema.parse(list))
}

/** Loads the student's own categories (none yet = []). */
export async function loadOwnCategories(vault: Vault): Promise<OwnCategory[]> {
  const raw = await vault.get(RECORD_ID)
  return raw === undefined ? [] : OwnSchema.parse(raw)
}

/** Categories to pick from: the built-in ones, then the student's own (`list`, default the saved ones), "Other" last. */
export function pickableCategories(list = own): Category[] {
  const mine = list.filter((c) => !c.removed).map((c): Category => ({ id: c.id, label: c.label, icon: 'tag' }))
  return [...CATEGORIES.slice(0, -1), ...mine, CATEGORIES[CATEGORIES.length - 1]]
}

/** Category label for an id (falls back to "Other" for unknown ids). */
export function categoryLabel(id: string | undefined): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? own.find((c) => c.id === id)?.label ?? tr('Other')
}

/** Categories ordered by how often the student used them; ties keep the default order. */
export function byMostUsed(transactions: Transaction[]): Category[] {
  const uses = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.kind === 'expense' && tx.categoryId) uses.set(tx.categoryId, (uses.get(tx.categoryId) ?? 0) + 1)
  }
  return pickableCategories().sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0))
}

/** Wallet the student used for their latest expense, so it's the default next time. */
export function lastUsedWalletId(transactions: Transaction[], fallback: string): string {
  for (let i = transactions.length - 1; i >= 0; i--) {
    if (transactions[i].kind === 'expense') return transactions[i].walletId
  }
  return fallback
}
