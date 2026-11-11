/*
 * answers.ts — The rules behind onboarding screens 4–5, kept out of the UI so they
 * can be tested: default dates, input checks, and turning what the student typed
 * into an Allowance + starting balances.
 */
import type { Allowance } from '../budget/allowance.ts'
import { addDays, daysBetween, weekday } from '../budget/days.ts'
import { parsePeso } from '../ledger/money.ts'
import type { StartingWallet } from './setupAccount.ts'

/** What "Your baon" (screen 4) collects, as typed. */
export interface BaonAnswers {
  amountText: string
  frequency: Allowance['frequency']
  nextDate: string // "YYYY-MM-DD"
  countClassDays: boolean
  classWeekdays: number[]
}

/** What "How much do you have now?" (screen 5) collects, as typed. */
export interface MoneyAnswers {
  cashText: string
  // GCash and Maya are switches; `custom` rows are banks / e-wallets the student named (BPI, SeaBank…)
  eWallets: { id: string; name: string; on: boolean; text: string; custom?: boolean }[]
}

/** Sensible first guess for the next allowance: tomorrow for daily, else the coming Sunday. */
export function defaultNextDate(today: string, frequency: Allowance['frequency']): string {
  if (frequency === 'daily') return addDays(today, 1)
  return addDays(today, 7 - weekday(today)) // Sunday after today (a week away if today is Sunday)
}

/** Fresh answers for a student starting today (design defaults: weekly, Mon–Sat classes). */
export function initialBaon(today: string): BaonAnswers {
  return { amountText: '', frequency: 'weekly', nextDate: defaultNextDate(today, 'weekly'), countClassDays: true, classWeekdays: [1, 2, 3, 4, 5, 6] }
}

export const initialMoney: MoneyAnswers = {
  cashText: '',
  eWallets: [
    { id: 'gcash', name: 'GCash', on: false, text: '' },
    { id: 'maya', name: 'Maya', on: false, text: '' },
  ],
}

/** Checks screen 4. Returns the Allowance, or a friendly message saying what to fix. */
export function toAllowance(a: BaonAnswers, today: string): Allowance | string {
  const amount = a.amountText.trim() === '' && a.frequency === 'irregular' ? 0 : parsePeso(a.amountText)
  if (amount === null || (amount === 0 && a.frequency !== 'irregular')) return 'Enter how much you usually get.'
  if (daysBetween(today, a.nextDate) < 1) return 'Pick a date after today.'
  if (a.countClassDays && a.classWeekdays.length === 0) return 'Pick at least one class day, or turn off class days.'
  return { amountCentavos: amount, frequency: a.frequency, nextDate: a.nextDate, countClassDays: a.countClassDays, classWeekdays: [...a.classWeekdays].sort() }
}

/** Parses a balance field; empty means ₱0. Returns null if it isn't a valid amount. */
function balance(text: string): number | null {
  return text.trim() === '' ? 0 : parsePeso(text)
}

/** Checks screen 5. Returns starting balances, or a friendly message. */
export function toBalances(m: MoneyAnswers): { cashCentavos: number; eWallets: StartingWallet[] } | string {
  const cash = balance(m.cashText)
  if (cash === null) return 'Check the cash amount.'
  const eWallets: StartingWallet[] = []
  const names = new Set(['cash', 'savings'])
  for (const w of m.eWallets.filter((w) => w.on)) {
    const name = w.name.trim().replace(/\s+/g, ' ')
    if (!name) return 'Name each bank or e-wallet you added, e.g. BPI.'
    if (name.length > 40) return `Keep “${name.slice(0, 20)}…” under 40 letters.`
    if (names.has(name.toLowerCase())) return `You added ${name} twice.`
    names.add(name.toLowerCase())
    const centavos = balance(w.text)
    if (centavos === null) return `Check the ${name} amount.`
    eWallets.push({ id: w.id, name, centavos })
  }
  return { cashCentavos: cash, eWallets }
}

/** Running total shown at the bottom of screen 5 (invalid fields count as ₱0). */
export function moneyTotal(m: MoneyAnswers): number {
  return [m.cashText, ...m.eWallets.filter((w) => w.on).map((w) => w.text)].reduce((sum, t) => sum + (balance(t) ?? 0), 0)
}
