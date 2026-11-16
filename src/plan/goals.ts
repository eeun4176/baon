/*
 * goals.ts — Savings goals: a target on a Savings wallet ("Laptop ₱20,000 by Mar 1").
 * Progress is the wallet's real balance, so saving or withdrawing moves it with no extra entries.
 * With a date: how much to save each week to get there (rounded up to whole pesos, so it's enough).
 * Pure, so it can be tested.
 */
import { daysBetween } from '../budget/days.ts'

export interface GoalProgress {
  left: number // centavos still to save (0 once reached)
  percent: number // 0–100, whole
  perWeek: number | null // centavos a week to reach it by the date; null = no date, reached, or the date passed
  late: boolean // the date passed and it isn't reached
}

/** How far a wallet is toward its goal. */
export function goalProgress(balance: number, goal: number, goalDate: string | undefined, today: string): GoalProgress {
  const left = Math.max(0, goal - balance)
  const percent = Math.min(100, Math.max(0, Math.floor((balance / goal) * 100)))
  const days = goalDate ? daysBetween(today, goalDate) : null
  const late = left > 0 && days !== null && days < 0
  const weeks = days !== null && days >= 0 ? Math.max(1, Math.ceil(days / 7)) : 0
  const perWeek = left > 0 && weeks ? Math.ceil(left / weeks / 100) * 100 : null
  return { left, percent, perWeek, late }
}
