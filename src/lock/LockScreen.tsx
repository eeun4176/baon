/*
 * LockScreen.tsx — Shared phone mode: what Baon shows every time it opens (and after a minute away).
 *   Locked   → type the passphrase → the app opens
 *   Forgot?  → prove it's you with the Recovery Kit code, or by signing in again (Google or email
 *              code), then make a new passphrase. Nothing is lost: the records stay on the phone.
 * Signing in again always starts from signed out, so an online sign-in left on this phone can't
 * skip the check. Google leaves the page and comes back to /?reset=1 (marked in sessionStorage
 * first, so typing that address by hand does nothing).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import logoIcon from '../assets/logo-icon.png'
import type { SignedInUser } from '../auth/auth.ts'
import { backupStatus, fromB64, keyFromRecoveryCode } from '../backup/backup.ts'
import { importDek } from '../crypto/crypto.ts'
import { firstName } from '../home/greetings.ts'
import { SignIn } from '../onboarding/SignIn.tsx'
import { Screen, Title } from '../ui/kit.tsx'
import { openVault, resetPassphrase, WrongPassphrase, type Vault } from '../vault/vault.ts'
import { NewPassphrase } from './NewPassphrase.tsx'
import { field, label, primary } from './passphrase.ts'
import { tr } from '../i18n/i18n.ts'

const RESET_FLAG = 'baon.reset' // this tab started "Sign in again" for this account
const link = 'min-h-11 w-full font-extrabold text-blue hover:underline'
const secondary = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2 disabled:opacity-60'

type View = 'lock' | 'forgot' | 'code' | 'signin' | 'new'

/** Reads/writes the "Sign in again" mark; blocked storage just means Google can't finish the reset. */
function resetFlag(value?: string | null): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(RESET_FLAG)
    if (value === null) sessionStorage.removeItem(RESET_FLAG)
    else sessionStorage.setItem(RESET_FLAG, value)
  } catch {
    // storage blocked
  }
  return null
}

