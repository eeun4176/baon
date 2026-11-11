/*
 * install.ts — "Install baon" in the profile menu. Chrome/Edge/Android fire
 * `beforeinstallprompt` when the app can be installed; we keep that event and
 * show the menu item until the student installs (iOS never fires it — there,
 * installing is Share → Add to Home Screen).
 * Imported once from main.tsx so the listener is ready before the event fires.
 */
import { useSyncExternalStore } from 'react'

/** The (non-standard) install prompt event Chrome/Edge send. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // we show our own "Install Baon" item instead of the browser's mini-bar
  deferred = e as InstallPromptEvent
  notify()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

/** True while the browser allows installing the app. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => deferred !== null,
  )
}

/** Shows the browser's install dialog. */
export async function promptInstall(): Promise<void> {
  const event = deferred
  deferred = null
  notify()
  await event?.prompt()
}
