/*
 * App.tsx — Root component. Decides what to show when baon opens:
 * - no account on this phone yet → Onboarding (needs internet once)
 * - account exists → open its encrypted vault and show the app (works offline)
 * Signed-in pages live inside AppShell (sidebar on desktop, bottom nav on phones).
 */
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { History } from './history/History.tsx'
import { Breakdown } from './home/Breakdown.tsx'
import { Home } from './home/Home.tsx'
import { Onboarding } from './onboarding/Onboarding.tsx'
import { AppShell } from './shell/AppShell.tsx'
import { ComingSoon } from './shell/ComingSoon.tsx'
import { SessionProvider } from './shell/SessionProvider.tsx'
import { Screen } from './ui/kit.tsx'
import { listDeviceAccounts, openVault, type Vault } from './vault/vault.ts'

type State =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'app'; vault: Vault; name: string }
  | { kind: 'error' }

/** Opens the first account on this device, if any. (Account picker comes with Shared mode.) */
async function boot(): Promise<State> {
  const [account] = await listDeviceAccounts()
  if (!account) return { kind: 'onboarding' }
  return { kind: 'app', vault: await openVault(account.userId), name: account.label }
}

/** Signed-in routes. */
function SignedInApp({ vault, name }: { vault: Vault; name: string }) {
  return (
    <SessionProvider vault={vault} name={name}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="breakdown" element={<Breakdown />} />
            <Route path="history" element={<History />} />
            <Route path="plan" element={<ComingSoon title="Plan" text="Set money aside for printing, projects and org fees — coming next." />} />
            <Route path="streak" element={<ComingSoon title="Streak" text="Your on-budget streak, free pass and spending map — coming next." />} />
            <Route path="me" element={<ComingSoon title="Me" text="Your profile, wallets and settings — coming next." />} />
            <Route path="backup" element={<ComingSoon title="Backup" text="Export an encrypted copy of your records so a broken phone doesn’t lose them — coming next." />} />
            <Route path="help" element={<ComingSoon title="Help & privacy" text="How baon keeps your records private, and answers to common questions — coming next." />} />
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

  useEffect(() => {
    boot().then(setState, () => setState({ kind: 'error' }))
  }, [])

  switch (state.kind) {
    case 'loading':
      return null // IndexedDB opens in milliseconds; avoids a flash of the wrong screen
    case 'onboarding':
      return <Onboarding onDone={(vault, name) => setState({ kind: 'app', vault, name })} />
    case 'app':
      return <SignedInApp vault={state.vault} name={state.name} />
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
