/*
 * split.ts — "Split the bill" in Add → Expense: the student paid the whole bill for themselves and
 * friends. Their share is the expense; each friend's share is a "Lent" utang, so it shows on Plan
 * until they pay back. Shares are equal; leftover centavos go to the student's own share.
 */

export const MAX_SPLIT = 10 // friends per bill
const NAME_MAX = 40 // same as an utang's person

/** Friends' names from "Mia, Carlo, mia" → ["Mia", "Carlo"]: trimmed, no empties or repeats (any case). */
export function parseNames(text: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of text.split(',')) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      names.push(name)
    }
  }
  return names
}

/** Splits `total` centavos between the student and `friends` people. null when there's too little to split. */
export function splitBill(total: number, friends: number): { own: number; each: number } | null {
  if (friends < 1) return null
  const each = Math.floor(total / (friends + 1))
  if (each < 1) return null
  return { own: total - each * friends, each }
}
