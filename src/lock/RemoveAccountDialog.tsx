/*
 * RemoveAccountDialog.tsx — "Who's using Baon?" → ✕ on an account: removes that account from this phone.
 * A passphrase account asks for its passphrase first, so one student can't remove another's Baon.
 * Like Me → Remove from this phone (sync.ts removeFromDevice): only once everything is saved to the
 * account online; otherwise it explains and removes nothing.
 */
import { useState, type FormEvent } from 'react'
import type { DeviceAccount } from '../db/db.ts'
import { firstName } from '../home/greetings.ts'
import { Modal } from '../ui/Modal.tsx'
import { openVault, WrongPassphrase, type Vault } from '../vault/vault.ts'
import { field, label } from './passphrase.ts'
import { tr } from '../i18n/i18n.ts'

/** The pop-up for one account. */
export function RemoveAccountDialog({ account, onClose, onRemoved }: { account: DeviceAccount; onClose: () => void; onRemoved: () => void }) {
  const shared = account.deviceMode === 'shared'
  const name = firstName(account.label)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Opens the account (passphrase if it has one), saves what's left to save, then removes it here. */
  async function remove(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    let vault: Vault | null = null
    try {
      vault = await openVault(account.userId, shared ? passphrase : undefined)
      const { removeFromDevice } = await import('../sync/sync.ts')
      await removeFromDevice(vault, () => import('../sync/neonRemote.ts').then((m) => m.neonRemote(account.userId)))
      // Their online sign-in, if it was the one on this browser, goes too.
      await import('../auth/auth.ts')
        .then(async (auth) => (await auth.currentUser())?.id === account.userId && auth.signOut())
        .catch(() => {})
      onRemoved()
    } catch (err) {
      vault?.lock()
      setError(err instanceof WrongPassphrase
        ? tr('That passphrase isn’t right. Try again.')
        : (err as { problem?: string }).problem
          ? tr('Some of {0}’s entries aren’t saved online yet. Open Baon as {0} while online, then try again.', name)
          : tr('Couldn’t remove. Try again.'))
      setBusy(false)
    }
  }

  return (
    <Modal title={tr('Remove {0} from this phone?', name)} onClose={() => !busy && onClose()}>
      <form onSubmit={remove} noValidate>
        <p className="font-semibold text-muted">{tr('Removed from this phone only. {0}’s records stay in their account.', name)}</p>
        {shared && (
          <label className={`${label} mt-4`}>
            {tr('{0}’s passphrase', name)}<input type="password" autoComplete="current-password" autoFocus value={passphrase} onChange={(e) => { setPassphrase(e.target.value); setError('') }} className={field} />
          </label>
        )}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
        <div className="mt-5 flex gap-2.5">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-12 flex-1 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2 disabled:opacity-60">{tr('Cancel')}</button>
          <button type="submit" disabled={busy || (shared && !passphrase)} className="min-h-12 flex-1 rounded-full bg-red px-5 font-black text-white hover:brightness-110 disabled:opacity-60">
            {busy ? tr('Removing…') : tr('Remove')}</button>
        </div>
      </form>
    </Modal>
  )
}
