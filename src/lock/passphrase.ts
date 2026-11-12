/*
 * passphrase.ts — Shared phone mode helpers for the lock screens: the new-passphrase rule and the
 * form styles they share (kept out of the component files so fast refresh keeps working).
 */
import { tr } from '../i18n/i18n.ts'

export const MIN_PASSPHRASE = 8

/** What's wrong with a new passphrase (typed twice), or null if it's fine. */
export function passphraseProblem(passphrase: string, again: string): string | null {
  if ([...passphrase].length < MIN_PASSPHRASE) return tr('Use at least {0} characters.', MIN_PASSPHRASE)
  if (passphrase !== again) return tr('The two don’t match. Type the same passphrase twice.')
  return null
}

export const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40 placeholder:text-muted/60'
export const label = 'block font-extrabold text-muted'
export const primary = 'flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue px-6 font-black text-white disabled:opacity-60'
