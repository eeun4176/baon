/*
 * Streak.tsx — Streak & spending map (design p21; phones get the same cards stacked).
 *   Dark hero: flame + current streak + this week's ✓ row. Tiles: best streak, free pass,
 *   on-budget days in the last 6 months. Spending map: one square per day (darker blue =
 *   more of that day's budget used, ink = over). "How streaks work" explains the rules.
 * Phones show the last 15 weeks of the map, larger screens 26 weeks (about 6 months).
 */
import flame from '../assets/streak-flame.png'
import { useToday } from '../home/useToday.ts'
import { addDays, weekday } from '../budget/days.ts'
import { Card, Icon, Page, PageHeader, type IconName } from '../ui/kit.tsx'
import { mapLevel } from './streak.ts'
import { useStreak } from './useStreak.ts'
import { WeekRow } from './WeekRow.tsx'

const WEEKS = 26
const PHONE_WEEKS = 15
const ROW_LABELS = ['', 'M', '', 'W', '', 'F', '']
const month = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' })
const shortDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const LEVEL_CLASS = { 0: 'bg-map-0', 1: 'bg-map-1', 2: 'bg-map-2', 3: 'bg-map-3', over: 'bg-map-over' } as const

const RULES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'check', title: 'Log every class day', text: 'A class day counts when you log what you spent, or tap “No spending today”. ₱0 days earn nothing extra — never skip meals.' },
  { icon: 'flame', title: 'Went over? It still counts', text: 'Logging honestly is what matters. Over-budget days show dark on your map, and tomorrow’s budget adjusts.' },
  { icon: 'ticket', title: 'One free pass a week', text: 'Forgot to log a day? Your free pass covers it automatically, once every Monday–Sunday.' },
  { icon: 'calendar', title: 'No class? It’s frozen', text: 'Weekends without class and breaks like sembreak or suspensions never break your streak.' },
]

/** Small white stat tile (Best streak, Free pass, On-budget days). */
function Tile({ title, value, sub, blue = false, className = '' }: { title: string; value: number; sub: string; blue?: boolean; className?: string }) {
  return (
    <Card className={`animate-rise ${className}`}>
      <h2 className="font-black">{title}</h2>
      <p key={value} className={`mt-1 animate-pop text-4xl font-black ${blue ? 'text-blue' : ''}`}>{value}</p>
      <p className="mt-1 text-sm font-semibold text-muted">{sub}</p>
    </Card>
  )
}

