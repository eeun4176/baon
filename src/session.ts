/*
 * session.ts — The unlocked account, shared with every screen through React context.
 * Records are decrypted ONCE when the app opens and kept in memory (never persisted
 * in plain text); saving or undoing updates every screen at once (plan §8 "State:
 * UI + unlocked session only"). The provider lives in shell/SessionProvider.tsx.
 */
import { createContext, useContext } from 'react'
import type { Presets } from './add/presets.ts'
import type { Allowance } from './budget/allowance.ts'
import type { Profile } from './me/profile.ts'
import type { Transaction, Wallet } from './ledger/ledger.ts'
import type { OwnCategory } from './add/categories.ts'
import type { Limits } from './plan/limits.ts'
import type { SchoolExpense } from './plan/school.ts'
import type { DaySnapshot } from './streak/streak.ts'
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
  snapshots: DaySnapshot[] // each day's budget, for the streak
  presets: Presets // one-tap buttons on Home
  profile: Profile // school, Senior high / College
  limits: Limits // category limits for this allowance cycle (Plan)
  ownCategories: OwnCategory[] // categories the student added (removed ones kept for old entries)
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
  /** Saves (or replaces) one day's snapshot. */
  saveSnapshot(snap: DaySnapshot): Promise<void>
  /** Saves the one-tap buttons (order = button order). */
  savePresets(presets: Presets): Promise<void>
  /** Saves the category limits (an empty object = none). */
  saveLimits(limits: Limits): Promise<void>
  /** Saves the student's own categories. */
  saveOwnCategories(list: OwnCategory[]): Promise<void>
  /** Changes the display name (already checked with checkName). */
  rename(name: string): Promise<void>
  /** Saves school / level. */
  saveProfile(profile: Profile): Promise<void>
  /** Adds or updates a wallet (rename, archive). */
  saveWallet(wallet: Wallet): Promise<void>
  toast: Toast | null
  showToast(toast: Toast): void
  dismissToast(): void
  /** Ends the online session (if reachable), locks the vault and leaves the app. Records stay on the device. Shared phone mode: just locks ("Lock"). */
  signOut(): void
  /** Re-reads every record (after sync brought changes from another device). */
  reload(): void
}

export const SessionContext = createContext<Session | null>(null)

/** The current unlocked account. Only used inside the signed-in app. */
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession used outside the unlocked app')
  return session
}
