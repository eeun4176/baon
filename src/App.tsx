/*
 * App.tsx — Root component. Decides what to show when baon opens:
 * - no account on this phone yet → Onboarding (needs internet once)
 * - account exists → open its encrypted vault and show the app (works offline)
 * - Shared phone mode → the lock screen (passphrase) every time, and again after a minute away
 * - more than one account on this phone → "Who's using Baon?" (each account: own records, own key)
 * Signed-in pages live inside AppShell (sidebar on desktop, bottom nav on phones).
 */
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BackupPanel } from './backup/BackupPanel.tsx'
import { SyncSection } from './sync/SyncSection.tsx'
import { Help } from './help/Help.tsx'
import { History } from './history/History.tsx'
import { Breakdown } from './home/Breakdown.tsx'
import { Home } from './home/Home.tsx'
import { Me } from './me/Me.tsx'
import { Onboarding } from './onboarding/Onboarding.tsx'
import { Plan } from './plan/Plan.tsx'
import { Streak } from './streak/Streak.tsx'
import { AppShell } from './shell/AppShell.tsx'
import { SessionProvider } from './shell/SessionProvider.tsx'
import logoIcon from './assets/logo-icon.png'
import { firstName } from './home/greetings.ts'
import { HOME_TITLE } from './pageTitle.ts'
import { Button, Card, Page, PageHeader, Screen } from './ui/kit.tsx'
import { LockScreen } from './lock/LockScreen.tsx'
import { AccountPicker } from './lock/AccountPicker.tsx'
import type { DeviceAccount } from './db/db.ts'
import { listDeviceAccounts, openVault, PassphraseNeeded, type Vault } from './vault/vault.ts'
import { tr } from './i18n/i18n.ts'

type State =
  | { kind: 'loading' }
  | { kind: 'onboarding'; adding: boolean } // adding: another account on a phone that already has one
  | { kind: 'picker'; accounts: DeviceAccount[] }
  | { kind: 'app'; vault: Vault; name: string }
  | { kind: 'signedOut'; userId: string; name: string }
  | { kind: 'locked'; userId: string; name: string }
  | { kind: 'error' }

// Remembers "signed out" on this device so a reload doesn't reopen the app by itself.
// (UX only, not security: My phone mode is protected by the phone's own screen lock.)
const SIGNED_OUT_KEY = 'baon.signedOut'
const AUTO_LOCK_MS = 60_000 // Shared phone mode: away this long (another app, screen off) → locked again
const ADDING_KEY = 'baon.adding' // "Add another account" in progress (survives Google's round trip, not a closed tab)

/** Reads/writes the adding-an-account mark; blocked storage just means Google sends you to the picker. */
function addingFlag(value?: boolean): boolean {
  try {
    if (value === undefined) return sessionStorage.getItem(ADDING_KEY) === '1'
    if (value) sessionStorage.setItem(ADDING_KEY, '1')
    else sessionStorage.removeItem(ADDING_KEY)
  } catch {
    // storage blocked
  }
  return false
}

/** Reads/writes the signed-out flag; storage errors just mean it isn't remembered. */
function signedOutFlag(value?: string | null): string | null {
  try {
    if (value === undefined) return localStorage.getItem(SIGNED_OUT_KEY)
    if (value === null) localStorage.removeItem(SIGNED_OUT_KEY)
    else localStorage.setItem(SIGNED_OUT_KEY, value)
  } catch {
    // storage blocked
  }
  return null
}

/** What opening Baon shows: Welcome, the one account, or the picker when there are several. */
async function boot(): Promise<State> {
  const accounts = await listDeviceAccounts()
  if (!accounts.length || addingFlag()) return { kind: 'onboarding', adding: accounts.length > 0 }
  if (accounts.length > 1) return { kind: 'picker', accounts }
  return openAccount(accounts[0])
}

/** One account: its app (My phone mode), its lock screen (Shared), or "signed out" if it was. */
async function openAccount(account: DeviceAccount, picked = false): Promise<State> {
  if (picked) signedOutFlag(null)
  else if (signedOutFlag() === account.userId && account.deviceMode !== 'shared') return { kind: 'signedOut', userId: account.userId, name: account.label }
  try {
    return { kind: 'app', vault: await openVault(account.userId), name: account.label }
  } catch (e) {
    if (e instanceof PassphraseNeeded) return { kind: 'locked', userId: account.userId, name: account.label }
    throw e
  }
}

