/*
 * Onboarding.tsx — Runs the 5 first-time screens in order (plan §4.1):
 *   Welcome → Sign in → Whose phone? → Your baon → Your money now → Home
 * Google sign-in leaves the page and comes back; on return we detect the session
 * and continue at "Whose phone?" so nothing has to be re-typed.
 */
import { useEffect, useState } from 'react'
import type { SignedInUser } from '../auth/auth.ts'
import { manilaDate } from '../budget/days.ts'
import type { Vault } from '../vault/vault.ts'
import { initialBaon, initialMoney, toAllowance, toBalances, type BaonAnswers, type MoneyAnswers } from './answers.ts'
import { setupAccount } from './setupAccount.ts'
import { SignIn } from './SignIn.tsx'
import { Welcome } from './Welcome.tsx'
import { WhosePhone } from './WhosePhone.tsx'
import { YourBaon } from './YourBaon.tsx'
import { YourMoney } from './YourMoney.tsx'

type Step = 'welcome' | 'signin' | 'phone' | 'baon' | 'money'

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

  switch (step) {
    case 'welcome':
      return <Welcome onStart={() => go(user ? 'phone' : 'signin')} />
    case 'signin':
      return <SignIn onBack={() => go('welcome')} onSignedIn={(u) => { setUser(u); go('phone') }} />
    case 'phone':
      return <WhosePhone onContinue={() => go('baon')} />
    case 'baon':
      return <YourBaon value={baon} onChange={setBaon} today={today} error={error} onBack={() => go('phone')} onContinue={continueFromBaon} />
    case 'money':
      return <YourMoney value={money} onChange={setMoney} error={error} busy={busy} onBack={() => go('baon')} onFinish={finish} />
  }
}
