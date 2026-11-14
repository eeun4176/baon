/*
 * SignedOut.tsx — "You're signed out" (My phone mode, after Sign out). Records stay on the phone.
 * "Continue as …" signs in again (Google or email code, same account only) before opening Baon,
 * so sync, which needs that online sign-in, picks up again by itself.
 * Like the lock screen's "Sign in again": any online sign-in left on this phone is ended first, and
 * Google comes back to /?continue=1, marked in sessionStorage first so typing that address does nothing.
 * Offline: the student can continue without syncing (Me → Backup offers "Sign in again" later).
 */
import { useEffect, useRef, useState } from 'react'
import logoIcon from '../assets/logo-icon.png'
import type { SignedInUser } from '../auth/auth.ts'
import { firstName } from '../home/greetings.ts'
import { SignIn } from '../onboarding/SignIn.tsx'
import { Button, Screen } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

const CONTINUE_FLAG = 'baon.continuing' // this tab started "Continue as …" for this account

/** Reads/writes the "Continue as …" mark; blocked storage just means Google can't finish it. */
function continueFlag(value?: string | null): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(CONTINUE_FLAG)
    if (value === null) sessionStorage.removeItem(CONTINUE_FLAG)
    else sessionStorage.setItem(CONTINUE_FLAG, value)
  } catch {
    // storage blocked
  }
  return null
}

/** The signed-out screen for one account. `onContinue` opens its records. */
export function SignedOut({ userId, name, onContinue, onSwitch }: { userId: string; name: string; onContinue: () => void; onSwitch: () => void }) {
  const [signingIn, setSigningIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const resumed = useRef(false)

  /** Signed in again: it must be this account. */
  async function signedIn(user: SignedInUser) {
    continueFlag(null)
    setSigningIn(false)
    if (user.id === userId) return onContinue()
    await import('../auth/auth.ts').then((auth) => auth.signOut()).catch(() => {})
    setError(tr('That’s a different account. Sign in with the one you use here.'))
  }

  // Back from Google: read the sign-in (Neon's one-time pass is in the address), then clean the address.
  useEffect(() => {
    if (resumed.current || !new URLSearchParams(location.search).has('continue')) return
    resumed.current = true
    const started = continueFlag() === userId
    import('../auth/auth.ts')
      .then((auth) => auth.currentUser())
      .catch(() => null)
      .then((user) => {
        window.history.replaceState(null, '', '/')
        if (started && user) signedIn(user)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first render
  }, [])

  /** "Continue as …": always from signed out, so only a real sign-in counts. */
  async function start() {
    setBusy(true)
    setError('')
    try {
      const auth = await import('../auth/auth.ts')
      await auth.signOut()
      continueFlag(userId)
      setSigningIn(true)
    } catch {
      setOffline(true)
      setError(tr('You’re offline. Connect to the internet to sign in again.'))
    } finally {
      setBusy(false)
    }
  }

  if (signingIn) return <SignIn inSetup={false} returnTo="/?continue=1" onBack={() => { continueFlag(null); setSigningIn(false) }} onSignedIn={signedIn} />

  return (
    <Screen
      footer={
        <>
          {error && <p role="alert" className="mb-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
          <Button disabled={busy} onClick={start}>{tr('Continue as {0}', firstName(name))}</Button>
          {offline && <button type="button" onClick={onContinue} className="mt-2 min-h-11 w-full font-extrabold text-blue hover:underline">{tr('Continue without syncing')}</button>}
          <button type="button" onClick={onSwitch} className="mt-2 min-h-11 w-full font-extrabold text-blue hover:underline">{tr('Use another account')}</button>
        </>
      }
    >
      <header className="flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight">
        <img src={logoIcon} alt="" className="size-10" />
        {tr('Baon')}</header>
      <div className="mt-16 animate-rise">
        <h1 className="text-[2rem] leading-tight font-black">{tr('You’re signed out')}</h1>
        <p className="mt-2 text-lg font-semibold text-muted">{tr('Your records are still here, encrypted on this device.')}</p>
        <div className="mt-6 flex items-center gap-3 rounded-[28px] bg-card p-4">
          <span className="grid size-12 place-items-center rounded-full bg-blue-tint text-lg font-black text-blue" aria-hidden="true">
            {firstName(name).charAt(0).toUpperCase()}
          </span>
          <span className="font-black">{name}</span>
        </div>
      </div>
    </Screen>
  )
}
