/*
 * allowance.ts — The student's allowance ("baon") setup from onboarding screen 4:
 * how much, how often, when the next one comes, and which days are class days.
 * Stored encrypted in the vault as a single record.
 */
import { z } from 'zod'
import type { Vault } from '../vault/vault.ts'
import { addDays, addMonth } from './days.ts'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export const AllowanceSchema = z.object({
  amountCentavos: z.int().min(0), // usual amount, prefilled in "Did your baon arrive?"
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'irregular']),
  // Next expected allowance (Manila day). For "irregular" it's the "make it last until" date.
  nextDate: z.string().regex(DAY),
  countClassDays: z.boolean(),
  classWeekdays: z.array(z.int().min(0).max(6)), // 0 = Sunday … 6 = Saturday
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
