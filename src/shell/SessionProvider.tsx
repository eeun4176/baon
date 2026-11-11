/*
 * SessionProvider.tsx — Loads the student's records from the encrypted vault once,
 * keeps them in memory, and gives every screen the same data plus save/undo actions.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadPresets, savePresets as storePresets, type Presets } from '../add/presets.ts'
import { loadAllowance, saveAllowance, type Allowance } from '../budget/allowance.ts'
import { sortWallets, type Transaction, type Wallet } from '../ledger/ledger.ts'
import { deleteTransaction, loadTransactions, loadWallets, saveTransaction, saveWallet as storeWallet } from '../ledger/repo.ts'
import { loadProfile, saveProfile as storeProfile, type Profile } from '../me/profile.ts'
import { loadSchoolExpenses, saveSchoolExpense as storeSchoolExpense, type SchoolExpense } from '../plan/school.ts'
import { loadSnapshots, saveSnapshot as storeSnapshot, type DaySnapshot } from '../streak/streak.ts'
import { SessionContext, type Session, type Toast } from '../session.ts'
import { Screen } from '../ui/kit.tsx'
import { listDeviceAccounts, renameAccount, type Vault } from '../vault/vault.ts'

interface Records {
  wallets: Wallet[]
  transactions: Transaction[]
  allowance: Allowance
  schoolExpenses: SchoolExpense[]
  snapshots: DaySnapshot[]
  presets: Presets
  profile: Profile
}

/** Decrypts everything the screens need (a student has a few thousand records a year at most). */
async function loadRecords(vault: Vault): Promise<Records> {
  const [wallets, transactions, allowance, schoolExpenses, snapshots, presets, profile] = await Promise.all([
    loadWallets(vault), loadTransactions(vault), loadAllowance(vault), loadSchoolExpenses(vault), loadSnapshots(vault), loadPresets(vault), loadProfile(vault),
  ])
  if (!allowance) throw new Error('Allowance not set up')
  return { wallets, transactions, allowance, schoolExpenses, snapshots, presets, profile }
}

/** Keeps transactions in time order after adding one. */
const byTime = (a: Transaction, b: Transaction) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)

/** Provides the unlocked session to everything inside it. */
export function SessionProvider({ vault, name: initialName, onSignOut, children }: { vault: Vault; name: string; onSignOut: (name: string) => void; children: ReactNode }) {
  const [name, setName] = useState(initialName)
  const [records, setRecords] = useState<Records | null | undefined>(undefined)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    loadRecords(vault).then(setRecords, () => setRecords(null))
  }, [vault])

  const addTransaction = useCallback(
    async (tx: Transaction) => {
      if (!records) return
      await saveTransaction(vault, tx, records.wallets)
      setRecords((r) => r && { ...r, transactions: [...r.transactions.filter((t) => t.id !== tx.id), tx].sort(byTime) })
    },
    [vault, records],
  )

  const removeTransaction = useCallback(
    async (id: string) => {
      await deleteTransaction(vault, id)
      setRecords((r) => r && { ...r, transactions: r.transactions.filter((t) => t.id !== id) })
    },
    [vault],
  )

  const saveSchoolExpense = useCallback(
    async (item: SchoolExpense) => {
      await storeSchoolExpense(vault, item)
      setRecords((r) => r && { ...r, schoolExpenses: [...r.schoolExpenses.filter((i) => i.id !== item.id), item] })
    },
    [vault],
  )

  const removeSchoolExpense = useCallback(
    async (id: string) => {
      await vault.remove(id)
      setRecords((r) => r && { ...r, schoolExpenses: r.schoolExpenses.filter((i) => i.id !== id) })
    },
    [vault],
  )

  const updateAllowance = useCallback(
    async (allowance: Allowance) => {
      await saveAllowance(vault, allowance)
      setRecords((r) => r && { ...r, allowance })
    },
    [vault],
  )

  const saveSnapshot = useCallback(
    async (snap: DaySnapshot) => {
      await storeSnapshot(vault, snap)
      setRecords((r) => r && { ...r, snapshots: [...r.snapshots.filter((s) => s.date !== snap.date), snap] })
    },
    [vault],
  )

  const savePresets = useCallback(
    async (presets: Presets) => {
      await storePresets(vault, presets)
      setRecords((r) => r && { ...r, presets })
    },
    [vault],
  )

  const rename = useCallback(
    async (next: string) => {
      await renameAccount(vault.userId, next)
      await vault.put('settings', 'account-name', { name: next }) // so the name syncs to other devices
      setName(next)
    },
    [vault],
  )

  const reload = useCallback(() => {
    loadRecords(vault).then(setRecords, () => {}) // keep what's shown if a re-read fails
    listDeviceAccounts().then((accounts) => {
      const label = accounts.find((a) => a.userId === vault.userId)?.label
      if (label) setName(label)
    }, () => {})
  }, [vault])

  const saveProfile = useCallback(
    async (profile: Profile) => {
      await storeProfile(vault, profile)
      setRecords((r) => r && { ...r, profile })
    },
    [vault],
  )

  const saveWallet = useCallback(
    async (wallet: Wallet) => {
      await storeWallet(vault, wallet)
      setRecords((r) => r && { ...r, wallets: sortWallets([...r.wallets.filter((w) => w.id !== wallet.id), wallet]) })
    },
    [vault],
  )

  // Each toast stays 5 s (plan §4.2: Undo for 5 s), then is marked "leaving" so it can
  // slide away, and is removed 200 ms later. A newer toast restarts the timer.
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast((t) => t && (t.leaving ? null : { ...t, leaving: true })), toast.leaving ? 200 : 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  const dismissToast = useCallback(() => setToast((t) => t && { ...t, leaving: true }), [])

  const signOut = useCallback(() => {
    // Best effort online sign-out (skipped when offline); the local lock happens either way.
    import('../auth/auth.ts').then((auth) => auth.signOut()).catch(() => {})
    vault.lock()
    onSignOut(name)
  }, [vault, onSignOut, name])

  const session = useMemo<Session | null>(
    () => records ? { vault, name, ...records, addTransaction, removeTransaction, saveSchoolExpense, removeSchoolExpense, updateAllowance, saveSnapshot, savePresets, rename, saveProfile, saveWallet, toast, showToast: setToast, dismissToast, signOut, reload } : null,
    [vault, name, records, addTransaction, removeTransaction, saveSchoolExpense, removeSchoolExpense, updateAllowance, saveSnapshot, savePresets, rename, saveProfile, saveWallet, toast, dismissToast, signOut, reload],
  )

  if (records === undefined) return null // decrypting takes a moment; avoid flashing empty screens
  if (!session) {
    return (
      <Screen>
        <p role="alert" className="mt-10 text-lg font-bold">Couldn’t open your records on this device. Close Baon and open it again.</p>
      </Screen>
    )
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
