/*
 * App.tsx — Root component. Decides what to show when baon opens:
 * - no account on this phone yet → Onboarding (needs internet once)
 * - account exists → open its encrypted vault and show the app (works offline)
 * - Shared phone mode → the lock screen (passphrase) every time, and again after a minute away
 * - more than one account on this phone → "Who's using Baon?" (each account: own records, own key)
 * Signed-in pages live inside AppShell (sidebar on desktop, bottom nav on phones).
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Home } from './home/Home.tsx'
import { AppShell } from './shell/AppShell.tsx'
import { loadPage } from './loadPage.ts'
import { SessionProvider } from './shell/SessionProvider.tsx'
import logoIcon from './assets/logo-icon.png'
import { HOME_TITLE, isKnownPath } from './pageTitle.ts'
import { Button, Card, Page, PageHeader, Screen } from './ui/kit.tsx'
import { LockScreen } from './lock/LockScreen.tsx'
import { SignedOut } from './lock/SignedOut.tsx'
import { AccountPicker } from './lock/AccountPicker.tsx'
import type { DeviceAccount } from './db/db.ts'
import { listDeviceAccounts, openVault, PassphraseNeeded, type Vault } from './vault/vault.ts'
import { tr } from './i18n/i18n.ts'

// Pages other than Home download when first opened, so the first screen shows sooner.
// Offline still works: the service worker saves every page file on the first visit.
// loadPage reloads once if a page's file is gone because a new version was deployed meanwhile.
const BackupPanel = lazy(() => loadPage(import('./backup/BackupPanel.tsx')).then((m) => ({ default: m.BackupPanel })))
const SyncSection = lazy(() => loadPage(import('./sync/SyncSection.tsx')).then((m) => ({ default: m.SyncSection })))
const Help = lazy(() => loadPage(import('./help/Help.tsx')).then((m) => ({ default: m.Help })))
const History = lazy(() => loadPage(import('./history/History.tsx')).then((m) => ({ default: m.History })))
const Breakdown = lazy(() => loadPage(import('./home/Breakdown.tsx')).then((m) => ({ default: m.Breakdown })))
const Me = lazy(() => loadPage(import('./me/Me.tsx')).then((m) => ({ default: m.Me })))
const Onboarding = lazy(() => loadPage(import('./onboarding/Onboarding.tsx')).then((m) => ({ default: m.Onboarding })))
const Plan = lazy(() => loadPage(import('./plan/Plan.tsx')).then((m) => ({ default: m.Plan })))
const Streak = lazy(() => loadPage(import('./streak/Streak.tsx')).then((m) => ({ default: m.Streak })))

type State =
  | { kind: 'loading' }
  | { kind: 'onboarding'; adding: boolean } // adding: another account on a phone that already has one
  | { kind: 'picker'; accounts: DeviceAccount[] }
  | { kind: 'app'; vault: Vault; name: string }
  | { kind: 'signedOut'; userId: string; name: string }
  | { kind: 'locked'; userId: string; name: string }
  | { kind: 'error' }

// Remembers "signed out" on this device so a reload doesn't reopen the app by itself.
// (My phone mode relies on the phone's own screen lock.)
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

/** Shown for an address Baon doesn't have. Home goes through the normal checks (sign-in, lock). */
function NotFound() {
  return (
    <Screen footer={<Button onClick={() => window.location.replace('/')}>{tr('Go to Home')}</Button>}>
      <header className="flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight">
        <img src={logoIcon} alt="" className="size-10" />
        {tr('Baon')}</header>
      <div className="mt-16 animate-rise">
        <h1 className="text-[2rem] leading-tight font-black">{tr('Page not found')}</h1>
        <p className="mt-2 text-lg font-semibold text-muted">{tr('This address isn’t part of Baon. Check the link, or go to Home.')}</p>
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
          <Route path="*" element={<NotFound />} />
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

  // Before any other screen, so an unknown address never shows Welcome, the lock or the app.
  if (state.kind !== 'loading' && !isKnownPath(window.location.pathname)) return <NotFound />

  switch (state.kind) {
    case 'loading':
      return null // IndexedDB opens in milliseconds; avoids a flash of the wrong screen
    case 'onboarding':
      return (
        <Suspense fallback={null}>
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
        </Suspense>
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
          userId={userId}
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
