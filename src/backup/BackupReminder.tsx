/*
 * BackupReminder.tsx — Home card that nudges for a backup ("Not backed up yet").
 * Shows only when backupDue() says so; "Later" hides it
 * for 3 days on this browser.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { backupDue, backupStatus } from './backup.ts'
import { tr } from '../i18n/i18n.ts'

const LATER_DAYS = 3

/** Reads/writes the "Later" time; storage errors just mean it isn't remembered. */
function later(userId: string, value?: number): number {
  const key = `baon.backupLater.${userId}`
  try {
    if (value === undefined) return Number(localStorage.getItem(key)) || 0
    localStorage.setItem(key, String(value))
  } catch {
    // storage blocked
  }
  return 0
}

/** The reminder card (renders nothing when no backup is due). `className` places it in the Home grid. */
export function BackupReminder({ className = '' }: { className?: string }) {
  const { vault, transactions } = useSession()
  const [last, setLast] = useState<string | undefined | null>(null) // null = still loading
  const [hiddenUntil, setHiddenUntil] = useState(() => later(vault.userId))

  useEffect(() => {
    backupStatus(vault.userId).then((s) => setLast(s.lastBackupAt), () => setLast(null))
  }, [vault])

  const [now] = useState(Date.now) // read once per visit to Home
  const due = last === null || now < hiddenUntil ? null : backupDue(last, transactions.map((t) => t.occurredAt), now)
  if (!due) return null
  const days = last ? Math.floor((now - Date.parse(last)) / 86_400_000) : 0

  return (
    <section className={`flex animate-rise flex-wrap items-center gap-4 rounded-3xl bg-card p-4 sm:rounded-[28px] sm:p-5 ${className}`} aria-labelledby="backup-reminder">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-tint text-blue"><Icon name="cloud" /></span>
      <div className="min-w-48 flex-1">
        <h2 id="backup-reminder" className="text-lg font-black">{due === 'never' ? tr('Not backed up yet') : tr('Last backup was {0} days ago', days)}</h2>
        <p className="font-semibold text-muted">
          {due === 'never' ? tr('Save a copy so you don’t lose your records if your phone breaks.') : tr('You’ve added entries since then. Save a fresh copy.')}
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => {
            const until = now + LATER_DAYS * 86_400_000
            later(vault.userId, until)
            setHiddenUntil(until)
          }}
          className="min-h-12 flex-1 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2 sm:flex-none"
        >
          {tr('Later')}</button>
        <Link to="/backup" className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-blue px-5 font-black whitespace-nowrap text-white sm:flex-none">
          {tr('Back up now')}</Link>
      </div>
    </section>
  )
}
