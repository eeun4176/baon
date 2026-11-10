/*
 * useToday.ts — Loads the student's records from the vault and computes today's
 * numbers. Shared by Home and "How it's counted" so both always agree.
 */
import { useEffect, useState } from 'react'
import { loadAllowance, type Allowance } from '../budget/allowance.ts'
import { budgetDayList, safeToSpend, type SafeToSpend } from '../budget/safeToSpend.ts'
import type { Wallet } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { loadTransactions, loadWallets } from '../ledger/repo.ts'
import { useSession } from '../session.ts'
import type { Vault } from '../vault/vault.ts'

export interface Today {
  result: SafeToSpend
  allowance: Allowance
  spendingWallets: Wallet[] // for "In wallets: Cash + GCash"
  budgetDays: string[] // the days the money covers, e.g. We Th Fr Sa
}

/** Reads everything needed for today from the encrypted vault. */
async function load(vault: Vault): Promise<Today> {
  const [wallets, transactions, allowance] = await Promise.all([loadWallets(vault), loadTransactions(vault), loadAllowance(vault)])
  if (!allowance) throw new Error('Allowance not set up')
  const result = safeToSpend({ wallets, transactions, allowance, setAsideCentavos: 0 }) // set-asides: feat/school-expenses
  return {
    result,
    allowance,
    spendingWallets: wallets.filter((w) => w.type === 'spending' && !w.archived),
    budgetDays: budgetDayList(result.today, allowance),
  }
}

/** Today's numbers for the signed-in student: `undefined` while loading, `null` if it failed. */
export function useToday(): Today | null | undefined {
  const { vault } = useSession()
  const [today, setToday] = useState<Today | null | undefined>(undefined)
  useEffect(() => {
    load(vault).then(setToday, () => setToday(null))
  }, [vault])
  return today
}

/** "₱720 ÷ 4 class days" — the division behind the daily budget. */
export function divisionText(t: Today): string {
  const unit = t.allowance.countClassDays ? 'class day' : 'day'
  return `${formatPeso(Math.max(0, t.result.readyToSpend))} ÷ ${t.result.budgetDays} ${unit}${t.result.budgetDays === 1 ? '' : 's'}`
}
