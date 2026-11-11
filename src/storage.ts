/*
 * storage.ts — Keeping the records on the device (plan §9: "The app requests persistent
 * storage and warns when storage is low").
 * Browsers may delete a site's data when the phone runs low on space, unless the site
 * is "persisted". Chrome/Edge grant that quietly for installed or often-used apps, Firefox
 * asks the student once, Safari grants it to home-screen apps.
 */
import { useEffect, useState } from 'react'

/** What the browser says about baon's storage. `persisted` is null when the browser can't tell. */
export interface StorageState {
  persisted: boolean | null
  usage: number // bytes baon uses
  quota: number // bytes baon may use (shrinks as the phone fills up); 0 = unknown
}

const LOW_BYTES = 50_000_000 // under 50 MB left: new entries and backups may start failing

/** True when the space left for baon is nearly gone (unknown quota never counts as low). */
export function isStorageLow({ usage, quota }: Pick<StorageState, 'usage' | 'quota'>): boolean {
  return quota > 0 && quota - usage < LOW_BYTES
}

/** "355 KB" / "1.2 MB". */
export function formatBytes(bytes: number): string {
  return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`
}

/** Reads persistence and usage; missing APIs give "unknown" instead of failing. */
export async function readStorage(): Promise<StorageState> {
  const s = navigator.storage
  const [persisted, estimate] = await Promise.all([
    s?.persisted ? s.persisted().catch(() => null) : null,
    s?.estimate ? s.estimate().catch(() => ({})) : {},
  ])
  return { persisted, usage: (estimate as StorageEstimate).usage ?? 0, quota: (estimate as StorageEstimate).quota ?? 0 }
}

/** Asks the browser to keep baon's data. Returns whether it is kept now (false if refused or unsupported). */
export async function keepStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Storage state for a screen; `refresh` re-reads it (e.g. after keepStorage). */
export function useStorage(): [StorageState | null, () => void] {
  const [state, setState] = useState<StorageState | null>(null)
  const refresh = () => {
    readStorage().then(setState, () => setState(null))
  }
  useEffect(refresh, [])
  return [state, refresh]
}
