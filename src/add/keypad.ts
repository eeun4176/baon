/*
 * keypad.ts — What each key on the Quick Add keypad does to the amount being typed.
 * The amount stays a string ("15.5") while typing and becomes centavos only on save
 * (parsePeso), so there is never float math. Also used for physical keyboards on desktop.
 */

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back'

/** Returns the new amount text after pressing `key`. Ignores presses that would make it invalid. */
export function pressKey(current: string, key: Key): string {
  if (key === 'back') return current.slice(0, -1)
  if (key === '.') {
    if (current.includes('.')) return current
    return current === '' ? '0.' : `${current}.`
  }
  const [whole, cents] = current.split('.')
  if (cents !== undefined) return cents.length >= 2 ? current : current + key // max 2 decimals
  if (whole === '0') return key // no leading zeros: "0" then "5" → "5"
  return whole.length >= 7 ? current : current + key // up to ₱9,999,999
}

/**
 * Desktop: the amount is a real text box. Returns the cleaned text if what was typed
 * follows the same rules as the keypad (≤ 7 digits, ≤ 2 decimals), else null (ignore it).
 */
export function acceptTyped(typed: string): string | null {
  const text = typed.replace(/[,\s₱]/g, '')
  return /^\d{0,7}(\.\d{0,2})?$/.test(text) ? text.replace(/^0+(?=\d)/, '') : null
}

/** Editing: centavos back to keypad text without float math (1550 → "15.50", 1500 → "15"). */
export function centavosToText(centavos: number): string {
  const cents = centavos % 100
  return cents === 0 ? String(centavos / 100) : `${Math.floor(centavos / 100)}.${String(cents).padStart(2, '0')}`
}

/** Display form while typing: "1500" → "1,500", "15.5" → "15.5", "" → "0". */
export function displayAmount(text: string): string {
  if (text === '') return '0'
  const [whole, cents] = text.split('.')
  const grouped = Number(whole).toLocaleString('en-PH')
  return cents === undefined ? grouped : `${grouped}.${cents}`
}
