/*
 * SyncSection.tsx — "Sync across devices" on Me → Backup and the Backup page.
 * Sync is always on (sync.ts, run by useSync.ts); this shows when it last worked, what's wrong
 * if it can't run (no internet, signed out) and a Sync now / Sign in again button.
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { SignIn } from '../onboarding/SignIn.tsx'
import { useSession } from '../session.ts'
import { runSync, useSyncStatus } from './useSync.ts'

const pill = 'min-h-12 rounded-full px-5 font-black disabled:opacity-60'
const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })

/** "9:47 AM" today, else "Nov 10". */
function when(iso: string): string {
  const d = new Date(iso)
  return day.format(d) === day.format(new Date()) ? time.format(d) : day.format(d)
}

/** The section. */
export function SyncSection() {
  const { vault, reload } = useSession()
  const status = useSyncStatus()
  const [signingIn, setSigningIn] = useState(false)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const resumed = useRef(false)

  // Back from "Sign in again" with Google (?sync=on): the address also carries Neon's one-time
  // sign-in pass, so the sign-in code must read it (it then removes it) before ?sync is cleared.
  useEffect(() => {
    if (resumed.current || !new URLSearchParams(search).has('sync')) return
    resumed.current = true
    import('../auth/auth.ts')
      .then((auth) => auth.currentUser())
      .catch(() => null)
      .finally(() => {
        navigate(pathname, { replace: true })
        runSync(vault, reload)
      })
  })

  const line = status.syncing
    ? 'Syncing…'
    : status.problem === 'offline'
      ? 'Waiting for internet. Changes are saved here and will sync later.'
      : status.problem === 'signin'
        ? 'You’re signed out, so this device isn’t syncing.'
        : status.problem === 'server'
          ? 'Couldn’t sync just now. baon will try again.'
          : status.lastSyncedAt
            ? `Synced · ${when(status.lastSyncedAt)}`
            : 'Not synced yet'

  return (
    <section aria-labelledby="sync-title">
      <h2 id="sync-title" className="text-xl font-black">Sync across devices</h2>
      <p className="mt-1 font-semibold text-muted">Your records follow you to every phone, tablet or computer where you sign in to baon.</p>
      <p role="status" className="mt-3 rounded-2xl bg-page p-3 font-bold">{line}</p>
      <div className="mt-3">
        {status.problem === 'signin' ? (
          <button type="button" onClick={() => setSigningIn(true)} className={`${pill} bg-blue text-white`}>Sign in again</button>
        ) : (
          <button type="button" disabled={status.syncing} onClick={() => runSync(vault, reload)} className={`${pill} bg-pebble hover:bg-pebble-2`}>Sync now</button>
        )}
      </div>
      {signingIn && <SignInAgain onClose={() => setSigningIn(false)} onSignedIn={() => runSync(vault, reload)} />}
    </section>
  )
}

/**
 * Full-screen sign-in when there's no online sign-in on this device (records stay unlocked here).
 * Email code: continues right away. Google: comes back to /backup?sync=on, which syncs.
 */
function SignInAgain({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const { vault, showToast } = useSession()
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-page">
      <SignIn
        returnTo="/backup?sync=on"
        onBack={onClose}
        onSignedIn={async (user) => {
          if (user.id !== vault.userId) {
            await import('../auth/auth.ts').then((auth) => auth.signOut()).catch(() => {})
            showToast({ message: 'That’s a different account. Sign in with the one you use here.' })
            return
          }
          onClose()
          onSignedIn()
        }}
      />
    </div>
  )
}
