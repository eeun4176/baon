/*
 * JoinSync.tsx — Onboarding screen when the signed-in account already has records online
 * (from another device): "Welcome back" → records download → Home. No questions, no code.
 * If the download fails, the student can try again or set this device up as new
 * (its records then merge into the account on the first sync).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SignedInUser } from '../auth/auth.ts'
import { Button, Screen, StepHeader, Title } from '../ui/kit.tsx'
import type { Vault } from '../vault/vault.ts'
import { tr } from '../i18n/i18n.ts'

/** The screen. Calls onDone with the unlocked vault once the records are here. */
export function JoinSync({ user, onDone, onSkip }: { user: SignedInUser; onDone: (vault: Vault, name: string) => void; onSkip: () => void }) {
  const [error, setError] = useState('')
  const started = useRef(false)

  /** Downloads the account's records, then opens baon (or the normal setup if there's nothing to bring). */
  const join = useCallback(async () => {
    try {
      const [{ joinSync }, { neonRemote }] = await Promise.all([import('./sync.ts'), import('./neonRemote.ts')])
      const joined = await joinSync(user.id, user.name, neonRemote(user.id))
      if (joined) onDone(joined.vault, joined.name)
      else onSkip()
    } catch {
      setError(tr('Couldn’t bring your records here. Check your internet and try again.'))
    }
  }, [user, onDone, onSkip])

  useEffect(() => {
    if (started.current) return
    started.current = true
    join()
  }, [join])

  return (
    <Screen footer={<Button disabled={!error} onClick={() => { setError(''); join() }}>{error ? tr('Try again') : tr('Bringing your records…')}</Button>}>
      <StepHeader step={2} />
      <Title sub={tr('Bringing your records here. This takes a few seconds.')}>{tr('Welcome back, {0}', user.name.split(' ')[0])}</Title>
      {error && (
        <>
          <p role="alert" className="mt-4 rounded-2xl bg-card p-3 text-center font-bold">{error}</p>
          <button type="button" onClick={onSkip} className="mt-6 min-h-11 font-extrabold text-blue hover:underline">{tr('Set up this device as new instead')}</button>
        </>
      )}
    </Screen>
  )
}