/** The lock screen for one account. */
export function LockScreen({ userId, name, onUnlocked, onSwitch }: { userId: string; name: string; onUnlocked: (vault: Vault) => void; onSwitch: () => void }) {
  const [view, setView] = useState<View>('lock')
  const [passphrase, setPassphrase] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasCode, setHasCode] = useState(false)
  const dek = useRef<CryptoKey | null>(null) // the account key, once "Forgot?" proved it's them
  const resumed = useRef(false)

  useEffect(() => {
    backupStatus(userId).then((s) => setHasCode(s.hasCode), () => {})
  }, [userId])

  /** Moves to a view and clears the old error. */
  const go = (next: View) => {
    setError('')
    setView(next)
  }

  /** Signed in again: it must be this account; its key (online) must open this phone's records. */
  async function fromAccount(user: SignedInUser) {
    resetFlag(null)
    setBusy(true)
    try {
      if (user.id !== userId) {
        await import('../auth/auth.ts').then((auth) => auth.signOut()).catch(() => {})
        throw new Error(tr('That’s a different account. Sign in with the one you use here.'))
      }
      const { neonRemote } = await import('../sync/neonRemote.ts')
      const key = await neonRemote(userId).getKey().catch(() => {
        throw new Error(tr('Couldn’t reach your account. Check your internet and try again.'))
      })
      if (!key) throw new Error(tr('Your account doesn’t have your records yet. Use your recovery code instead.'))
      dek.current = await importDek(fromB64(key.dek))
      go('new')
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Something went wrong. Try again.'))
      setView('forgot')
    } finally {
      setBusy(false)
    }
  }

  // Back from Google during "Sign in again": read the sign-in (Neon's one-time pass is in the address), then clean the address.
  useEffect(() => {
    if (resumed.current || !new URLSearchParams(location.search).has('reset')) return
    resumed.current = true
    const started = resetFlag() === userId
    import('../auth/auth.ts')
      .then((auth) => auth.currentUser())
      .catch(() => null)
      .then((user) => {
        window.history.replaceState(null, '', '/')
        if (started && user) fromAccount(user)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first render
  }, [])

  /** Unlock with the passphrase. */
  async function unlock(e: FormEvent) {
    e.preventDefault()
    if (!passphrase) return setError(tr('Type your passphrase.'))
    setBusy(true)
    setError('')
    try {
      onUnlocked(await openVault(userId, passphrase))
    } catch (err) {
      setError(err instanceof WrongPassphrase ? tr('That passphrase isn’t right. Try again.') : tr('Baon couldn’t open its storage on this phone. Close the app and open it again.'))
      setBusy(false)
    }
  }

  /** Forgot → recovery code. */
  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      dek.current = await keyFromRecoveryCode(userId, code)
      go('new')
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Something went wrong. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  /** Forgot → sign in again: always from signed out, so only a real sign-in counts. */
  async function startSignIn() {
    setBusy(true)
    setError('')
    try {
      const auth = await import('../auth/auth.ts')
      await auth.signOut()
      resetFlag(userId)
      go('signin')
    } catch {
      setError(tr('You’re offline. Connect to the internet to sign in again.'))
    } finally {
      setBusy(false)
    }
  }

  /** Saves the new passphrase with the proven key and opens the app. */
  async function saveNew(next: string) {
    try {
      onUnlocked(await resetPassphrase(userId, dek.current!, next))
    } catch (e) {
      throw new Error(e instanceof WrongPassphrase ? tr('That key doesn’t open the records on this phone. Try your recovery code instead.') : tr('Couldn’t save. Try again.'), { cause: e })
    }
  }

  if (view === 'signin') return <SignIn inSetup={false} returnTo="/?reset=1" onBack={() => go('forgot')} onSignedIn={fromAccount} />

  const alert = error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>
  return (
    <Screen>
      <header className="flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight">
        <img src={logoIcon} alt="" className="size-10" />
        {tr('Baon')}</header>
      <div className="mt-12 animate-rise">
        {view === 'lock' && (
          <>
            <Title sub={tr('This phone is shared, so Baon asks for your passphrase.')}>{tr('Hi, {0}', firstName(name))}</Title>
            <form onSubmit={unlock} noValidate>
              <label className={label}>
                {tr('Passphrase')}<input type="password" autoComplete="current-password" autoFocus value={passphrase} onChange={(e) => { setPassphrase(e.target.value); setError('') }} className={field} />
              </label>
              {alert}
              <button type="submit" disabled={busy} className={`${primary} mt-5`}>{busy ? tr('Opening…') : tr('Open Baon')}</button>
            </form>
            <button type="button" onClick={() => go('forgot')} className={`${link} mt-4`}>{tr('Forgot your passphrase?')}</button>
            <button type="button" onClick={onSwitch} className={link}>{tr('Not you? Use another account')}</button>
          </>
        )}

        {view === 'forgot' && (
          <>
            <Title sub={tr('Show it’s you, then make a new passphrase. Your records stay.')}>{tr('Forgot your passphrase?')}</Title>
            <div className="space-y-3">
              {hasCode && <button type="button" disabled={busy} onClick={() => go('code')} className={secondary}>{tr('Use my recovery code')}</button>}
              <button type="button" disabled={busy} onClick={startSignIn} className={secondary}>{busy ? tr('Checking…') : tr('Sign in again')}</button>
            </div>
            {alert}
            <button type="button" onClick={() => go('lock')} className={`${link} mt-4`}>{tr('Back')}</button>
          </>
        )}

        {view === 'code' && (
          <>
            <Title sub={tr('The code from your Recovery Kit, in groups of 4.')}>{tr('Use my recovery code')}</Title>
            <form onSubmit={submitCode} noValidate>
              <label className={label}>
                {tr('Recovery code')}<input autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => { setCode(e.target.value); setError('') }} className={`${field} uppercase`} />
              </label>
              {alert}
              <button type="submit" disabled={busy || !code.trim()} className={`${primary} mt-5`}>{busy ? tr('Checking…') : tr('Continue')}</button>
            </form>
            <button type="button" onClick={() => go('forgot')} className={`${link} mt-4`}>{tr('Back')}</button>
          </>
        )}

        {view === 'new' && (
          <>
            <Title sub={tr('It’s you. Make a new passphrase to open Baon.')}>{tr('Make a new passphrase')}</Title>
            <NewPassphrase submitLabel={tr('Save and open Baon')} onSave={saveNew} />
          </>
        )}
      </div>
    </Screen>
  )
}
