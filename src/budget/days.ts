/*
 * days.ts — Calendar-day helpers fixed to Philippine time (plan §5: a day runs
 * 00:00–23:59 Asia/Manila, whatever time zone the phone is set to).
 *
 * Days are plain "YYYY-MM-DD" strings (e.g. "2026-11-10"). Doing day math on these
 * strings via UTC avoids daylight-saving and device-time-zone surprises.
 */

const DAY_MS = 86_400_000

const manilaFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Manila calendar day of an instant, e.g. 2026-11-09T16:30Z → "2026-11-10". */
export function manilaDate(instant: Date | string = new Date()): string {
  return manilaFormat.format(typeof instant === 'string' ? new Date(instant) : instant)
}

/** Milliseconds at UTC midnight of a "YYYY-MM-DD" day (used only for day math). */
function utc(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
}

/** Day `n` days after `day` (negative goes back). */
export function addDays(day: string, n: number): string {
  return new Date(utc(day) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (0 if same day, negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

/** Day of week: 0 = Sunday … 6 = Saturday (same order as the Su–Sa week row). */
export function weekday(day: string): number {
  return new Date(utc(day)).getUTCDay()
}

/**
 * Same day next month, clamped to the month's last day (Jan 31 → Feb 28).
 * shortcut: a 29th–31st allowance then stays on the 28th in later months;
 * store the original day-of-month if students report it.
 */
export function addMonth(day: string): string {
  const d = new Date(utc(day))
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay))
  return target.toISOString().slice(0, 10)
}