/** "You're signed out" screen: records stay on the device; continue reopens the vault. */
function SignedOut({ name, onContinue, onSwitch }: { name: string; onContinue: () => void; onSwitch: () => void }) {
  return (
    <Screen
      footer={
        <>
          <Button onClick={onContinue}>{tr('Continue as {0}', firstName(name))}</Button>
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

/** Backup page (sidebar link): the same panel as Me → Backup. */
function BackupPage() {
  return (
    <Page>
      <PageHeader title={tr('Backup')} sub={tr('Keep a copy of your records, and use Baon on all your devices.')} />
      <div className="max-w-2xl space-y-4">
        <Card className="animate-rise">
          <BackupPanel />
        </Card>
        <Card className="animate-rise">
          <SyncSection />
        </Card>
      </div>
    </Page>
  )
}

/** Signed-in routes. */
function SignedInApp({ vault, name, onSignOut }: { vault: Vault; name: string; onSignOut: (name: string) => void }) {
  return (
    <SessionProvider vault={vault} name={name} onSignOut={onSignOut}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="breakdown" element={<Breakdown />} />
            <Route path="history" element={<History />} />
            <Route path="plan" element={<Plan />} />
            <Route path="streak" element={<Streak />} />
            <Route path="me" element={<Me />} />
            <Route path="backup" element={<BackupPage />} />
            <Route path="help" element={<Help />} />
          </Route>
          {/* Old Quick Add address and the home-screen shortcut open the Add dialog on Home. */}
          <Route path="add" element={<Navigate to="/?add=1" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}

/** App root. */
export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  // Outside the signed-in pages (sign-in, signed out) the tab shows the Home title.
  useEffect(() => {
    if (state.kind !== 'app') document.title = HOME_TITLE
  }, [state.kind])

  useEffect(() => {
    boot().then(setState, () => setState({ kind: 'error' }))
  }, [])

  /** Shows a screen worked out asynchronously (open an account, start over). */
  const show = (next: Promise<State>) => next.then(setState, () => setState({ kind: 'error' }))
  /** "Use another account": the picker, which also offers Add another account. */
  const pick = () => show(listDeviceAccounts().then((accounts): State => ({ kind: 'picker', accounts })))
  /** An account was removed from the picker: the rest stay listed; none left → Welcome. */
  const afterRemove = () => show(listDeviceAccounts().then((accounts): State => (accounts.length ? { kind: 'picker', accounts } : { kind: 'onboarding', adding: false })))
  /** Add another account: from signed out, so the new sign-in is that person's (onboarding). */
  const add = async () => {
    addingFlag(true)
    await import('./auth/auth.ts').then((auth) => auth.signOut()).catch(() => {})
    setState({ kind: 'onboarding', adding: true })
  }

  // Shared phone mode: lock again after a minute away (checked when Baon comes back on screen).
  const app = state.kind === 'app' ? state : null
  useEffect(() => {
    if (!app) return
    let hiddenAt = 0
    /** Notes when Baon left the screen; locks on return if it was away too long. */
    const onChange = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt >= AUTO_LOCK_MS && app.vault.shared()) {
        app.vault.lock()
        window.history.replaceState(null, '', '/')
        setState({ kind: 'locked', userId: app.vault.userId, name: app.name })
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [app])

  switch (state.kind) {
    case 'loading':
      return null // IndexedDB opens in milliseconds; avoids a flash of the wrong screen
    case 'onboarding':
      return (
        <Onboarding
          adding={state.adding}
          onDone={(vault, name) => {
            addingFlag(false)
            setState({ kind: 'app', vault, name })
          }}
          onCancel={state.adding ? () => { addingFlag(false); show(boot()) } : undefined}
          onExisting={(userId) => {
            addingFlag(false) // already on this phone: open it instead of setting it up again
            show(listDeviceAccounts().then((list) => openAccount(list.find((a) => a.userId === userId)!, true)))
          }}
        />
      )
    case 'picker':
      return <AccountPicker accounts={state.accounts} onPick={(account) => show(openAccount(account, true))} onAdd={add} onRemoved={afterRemove} />
    case 'app': {
      const { vault, name } = state
      return (
        <SignedInApp
          vault={vault}
          name={name}
          onSignOut={(current) => {
            window.history.replaceState(null, '', '/') // next sign-in starts on Home
            if (vault.shared()) return setState({ kind: 'locked', userId: vault.userId, name: current })
            signedOutFlag(vault.userId)
            setState({ kind: 'signedOut', userId: vault.userId, name: current }) // the name may have changed on Me
          }}
        />
      )
    }
    case 'signedOut': {
      const { userId, name } = state
      return (
        <SignedOut
          name={name}
          onContinue={() => {
            signedOutFlag(null)
            openVault(userId).then((vault) => setState({ kind: 'app', vault, name }), () => setState({ kind: 'error' }))
          }}
          onSwitch={pick}
        />
      )
    }
    case 'locked': {
      const { userId, name } = state
      return <LockScreen userId={userId} name={name} onUnlocked={(vault) => setState({ kind: 'app', vault, name })} onSwitch={pick} />
    }
    case 'error':
      return (
        <Screen>
          <p role="alert" className="mt-10 text-lg font-bold">
            {tr('Baon couldn’t open its storage on this phone. Close the app and open it again.')}</p>
        </Screen>
      )
  }
}
