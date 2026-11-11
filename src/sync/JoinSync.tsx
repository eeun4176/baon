/*
 * JoinSync.tsx — Onboarding screen for a new device when the account already syncs:
 * "Welcome back" → recovery code → records download → Home. The student can also set the
 * device up separately instead (they can switch it to the synced records later on Me → Backup).
 */
import { useState, type FormEvent } from 'react'
import type { SignedInUser } from '../auth/auth.ts'
import { Button, Screen, StepHeader, Title } from '../ui/kit.tsx'
import { openVault, type Vault } from '../vault/vault.ts'

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-card px-4 text-lg font-bold text-ink uppercase outline-none focus:ring-2 focus:ring-blue/40 placeholder:text-muted/60'

/** The screen. Calls onDone with the unlocked vault once the records are here. */
export function JoinSync({ user, onDone, onSkip }: { user: SignedInUser; onDone: (vault: Vault, name: string) => void; onSkip: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Unlocks with the code, downloads everything, then opens baon. */
  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!code.trim()) return setError('Type your recovery code.')
    setBusy(true)
    setError('')
    try {
      const [{ joinSync, SyncError }, { neonRemote }] = await Promise.all([import('./sync.ts'), import('./neonRemote.ts')])
      try {
        const name = await joinSync(user.id, user.name, code, neonRemote(user.id))
        onDone(await openVault(user.id), name)
      } catch (err) {
        setError(err instanceof Error && !(err instanceof SyncError) ? err.message : 'Couldn’t reach sync. Check your internet and try again.')
        setBusy(false)
      }
    } catch {
      setError('Couldn’t reach sync. Check your internet and try again.')
      setBusy(false)
    }
  }

  return (
    <Screen footer={<Button disabled={busy} onClick={() => submit()}>{busy ? 'Bringing your records…' : 'Bring my records here'}</Button>}>
      <StepHeader step={2} />
      <Title sub="Your baon syncs from another device. Enter your recovery code to bring your records here.">Welcome back, {user.name.split(' ')[0]}</Title>
      <form onSubmit={submit} noValidate>
        <label className="block font-extrabold text-muted">
          Recovery code
          <input autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-…" value={code} onChange={(e) => { setCode(e.target.value); setError('') }} className={field} />
        </label>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-card p-3 text-center font-bold">{error}</p>}
      </form>
      <p className="mt-4 font-semibold text-muted">It’s the code you saved when you turned on sync or made a backup.</p>
      <button type="button" onClick={onSkip} className="mt-6 min-h-11 font-extrabold text-blue hover:underline">Set up this device separately instead</button>
    </Screen>
  )
}
