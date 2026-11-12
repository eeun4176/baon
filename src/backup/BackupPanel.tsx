/*
 * BackupPanel.tsx — Backup screens (Me → Backup and the /backup page, plan §7.4):
 *   Export a backup   first time: Recovery Kit (code → Copy / Download → type group 3 to confirm),
 *                     then downloads baon-backup-<date>.json (encrypted; opens only with the code)
 *   Lost it?          make a new code (old backups keep needing the old one), then a fresh export
 *   Restore           pick the file + type the code; replaces this phone's records
 * RestoreForm is also used by onboarding ("Have a backup? Restore it").
 */
import { useEffect, useState, type FormEvent } from 'react'
import { manilaDate } from '../budget/days.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import type { Vault } from '../vault/vault.ts'
import { backupStatus, makeBackup, newRecoveryCode, readBackupFile, restoreBackup, saveRecoveryCode } from './backup.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40 placeholder:text-muted/60'
const label = 'block font-extrabold text-muted'
const primary = 'flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue px-6 font-black text-white disabled:opacity-60'
const secondary = 'flex min-h-12 items-center justify-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2 disabled:opacity-60'
const when = new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Saves a Blob as a download. */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The Backup card body: status, Export and Restore. */
export function BackupPanel() {
  const { vault, name, showToast } = useSession()
  const [status, setStatus] = useState<{ hasCode: boolean; lastBackupAt?: string } | null>(null)
  const [dialog, setDialog] = useState<'kit' | 'newKit' | 'restore' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    backupStatus(vault.userId).then(setStatus, () => setStatus({ hasCode: false }))
  }, [vault])

  /** Builds and downloads the encrypted file. */
  async function exportNow() {
    setBusy(true)
    try {
      download(await makeBackup(vault, name), `baon-backup-${manilaDate()}.json`)
      setStatus(await backupStatus(vault.userId))
      showToast({ message: tr('Backup saved to your downloads') })
    } catch {
      showToast({ message: tr('Couldn’t make the backup. Try again.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-black">{status?.lastBackupAt ? `Last backup: ${when.format(new Date(status.lastBackupAt))}` : tr('Not backed up yet')}</h2>
      <p className="mt-1 font-semibold text-muted">
        {tr('Save a copy so you don’t lose your records if your phone breaks or the browser is cleared. The file is encrypted — it opens only with your recovery code.')}</p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button type="button" disabled={!status || busy} onClick={() => (status?.hasCode ? exportNow() : setDialog('kit'))} className={primary}>
          <Icon name="download" className="size-5" /> {tr('Export a backup')}</button>
        <button type="button" onClick={() => setDialog('restore')} className={secondary}>
          <Icon name="cloud" className="size-5" /> {tr('Restore from a file')}</button>
      </div>
      {status?.hasCode && (
        <p className="mt-3 text-sm font-semibold text-muted">
          {tr('Every backup opens with the recovery code you saved.')}{' '}
          <button type="button" onClick={() => setDialog('newKit')} className="min-h-11 font-extrabold text-blue hover:underline">{tr('Lost it? Make a new code')}</button>
        </p>
      )}

      {(dialog === 'kit' || dialog === 'newKit') && (
        <RecoveryKitDialog
          replacing={dialog === 'newKit'}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            exportNow()
          }}
        />
      )}
      {dialog === 'restore' && (
        <Modal title={tr('Restore from a file')} onClose={() => setDialog(null)}>
          <p className="mb-4 rounded-2xl bg-pebble p-3 font-bold">{tr('This replaces everything on this phone with the backup’s records. Anything added after that backup will be gone.')}</p>
          <RestoreForm userId={vault.userId} fallbackName={name} current={vault} onRestored={() => { vault.lock(); location.reload() }} />{/* lock: the old key must not write into the restored records */}
        </Modal>
      )}
    </div>
  )
}

/** Shows a new Recovery Kit code (first export, or replacing a lost one) and checks the student saved it. */
export function RecoveryKitDialog({ replacing, onClose, onSaved }: { replacing: boolean; onClose: () => void; onSaved: () => void }) {
  const { vault, name } = useSession()
  const [code] = useState(newRecoveryCode)
  const [step, setStep] = useState<'show' | 'confirm'>('show')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const groups = code.split('-')

  /** Copies the code to the clipboard. */
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setError(tr('Copied. Paste it somewhere safe, like your notes app.'))
    } catch {
      setError(tr('Couldn’t copy. Write it down or use Download.'))
    }
  }

  /** Downloads the code as a small text file. */
  function save() {
    const text = tr('Baon Recovery Kit\n\nAccount: {0}\nRecovery code: {1}\nMade: {2}\n\nYou need this code to open your Baon backups.\nIf you lose it, your backups can\'t be opened, not even by us.\n', name, code, manilaDate())
    download(new Blob([text], { type: 'text/plain' }), 'baon-recovery-kit.txt')
  }

  /** Checks group 3, then stores the code's wrapped key (never the code itself). */
  async function confirm(e: FormEvent) {
    e.preventDefault()
    const clean = typed.trim().toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')
    if (clean !== groups[2]) return setError(tr('That isn’t group 3. Look at your saved code and try again.'))
    setBusy(true)
    try {
      await saveRecoveryCode(vault, code)
      onSaved()
    } catch {
      setBusy(false)
      setError(tr('Couldn’t save. Try again.'))
    }
  }

  return (
    <Modal title={replacing ? tr('Your new recovery code') : tr('Your Recovery Kit')} onClose={onClose}>
      {step === 'show' ? (
        <>
          {replacing && (
            <p className="mb-3 rounded-2xl bg-blue-tint p-3 font-bold text-blue">
              {tr('Backups from now on open with this new code. Backups you already made still need the old one, so we’ll export a fresh backup right after.')}</p>
          )}
          <p className="font-semibold text-muted">{tr('Your backup opens only with this code. Save it somewhere other than this phone — a photo, a notebook, or your email.')}</p>
          <ol className="mt-4 grid grid-cols-5 gap-1.5 rounded-2xl bg-page p-2.5 sm:gap-2 sm:p-3" aria-label={tr('Recovery code')}>
            {groups.map((g, i) => (
              <li key={i} className="rounded-xl bg-card py-2 text-center text-sm font-black min-[360px]:text-base min-[360px]:tracking-wide sm:text-xl sm:tracking-wider tabular-nums sm:text-xl">
                <span className="sr-only">{tr('Group {0}:', i + 1)} </span>{g}
              </li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={copy} className={secondary}>{tr('Copy')}</button>
            <button type="button" onClick={save} className={secondary}><Icon name="download" className="size-5" /> {tr('Download')}</button>
          </div>
          {error && <p role="status" className="mt-3 text-center font-bold">{error}</p>}
          <p className="mt-4 rounded-2xl bg-pebble p-3 font-bold">{tr('If you lose your phone and this code, your records can’t be recovered — not even by us.')}</p>
          <button type="button" onClick={() => { setStep('confirm'); setError('') }} className={`${primary} mt-5 w-full`}>{tr('I saved it')}</button>
        </>
      ) : (
        <form onSubmit={confirm} noValidate>
          <label className={label}>
            {tr('Type group 3 of your code, to check you saved it')}<input autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={4} placeholder="XXXX" value={typed} onChange={(e) => { setTyped(e.target.value); setError('') }} className={`${field} tracking-widest uppercase`} />
          </label>
          {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
          <div className="mt-5 flex gap-2.5">
            <button type="button" onClick={() => setStep('show')} className={`${secondary} flex-1`}>{tr('Show code')}</button>
            <button type="submit" disabled={busy} className={`${primary} flex-1`}>{tr('Export backup')}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** Pick a backup file + type the recovery code. Calls onRestored with the restored display name. */
export function RestoreForm({ userId, fallbackName, current, onRestored }: { userId: string; fallbackName: string; current?: Vault; onRestored: (name: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Checks everything, then restores. Nothing on the phone changes unless it all checks out. */
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return setError(tr('Pick your backup file first.'))
    if (!code.trim()) return setError(tr('Type your recovery code.'))
    setBusy(true)
    setError('')
    try {
      onRestored(await restoreBackup(await readBackupFile(file), code, userId, fallbackName, current))
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Couldn’t restore. Try again.'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className={label}>{tr('Backup file')}</p>
      <label className="mt-1.5 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-page px-4 font-bold focus-within:ring-2 focus-within:ring-blue/40">
        <Icon name="download" className="size-5 shrink-0 text-blue" />
        <span className="min-w-0 flex-1 truncate">{file ? file.name : tr('Choose your backup file')}</span>
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError('') }} />
      </label>
      <label className={`${label} mt-4`}>
        {tr('Recovery code')}<input autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => { setCode(e.target.value); setError('') }} className={`${field} uppercase`} />
      </label>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
      <button type="submit" disabled={busy} className={`${primary} mt-5 w-full`}>{busy ? tr('Restoring…') : tr('Restore my records')}</button>
    </form>
  )
}
