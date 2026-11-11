/*
 * pageTitle.ts — Browser tab titles: "Baon | Student Budget Tracker" on Home (and before
 * sign-in), "<Page> | Baon Student Budget Tracker" everywhere else.
 */
export const HOME_TITLE = 'Baon | Student Budget Tracker'

const PAGES: Record<string, string> = {
  '/breakdown': 'How it’s counted',
  '/history': 'History',
  '/plan': 'Plan',
  '/streak': 'Streak',
  '/me': 'Me',
  '/backup': 'Backup',
  '/help': 'Help & privacy',
}

/** Tab title for a signed-in path (unknown paths count as Home). */
export function pageTitle(pathname: string): string {
  const page = PAGES[pathname.replace(/\/+$/, '') || '/']
  return page ? `${page} | Baon Student Budget Tracker` : HOME_TITLE
}
