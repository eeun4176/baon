/*
 * safeToSpend.ts — The number on the Home screen (based on balances):
 *
 *   Ready to spend   = money in spending wallets − money set aside for school
 *   Budget days left = today … the day before the next allowance
 *                      (only class days if "Count only class days" is on; minimum 1)
 *   Daily budget     = Ready to spend ÷ Budget days left, rounded DOWN to whole pesos
 *   Left for today   = Daily budget − what was spent today
 *
 * Today's own spending is added back before dividing, so logging a ₱15 jeep
 * lowers "left for today" but not today's budget itself. Money that arrives today
 * (allowance) or leaves to savings today does change today's budget — the design's
 * "your new daily budget starts once your baon is in".
 */
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import { spendingTotal } from '../ledger/ledger.ts'
import { breakOn, type Allowance } from './allowance.ts'
import { addDays, daysBetween, manilaDate, weekday } from './days.ts'

export interface SafeToSpend {
  today: string // Manila day this was computed for
  inWallets: number // spending wallets now (centavos)
  setAside: number // reserved for school expenses
  readyToSpend: number // inWallets − setAside (can be negative)
  budgetDays: number // days the money must last (≥ 1)
  isClassDay: boolean // false → "No class today — ₱0 planned"
  dailyBudget: number // whole pesos, in centavos, never negative
  spentToday: number // expenses − refunds dated today
  leftToday: number // negative means "₱X over today"
  allowanceDue: boolean // next allowance date reached → ask "Did your baon arrive?"
  setAsidesExceedMoney: boolean // "Your set-asides are more than your money right now"
}

/** True if `day` counts toward the budget: always, unless class-days mode is on (break days always count). */
export function counts(day: string, allowance: Allowance): boolean {
  return !allowance.countClassDays || allowance.classWeekdays.includes(weekday(day)) || !!breakOn(day, allowance)
}

/** The days the money must cover: `today` … the day before the next allowance (class days only if on). */
export function budgetDayList(today: string, allowance: Allowance): string[] {
  const days: string[] = []
  for (let d = today; daysBetween(d, allowance.nextDate) > 0; d = addDays(d, 1)) {
    if (counts(d, allowance)) days.push(d)
  }
  return days
}

/** How many budget days are left; at least 1 so we never divide by zero. */
export function budgetDaysLeft(today: string, allowance: Allowance): number {
  return Math.max(1, budgetDayList(today, allowance).length)
}

/** Net spending dated `day`: expenses minus refunds (transfers and saves aren't spending). */
export function spentOn(day: string, txs: Transaction[]): number {
  let total = 0
  for (const tx of txs) {
    if (manilaDate(tx.occurredAt) !== day) continue
    if (tx.kind === 'expense') total += tx.amountCentavos
    else if (tx.kind === 'refund') total -= tx.amountCentavos
  }
  return total
}

/** Computes everything the Home and "How it's counted" screens show. */
export function safeToSpend(input: {
  wallets: Wallet[]
  transactions: Transaction[]
  allowance: Allowance
  setAsideCentavos: number // sum of school expenses with status "Set aside"
  now?: Date
}): SafeToSpend {
  const { wallets, transactions, allowance, setAsideCentavos } = input
  const today = manilaDate(input.now)
  const inWallets = spendingTotal(wallets, transactions)
  const readyToSpend = inWallets - setAsideCentavos
  const spentToday = spentOn(today, transactions)
  const budgetDays = budgetDaysLeft(today, allowance)
  const isClassDay = counts(today, allowance)

  // Add today's spending back so it lowers "left for today", not today's budget.
  const forBudget = readyToSpend + spentToday
  const dailyBudget = isClassDay && forBudget > 0 ? Math.floor(forBudget / budgetDays / 100) * 100 : 0

  return {
    today,
    inWallets,
    setAside: setAsideCentavos,
    readyToSpend,
    budgetDays,
    isClassDay,
    dailyBudget,
    spentToday,
    leftToday: dailyBudget - spentToday,
    allowanceDue: daysBetween(today, allowance.nextDate) <= 0,
    setAsidesExceedMoney: readyToSpend < 0,
  }
}
