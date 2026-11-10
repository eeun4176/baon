/*
 * session.ts — The unlocked account, shared with every screen through React context.
 * Records are decrypted ONCE when the app opens and kept in memory (never persisted
 * in plain text); saving or undoing updates every screen at once (plan §8 "State:
 * UI + unlocked session only"). The provider lives in shell/SessionProvider.tsx.
 */
import { createContext, useContext } from 'react'
import type { Allowance } from './budget/allowance.ts'
import type { Transaction, Wallet } from './ledger/ledger.ts'
import type { SchoolExpense } from './plan/school.ts'
import type { Vault } from './vault/vault.ts'

/** A short message at the bottom of the screen, optionally with Undo (plan §4.2: 5 s). */
export interface Toast {
  message: string
  undo?: () => void
  leaving?: boolean // set while it animates out
}

export interface Session {
  vault: Vault
  name: string
  wallets: Wallet[]
  transactions: Transaction[] // oldest first
  allowance: Allowance
  schoolExpenses: SchoolExpense[]
  /** Validates, encrypts and saves a transaction; throws a friendly message if a rule is broken. */
  addTransaction(tx: Transaction): Promise<void>
  /** Deletes a transaction (Undo, delete in History). */
  removeTransaction(id: string): Promise<void>
  /** Saves a school expense (add, edit, set aside). */
  saveSchoolExpense(item: SchoolExpense): Promise<void>
  /** Deletes a school expense (its payment, if any, stays in History). */
  removeSchoolExpense(id: string): Promise<void>
  /** Saves a changed allowance setup (e.g. class days on Plan). */
  updateAllowance(allowance: Allowance): Promise<void>
  toast: Toast | null
  showToast(toast: Toast): void
  dismissToast(): void
  /** Ends the online session (if reachable), locks the vault and leaves the app. Records stay on the device. */
  signOut(): void
}

export const SessionContext = createContext<Session | null>(null)

/** The current unlocked account. Only used inside the signed-in app. */
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession used outside the unlocked app')
  return session
}
