/*
 * App.tsx — Root component. Decides what to show when baon opens:
 * - no account on this phone yet → Onboarding (needs internet once)
 * - account exists → open its encrypted vault and show Home (works offline)
 * Tabs/routing (History, Plan, Me) arrive with the screens that need them.
 */
import { useEffect, useState } from 'react'
import { Home } from './home/Home.tsx'
import { Onboarding } from './onboarding/Onboarding.tsx'
import { Screen } from './ui/kit.tsx'
import { listDeviceAccounts, openVault, type Vault } from './vault/vault.ts'

type State =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'home'; vault: Vault; name: string }
  | { kind: 'error' }

/** Opens the first account on this device, if any. (Account picker comes with Shared mode.) */
async function boot(): Promise<State> {
  const [account] = await listDeviceAccounts()
  if (!account) return { kind: 'onboarding' }
  return { kind: 'home', vault: await openVault(account.userId), name: account.label }
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
      return <Onboarding onDone={(vault, name) => setState({ kind: 'home', vault, name })} />
    case 'home':
      return <Home vault={state.vault} name={state.name} />
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
