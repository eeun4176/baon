/*
 * DeviceModeItems.tsx — Me → Security: which mode this phone uses, and switching it.
 *   My phone mode    → "Turn on" Shared phone mode (make a passphrase)
 *   Shared phone mode → Change passphrase / Turn off (both ask for the current passphrase first)
 * Also says plainly what the passphrase doesn't cover: the account sign-in can still open the records.
 */
import { useState, type FormEvent } from 'react'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { NewPassphrase } from './NewPassphrase.tsx'
import { field, label, primary } from './passphrase.ts'
import { tr } from '../i18n/i18n.ts'

const pill = 'mt-3 min-h-11 rounded-full px-5 font-black'
const item = 'flex items-start gap-3 rounded-2xl bg-page p-3 sm:p-4'

/** Asks for the current passphrase; calls onOk once it's right. */
function CurrentPassphrase({ submitLabel, onOk }: { submitLabel: string; onOk: () => Promise<void> | void }) {
  const { vault } = useSession()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Checks it, then continues. */
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!(await vault.checkPassphrase(passphrase))) throw new Error(tr('That passphrase isn’t right. Try again.'))
      await onOk()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : tr('Couldn’t save. Try again.'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className={label}>
        {tr('Your passphrase now')}<input type="password" autoComplete="current-password" autoFocus value={passphrase} onChange={(e) => { setPassphrase(e.target.value); setError('') }} className={field} />
      </label>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
      <button type="submit" disabled={busy || !passphrase} className={`${primary} mt-5`}>{busy ? tr('Checking…') : submitLabel}</button>
    </form>
  )
}

/** The list items (inside Security's <ul>). */
export function DeviceModeItems() {
  const { vault, showToast } = useSession()
  const [dialog, setDialog] = useState<'on' | 'change' | 'off' | null>(null)
  const [checked, setChecked] = useState(false) // Change: current passphrase was right
  const close = () => {
    setDialog(null)
    setChecked(false)
  }

  /** Switches mode (or changes the passphrase), then tells the student. */
  async function save(passphrase: string | null, message: string) {
    await vault.protect(passphrase)
    close()
    showToast({ message })
  }

  return (
    <>
      {vault.shared() ? (
        <>
          <li className={item}>
            <Icon name="lock" className="mt-0.5 size-5 shrink-0 text-blue" />
            <span>
              <span className="block font-black">{tr('Shared phone mode · on')}</span>
              <span className="block font-semibold text-muted">{tr('Baon asks for your passphrase every time it opens.')}</span>
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setDialog('change')} className={`${pill} bg-blue text-white`}>{tr('Change passphrase')}</button>
                <button type="button" onClick={() => setDialog('off')} className={`${pill} bg-pebble hover:bg-pebble-2`}>{tr('Turn off')}</button>
              </span>
            </span>
          </li>
          <li className={item}>
            <Icon name="users" className="mt-0.5 size-5 shrink-0 text-muted" />
            <span className="block font-semibold text-muted">{tr('Your Google or email sign-in can also open your records, so sign out of Google on this phone too.')}</span>
          </li>
        </>
      ) : (
        <>
          <li className={item}>
            <Icon name="phone" className="mt-0.5 size-5 shrink-0 text-blue" />
            <span>
              <span className="block font-black">{tr('My phone mode · on')}</span>
              <span className="block font-semibold text-muted">{tr('Baon opens right away, so keep your phone’s screen lock on.')}</span>
            </span>
          </li>
          <li className={item}>
            <Icon name="users" className="mt-0.5 size-5 shrink-0 text-muted" />
            <span>
              <span className="block font-black">{tr('Shared phone mode')}</span>
              <span className="block font-semibold text-muted">{tr('Sharing this phone? Baon will ask for a passphrase every time it opens.')}</span>
              <button type="button" onClick={() => setDialog('on')} className={`${pill} bg-blue text-white`}>{tr('Turn on')}</button>
            </span>
          </li>
        </>
      )}

      {dialog === 'on' && (
        <Modal title={tr('Turn on shared phone mode')} onClose={close}>
          <NewPassphrase submitLabel={tr('Turn on')} onSave={(p) => save(p, tr('Shared phone mode is on'))} />
        </Modal>
      )}
      {dialog === 'change' && (
        <Modal title={tr('Change passphrase')} onClose={close}>
          {checked
            ? <NewPassphrase submitLabel={tr('Save passphrase')} onSave={(p) => save(p, tr('Passphrase changed'))} />
            : <CurrentPassphrase submitLabel={tr('Continue')} onOk={() => setChecked(true)} />}
        </Modal>
      )}
      {dialog === 'off' && (
        <Modal title={tr('Turn off shared phone mode')} onClose={close}>
          <p className="mb-4 font-semibold text-muted">{tr('Baon will open without a passphrase. Do this only if the phone is yours alone.')}</p>
          <CurrentPassphrase submitLabel={tr('Turn off')} onOk={() => save(null, tr('Shared phone mode is off'))} />
        </Modal>
      )}
    </>
  )
}
