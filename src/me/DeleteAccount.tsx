/*
 * DeleteAccount.tsx — "Delete account" on Me → Security (RA 10173 right to erasure).
 * Type DELETE, then:
 *   1. delete the synced online copy, then try to delete the online sign-in account
 *      (only works if Neon Auth allows it and the
 *      sign-in is recent — so it may fail, and we say so),
 *   2. sign out and delete everything baon saved on this phone (always),
 *   3. tell the student exactly what was deleted, then go back to Welcome.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useSession } from '../session.ts'
import { Modal } from '../ui/Modal.tsx'
import { deleteAccountFromDevice } from '../vault/vault.ts'
import { tr } from '../i18n/i18n.ts'

const pill = 'min-h-13 flex-1 rounded-full px-5 text-lg font-black disabled:opacity-60'

/** The confirm → result dialog. */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { vault } = useSession()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'all' | 'phone' | null>(null)

  /** Deletes online (best effort) and on this phone (always). */
  async function remove(e: FormEvent) {
    e.preventDefault()
    if (typed.trim().toUpperCase() !== 'DELETE') return setError(tr('Type DELETE to confirm.'))
    setBusy(true)
    try {
      const auth = await import('../auth/auth.ts').catch(() => null) // offline and never loaded: skip online steps
      // Online copy first (needs the sign-in). If that fails, keep the sign-in account too,
      // so the copy can still be removed later.
      const cloudOk = auth
        ? await import('../sync/neonRemote.ts').then(({ neonRemote }) => neonRemote(vault.userId).deleteAll()).then(() => true, () => false)
        : false
      const online = cloudOk && ((await auth?.deleteSignInAccount()) ?? false)
      if (!online) await auth?.signOut().catch(() => {})
      vault.lock()
      await deleteAccountFromDevice(vault.userId)
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith('baon.')) localStorage.removeItem(key)
      } catch {
        // storage blocked: nothing saved there anyway
      }
      setDone(online ? 'all' : 'phone')
    } catch {
      setBusy(false)
      setError(tr('Couldn’t delete. Close Baon, open it again and try once more.'))
    }
  }

  if (done) {
    return (
      <Modal title={done === 'all' ? tr('Your account is deleted') : tr('Deleted from this phone')} onClose={() => location.replace('/')}>
        <p className="font-semibold text-muted">
          {done === 'all'
            ? tr('Your sign-in account, your synced copies online and everything Baon saved on this phone are gone.')
            : tr('Everything Baon saved on this phone is gone. Your sign-in account (and any synced copies online) couldn’t be removed from here — message the Baon team and we’ll remove them.')}
        </p>
        <button type="button" onClick={() => location.replace('/')} className={`${pill} mt-5 w-full bg-blue text-white`}>{tr('OK')}</button>
      </Modal>
    )
  }

  return (
    <Modal title={tr('Delete your account?')} onClose={onClose}>
      <form onSubmit={remove} noValidate>
        <p className="font-semibold text-muted">
          {tr('This deletes your sign-in account and synced copies online, and removes your records, wallets, plans, streak and recovery code from this phone. Your other devices keep their own records. It can’t be undone. Backups you saved elsewhere aren’t touched.')}</p>
        <Link to="/backup" className="mt-3 inline-block font-extrabold text-blue hover:underline">{tr('Make a backup first')}</Link>
        <label className="mt-4 block font-extrabold text-muted">
          {tr('Type DELETE to confirm')}<input
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(e) => { setTyped(e.target.value); setError('') }}
            className="mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold tracking-widest text-ink uppercase outline-none focus:ring-2 focus:ring-blue/40"
          />
        </label>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={onClose} className={`${pill} bg-pebble hover:bg-pebble-2`}>{tr('Cancel')}</button>
          <button type="submit" disabled={busy} className={`${pill} bg-red text-white`}>{busy ? tr('Deleting…') : tr('Delete')}</button>
        </div>
      </form>
    </Modal>
  )
}
