/*
 * App.tsx — Root component. Decides what to show when baon opens:
 * - no account on this phone yet → Onboarding (needs internet once)
 * - account exists → open its encrypted vault and show the app (works offline)
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
import { listDeviceAccounts, openVault, type Vault } from './vault/vault.ts'

type State =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'app'; vault: Vault; name: string }
  | { kind: 'signedOut'; userId: string; name: string }
  | { kind: 'error' }

// Remembers "signed out" on this device so a reload doesn't reopen the app by itself.
// (UX only, not security: My phone mode is protected by the phone's own screen lock.)
const SIGNED_OUT_KEY = 'baon.signedOut'

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

/** Opens the first account on this device, if any. (Account picker comes with Shared mode.) */
async function boot(): Promise<State> {
  const [account] = await listDeviceAccounts()
  if (!account) return { kind: 'onboarding' }
  if (signedOutFlag() === account.userId) return { kind: 'signedOut', userId: account.userId, name: account.label }
  return { kind: 'app', vault: await openVault(account.userId), name: account.label }
}

/** "You're signed out" screen: records stay on the device; continue reopens the vault. */
function SignedOut({ name, onContinue }: { name: string; onContinue: () => void }) {
  return (
    <Screen footer={<Button onClick={onContinue}>Continue as {firstName(name)}</Button>}>
      <header className="flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight">
        <img src={logoIcon} alt="" className="size-10" />
        baon
      </header>
      <div className="mt-16 animate-rise">
        <h1 className="text-[2rem] leading-tight font-black">You’re signed out</h1>
        <p className="mt-2 text-lg font-semibold text-muted">Your records are still here, encrypted on this device.</p>
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
      <PageHeader title="Backup" sub="Keep a copy of your records, and use baon on all your devices." />
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

  switch (state.kind) {
    case 'loading':
      return null // IndexedDB opens in milliseconds; avoids a flash of the wrong screen
    case 'onboarding':
      return <Onboarding onDone={(vault, name) => setState({ kind: 'app', vault, name })} />
    case 'app': {
      const { vault, name } = state
      return (
        <SignedInApp
          vault={vault}
          name={name}
          onSignOut={(current) => {
            signedOutFlag(vault.userId)
            window.history.replaceState(null, '', '/') // next sign-in starts on Home
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
        />
      )
    }
    case 'error':
      return (
        <Screen>
          <p role="alert" className="mt-10 text-lg font-bold">
            baon couldn’t open its storage on this phone. Close the app and open it again.
          </p>
        </Screen>
      )
  }
}
