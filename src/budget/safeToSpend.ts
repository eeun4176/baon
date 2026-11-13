/*
 * safeToSpend.ts — The number on the Home screen (based on balances):
 *
 *   Ready to spend   = money in spending wallets − money held back
 *   Held back        = school set-asides + utang still owed + money kept for later
 *                      (a scholarship or salary the student made "last until" a date)
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
import { owedTotal } from '../ledger/utang.ts'
import { breakOn, type Allowance } from './allowance.ts'
import { addDays, daysBetween, manilaDate, weekday } from './days.ts'

export interface SafeToSpend {
  today: string // Manila day this was computed for
  inWallets: number // spending wallets now (centavos)
  setAside: number // reserved for school expenses
  owed: number // utang still to pay back
  forLater: number // money in kept for after this budget period (see heldForLater)
  readyToSpend: number // inWallets − setAside − owed − forLater (can be negative)
  budgetDays: number // days the money must last (≥ 1)
  isClassDay: boolean // false → "No class today — ₱0 planned"
  dailyBudget: number // whole pesos, in centavos, never negative
  spentToday: number // expenses − refunds dated today
  leftToday: number // negative means "₱X over today"
  allowanceDue: boolean // next allowance date reached → ask "Did your baon arrive?"
  overspent: boolean // wallets below ₱0: spent more than there was
  holdsExceedMoney: boolean // wallets fine, but more is held back than they hold
}

/**
 * Money in that the student asked to "make it last until" a date: the part meant for days after
 * this budget period (from the next allowance, or tomorrow if it's due, up to that date) is held
 * back, spread evenly over every day from when it came in. Each new period releases its share.
 * E.g. ₱3,000 on Nov 1 lasting until Nov 30, next allowance Nov 8: Nov 8–30 is 23 of 30 days → ₱2,300 held.
 */
export function heldForLater(txs: Transaction[], allowance: Allowance, today: string): number {
  const laterFrom = allowance.nextDate > today ? allowance.nextDate : addDays(today, 1)
  let held = 0
  for (const tx of txs) {
    if (tx.kind !== 'income' || !tx.spreadUntil) continue
    const total = daysBetween(manilaDate(tx.occurredAt), tx.spreadUntil) + 1
    const later = Math.max(0, daysBetween(laterFrom, tx.spreadUntil) + 1)
    held += Math.floor((tx.amountCentavos * Math.min(later, total)) / total)
  }
  return held
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
  const owed = owedTotal(transactions)
  const forLater = heldForLater(transactions, allowance, today)
  const readyToSpend = inWallets - setAsideCentavos - owed - forLater
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
    owed,
    forLater,
    readyToSpend,
    budgetDays,
    isClassDay,
    dailyBudget,
    spentToday,
    leftToday: dailyBudget - spentToday,
    allowanceDue: daysBetween(today, allowance.nextDate) <= 0,
    overspent: inWallets < 0,
    holdsExceedMoney: inWallets >= 0 && readyToSpend < 0,
  }
}
