/*
 * money.ts — Converting between what students type/see (₱15.50) and what Baon
 * stores (integer centavos, 1550). Plan §5: money is NEVER a floating-point number,
 * so 0.1 + 0.2 rounding bugs can't creep into balances.
 */

/** Largest amount accepted from input: ₱9,999,999.99 — far above any student balance. */
export const MAX_CENTAVOS = 999_999_999

/**
 * Parses keypad/text input like "15", "15.5", "1,500" or "15.50" into centavos.
 * Returns null for anything invalid (empty, letters, 3+ decimals, too large).
 * Works on the digits as text, so no float math is involved.
 */
export function parsePeso(input: string): number | null {
  const match = /^(\d{1,7})(?:\.(\d{0,2}))?$/.exec(input.replace(/[,\s₱]/g, ''))
  if (!match) return null
  const centavos = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return centavos <= MAX_CENTAVOS ? centavos : null
}

const pesoWhole = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 })
const pesoExact = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Formats centavos for display: 105000 → "₱1,050", 1550 → "₱15.50", -1500 → "−₱15".
 * Whole pesos drop ".00" (as in the design); a real minus sign (−) is used for negatives.
 */
export function formatPeso(centavos: number): string {
  const abs = Math.abs(centavos)
  const text = abs % 100 === 0 ? pesoWhole.format(abs / 100) : pesoExact.format(abs / 100)
  return `${centavos < 0 ? '−' : ''}₱${text}`
}
