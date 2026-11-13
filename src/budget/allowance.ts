/*
 * allowance.ts — The student's allowance ("baon") setup from onboarding screen 4:
 * how much, how often, when the next one comes, and which days are class days.
 * Stored encrypted in the vault as a single record.
 */
import * as z from 'zod/mini'
import type { Vault } from '../vault/vault.ts'
import { addDays, addMonth, daysBetween } from './days.ts'
import { tr } from '../i18n/i18n.ts'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export const AllowanceSchema = z.object({
  amountCentavos: z.int().check(z.minimum(0)), // usual amount, prefilled in "Did your baon arrive?"
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'irregular']),
  // Next expected allowance (Manila day). For "irregular" it's the "Make it last until" date.
  nextDate: z.string().check(z.regex(DAY)),
  countClassDays: z.boolean(),
  classWeekdays: z.array(z.int().check(z.minimum(0), z.maximum(6))), // 0 = Sunday … 6 = Saturday
  // After "Not yet": the day it was due on schedule. While waiting, nextDate is the day the student
  // expects it; the next cycle still counts from this day, so a late baon doesn't shift the usual day.
  lateFrom: z.optional(z.string().check(z.regex(DAY))),
  // "No classes" breaks (typhoon day … sembreak), inclusive Manila days. During a break the
  // budget counts every day (students still eat) and the streak is frozen.
  breaks: z.optional(z.array(z.object({ from: z.string().check(z.regex(DAY)), to: z.string().check(z.regex(DAY)) }))),
})
export type Allowance = z.infer<typeof AllowanceSchema>

/** Frequency choices (onboarding + Me → Edit allowance). */
export const FREQUENCIES = [
  ['daily', tr('Daily')],
  ['weekly', tr('Weekly')],
  ['biweekly', tr('Every 2 weeks')],
  ['monthly', tr('Monthly')],
  ['irregular', tr('Irregular')],
] as const

/** "Every week", "Every 2 weeks"… for sentences. */
export const FREQUENCY_TEXT: Record<Allowance['frequency'], string> = {
  daily: tr('Every day'), weekly: tr('Every week'), biweekly: tr('Every 2 weeks'), monthly: tr('Every month'), irregular: tr('Irregular'),
}

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

/**
 * After "Yes, it arrived": the next expected date after today. Skips whole cycles if the
 * student answers late (e.g. a weekly baon confirmed 9 days after it was due).
 * Null for irregular allowances — the student picks the "Make it last until" date.
 */
export function advanceNextDate(allowance: Allowance, today: string): string | null {
  let next = nextAllowanceDate(allowance.lateFrom ?? allowance.nextDate, allowance.frequency)
  while (next !== null && next <= today) next = nextAllowanceDate(next, allowance.frequency)
  return next
}

/**
 * An allowance logged from Add on `today`: if Baon is asking "Did your baon arrive?" (date reached)
 * or waiting after "Not yet", it's the answer — returns the allowance with the next date moved.
 * Null when it's extra money mid-cycle, or the schedule is irregular (Home asks for the date).
 */
export function afterAllowanceLogged(allowance: Allowance, today: string): Allowance | null {
  if (daysBetween(today, allowance.nextDate) > 0 && !allowance.lateFrom) return null
  const nextDate = advanceNextDate(allowance, today)
  return nextDate ? { ...allowance, nextDate, lateFrom: undefined } : null
}

/** The break that covers `day`, if any. */
export function breakOn(day: string, allowance: Allowance): { from: string; to: string } | undefined {
  return allowance.breaks?.find((b) => b.from <= day && day <= b.to)
}

const DAY_NAMES = [tr('Sun'), tr('Mon'), tr('Tue'), tr('Wed'), tr('Thu'), tr('Fri'), tr('Sat')]

/** Which days the budget counts, in words: "Mon–Sat", "Mon, Wed, Fri", "Every day" or "None". */
export function classDaysText(allowance: Allowance): string {
  const days = [...new Set(allowance.classWeekdays)].sort()
  if (!allowance.countClassDays || days.length === 7) return tr('Every day')
  if (days.length === 0) return tr('None')
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
