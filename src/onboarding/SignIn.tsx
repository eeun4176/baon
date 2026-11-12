/*
 * SignIn.tsx — Onboarding screen 2 (design "2 Sign in"): Continue with Google,
 * or "Use email instead" → 6-digit code. Needs internet; shows a calm message offline.
 * The auth module is loaded on demand so the offline app never downloads it.
 */
import { useState, useSyncExternalStore } from 'react'
import type { SignedInUser } from '../auth/auth.ts'
import type { DocId } from '../legal/docs.ts'
import { PolicyDialog } from '../legal/Legal.tsx'
import { Button, Icon } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'
import { Step } from './Step.tsx'

const policyLink = 'font-extrabold text-blue underline'

/** Subscribes to the browser's online/offline events. */
function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** True while the phone has a connection (re-renders when it changes). */
function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}

/**
 * Sign-in step. Calls onSignedIn after the email code works; Google leaves the page and comes
 * back to `returnTo` (default: the start page). `inSetup` false (lock screen): no step numbers.
 */
export function SignIn({ onBack, onSignedIn, returnTo = '/', inSetup = true }: { onBack?: () => void; onSignedIn: (user: SignedInUser) => void; returnTo?: string; inSetup?: boolean }) {
  const online = useOnline()
  const [mode, setMode] = useState<'choose' | 'email' | 'code'>('choose')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [policy, setPolicy] = useState<DocId | null>(null)

  /** Runs an auth action with a busy state and a friendly error message. */
  async function attempt(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Something went wrong. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const google = () =>
    attempt(async () => {
      const auth = await import('../auth/auth.ts')
      await auth.signInWithGoogle(`${location.origin}${returnTo}`)
    })

  const sendCode = () =>
    attempt(async () => {
      const auth = await import('../auth/auth.ts')
      await auth.sendEmailCode(email.trim())
      setMode('code')
    })

  const verify = () =>
    attempt(async () => {
      const auth = await import('../auth/auth.ts')
      await auth.verifyEmailCode(email.trim(), code)
      const user = await auth.currentUser()
      if (!user) throw new Error(tr('Signed in, but we couldn’t read your account. Try again.'))
      onSignedIn(user)
    })

  return (
    <Step n={inSetup ? 1 : undefined} onBack={onBack} title={tr('Sign in to get started')} sub={tr('No password needed. It’s just to know it’s you.')}>
      {!online && (
        <p role="status" className="mb-4 rounded-2xl bg-pebble p-4 font-bold">
          {tr('You’re offline. Connect once to set up.')}</p>
      )}

      <div className="space-y-3">
        {mode === 'choose' && (
          <>
            <Button variant="dark" disabled={!online || busy} onClick={google}>
              <span className="grid size-7 place-items-center rounded-full bg-white" aria-hidden="true">
                <svg viewBox="0 0 48 48" className="size-4">{/* Google's "G" logo */}
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              </span>
              {tr('Continue with Google')}</Button>
            <Button variant="secondary" disabled={!online || busy} onClick={() => setMode('email')}>
              <Icon name="mail" />
              {tr('Use email instead')}</Button>
            <p className="text-center font-semibold text-muted">{tr('We’ll email you a 6‑digit code.')}</p>
          </>
        )}

        {mode === 'email' && (
          <form onSubmit={(e) => { e.preventDefault(); sendCode() }} className="space-y-3">
            <label className="block font-extrabold">
              {tr('Your email')}<input
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 block min-h-14 w-full rounded-full bg-pebble px-5 text-lg font-bold outline-blue"
              />
            </label>
            <Button type="submit" disabled={!online || busy || !email.includes('@')}>{busy ? tr('Sending…') : tr('Send code')}</Button>
            <Button variant="secondary" onClick={() => setMode('choose')}>{tr('Back to Google')}</Button>
          </form>
        )}

        {mode === 'code' && (
          <form onSubmit={(e) => { e.preventDefault(); verify() }} className="space-y-3">
            <label className="block font-extrabold">
              {tr('6‑digit code sent to')}{' '}{email}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="mt-2 block min-h-14 w-full rounded-full bg-pebble px-5 text-center text-2xl font-black tracking-[0.4em] outline-blue"
              />
            </label>
            <Button type="submit" disabled={!online || busy || code.length !== 6}>{busy ? tr('Checking…') : tr('Continue')}</Button>
            <button type="button" onClick={() => setMode('email')} className="min-h-11 w-full font-extrabold text-blue">
              {tr('Use a different email')}</button>
          </form>
        )}

        {error && <p role="alert" className="rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-3xl bg-card p-4">
        <Icon name="shield" className="size-6 shrink-0 text-blue" />
        <p className="text-[0.9375rem] font-bold">{tr('Your records are scrambled and synced to your account.')}</p>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-muted">
        {tr('By continuing, you agree to the')}{' '}<button type="button" onClick={() => setPolicy('terms')} className={policyLink}>{tr('Terms')}</button>,{' '}
        <button type="button" onClick={() => setPolicy('privacy')} className={policyLink}>{tr('Privacy Policy')}</button> {tr('and')}{' '}
        <button type="button" onClick={() => setPolicy('storage')} className={policyLink}>{tr('Local Storage Policy')}</button>.
      </p>
      {policy && <PolicyDialog id={policy} onClose={() => setPolicy(null)} />}
    </Step>
  )
}
