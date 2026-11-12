/*
 * Onboarding.tsx — Runs the 5 first-time screens in order (plan §4.1):
 *   Welcome → Sign in → Whose phone? → Your baon → Your money now → Home
 * or, from "Whose phone?", Restore a backup → Home (records come from the file),
 * or, if the account already has records online (another device), Welcome back → records download → Home.
 * "Shared with family or classmates" adds Make a passphrase right after Whose phone?; the new account
 * is locked with it before Home opens (vault.protect).
 * Adding another account (`adding`): same steps, Shared picked first, a way back to the accounts, and
 * if the person who signs in already has Baon on this phone, that account opens instead (onExisting).
 * Google sign-in leaves the page and comes back; on return we detect the session
 * and continue at "Whose phone?" so nothing has to be re-typed.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SignedInUser } from '../auth/auth.ts'
import type { DeviceMode } from '../db/db.ts'
import { NewPassphrase } from '../lock/NewPassphrase.tsx'
import { manilaDate } from '../budget/days.ts'
import { RestoreForm } from '../backup/BackupPanel.tsx'
import { JoinSync } from '../sync/JoinSync.tsx'
import { Screen, StepHeader, Title } from '../ui/kit.tsx'
import { listDeviceAccounts, openVault, type Vault } from '../vault/vault.ts'
import { initialBaon, initialMoney, toAllowance, toBalances, type BaonAnswers, type MoneyAnswers } from './answers.ts'
import { BrandPanel } from './BrandPanel.tsx'
import { setupAccount } from './setupAccount.ts'
import { SignIn } from './SignIn.tsx'
import { Welcome } from './Welcome.tsx'
import { WhosePhone } from './WhosePhone.tsx'
import { YourBaon } from './YourBaon.tsx'
import { YourMoney } from './YourMoney.tsx'
import { tr } from '../i18n/i18n.ts'

type Step = 'welcome' | 'signin' | 'phone' | 'pass' | 'baon' | 'money' | 'restore' | 'join'

/** First-time setup. Calls onDone with the new, unlocked vault. */
export function Onboarding({ adding = false, onDone, onCancel, onExisting }: {
  adding?: boolean
  onDone: (vault: Vault, name: string) => void
  onCancel?: () => void
  onExisting: (userId: string) => void
}) {
  const [step, setStep] = useState<Step>('welcome')
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [today] = useState(() => manilaDate())
  const [baon, setBaon] = useState<BaonAnswers>(() => initialBaon(today))
  const [money, setMoney] = useState<MoneyAnswers>(initialMoney)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<DeviceMode>(adding ? 'shared' : 'my-phone') // a second person on this phone: lock by default
  const checked = useRef('')
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const [afterPass, setAfterPass] = useState<Step>('baon') // where Make a passphrase continues to
  const [hasCloud, setHasCloud] = useState(false) // the account has records online: bring them instead of asking

  // Coming back from Google (or reopening mid-setup): if already signed in, skip ahead.
  useEffect(() => {
    import('../auth/auth.ts')
      .then((auth) => auth.currentUser())
      .then((u) => {
        if (!u) return
        setUser(u)
        setStep((s) => (s === 'welcome' || s === 'signin' ? 'phone' : s))
      })
      .catch(() => {}) // offline: stay on Welcome; Sign in explains what to do
  }, [])

  // Signed in and already on this phone (e.g. tapped Add another account, then picked their own): open it.
  useEffect(() => {
    if (!user || checked.current === user.id) return
    checked.current = user.id
    listDeviceAccounts().then((list) => list.some((a) => a.userId === user.id) && onExisting(user.id), () => {})
  }, [user, onExisting])

  // Signed in and this account already has records online (another device): bring them here.
  useEffect(() => {
    if (!user) return
    Promise.all([import('../sync/sync.ts'), import('../sync/neonRemote.ts')])
      .then(([sync, { neonRemote }]) => sync.cloudHasAccount(neonRemote(user.id)))
      .then((has) => {
        if (!has) return
        setHasCloud(true)
        setStep((s) => (s === 'baon' ? 'join' : s)) // already past Whose phone? before the check finished
      })
      .catch(() => {}) // offline or sync not set up: normal setup
  }, [user])

  /** Moves to a step and clears the previous step's error. */
  const go = (next: Step) => {
    setError('')
    setStep(next)
    window.scrollTo(0, 0)
  }

  /** Whose phone? → Make a passphrase (shared) → then `next`. */
  function afterPhone(next: Step) {
    if (mode === 'shared') {
      setAfterPass(next)
      return go('pass')
    }
    setPassphrase(null)
    go(next)
  }

  /** Hands the new account to the app, locked with the passphrase first in Shared phone mode. */
  async function done(vault: Vault, name: string) {
    // shortcut: if this re-lock fails (storage error) the account stays in My phone mode; Me → Security shows the real mode.
    if (passphrase) await vault.protect(passphrase).catch(() => {})
    onDone(vault, name)
  }

  /** Screen 4 → 5, only if the allowance answers make sense. */
  function continueFromBaon() {
    const result = toAllowance(baon, today)
    if (typeof result === 'string') return setError(result)
    go('money')
  }

  /** Screen 5: validate, create the encrypted account, then hand over to Home. */
  async function finish() {
    const allowance = toAllowance(baon, today)
    const balances = toBalances(money)
    if (typeof allowance === 'string') return go('baon')
    if (typeof balances === 'string') return setError(balances)
    if (!user) return go('signin')

    setBusy(true)
    try {
      const vault = await setupAccount({ userId: user.id, name: user.name, allowance, ...balances })
      await done(vault, user.name)
    } catch {
      setError(tr('Couldn’t save on this phone. Check that storage isn’t full, then try again.'))
      setBusy(false)
    }
  }

  const screens: Record<Step, ReactNode> = {
    welcome: <Welcome onStart={() => go(user ? 'phone' : 'signin')} onBack={onCancel} />,
    signin: <SignIn onBack={() => go('welcome')} onSignedIn={(u) => { setUser(u); go('phone') }} />,
    phone: <WhosePhone mode={mode} onMode={setMode} onContinue={() => afterPhone(hasCloud ? 'join' : 'baon')} onRestore={() => afterPhone('restore')} />,
    pass: (
      <Screen>
        <StepHeader step={2} onBack={() => go('phone')} />
        <Title sub={tr('Baon will ask for it every time it opens, so others using this phone can’t see your records.')}>{tr('Make a passphrase')}</Title>
        <NewPassphrase submitLabel={tr('Continue')} onSave={async (p) => { setPassphrase(p); go(afterPass === 'baon' && hasCloud ? 'join' : afterPass) }} />
      </Screen>
    ),
    join: user && <JoinSync user={user} onDone={done} onSkip={() => go('baon')} />,
    restore: user && (
      <Screen>
        <StepHeader step={2} onBack={() => go('phone')} />
        <Title sub={tr('Pick your baon-backup file and type the recovery code you saved.')}>{tr('Restore your backup')}</Title>
        <RestoreForm userId={user.id} fallbackName={user.name} onRestored={(name) => openVault(user.id).then((vault) => done(vault, name), () => setError(tr('Restored, but couldn’t open it. Close Baon and open it again.')))} />
        {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
      </Screen>
    ),
    baon: <YourBaon value={baon} onChange={setBaon} today={today} error={error} onBack={() => go('phone')} onContinue={continueFromBaon} />,
    money: <YourMoney value={money} onChange={setMoney} error={error} busy={busy} onBack={() => go('baon')} onFinish={finish} />,
  }

  // Phone/tablet: just the step. Desktop (≥ 1024px): brand panel left, step centered right.
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-2">
      <BrandPanel />
      <div className="lg:flex lg:items-center">
        <div className="w-full">{screens[step]}</div>
      </div>
    </div>
  )
}
