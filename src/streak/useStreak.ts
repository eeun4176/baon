/*
 * useStreak.ts — React glue for the streak:
 *   useStreak()            the current streak, recomputed when records change
 *   useKeepTodaySnapshot() saves today's budget while the app is open (AppShell runs it),
 *                          so past days keep the budget they really had
 */
import { useEffect, useMemo } from 'react'
import { useToday } from '../home/useToday.ts'
import { useSession } from '../session.ts'
import { streakSummary, type Streak } from './streak.ts'

/** The student's streak as of today. */
export function useStreak(): Streak {
  const { snapshots, transactions, allowance } = useSession()
  const today = useToday().result.today
  return useMemo(() => streakSummary({ today, snapshots, transactions, allowance }), [today, snapshots, transactions, allowance])
}

/** Keeps today's snapshot equal to today's budget (today isn't final; past days never change). */
export function useKeepTodaySnapshot(): void {
  const { snapshots, saveSnapshot } = useSession()
  const { result } = useToday()
  useEffect(() => {
    const saved = snapshots.find((s) => s.date === result.today)
    if (saved && saved.dailyBudgetCentavos === result.dailyBudget && saved.isClassDay === result.isClassDay) return
    saveSnapshot({ ...saved, date: result.today, dailyBudgetCentavos: result.dailyBudget, isClassDay: result.isClassDay }).catch(() => {})
  }, [snapshots, saveSnapshot, result])
}
