/*
 * Streak.tsx — Streak screen (design "Streak v2"). Phones stack the cards; ≥ lg uses rows of 2 + 1.
 *   Hero (dark): flame + current streak, "Best!" when it's the best, progress to the next goal,
 *     and this week's Su–Sa circles (✓ logged, dashed = no class).
 *   Stats: best streak, free passes saved, on-budget days (tiles on phones, a list on desktop).
 *   Spending map: 3 or 6 months, one square per day (darker blue = more of that day's budget used,
 *     ink = over). Tap a day to see what happened that day.
 *   This month so far: logged / spent / on budget / over budget.
 *   How streaks work: the four rules.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { streakFlame } from './flame.ts'
import { useToday } from '../home/useToday.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { addDays, manilaDate, weekday } from '../budget/days.ts'
import { breakOn } from '../budget/allowance.ts'
import { counts } from '../budget/safeToSpend.ts'
import { Icon, Page, type IconName } from '../ui/kit.tsx'
import { mapLevel } from './streak.ts'
import { useStreak } from './useStreak.ts'
import { shareStreak } from './share.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

const SHORT = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]
const LONG = [tr('Sunday'), tr('Monday'), tr('Tuesday'), tr('Wednesday'), tr('Thursday'), tr('Friday'), tr('Saturday')]

const ROW_LABELS: [string, string][] = [['', ''], [tr('M'), tr('Mon')], ['', ''], [tr('W'), tr('Wed')], ['', ''], [tr('F'), tr('Fri')], ['', '']]
const month = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'short' })
const monthLong = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'long' })
const shortDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'short', day: 'numeric' })
const niceDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const asDate = (day: string) => new Date(`${day}T00:00:00Z`)
const LEVEL_CLASS = { 0: 'bg-map-0', 1: 'bg-map-1', 2: 'bg-map-2', 3: 'bg-map-3', over: 'bg-map-over' } as const

/** Streak goals the progress bar counts toward; past the last, every next 100. */
const GOALS = [3, 7, 14, 30, 50, 100, 200, 365]
const nextGoal = (n: number) => GOALS.find((g) => g > n) ?? (Math.floor(n / 100) + 1) * 100

const RULES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'check', title: tr('Log every class day'), text: tr('Log what you spent, or tap “No spending today”.') },
  { icon: 'flame', title: tr('Went over? It still counts'), text: tr('Logging is what matters. Tomorrow’s budget adjusts.') },
  { icon: 'ticket', title: tr('A free pass every Monday'), text: tr('Forgot a day? A saved pass covers it.') },
  { icon: 'calendar', title: tr('No class? It’s frozen'), text: tr('Days without class never break your streak.') },
]

