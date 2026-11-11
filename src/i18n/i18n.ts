/*
 * i18n.ts — English / Filipino. Text is written in English in the code and wrapped in tr();
 * the English text itself is the key into the Filipino dictionary (fil.ts). Anything not
 * translated yet shows in English, never blank. {0}, {1}… are filled from the extra arguments,
 * so a translation can put them in a different order. A word with two meanings gets a note after
 * "|" with no space after it (e.g. "Save|savings tab"): English shows the part before it, Filipino
 * has its own entry. A " | " with spaces (page titles) is ordinary text.
 * The language is read once when Baon opens; changing it reloads the app (setLanguage).
 * i18n.test.ts checks that every tr() text has a translation with the same {0}, {1}… slots.
 */
import { FIL } from './fil.ts'

export type Language = 'en' | 'fil'
const KEY = 'baon.lang'

/** Saved language (English unless the student picked Filipino; storage blocked → English). */
function saved(): Language {
  try {
    return localStorage.getItem(KEY) === 'fil' ? 'fil' : 'en'
  } catch {
    return 'en'
  }
}

/** The language this session shows. */
export const language: Language = saved()

/** Locale for dates and numbers ("Miy, Nob 11" in Filipino). */
export const LOCALE = language === 'fil' ? 'fil-PH' : 'en-US'

/** Translates `text` (English) and fills {0}, {1}… with `args`. */
export function tr(text: string, ...args: unknown[]): string {
  const s = (language === 'fil' && FIL[text]) || text.replace(/\|\S.*$/s, '') // drop a '|note' (a ' | ' with spaces is real text)
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i: string) => (Number(i) < args.length ? String(args[Number(i)]) : m)) : s
}

/** Switches language and reloads Baon so every screen uses it. */
export function setLanguage(next: Language) {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    return // storage blocked: can't remember the choice
  }
  location.reload()
}
