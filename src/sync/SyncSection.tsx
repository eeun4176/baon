/*
 * SyncSection.tsx — "Sync across devices" on Me → Backup and the Backup page (opt-in).
 *   Switch on   → needs internet and a recovery code (Recovery Kit is made first if missing);
 *                 if this account already syncs from another device with different records,
 *                 asks for that recovery code and switches this device to the synced records.
 *   Switch off  → "Only on this device" or "Everywhere" (also deletes the online copies).
 *   Status      → last synced time, "Syncing…", or what's wrong (no internet, sign in again).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { RecoveryKitDialog } from '../backup/BackupPanel.tsx'
import { SignIn } from '../onboarding/SignIn.tsx'
import { useSession } from '../session.ts'
import { Switch } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { runSync, setSyncStatus, useSyncStatus } from './useSync.ts'

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40 placeholder:text-muted/60'
const pill = 'min-h-12 flex-1 rounded-full px-5 font-black disabled:opacity-60'
const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })

/** "9:47 AM" today, else "Nov 10". */
function when(iso: string): string {
  const d = new Date(iso)
  return day.format(d) === day.format(new Date()) ? time.format(d) : day.format(d)
}

/** The cloud for this account (loaded on demand). */
async function cloud(userId: string) {
  const [{ neonRemote }, sync] = await Promise.all([import('./neonRemote.ts'), import('./sync.ts')])
  return { remote: neonRemote(userId), sync }
}

/** The section. */
export function SyncSection() {
  const { vault, name, showToast, reload } = useSession()
  const status = useSyncStatus()
  const [dialog, setDialog] = useState<'kit' | 'other' | 'off' | 'signin' | null>(null)
  const [busy, setBusy] = useState(false)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const resumed = useRef(false)
  const justSignedIn = useRef(false) // a sign-in problem right after signing in = the server refused, don't loop

  // Back from "Sign in again" with Google (?sync=on): finish turning sync on. The address also
  // carries Neon's one-time sign-in pass, so the sign-in code must read it (it then removes it)
  // before ?sync is cleared — clearing first would throw the sign-in away.
  useEffect(() => {
    if (resumed.current || !new URLSearchParams(search).has('sync')) return
    resumed.current = true
    justSignedIn.current = true
    import('../auth/auth.ts')
      .then((auth) => auth.currentUser())
      .catch(() => null)
      .finally(() => {
        navigate(pathname, { replace: true })
        if (!status.on) turnOn()
        else runSync(vault, reload)
      })
  })

  /** Explains a failed sync action. */
  async function explain(e: unknown) {
    const { SyncError } = await import('./sync.ts')
    if (e instanceof SyncError && e.problem === 'signin') {
      if (!justSignedIn.current) return setDialog('signin')
      justSignedIn.current = false
      console.warn('baon sync: signed in, but the sync server refused the sign-in', e)
      return showToast({ message: 'Sync couldn’t start. Try again later.' })
    }
    showToast({ message: e instanceof SyncError && e.problem === 'offline' ? 'No internet — try again when you’re online' : 'Couldn’t reach sync. Try again.' })
  }

  /** Turns sync on (or asks for what it needs first). */
  async function turnOn() {
    if (!navigator.onLine) return showToast({ message: 'Connect to the internet to turn on sync' })
    setBusy(true)
    try {
      const { remote, sync } = await cloud(vault.userId)
      const result = await sync.turnOnSync(vault, remote, name)
      if (result === 'needs-kit') return setDialog('kit')
      if (result === 'other-key') return setDialog('other')
      const state = await sync.syncState(vault.userId)
      setSyncStatus({ on: true, problem: undefined, lastSyncedAt: state.lastSyncedAt })
      reload()
      showToast({ message: 'Sync is on' })
    } catch (e) {
      await explain(e)
    } finally {
      setBusy(false)
    }
  }

  /** Turns sync off here, or everywhere (deleting the online copies). */
  async function turnOff(everywhere: boolean) {
    setBusy(true)
    try {
      const { remote, sync } = await cloud(vault.userId)
      await sync.turnOffSync(vault.userId, everywhere ? remote : undefined)
      setSyncStatus({ on: false, problem: undefined })
      setDialog(null)
      showToast({ message: everywhere ? 'Sync is off and the online copies are deleted' : 'Sync is off on this device' })
    } catch (e) {
      await explain(e)
    } finally {
      setBusy(false)
    }
  }

  const line = !status.on
    ? 'Off — your records are only on this device.'
    : status.syncing
      ? 'Syncing…'
      : status.problem === 'offline'
        ? 'Waiting for internet. Changes are saved here and will sync later.'
        : status.problem === 'signin'
          ? 'Sign in again to keep syncing.'
          : status.problem === 'server'
            ? 'Couldn’t sync just now. baon will try again.'
            : status.lastSyncedAt
              ? `On · last synced ${when(status.lastSyncedAt)}`
              : 'On'

  return (
    <section aria-labelledby="sync-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="sync-title" className="text-xl font-black">Sync across devices</h2>
          <p className="mt-1 font-semibold text-muted">
            Use baon on your phone, tablet and computer. Your records are scrambled before they leave this device — we can’t read them.
          </p>
        </div>
        <Switch checked={status.on} label="Sync across devices" onChange={(on) => (busy ? undefined : on ? turnOn() : setDialog('off'))} />
      </div>
      <p role="status" className="mt-3 rounded-2xl bg-page p-3 font-bold">{busy && !status.on ? 'Turning on…' : line}</p>
      {status.on && (
        <div className="mt-3 flex flex-wrap gap-2.5">
          {status.problem === 'signin' ? (
            <button type="button" onClick={() => setDialog('signin')} className={`${pill} flex-none bg-blue text-white`}>Sign in again</button>
          ) : (
            <button type="button" disabled={status.syncing} onClick={() => runSync(vault, reload)} className={`${pill} flex-none bg-pebble hover:bg-pebble-2`}>Sync now</button>
          )}
        </div>
      )}
      {status.on && <p className="mt-3 text-sm font-semibold text-muted">On another device: sign in, then enter your recovery code.</p>}

      {dialog === 'kit' && (
        <RecoveryKitDialog
          replacing={false}
          doneLabel="Turn on sync"
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            turnOn()
          }}
        />
      )}
      {dialog === 'other' && <OtherDeviceDialog onClose={() => setDialog(null)} />}
      {dialog === 'off' && (
        <Modal title="Turn off sync?" onClose={() => setDialog(null)}>
          <p className="font-semibold text-muted">Your records stay on this device either way.</p>
          <div className="mt-5 space-y-2.5">
            <button type="button" disabled={busy} onClick={() => turnOff(false)} className={`${pill} w-full bg-pebble hover:bg-pebble-2`}>Only on this device</button>
            <button type="button" disabled={busy} onClick={() => turnOff(true)} className={`${pill} w-full bg-red text-white`}>Everywhere — delete the online copies</button>
          </div>
          <p className="mt-3 text-sm font-semibold text-muted">“Everywhere” stops sync on all your devices. Each device keeps its own records.</p>
        </Modal>
      )}
      {dialog === 'signin' && <SignInAgain onClose={() => setDialog(null)} onSignedIn={() => {
            justSignedIn.current = true
            if (status.on) runSync(vault, reload)
            else turnOn()
          }} />}
    </section>
  )
}

