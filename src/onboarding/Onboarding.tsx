/*
 * Onboarding.tsx — Runs the 5 first-time screens in order (plan §4.1):
 *   Welcome → Sign in → Whose phone? → Your baon → Your money now → Home
 * or, from "Whose phone?", Restore a backup → Home (records come from the file),
 * or, if the account already has records online (another device), Welcome back → records download → Home.
 * Google sign-in leaves the page and comes back; on return we detect the session
 * and continue at "Whose phone?" so nothing has to be re-typed.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { SignedInUser } from '../auth/auth.ts'
import { manilaDate } from '../budget/days.ts'
import { RestoreForm } from '../backup/BackupPanel.tsx'
import { JoinSync } from '../sync/JoinSync.tsx'
import { Screen, StepHeader, Title } from '../ui/kit.tsx'
import { openVault, type Vault } from '../vault/vault.ts'
import { initialBaon, initialMoney, toAllowance, toBalances, type BaonAnswers, type MoneyAnswers } from './answers.ts'
import { BrandPanel } from './BrandPanel.tsx'
import { setupAccount } from './setupAccount.ts'
import { SignIn } from './SignIn.tsx'
import { Welcome } from './Welcome.tsx'
import { WhosePhone } from './WhosePhone.tsx'
import { YourBaon } from './YourBaon.tsx'
import { YourMoney } from './YourMoney.tsx'

type Step = 'welcome' | 'signin' | 'phone' | 'baon' | 'money' | 'restore' | 'join'

/** First-time setup. Calls onDone with the new, unlocked vault. */
export function Onboarding({ onDone }: { onDone: (vault: Vault, name: string) => void }) {
  const [step, setStep] = useState<Step>('welcome')
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [today] = useState(() => manilaDate())
  const [baon, setBaon] = useState<BaonAnswers>(() => initialBaon(today))
  const [money, setMoney] = useState<MoneyAnswers>(initialMoney)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  // Signed in and this account already has records online (another device): bring them here.
  useEffect(() => {
    if (!user) return
    Promise.all([import('../sync/sync.ts'), import('../sync/neonRemote.ts')])
      .then(([sync, { neonRemote }]) => sync.cloudHasAccount(neonRemote(user.id)))
      .then((has) => has && setStep((s) => (s === 'phone' ? 'join' : s)))
      .catch(() => {}) // offline or sync not set up: normal setup
  }, [user])

  /** Moves to a step and clears the previous step's error. */
  const go = (next: Step) => {
    setError('')
    setStep(next)
    window.scrollTo(0, 0)
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
      onDone(vault, user.name)
    } catch {
      setError('Couldn’t save on this phone. Check that storage isn’t full, then try again.')
      setBusy(false)
    }
  }

  const screens: Record<Step, ReactNode> = {
    welcome: <Welcome onStart={() => go(user ? 'phone' : 'signin')} />,
    signin: <SignIn onBack={() => go('welcome')} onSignedIn={(u) => { setUser(u); go('phone') }} />,
    phone: <WhosePhone onContinue={() => go('baon')} onRestore={() => go('restore')} />,
    join: user && <JoinSync user={user} onDone={onDone} onSkip={() => go('phone')} />,
    restore: user && (
      <Screen>
        <StepHeader step={2} onBack={() => go('phone')} />
        <Title sub="Pick your baon-backup file and type the recovery code you saved.">Restore your backup</Title>
        <RestoreForm userId={user.id} fallbackName={user.name} onRestored={(name) => openVault(user.id).then((vault) => onDone(vault, name), () => setError('Restored, but couldn’t open it. Close Baon and open it again.'))} />
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
