/*
 * loadPage.ts — Loads a page's file (pages other than Home download when first opened).
 * After a new version is deployed, an open Baon still asks for the old file names, which are
 * gone, so the page would go blank. Then it reloads once to get the new version. The mark in
 * sessionStorage stops a reload loop (e.g. offline); a page that loads clears it for the next deploy.
 */
const RELOADED_KEY = 'baon.pageReload'

/** Resolves with the page's module; on a failed load, reloads once instead of failing. */
export function loadPage<T>(load: Promise<T>, reload = () => window.location.reload()): Promise<T> {
  return load.then(
    (module) => {
      try {
        sessionStorage.removeItem(RELOADED_KEY)
      } catch {
        // storage blocked
      }
      return module
    },
    (error: unknown) => {
      try {
        if (!sessionStorage.getItem(RELOADED_KEY)) {
          sessionStorage.setItem(RELOADED_KEY, '1')
          reload()
          return new Promise<T>(() => {}) // the reload replaces the page
        }
      } catch {
        // storage blocked: can't guard against a loop, so don't reload
      }
      throw error
    },
  )
}
