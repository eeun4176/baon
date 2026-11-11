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

/** Tab title for a signed-in path (unknown paths count as Home). */
export function pageTitle(pathname: string): string {
  const page = PAGES[pathname.replace(/\/+$/, '') || '/']
  return page ? tr('{0} | Baon Student Budget Tracker', page) : HOME_TITLE
}
