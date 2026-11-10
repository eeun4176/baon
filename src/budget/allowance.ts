/*
 * allowance.ts — The student's allowance ("baon") setup from onboarding screen 4:
 * how much, how often, when the next one comes, and which days are class days.
 * Stored encrypted in the vault as a single record.
 */
import * as z from 'zod/mini'
import type { Vault } from '../vault/vault.ts'
import { addDays, addMonth } from './days.ts'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export const AllowanceSchema = z.object({
  amountCentavos: z.int().check(z.minimum(0)), // usual amount, prefilled in "Did your baon arrive?"
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'irregular']),
  // Next expected allowance (Manila day). For "irregular" it's the "make it last until" date.
  nextDate: z.string().check(z.regex(DAY)),
  countClassDays: z.boolean(),
  classWeekdays: z.array(z.int().check(z.minimum(0), z.maximum(6))), // 0 = Sunday … 6 = Saturday
})
export type Allowance = z.infer<typeof AllowanceSchema>

/**
 * The allowance date after `current`, for when the student taps "Yes, it arrived".
 * Returns null for irregular allowances — the student picks the next date themselves.
 */
export function nextAllowanceDate(current: string, frequency: Allowance['frequency']): string | null {
  switch (frequency) {
    case 'daily': return addDays(current, 1)
    case 'weekly': return addDays(current, 7)
    case 'biweekly': return addDays(current, 14)
    case 'monthly': return addMonth(current)
    case 'irregular': return null
  }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Which days the budget counts, in words: "Mon–Sat", "Mon, Wed, Fri", "Every day" or "None". */
export function classDaysText(allowance: Allowance): string {
  const days = [...new Set(allowance.classWeekdays)].sort()
  if (!allowance.countClassDays || days.length === 7) return 'Every day'
  if (days.length === 0) return 'None'
  const inARow = days.length >= 3 && days.at(-1)! - days[0] === days.length - 1
  return inARow ? `${DAY_NAMES[days[0]]}–${DAY_NAMES[days.at(-1)!]}` : days.map((d) => DAY_NAMES[d]).join(', ')
}

const RECORD_ID = 'allowance'

/** Validates and saves the allowance setup. */
export async function saveAllowance(vault: Vault, allowance: Allowance): Promise<void> {
  await vault.put('settings', RECORD_ID, AllowanceSchema.parse(allowance))
}

/** Loads the allowance setup, or undefined before onboarding is finished. */
export async function loadAllowance(vault: Vault): Promise<Allowance | undefined> {
  const raw = await vault.get(RECORD_ID)
  return raw === undefined ? undefined : AllowanceSchema.parse(raw)
}
