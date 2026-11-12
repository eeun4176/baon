/*
 * AccountPicker.tsx — "Who's using Baon?" when a phone has more than one account (or someone tapped
 * "Use another account"). Each account keeps its own records and key (vault.ts); picking one opens it
 * (My phone mode) or its lock screen (Shared phone mode). "Add another account" starts onboarding.
 * ✕ removes an account from this phone (RemoveAccountDialog: passphrase first, only once it's all saved online).
 */
import { useState } from 'react'
import logoIcon from '../assets/logo-icon.png'
import type { DeviceAccount } from '../db/db.ts'
import { firstName } from '../home/greetings.ts'
import { Icon, Screen, Title } from '../ui/kit.tsx'
import { RemoveAccountDialog } from './RemoveAccountDialog.tsx'
import { tr } from '../i18n/i18n.ts'

/** The picker. `onRemoved`: an account was removed (the list must be read again). */
export function AccountPicker({ accounts, onPick, onAdd, onRemoved }: { accounts: DeviceAccount[]; onPick: (account: DeviceAccount) => void; onAdd: () => void; onRemoved: () => void }) {
  const [removing, setRemoving] = useState<DeviceAccount | null>(null)
  const someOpen = accounts.length > 1 && accounts.some((a) => a.deviceMode !== 'shared')
  return (
    <Screen>
      <header className="flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight">
        <img src={logoIcon} alt="" className="size-10" />
        {tr('Baon')}</header>
      <div className="mt-12 animate-rise">
        <Title sub={tr('Pick your account. Each one has its own records.')}>{tr('Who’s using Baon?')}</Title>
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li key={a.userId} className="flex items-center gap-1 rounded-[28px] bg-card pr-2">
              <button type="button" onClick={() => onPick(a)} className="flex min-w-0 flex-1 items-center gap-3 rounded-[28px] p-4 text-left hover:bg-pebble">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-tint text-lg font-black text-blue" aria-hidden="true">
                  {firstName(a.label).charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">{a.label}</span>
                  <span className="block text-sm font-semibold text-muted">{a.deviceMode === 'shared' ? tr('Locked with a passphrase') : tr('Opens right away')}</span>
                </span>
                <Icon name={a.deviceMode === 'shared' ? 'lock' : 'chevron-right'} className="size-5 shrink-0 text-muted" />
              </button>
              <button type="button" onClick={() => setRemoving(a)} aria-label={tr('Remove {0} from this phone', a.label)} className="grid size-11 shrink-0 place-items-center rounded-full text-red hover:bg-red/10">
                <Icon name="x" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onAdd} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
          <Icon name="plus" className="size-5" /> {tr('Add another account')}</button>
        {someOpen && (
          <p className="mt-4 rounded-2xl bg-pebble p-3 font-bold">
            {tr('Anyone using this phone can open an account that opens right away. To lock yours, turn on shared phone mode in Me → Security.')}</p>
        )}
      </div>
      {removing && <RemoveAccountDialog account={removing} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); onRemoved() }} />}
    </Screen>
  )
}
