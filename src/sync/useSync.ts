/*
 * useSync.ts — Runs sync while the app is open (always on) and shares its status with the
 * screens (Me → Backup shows it).
 * When: on open, when the internet comes back, when the app comes back to the front,
 * every 5 minutes while it's in front, and 2 seconds after any change made here.
 * (5, not 1: every check is ~3 server requests even when nothing changed, and a busy class
 * of students checking each minute would keep the free database awake all day.)
 * Signed out, or the account was deleted elsewhere: it stops trying until the student acts (or reopens Baon).
 * The sync code and the cloud connection are loaded only when sync actually runs.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { useSession } from '../session.ts'
import { onLocalChange, type Vault } from '../vault/vault.ts'
import type { SyncProblem } from './sync.ts'

/** What the screens show about sync on this device. */
export interface SyncStatus {
  syncing: boolean
  problem?: SyncProblem
  lastSyncedAt?: string
}

let status: SyncStatus = { syncing: false }
const listeners = new Set<() => void>()

/** Updates the shared status and re-renders screens that show it. */
export function setSyncStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  listeners.forEach((l) => l())
}

/** Current sync status (re-renders when it changes). */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

let running: Promise<void> | null = null
let again = false

/**
 * Syncs once now. Overlapping calls run one after another.
 * `onChanged` runs when records on this device changed, so the screens can reload them.
 */
export async function runSync(vault: Vault, onChanged: () => void): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      setSyncStatus({ syncing: true })
      try {
        const [{ syncNow, lastSyncedAt }, { neonRemote }] = await Promise.all([import('./sync.ts'), import('./neonRemote.ts')])
        const result = await syncNow(vault, neonRemote(vault.userId))
        setSyncStatus({ lastSyncedAt: await lastSyncedAt(vault.userId), problem: undefined })
        if (result.changed) onChanged()
      } catch (e) {
        const { SyncError } = await import('./sync.ts')
        setSyncStatus({ problem: e instanceof SyncError ? e.problem : 'server' })
      } finally {
        setSyncStatus({ syncing: false })
      }
    } while (again)
  })()
  try {
    await running
  } finally {
    running = null
  }
}

/** Keeps this device in sync while the app is open (used once, in AppShell). */
export function useAutoSync() {
  const { vault, reload } = useSession()
  useEffect(() => {
    let timer = 0
    const run = (evenIfSignedOut = false) => {
      if ((evenIfSignedOut || (status.problem !== 'signin' && status.problem !== 'deleted')) && navigator.onLine && document.visibilityState === 'visible') runSync(vault, reload).catch(() => {})
    }
    const soon = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(run, 2000)
    }
    import('./sync.ts')
      .then(({ lastSyncedAt }) => lastSyncedAt(vault.userId))
      .then((at) => {
        setSyncStatus({ lastSyncedAt: at, problem: undefined })
        run(true)
      })
      .catch(() => {})
    const onOnline = () => run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    const stopListening = onLocalChange(soon)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    const every = window.setInterval(run, 5 * 60_000)
    return () => {
      stopListening()
      window.clearTimeout(timer)
      window.clearInterval(every)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [vault, reload])
}