/** "Logged" / "No class" key for the week circles. */
function WeekLegend({ className = '' }: { className?: string }) {
  return (
    <span className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-extrabold text-white/75 lg:gap-x-3.5 lg:text-xs ${className}`} aria-hidden="true">
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue lg:size-2.5" />{tr('Logged')}</span>
      <span className="flex items-center gap-1.5"><span className="size-[9px] rounded-full border-[1.5px] border-dashed border-white/40 lg:size-2.5" />{tr('No class · doesn’t count')}</span>
    </span>
  )
}

/** Streak screen. */
export function Streak() {
  const streak = useStreak()
  const { result, breakUntil } = useToday()
  const { transactions, allowance, showToast } = useSession()
  const [sharing, setSharing] = useState(false)
  const [range, setRange] = useState<'3m' | '6m'>('3m')
  const today = result.today
  const [picked, setPicked] = useState(today)
  const n = streak.current
  const goal = nextGoal(n)
  const isBest = n > 0 && n === streak.best

  // Expenses logged per day (refunds, moves, money in and utang aren't expenses), for the map's labels.
  const expenseCount = useMemo(() => {
    const count = new Map<string, number>()
    for (const tx of transactions) if (tx.kind === 'expense') count.set(manilaDate(tx.occurredAt), (count.get(manilaDate(tx.occurredAt)) ?? 0) + 1)
    return count
  }, [transactions])

  /** Map cell label: "Tue, Nov 10 · 3 expenses · ₱140 spent", or "… · No expenses". */
  function dayTitle(day: string): string {
    const count = expenseCount.get(day) ?? 0
    const date = niceDay.format(asDate(day))
    if (!count) return `${date} · ${tr('No expenses')}`
    const spent = formatPeso(Math.max(0, streak.days.get(day)?.spent ?? 0))
    return `${date} · ${count === 1 ? tr('1 expense') : tr('{0} expenses', count)} · ${tr('{0} spent', spent)}`
  }

  /** What the tapped day meant for the streak, and what was spent. */
  function dayDetail(day: string): { text: string; amount: string } {
    const d = streak.days.get(day)
    if (day > today) return { text: tr('Coming up.'), amount: '' }
    if (!d) return { text: tr('Before you started using Baon.'), amount: '' }
    const amount = d.spent > 0 ? formatPeso(d.spent) : ''
    if (d.status === 'on') return { text: d.budget ? tr('Logged · {0}% of that day’s {1} budget.', Math.round((Math.max(0, d.spent) / d.budget) * 100), formatPeso(d.budget)) : tr('Logged.'), amount }
    if (d.status === 'over') return { text: tr('Over that day’s {0} budget — still counted for your streak.', formatPeso(d.budget ?? 0)), amount }
    const text = { off: tr('No class — doesn’t affect your streak.'), break: tr('On break — your streak stayed frozen.'), pass: tr('Nothing logged — a free pass covered it.'), pending: tr('Nothing logged yet today.'), none: tr('Class day with nothing logged.') }[d.status]
    return { text, amount }
  }

  // Map: whole Sun–Sat weeks ending this week.
  const weekCount = range === '3m' ? 13 : 26
  const firstSunday = addDays(today, -weekday(today) - (weekCount - 1) * 7)
  const weeks = Array.from({ length: weekCount }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstSunday, w * 7 + d)))
  const started = streak.days.keys().next().value
  const detail = dayDetail(picked)

  // All-time on-budget days, and this month so far.
  let onDays = 0
  for (const d of streak.days.values()) if (d.status === 'on') onDays++
  const monthStart = `${today.slice(0, 8)}01`
  let mOn = 0
  let mOver = 0
  let mSpent = 0
  for (let d = monthStart; d <= today; d = addDays(d, 1)) {
    const day = streak.days.get(d)
    if (!day) continue
    mSpent += day.spent
    if (day.status === 'on') mOn++
    if (day.status === 'over') mOver++
  }
  const mLogged = mOn + mOver
  const mPct = mLogged ? Math.round((mOn / mLogged) * 100) : 0
  const onBudgetText = mLogged ? tr('{0} of {1} days on budget', mOn, mLogged) : tr('Nothing logged yet')

  /** Makes the streak picture and opens the share sheet (or downloads it on a computer). */
  async function share() {
    const sunday = addDays(today, -weekday(today))
    const week = Array.from({ length: 7 }, (_, i) => ['on', 'over'].includes(streak.days.get(addDays(sunday, i))?.status ?? ''))
    setSharing(true)
    try {
      if ((await shareStreak(n, week, weekday(today))) === 'downloaded') showToast({ message: tr('Streak picture saved to your downloads') })
    } catch {
      showToast({ message: tr('Couldn’t make the picture. Try again.') })
    } finally {
      setSharing(false)
    }
  }

  const stats: { icon: IconName; tile: string; label: string; wide?: string; value: number; suffix?: string; phoneSuffix?: boolean; blue?: boolean }[] = [
    { icon: 'trophy', tile: 'bg-amber-tint text-amber', label: tr('Best streak'), value: streak.best, suffix: streak.best === 1 ? tr('day') : tr('days'), phoneSuffix: true },
    { icon: 'ticket', tile: 'bg-blue-tint text-blue', label: tr('Free pass'), value: streak.passLeft, suffix: tr('saved'), blue: streak.passLeft > 0 },
    { icon: 'check-circle', tile: 'bg-trend-down/10 text-trend-down', label: tr('On budget'), wide: tr('On-budget days'), value: onDays },
  ]
  const tab = (on: boolean) => `h-7 rounded-full px-3 text-xs font-extrabold lg:h-[34px] lg:px-3.5 lg:text-[13px] ${on ? 'bg-card shadow-[0_1px_3px_rgba(29,31,30,0.12)]' : 'text-muted'}`

  return (
    <Page>
      <header className="mb-3.5 flex items-center justify-between gap-2 md:mb-5 md:items-end">
        <div className="flex items-center gap-0.5">
          <Link to="/" aria-label={tr('Back to Home')} className="-ml-2 grid size-11 shrink-0 place-items-center md:hidden"><Icon name="chevron-left" /></Link>
          <div>
            <h1 className="text-[1.875rem] leading-tight font-black tracking-[-0.03em] md:text-[2.125rem]">{tr('Streak')}</h1>
            <p className="mt-1 hidden font-bold text-muted md:block">{tr('Log your spending every class day — that’s a streak day.')}</p>
          </div>
        </div>
        {/* Phone: round icon button. Larger screens: blue "Share" pill. ! beats dark mode's lighter .text-blue (index.css). */}
        <button type="button" disabled={sharing} onClick={share} className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-blue disabled:opacity-60 md:flex md:h-12 md:w-auto md:gap-2 md:bg-blue md:px-[1.375rem] md:font-extrabold md:text-white!">
          <Icon name="share" className="size-5 md:size-[1.125rem]" /><span className="sr-only md:not-sr-only">{tr('Share')}</span></button>
      </header>

      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-5">
        {/* Hero */}
        <section className="flex animate-rise flex-col gap-[1.125rem] rounded-[30px] bg-hero px-5 py-[1.375rem] text-white lg:col-span-2 lg:gap-[1.375rem] lg:rounded-[32px] lg:px-[1.875rem] lg:py-7" aria-labelledby="streak-now">
          <div className="flex items-center gap-3.5 lg:flex-wrap lg:gap-x-6 lg:gap-y-4">
            <div className="flex min-w-0 flex-1 items-center gap-3.5 lg:basis-72 lg:gap-4">
              <img src={streakFlame(n, streak.pending)} alt="" className="size-[3.875rem] shrink-0 animate-pop lg:size-[4.75rem]" />
              <div className="min-w-0">
                <h2 id="streak-now" className="text-[clamp(2.25rem,11vw,2.875rem)] leading-[0.95] font-black tracking-[-0.04em] lg:text-[4rem]">
                  <span key={n} className="inline-block animate-pop">{n}</span> {n === 1 ? tr('day') : tr('days')}
                </h2>
                <p className="mt-1 text-sm font-extrabold text-white/75 lg:text-[1.0625rem]">
                  {breakUntil ? tr('in a row · Frozen during your break until {0}', shortDay.format(asDate(breakUntil))) : tr('logged in a row')}
                </p>
              </div>
            </div>
            {isBest && (
              <span className="inline-flex h-[1.625rem] shrink-0 items-center gap-1.5 self-start rounded-full bg-[#3a2a12] px-2.5 text-[11px] font-black text-[#ffc94d] lg:h-[2.125rem] lg:self-center lg:px-3.5 lg:text-sm">
                <Icon name="star" className="hidden size-4 lg:block" />
                <span className="lg:hidden">{tr('Best!')}</span><span className="hidden lg:inline">{tr('Personal best!')}</span>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 lg:gap-2">
            <p className="flex justify-between gap-2 text-xs font-extrabold lg:text-sm">
              <span className="text-white/90">{goal - n === 1 ? tr('1 more day to a {0}-day streak', goal) : tr('{0} more days to a {1}-day streak', goal - n, goal)}</span>
              <span className="text-white/75">{n}/{goal}</span>
            </p>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-white/15 lg:h-2.5">
              <div className="h-full rounded-full bg-linear-to-r from-[#ff6a1f] to-[#ffb020]" style={{ width: `${(n / goal) * 100}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white/[0.07] px-3 py-3.5 lg:gap-3 lg:rounded-3xl lg:px-[1.125rem] lg:py-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 lg:px-0">
              <span className="text-[11px] font-black tracking-[0.08em] text-white/75 uppercase lg:text-xs">{tr('This week')}</span>
              <WeekLegend className="hidden lg:flex" />
            </div>
            <ol className="grid grid-cols-7 gap-1 text-center lg:gap-1.5" aria-label={tr('This week')}>
              {SHORT.map((label, i) => {
                const day = addDays(today, i - weekday(today))
                const isToday = day === today
                const status = streak.days.get(day)?.status
                const logged = status === 'on' || status === 'over'
                const noClass = status === 'off' || status === 'break' || (day > today && (!!breakOn(day, allowance) || !counts(day, allowance)))
                const circle = logged ? 'bg-blue' : noClass ? 'border-2 border-dashed border-white/30' : isToday ? 'border-2 border-blue' : 'bg-white/10'
                return (
                  <li key={day} className="flex flex-col items-center gap-1.5 lg:gap-2" aria-current={isToday ? 'date' : undefined} aria-label={`${LONG[i]}${isToday ? tr(', today') : ''}${logged ? tr(', counted') : ''}`}>
                    <span aria-hidden="true" className={`text-[11px] font-black lg:text-[13px] ${isToday ? 'text-white' : 'text-white/75'}`}>{label}</span>
                    <span aria-hidden="true" className={`grid size-9 animate-rise place-items-center rounded-full lg:size-12 ${circle} ${isToday ? 'outline-2 outline-offset-2 outline-blue' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
                      {logged && <Icon name="check" className="size-3.5 stroke-[3.4] lg:size-[1.125rem]" />}
                      {status === 'pass' && <Icon name="ticket" className="size-3.5 text-white/70 lg:size-[1.125rem]" />}
                    </span>
                  </li>
                )
              })}
            </ol>
            <WeekLegend className="px-1 lg:hidden" />
          </div>
        </section>

        {/* Stats: three tiles on phones, a list card on desktop */}
        <section aria-label={tr('Streak stats')} className="grid grid-cols-3 gap-2 lg:flex lg:flex-col lg:gap-0 lg:rounded-[32px] lg:bg-card lg:px-6 lg:py-2.5">
          {stats.map((s) => (
            <div key={s.icon} className="flex min-w-0 animate-rise flex-col gap-0.5 rounded-[22px] bg-card px-3 py-3.5 lg:flex-1 lg:flex-row lg:items-center lg:gap-3.5 lg:rounded-none lg:border-b lg:border-pebble lg:px-0 lg:py-4 lg:last:border-0">
              <span className={`hidden size-12 shrink-0 place-items-center rounded-2xl lg:grid ${s.tile}`}><Icon name={s.icon} className="size-[1.625rem]" /></span>
              <span className="text-xs font-extrabold text-muted lg:flex-1 lg:text-base lg:font-black lg:text-ink">
                {s.wide ? <><span className="lg:hidden">{s.label}</span><span className="hidden lg:inline">{s.wide}</span></> : s.label}
              </span>
              <span key={s.value} className={`animate-pop text-2xl font-black lg:text-[1.875rem] lg:tracking-[-0.02em] ${s.blue ? 'text-blue' : ''}`}>
                {s.value}
                {s.suffix && <span className={`text-[13px] tracking-normal text-muted lg:inline lg:text-[0.9375rem] ${s.phoneSuffix ? '' : 'hidden'}`}> {s.suffix}</span>}
              </span>
            </div>
          ))}
        </section>

        {/* Spending map */}
        <section aria-labelledby="map-title" className="flex min-w-0 animate-rise flex-col gap-3 rounded-[26px] bg-card p-[1.125rem] lg:col-span-2 lg:gap-4 lg:rounded-[32px] lg:px-7 lg:py-6">
          <div className="flex items-center justify-between gap-2 lg:gap-3">
            <div>
              <h2 id="map-title" className="font-black lg:text-lg">{tr('Spending map')}</h2>
              <p className="hidden text-sm font-bold text-muted lg:block">{tr('Darker blue = more of that day’s budget used. Tap a day.')}</p>
            </div>
            <div role="tablist" aria-label={tr('Range')} className="flex shrink-0 gap-0.5 rounded-full bg-page p-[3px] lg:gap-1 lg:p-1">
              {(['3m', '6m'] as const).map((r) => (
                <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={tab(range === r)}>
                  <span className="lg:hidden">{r.toUpperCase()}</span><span className="hidden lg:inline">{r === '3m' ? tr('3 months') : tr('6 months')}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="-mt-1.5 text-xs font-bold text-muted lg:hidden">{tr('Darker blue = more of that day’s budget used. Tap a day.')}</p>

          <div
            className={`grid grid-flow-col grid-rows-[auto_repeat(7,auto)] gap-[3px] lg:gap-[5px] ${range === '3m' ? 'lg:max-w-[38rem]' : ''}`}
            style={{ gridTemplateColumns: `auto repeat(${weekCount}, minmax(0, 1fr))` }}
          >
            {[['', ''], ...ROW_LABELS].map(([phone, wide], i) => (
              <span key={`label-${i}`} aria-hidden="true" className="flex w-3.5 items-center text-[10px] font-extrabold text-muted lg:w-6 lg:text-[11px]">
                <span className="lg:hidden">{phone}</span><span className="hidden lg:inline">{wide}</span>
              </span>
            ))}
            {weeks.map((week, w) => {
              const firstOfMonth = week.find((d) => d.endsWith('-01'))
              const label = firstOfMonth ?? (w === 0 ? week[0] : null) // month name where a month starts, and on the first column
              return [
                <span key={`m-${w}`} aria-hidden="true" className="h-4 overflow-visible text-[10px] font-extrabold whitespace-nowrap text-muted lg:h-[1.125rem] lg:text-[11px]">
                  {label && month.format(asDate(label))}
                </span>,
                ...week.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-label={day > today ? niceDay.format(asDate(day)) : dayTitle(day)}
                    aria-pressed={day === picked}
                    onClick={() => setPicked(day)}
                    className={`aspect-square w-full ${range === '3m' ? 'rounded-[5px] lg:rounded-[7px]' : 'rounded-[3px] lg:rounded-[5px]'} ${day > today ? 'bg-page' : LEVEL_CLASS[mapLevel(streak.days.get(day))]} ${day === picked ? 'outline-2 outline-offset-1 outline-ink lg:outline-offset-2' : ''}`}
                  />
                )),
              ]
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 text-[11px] font-extrabold text-muted lg:text-xs">
            <span className="flex items-center gap-1 lg:gap-[5px]" aria-hidden="true">
              {tr('Less')}{([0, 1, 2, 3] as const).map((l) => <span key={l} className={`size-2.5 rounded-[3px] lg:size-3 ${LEVEL_CLASS[l]}`} />)}{tr('More')}
              <span className="ml-2 size-2.5 rounded-[3px] bg-map-over lg:ml-2.5 lg:size-3" />{tr('Over budget')}
            </span>
            {started && <span className="hidden lg:inline">{tr('You started logging {0}', shortDay.format(asDate(started)))}</span>}
          </div>

          <div className="flex items-center gap-2.5 rounded-[18px] bg-page px-3.5 py-3 lg:gap-3 lg:rounded-[20px] lg:px-4 lg:py-3.5" aria-live="polite">
            <span className={`size-3.5 shrink-0 rounded-[4px] lg:size-4 lg:rounded-[5px] ${picked > today ? 'bg-map-0' : LEVEL_CLASS[mapLevel(streak.days.get(picked))]}`} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-black lg:text-[0.9375rem]">{picked === today ? tr('{0} · Today', niceDay.format(asDate(picked))) : niceDay.format(asDate(picked))}</span>
              <span className="text-xs leading-snug font-bold text-ink/80 lg:text-[0.8125rem]">{detail.text}</span>
            </span>
            {detail.amount && <span className="font-black lg:text-lg">{detail.amount}</span>}
          </div>
        </section>

        {/* This month so far */}
        <section aria-labelledby="month-title" className="flex animate-rise flex-col gap-3 rounded-[26px] bg-card p-[1.125rem] lg:gap-3.5 lg:rounded-[32px] lg:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 id="month-title" className="font-black lg:text-lg">{tr('{0} so far', monthLong.format(asDate(today)))}</h2>
              <p className="hidden text-sm font-bold text-muted lg:block">{shortDay.format(asDate(monthStart))} – {Number(today.slice(8))}</p>
            </div>
            <span className="text-[13px] font-extrabold text-blue lg:hidden">{mLogged ? tr('{0} of {1} on budget', mOn, mLogged) : tr('Nothing logged yet')}</span>
          </div>
          <div className="flex flex-col gap-2 lg:order-last">
            <p className="hidden justify-between text-[13px] font-extrabold lg:flex"><span>{onBudgetText}</span><span className="text-blue">{mPct}%</span></p>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-pebble lg:h-2.5">
              <div className="h-full rounded-full bg-blue" style={{ width: `${mPct}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 lg:grid-cols-2 lg:gap-2.5">
            {[
              [tr('Logged days'), String(mLogged), ''],
              [tr('Spent'), formatPeso(Math.max(0, mSpent)), ''],
              [tr('On budget'), String(mOn), 'hidden lg:flex text-blue'],
              [tr('Over budget'), String(mOver), ''],
            ].map(([label, value, extra]) => (
              <div key={label} className={`flex min-w-0 flex-col rounded-2xl bg-page px-3 py-2.5 lg:gap-0.5 lg:rounded-[20px] lg:px-4 lg:py-3.5 ${extra}`}>
                <dt className="text-[11px] font-extrabold text-muted lg:text-[13px]">{label}</dt>
                <dd className="text-[clamp(0.9375rem,4.6vw,1.125rem)] font-black lg:text-[1.625rem]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How streaks work */}
        <section aria-labelledby="how-title" className="animate-rise rounded-[26px] bg-card p-[1.125rem] lg:col-span-3 lg:rounded-[32px] lg:px-7 lg:pt-6 lg:pb-7">
          <h2 id="how-title" className="pb-1.5 font-black lg:pb-4 lg:text-lg">{tr('How streaks work')}</h2>
          <ol className="grid lg:grid-cols-4 lg:gap-3">
            {RULES.map((r, i) => (
              <li key={r.title} className="flex items-start gap-3 border-t border-pebble py-2.5 lg:flex-col lg:gap-2.5 lg:rounded-3xl lg:border-0 lg:bg-page lg:p-[1.125rem]">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-blue-tint text-sm font-black text-blue lg:hidden">{i + 1}</span>
                <span aria-hidden="true" className="hidden size-10 place-items-center rounded-[14px] bg-card text-blue lg:grid"><Icon name={r.icon} className="size-5" /></span>
                <div className="flex flex-col gap-0.5 lg:gap-2.5">
                  <h3 className="text-sm font-black lg:text-base">{r.title}</h3>
                  <p className="text-xs leading-[1.45] font-bold text-muted lg:text-sm">{r.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Page>
  )
}