/** This account already syncs records from another device: switch this device to them with that recovery code. */
function OtherDeviceDialog({ onClose }: { onClose: () => void }) {
  const { vault, name } = useSession()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Checks the code, then replaces this device's records with the synced ones and reopens baon. */
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return setError('Type your recovery code.')
    setBusy(true)
    setError('')
    let replaced = false
    try {
      const { remote, sync } = await cloud(vault.userId)
      await sync.joinSync(vault.userId, name, code, remote, () => {
        replaced = true
        vault.lock()
      })
      location.reload()
    } catch (err) {
      if (replaced) return location.reload() // the old key is locked: reopen; the rest downloads on the next sync
      const { SyncError } = await import('./sync.ts')
      setBusy(false)
      setError(err instanceof Error && !(err instanceof SyncError) ? err.message : 'Couldn’t reach sync. Check your internet and try again.')
    }
  }

  return (
    <Modal title="Your account already syncs" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="font-semibold text-muted">
          Your records are already synced from another device. Enter the recovery code you saved there to use those records here.
        </p>
        <p className="mt-3 rounded-2xl bg-pebble p-3 font-bold">Records that are only on this device will be replaced.</p>
        <Link to="/backup" onClick={onClose} className="mt-3 inline-block font-extrabold text-blue hover:underline">Make a backup first</Link>
        <label className="mt-4 block font-extrabold text-muted">
          Recovery code
          <input autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-…" value={code} onChange={(e) => { setCode(e.target.value); setError('') }} className={`${field} uppercase`} />
        </label>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
        <button type="submit" disabled={busy} className={`${pill} mt-5 w-full bg-blue text-white`}>{busy ? 'Switching…' : 'Use my synced records'}</button>
      </form>
    </Modal>
  )
}

/**
 * Full-screen sign-in when there's no online sign-in on this device (records stay unlocked here).
 * Email code: continues right away. Google: comes back to /backup?sync=on, which finishes the job.
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
