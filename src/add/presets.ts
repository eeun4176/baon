/*
 * presets.ts — One-tap buttons on Home (plan §4.2): "Jeep ₱15", "Lunch ₱80"…
 * The student can add (up to 8), edit, reorder and delete them. They're stored
 * encrypted as ONE settings record { items, dismissed }, so the array order is the
 * button order. Until the student changes anything, the design's four starters show.
 *
 * Suggestion: after the same expense (name + amount + category) is logged 3 times,
 * Home offers to turn it into a button; "No thanks" is remembered in `dismissed`.
 */
import * as z from 'zod/mini'
import type { Transaction } from '../ledger/ledger.ts'
import type { Vault } from '../vault/vault.ts'
import { CATEGORIES, categoryLabel } from './categories.ts'
import { tr } from '../i18n/i18n.ts'

export const MAX_PRESETS = 8

const PresetSchema = z.object({
  id: z.string().check(z.minLength(1)),
  label: z.string().check(z.trim(), z.minLength(1), z.maxLength(24)),
  amountCentavos: z.int().check(z.positive()),
  categoryId: z.string().check(z.minLength(1)),
  walletId: z.optional(z.string()), // missing → the wallet used last
  icon: z.optional(z.enum(['printer'])), // only the "Print" starter overrides its category icon
})
export type Preset = z.infer<typeof PresetSchema>

export const PresetsSchema = z.object({
  items: z.array(PresetSchema).check(z.maxLength(MAX_PRESETS)),
  dismissed: z.array(z.string()), // suggestion keys the student said "No thanks" to
})
export type Presets = z.infer<typeof PresetsSchema>

/** The design's four starters (Jeep ₱15, Lunch ₱80, Print ₱5, Load ₱50). */
export const DEFAULT_PRESETS: Presets = {
  items: [
    { id: 'jeep', label: tr('Jeep'), amountCentavos: 1500, categoryId: 'fare' },
    { id: 'lunch', label: tr('Lunch'), amountCentavos: 8000, categoryId: 'food' },
    { id: 'print', label: tr('Print'), amountCentavos: 500, categoryId: 'school', icon: 'printer' },
    { id: 'load', label: tr('Load'), amountCentavos: 5000, categoryId: 'load' },
  ],
  dismissed: [],
}

/** Icon for a button: its own override, else its category's icon. */
export function presetIcon(p: Preset) {
  return p.icon ?? CATEGORIES.find((c) => c.id === p.categoryId)?.icon ?? 'dots'
}

/** Same name + amount + category = the same everyday expense. */
const keyOf = (label: string, amountCentavos: number, categoryId: string) => `${label.trim().toLowerCase()}|${amountCentavos}|${categoryId}`

export interface Suggestion {
  key: string
  label: string
  amountCentavos: number
  categoryId: string
  times: number
}

/** An expense logged ≥ 3 times that isn't a button yet (and wasn't dismissed), most frequent first. */
export function suggestPreset(transactions: Transaction[], presets: Presets): Suggestion | null {
  if (presets.items.length >= MAX_PRESETS) return null
  const taken = new Set([...presets.dismissed, ...presets.items.map((p) => keyOf(p.label, p.amountCentavos, p.categoryId))])
  const seen = new Map<string, Suggestion>()
  for (const tx of transactions) {
    if (tx.kind !== 'expense' || tx.linkedId || !tx.categoryId) continue // school payments aren't everyday buttons
    const label = tx.note?.trim() || categoryLabel(tx.categoryId)
    if (label.length > 24) continue
    const key = keyOf(label, tx.amountCentavos, tx.categoryId)
    if (taken.has(key)) continue
    const s = seen.get(key) ?? { key, label, amountCentavos: tx.amountCentavos, categoryId: tx.categoryId, times: 0 }
    s.times++
    seen.set(key, s)
  }
  let best: Suggestion | null = null
  for (const s of seen.values()) if (s.times >= 3 && (!best || s.times >= best.times)) best = s // ties → latest seen
  return best
}

const RECORD_ID = 'presets'

/** Validates and saves the one-tap buttons. */
export async function savePresets(vault: Vault, presets: Presets): Promise<void> {
  await vault.put('settings', RECORD_ID, PresetsSchema.parse(presets))
}

/** Loads the one-tap buttons (the four starters if the student never changed them). */
export async function loadPresets(vault: Vault): Promise<Presets> {
  const raw = await vault.get(RECORD_ID)
  return raw === undefined ? DEFAULT_PRESETS : PresetsSchema.parse(raw)
}
