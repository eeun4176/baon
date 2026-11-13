/*
 * savings.ts — Home's "Ipon outlook" and tipid tips. Pure functions, so they can be tested.
 *
 * Outlook: on each logged class day of the last 4 weeks, what was left of that day's budget
 * (budget − spent; negative when over). Its average, times the budget days in the next 30 days,
 * is "about ₱X a month if you keep this up". Needs 5 such days first, so a single lucky day
 * doesn't promise too much.
 *
 * Tips: one tip for the category the student spent most on in the last 7 days (lots of Food →
 * a baon-from-home tip), changing every day; "Another tip" moves to the next. General tips otherwise.
 */
import { addDays, daysBetween } from '../budget/days.ts'
import type { Allowance } from '../budget/allowance.ts'
import { counts } from '../budget/safeToSpend.ts'
import { spentByCategory } from '../history/history.ts'
import type { Transaction } from '../ledger/ledger.ts'
import type { Day } from '../streak/streak.ts'
import { tr } from '../i18n/i18n.ts'

export const MIN_DAYS = 5 // logged class days needed before showing an estimate
const LOOKBACK = 28

export interface Outlook {
  count: number // logged class days with a saved budget in the last 4 weeks
  perDay: number // average left over per day (centavos, whole pesos; negative = over on average)
  perMonth: number // perDay × budget days in the next 30 days
  sixMonths: number
  daysPerMonth: number // budget days in the next 30 days (for "₱20 less a day saves ₱X a month")
}

/** "If you keep this up" estimate from the streak's days. `count < MIN_DAYS` = not enough yet. */
export function iponOutlook(days: Map<string, Day>, allowance: Allowance, today: string): Outlook {
  let count = 0
  let left = 0
  for (const [day, d] of days) {
    if (day >= today || daysBetween(day, today) > LOOKBACK) continue
    if ((d.status !== 'on' && d.status !== 'over') || d.budget === undefined) continue
    count++
    left += d.budget - d.spent
  }
  let daysPerMonth = 0
  for (let i = 0; i < 30; i++) if (counts(addDays(today, i), allowance)) daysPerMonth++
  const perDay = count ? Math.trunc(left / count / 100) * 100 : 0
  const perMonth = perDay * daysPerMonth
  return { count, perDay, perMonth, sixMonths: perMonth * 6, daysPerMonth }
}

/** A tip, for one category or (no category) for anyone. */
interface Tip {
  category?: string
  text: string
}

export const TIPS: Tip[] = [
  { category: 'food', text: tr('Bring baon from home two or three days a week. Even rice and ulam from last night counts.') },
  { category: 'food', text: tr('Share a bigger meal with a classmate instead of buying two small ones.') },
  { category: 'food', text: tr('Carry a tumbler and refill it at school instead of buying bottled water.') },
  { category: 'fare', text: tr('For short trips, walk or share a tricycle with classmates going the same way.') },
  { category: 'fare', text: tr('Leave a bit earlier so you can take the jeep instead of a tricycle or ride-hailing.') },
  { category: 'load', text: tr('A data promo usually lasts longer than regular load for the same price.') },
  { category: 'load', text: tr('Download readings and videos on school or home Wi-Fi, so your data lasts.') },
  { category: 'snacks', text: tr('Pack a snack from home for the afternoon. Store snacks add up fast.') },
  { category: 'snacks', text: tr('Make milk tea or coffee a once-a-week treat, not a daily one.') },
  { category: 'school', text: tr('Print in batches, or read on screen when you can. Every page adds up.') },
  { category: 'school', text: tr('Ask seniors for old books and reviewers before buying new ones.') },
  { category: 'shopping', text: tr('Wait a day before buying something that isn’t on your list. Most of the time you won’t miss it.') },
  { category: 'fun', text: tr('Look for free things to do with friends: the park, a free event, a movie at home.') },
  { text: tr('Save first: move a little to Savings as soon as your baon arrives, then spend the rest.') },
  { text: tr('Log every expense, even ₱5. Small things are the easiest to forget and the hardest to notice.') },
  { text: tr('Set a limit for the category you spend most on. Plan → Category limits.') },
  { text: tr('Coins and ₱20 bills go fast. Keep only what you need today in your wallet.') },
]

/** Today's tip: from the top category of the last 7 days if it has tips, else a general one. `offset`: "Another tip". */
export function pickTip(transactions: Transaction[], today: string, offset = 0): string {
  const top = spentByCategory(transactions, addDays(today, -6), today)[0]?.categoryId
  const forTop = TIPS.filter((t) => t.category === top)
  const list = forTop.length ? forTop : TIPS.filter((t) => !t.category)
  const n = daysBetween('2026-01-01', today) + offset
  return list[((n % list.length) + list.length) % list.length].text
}
