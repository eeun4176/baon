/*
 * useToday.ts — Today's numbers, computed from the in-memory session records.
 * Shared by Home and "How it's counted" so both always agree, and recomputed
 * instantly when an expense is added or undone.
 */
import { useMemo } from 'react'
import type { Allowance } from '../budget/allowance.ts'
import { budgetDayList, safeToSpend, type SafeToSpend } from '../budget/safeToSpend.ts'
import type { Wallet } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'

export interface Today {
  result: SafeToSpend
  allowance: Allowance
  spendingWallets: Wallet[] // for "In wallets: Cash + GCash"
  budgetDays: string[] // the days the money covers, e.g. We Th Fr Sa
}

/** Today's numbers for the signed-in student. */
export function useToday(): Today {
  const { wallets, transactions, allowance } = useSession()
  return useMemo(() => {
    const result = safeToSpend({ wallets, transactions, allowance, setAsideCentavos: 0 }) // set-asides: feat/school-expenses
    return {
      result,
      allowance,
      spendingWallets: wallets.filter((w) => w.type === 'spending' && !w.archived),
      budgetDays: budgetDayList(result.today, allowance),
    }
  }, [wallets, transactions, allowance])
}

/** "₱720 ÷ 4 class days" — the division behind the daily budget. */
export function divisionText(t: Today): string {
  const unit = t.allowance.countClassDays ? 'class day' : 'day'
  return `${formatPeso(Math.max(0, t.result.readyToSpend))} ÷ ${t.result.budgetDays} ${unit}${t.result.budgetDays === 1 ? '' : 's'}`
}
