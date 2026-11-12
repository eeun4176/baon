/*
 * NewPassphrase.tsx — "Make a passphrase" form (Shared phone mode): type it twice, then save.
 * Used by onboarding, Me → Security (turn on / change) and the lock screen after "Forgot?".
 * The passphrase is never saved; only a key made from it locks the records (vault.ts).
 */
import { useState, type FormEvent } from 'react'
import { field, label, MIN_PASSPHRASE, passphraseProblem, primary } from './passphrase.ts'
import { tr } from '../i18n/i18n.ts'

/** The form. `onSave` may throw an Error whose message is shown. */
export function NewPassphrase({ submitLabel, onSave }: { submitLabel: string; onSave: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Checks both fields, then saves. */
  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = passphraseProblem(passphrase, again)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await onSave(passphrase)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : tr('Couldn’t save. Try again.'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className={label}>
        {tr('New passphrase')}<input type="password" autoComplete="new-password" autoFocus value={passphrase} onChange={(e) => { setPassphrase(e.target.value); setError('') }} className={field} />
      </label>
      <label className={`${label} mt-4`}>
        {tr('Type it again')}<input type="password" autoComplete="new-password" value={again} onChange={(e) => { setAgain(e.target.value); setError('') }} className={field} />
      </label>
      <p className="mt-3 text-sm font-semibold text-muted">{tr('At least {0} characters, like “jeep ako every morning”.', MIN_PASSPHRASE)}</p>
      <p className="mt-3 rounded-2xl bg-pebble p-3 font-bold">{tr('Forgot it? You’ll need your recovery code, or to sign in again.')}</p>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
      <button type="submit" disabled={busy} className={`${primary} mt-5`}>{busy ? tr('Saving…') : submitLabel}</button>
    </form>
  )
}