/** Streak screen. */
export function Streak() {
  const streak = useStreak()
  const { result, breakUntil } = useToday()
  const today = result.today
  const n = streak.current

  // Map: whole Sun–Sat weeks ending this week.
  const firstSunday = addDays(today, -weekday(today) - (WEEKS - 1) * 7)
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstSunday, w * 7 + d)))
  let onDays = 0
  let overDays = 0
  for (const week of weeks) for (const day of week) {
    const status = streak.days.get(day)?.status
    if (status === 'on') onDays++
    if (status === 'over') overDays++
  }

  return (
    <Page>
      <PageHeader title="Streak" sub="Log your spending every class day — that’s a streak day." />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Hero */}
        {/* Hero: flame + number on top, this week's row spread across the full card below */}
        <section className="flex animate-rise flex-col justify-between gap-6 rounded-[28px] bg-hero p-6 text-white md:p-8 lg:col-span-8" aria-labelledby="streak-now">
          <div className="flex items-center gap-4 md:gap-6">
            <img src={flame} alt="" className="size-16 shrink-0 animate-pop sm:size-20 md:size-24" />
            <div className="min-w-0">
              <h2 id="streak-now" className="text-[clamp(2.75rem,12vw,4.5rem)] leading-none font-black">
                <span key={n} className="inline-block animate-pop">{n}</span> {n === 1 ? 'day' : 'days'}
              </h2>
              <p className="mt-1.5 font-bold text-white/80 md:text-lg">
                {breakUntil ? `in a row · frozen during your break until ${shortDay.format(new Date(`${breakUntil}T00:00:00Z`))}` : 'logged in a row'}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-extrabold tracking-[0.12em] text-white/60 uppercase">This week</p>
            <WeekRow today={today} streak={streak} dark />
          </div>
        </section>

        {/* Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-4 lg:gap-5">
          <Tile title="Best streak" value={streak.best} sub={streak.best === 1 ? 'day' : 'days'} />
          <Tile title="Free pass" value={streak.passLeft ? 1 : 0} sub={streak.passLeft ? 'left this week' : 'used this week'} blue={streak.passLeft} />
          <Card className="col-span-2 flex animate-rise items-center justify-between gap-3">
            <div>
              <h2 className="font-black">On-budget days</h2>
              <p className="text-sm font-semibold text-muted">Last 6 months</p>
            </div>
            <p key={onDays} className="animate-pop text-4xl font-black">{onDays}</p>
          </Card>
        </div>

        {/* Spending map */}
        <Card className="animate-rise lg:col-span-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-black">Spending map</h2>
            <p className="text-sm font-semibold text-muted">Each square is a day · darker blue = more of that day’s budget used</p>
          </div>
          <p className="sr-only">{onDays} on-budget days and {overDays} over-budget days in the last 6 months.</p>
          <div
            aria-hidden="true"
            className="grid grid-flow-col grid-cols-[auto_repeat(15,minmax(0,1fr))] grid-rows-[auto_repeat(7,auto)] gap-1 md:grid-cols-[auto_repeat(26,minmax(0,1fr))] md:gap-1.5"
          >
            {['', ...ROW_LABELS].map((label, i) => (
              <span key={`label-${i}`} className="grid place-items-center pr-1 text-xs font-extrabold text-muted">{label}</span>
            ))}
            {weeks.map((week, w) => {
              const phoneHidden = w < WEEKS - PHONE_WEEKS ? 'hidden md:block' : ''
              const firstOfMonth = week.find((d) => d.endsWith('-01'))
              // Month name where a month starts, and on the first column (phones: first visible one only).
              const firstColumn = w === 0 || w === WEEKS - PHONE_WEEKS
              const label = firstOfMonth ?? (firstColumn ? week[0] : null)
              const phoneOnly = !firstOfMonth && w === WEEKS - PHONE_WEEKS ? 'md:invisible' : ''
              return [
                <span key={`m-${w}`} className={`h-5 overflow-visible text-xs font-extrabold whitespace-nowrap text-muted ${phoneHidden} ${phoneOnly}`}>
                  {label && month.format(new Date(`${label}T00:00:00Z`))}
                </span>,
                ...week.map((day) => (
                  <span
                    key={day}
                    title={day}
                    className={`aspect-square rounded-[4px] md:rounded-md ${day > today ? 'bg-transparent' : LEVEL_CLASS[mapLevel(streak.days.get(day))]} ${phoneHidden}`}
                  />
                )),
              ]
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-extrabold text-muted" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              Less
              {([0, 1, 2, 3] as const).map((l) => <span key={l} className={`size-3.5 rounded-[3px] ${LEVEL_CLASS[l]}`} />)}
              More
            </span>
            <span className="flex items-center gap-1.5"><span className="size-3.5 rounded-[3px] bg-map-over" /> Over budget</span>
          </div>
        </Card>

        {/* How streaks work */}
        <Card className="animate-rise lg:col-span-12">
          <h2 className="text-xl font-black">How streaks work</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RULES.map((r) => (
              <li key={r.title} className="rounded-3xl bg-page p-5">
                <Icon name={r.icon} className="size-7 text-blue" />
                <h3 className="mt-3 text-lg font-black">{r.title}</h3>
                <p className="mt-1 font-semibold text-muted">{r.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  )
}
