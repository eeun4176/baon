/*
 * pageTitle.ts — Browser tab titles: "Baon | Student Budget Tracker" on Home (and before
 * sign-in), "<Page> | Baon Student Budget Tracker" everywhere else.
 */
import { tr } from './i18n/i18n.ts'

export const HOME_TITLE = tr('Baon | Student Budget Tracker')

const PAGES: Record<string, string> = {
  '/breakdown': tr('How it’s counted'),
  '/history': tr('History'),
  '/plan': tr('Plan'),
  '/streak': tr('Streak'),
  '/me': tr('Me'),
  '/backup': tr('Backup'),
  '/help': tr('Help & privacy'),
}

/** Path without trailing slashes ("/history/" → "/history", "/" stays "/"). */
const tidy = (pathname: string) => pathname.replace(/\/+$/, '') || '/'

/** Tab title for a signed-in path (unknown paths count as Home). */
export function pageTitle(pathname: string): string {
  const page = PAGES[tidy(pathname)]
  return page ? tr('{0} | Baon Student Budget Tracker', page) : HOME_TITLE
}

/** True if Baon has this address: Home, a page above, or /add (the Add shortcut). Anything else → "Page not found". */
export function isKnownPath(pathname: string): boolean {
  const path = tidy(pathname)
  return path === '/' || path === '/add' || path in PAGES
}
