/*
 * theme.ts — Light / Dark / Device theme (plan C11: supports dark mode).
 * The choice is a per-device convenience, so it lives in localStorage (wrapped in
 * try/catch for private mode). "Device" removes the attribute and the CSS follows
 * the phone/computer setting (see index.css).
 */

export type ThemeChoice = 'light' | 'dark' | 'device'

const KEY = 'baon.theme'

/** The saved choice, or "device" if none / storage blocked. */
export function getTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // storage blocked: follow the device
  }
  return 'device'
}

/** Applies a choice to the page: sets <html data-theme> and the browser bar color. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'device') delete root.dataset.theme
  else root.dataset.theme = choice
  const page = getComputedStyle(root).getPropertyValue('--color-page').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page || '#F3F4F4')
}

/** Saves and applies a choice. */
export function setTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'device') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // not remembered — still applied for this visit
  }
  applyTheme(choice)
}
