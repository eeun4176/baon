/*
 * RemoveFromPhone.tsx — Me → Security: "Remove Baon from this phone" (for a borrowed or shared phone).
 * Saves every change to the account first (sync), then deletes this account's records here and signs
 * out; nothing is removed if the upload fails. The records come back by signing in on any phone.
 */
import { useState } from 'react'
import { useSession } from '../session.ts'
import { Modal } from '../ui/Modal.tsx'
import { tr } from '../i18n/i18n.ts'

/** The section + its confirm pop-up. */
export function RemoveFromPhone() {
  const { vault } = useSession()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /** Upload, then remove; explains what to do if the upload couldn't finish. */
  async function remove() {
    setBusy(true)
    setError('')
    try {
      const { removeFromDevice } = await import('../sync/sync.ts')
      await removeFromDevice(vault, () => import('../sync/neonRemote.ts').then((m) => m.neonRemote(vault.userId)))
      await import('../auth/auth.ts').then((auth) => auth.signOut()).catch(() => {})
      location.replace('/') // starts over: the other account, the picker, or Welcome
    } catch (e) {
      const problem = (e as { problem?: string }).problem
      setError(
        problem === 'offline'
          ? tr('You’re offline. Connect first so your latest entries are saved.')
          : problem === 'signin'
            ? tr('Sign in again first (Me → Backup), so your latest entries are saved to your account.')
            : tr('Couldn’t save your latest entries to your account. Try again in a bit.'),
      )
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 border-t border-pebble pt-5">
      <h3 className="font-black">{tr('Remove Baon from this phone')}</h3>
      <p className="mt-1 font-semibold text-muted">{tr('For a phone that isn’t yours. Your records stay in your account.')}</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-12 rounded-full border-2 border-red px-5 font-black text-red hover:bg-red hover:text-white">
        {tr('Remove from this phone')}</button>
      {open && (
        <Modal title={tr('Remove Baon from this phone?')} onClose={() => !busy && setOpen(false)}>
          <p className="font-semibold text-muted">{tr('Your latest entries are saved to your account first, then removed from this phone.')}</p>
          {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
          <div className="mt-5 flex gap-2.5">
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-12 flex-1 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2 disabled:opacity-60">{tr('Cancel')}</button>
            <button type="button" disabled={busy} onClick={remove} className="min-h-12 flex-1 rounded-full bg-red px-5 font-black text-white hover:brightness-110 disabled:opacity-60">
              {busy ? tr('Saving…') : tr('Remove')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
