/*
 * Home.tsx — Today at a glance (Home v2 design).
 * Phone: logo + avatar, date line, greeting; the "Today" card; streak and Ipon outlook side by side;
 *   a tipid tip; One-tap add; then "Your money": today's entries, spent per day, wallets,
 *   set aside for school, category limits.
 * Desktop: greeting row with a search box (matches show under it; Enter opens History); the "Today"
 *   card and One-tap add on the left, the dark streak card and Ipon outlook (with its tip) on the
 *   right; "Your money": spent per day beside today's entries, then wallets, set aside, limits.
 * The "Today" card: what's safe to spend (or "over" / "spent"), Left until · Class days left ·
 *   This week (with a green ↓ / red ↑ against last week), and a split bar of "left to spend"
 *   vs "held back" (school, utang, money for later), drawn like Plan's.
 */
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import logoIcon from '../assets/logo-icon.png'
import { addDays, manilaDate, weekday } from '../budget/days.ts'
import { filterEntries, weekTrend } from '../history/history.ts'
import { TxRow } from '../history/TxRow.tsx'
import { formatPeso } from '../ledger/money.ts'
import { Avatar } from '../me/Avatar.tsx'
import { useSession } from '../session.ts'
import { useAddDialog } from '../shell/useAddDialog.ts'
import { streakFlame } from '../streak/flame.ts'
import type { Streak } from '../streak/streak.ts'
import { useStreak } from '../streak/useStreak.ts'
import { Pill, Icon, Page, SplitBar, type IconName } from '../ui/kit.tsx'
import { BackupReminder } from '../backup/BackupReminder.tsx'
import { AllowanceCheckIn } from './AllowanceCheckIn.tsx'
import { randomGreeting } from './greetings.ts'
import { LimitsCard } from './LimitsCard.tsx'
import { EntriesCard, SetAsideCard, SpentPerDayCard, WalletsCard } from './MoneyCards.tsx'
import { OneTapAdd } from './OneTapAdd.tsx'
import { SavingsCard, TipBox } from './SavingsCard.tsx'
import { StorageWarning } from './StorageWarning.tsx'
import { useToday, type Today } from './useToday.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

const LONG = [tr('Sunday'), tr('Monday'), tr('Tuesday'), tr('Wednesday'), tr('Thursday'), tr('Friday'), tr('Saturday')]
const SHORT = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]
const breakDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const dateLine = new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

/** "4 class days", "1 day"… the days the money covers. */
function daysText(t: Today): string {
  const n = t.result.budgetDays
  return t.allowance.countClassDays && !t.breakUntil
    ? n === 1 ? tr('{0} class day', n) : tr('{0} class days', n)
    : n === 1 ? tr('{0} day', n) : tr('{0} days', n)
}

/** Gray stat tile inside the Today card. */
function Stat({ title, value, sub, className = '' }: { title: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-[18px] bg-page px-3.5 py-3 lg:rounded-[20px] lg:px-4 lg:py-3.5 ${className}`}>
      <span className="truncate text-xs font-extrabold text-muted lg:text-sm">{title}</span>
      <span className="text-[1.1875rem] font-black tracking-tight lg:text-[1.375rem]">{value}</span>
      {sub && <span className="text-xs font-extrabold">{sub}</span>}
    </div>
  )
}

/**
 * "This week" tile: spent Sunday → today, with an arrow beside the amount and the peso difference
 * against the same days last week (red ↑ more, green ↓ less). The words say it too.
 */
function WeekTile({ today }: { today: string }) {
  const { transactions } = useSession()
  const w = weekTrend(transactions, today)
  const up = w.diff !== null && w.diff > 0
  const down = w.diff !== null && w.diff < 0
  const tone = up ? 'text-trend-up' : down ? 'text-trend-down' : 'text-muted'
  return (
    <Stat
      title={tr('This week')}
      value={
        <span className="flex items-center gap-1">
          {formatPeso(w.now)}
          {(up || down) && <Icon name={up ? 'arrow-up' : 'arrow-down'} className={`size-5 ${tone}`} />}
        </span>
      }
      sub={w.diff === null ? <span className="text-muted">{tr('Nothing last week to compare')}</span> : (
        <span className={tone}>
          {up ? tr('{0} more than last week', formatPeso(w.diff!)) : down ? tr('{0} less than last week', formatPeso(-w.diff!)) : tr('Same as last week')}
        </span>
      )}
    />
  )
}

/** Blue-tint note with an info icon (or a link when `to` is given). */
function Note({ children, to }: { children: ReactNode; to?: string }) {
  const body = (
    <>
      <Icon name="info" className="mt-0.5 size-[1.125rem] shrink-0" />
      <span className="text-[0.8125rem] leading-snug font-bold lg:text-sm">{children}</span>
    </>
  )
  // No flex-basis here: notes sit in a column, where a basis would set their height, not width.
  const cls = 'flex items-start gap-2 rounded-2xl bg-blue-tint px-3 py-2.5 text-blue lg:rounded-[18px] lg:px-3.5 lg:py-3'
  return to ? <Link to={to} className={`${cls} hover:underline`}>{body}</Link> : <p className={cls}>{body}</p>
}

/** The "Today" card. `onCheckIn`: "It came" while waiting after "Not yet". */
function TodayHero({ t, onCheckIn }: { t: Today; onCheckIn?: () => void }) {
  const { open } = useAddDialog()
  const { transactions, snapshots, saveSnapshot, showToast } = useSession()
  const [showHow, setShowHow] = useState(false)
  const r = t.result
  const over = r.isClassDay && r.leftToday < 0
  const spentOnDayOff = !r.isClassDay && r.spentToday > 0 // not "over": it comes out of the next class days
  const snap = snapshots.find((s) => s.date === r.today)
  const nothingLogged = !snap?.noSpend && !transactions.some((tx) => manilaDate(tx.occurredAt) === r.today)
  const held = r.setAside + r.owed + r.forLater
  const left = Math.max(0, r.readyToSpend)

  const [chipIcon, chipText, chipTone]: [IconName, string, 'gray' | 'amber'] = t.breakUntil
    ? ['pause', tr('On break'), 'gray']
    : !r.isClassDay ? ['calendar', tr('No class today'), 'gray']
    : over ? ['info', tr('Over today'), 'amber'] : ['calendar', tr('Class day'), 'gray']
  const [amount, suffix] = over ? [-r.leftToday, tr('over')] : spentOnDayOff ? [r.spentToday, tr('spent')] : r.isClassDay ? [r.leftToday, tr('left today')] : [0, tr('planned')]

  /** "No spending today": counts as logged for the streak, with Undo. */
  async function markNoSpend() {
    const today = snap ?? { date: r.today, dailyBudgetCentavos: r.dailyBudget, isClassDay: r.isClassDay }
    await saveSnapshot({ ...today, noSpend: true })
    showToast({ message: tr('Logged: no spending today'), undo: () => saveSnapshot({ ...today, noSpend: false }) })
  }

  const notes = [
    over && <Note key="over">{tr('It’s okay. Tomorrow’s budget adjusts.')}</Note>,
    spentOnDayOff && <Note key="off">{tr('Comes out of your next class days. Streak is safe.')}</Note>,
    t.breakUntil && <Note key="break">{tr('{0} · Budget counts every day, streak paused', t.breakUntil === r.today ? tr('No classes today') : tr('No classes until {0}', breakDay.format(new Date(`${t.breakUntil}T00:00:00Z`))))}</Note>,
    r.overspent && <Note key="overspent">{tr('{0} more spent than you have. Log any money that came in.', formatPeso(-r.inWallets))}</Note>,
    r.holdsExceedMoney && <Note key="holds" to="/breakdown">{tr('{0} more held back than you have. See how it’s counted', formatPeso(-r.readyToSpend))}</Note>,
  ].filter(Boolean)

  return (
    <section aria-labelledby="today-title" className="flex h-full animate-rise flex-col gap-3.5 rounded-[30px] bg-card px-5 py-[1.375rem] lg:gap-[1.125rem] lg:rounded-[32px] lg:px-[1.875rem] lg:py-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="today-title" className="font-black lg:text-base">{tr('Today')}</h2>
        <Pill tone={chipTone} className="h-7 gap-1.5 px-2.5 lg:h-8 lg:px-3 lg:text-[0.8125rem]"><Icon name={chipIcon} className="size-3.5 lg:size-4" />{chipText}</Pill>
      </div>

      <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
        <p className="flex items-baseline gap-1 font-black tracking-tighter lg:gap-1.5" aria-live="polite">
          <span className="text-[1.875rem] text-muted/80 lg:text-[2.5rem]">₱</span>
          <span key={amount} className="animate-pop text-[clamp(3rem,16vw,3.75rem)] leading-[0.95] lg:text-[5.25rem]">{formatPeso(amount).slice(1)}</span>
          <span className="ml-1 text-lg tracking-normal lg:text-[1.375rem]">{suffix}</span>
        </p>
        {notes.length > 0 && <div className="flex min-w-60 flex-1 flex-col gap-2 lg:mb-1.5">{notes}</div>}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-2.5">
        <Stat title={tr('Left until {0}', LONG[weekday(t.allowance.nextDate)])} value={formatPeso(left)} sub={<span className="text-muted lg:hidden">{tr('for {0}', daysText(t))}</span>} />
        <Stat className="hidden lg:flex" title={t.allowance.countClassDays && !t.breakUntil ? tr('Class days left') : tr('Days left')} value={daysText(t)} />
        <WeekTile today={r.today} />
      </div>

      {held > 0 && (
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <SplitBar
            className="h-2.5 lg:h-3"
            label={tr('{0} left to spend, {1} held back', formatPeso(left), formatPeso(held))}
            parts={[{ amount: left, color: 'bg-blue' }, { amount: held, color: 'bg-map-1' }]}
          />
          <div className="flex justify-between gap-3 text-xs font-extrabold text-muted lg:text-[0.8125rem]">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-blue" />{tr('{0} left to spend', formatPeso(left))}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-map-1" />{tr('{0} held back', formatPeso(held))}</span>
          </div>
        </div>
      )}

      <div className="mt-auto flex gap-2 lg:flex-wrap lg:gap-2.5">
        <button type="button" onClick={() => open()} className="flex min-h-[3.125rem] flex-1 items-center justify-center gap-1.5 rounded-full bg-blue px-4 font-extrabold text-white hover:shadow-[0_10px_24px_-8px_rgba(30,94,255,0.6)] lg:min-h-13 lg:flex-none lg:px-6">
          <Icon name="plus" className="size-5" /> {tr('Add expense')}</button>
        {/* Phone: its own screen. Desktop: the sum opens right here. */}
        <Link to="/breakdown" className="flex min-h-[3.125rem] flex-1 items-center justify-center rounded-full bg-pebble px-4 font-extrabold hover:bg-pebble-2 lg:hidden">{tr('How it’s counted')}</Link>
        <button type="button" aria-expanded={showHow} onClick={() => setShowHow((s) => !s)} className="hidden min-h-13 items-center rounded-full bg-pebble px-6 font-extrabold hover:bg-pebble-2 lg:flex">
          {tr('How it’s counted')}</button>
      </div>
      {showHow && (
        <p className="hidden animate-rise flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[20px] bg-page px-4 py-3.5 text-sm font-extrabold lg:flex">
          <span>{tr('{0} in wallets', formatPeso(r.inWallets))}</span><span className="text-muted">−</span>
          <span>{tr('{0} held back', formatPeso(held))}</span><span className="text-muted">=</span>
          <span className="font-black text-blue">{tr('{0} for {1}', formatPeso(left), daysText(t))}</span>
          <Link to="/breakdown" className="ml-auto text-blue hover:underline">{tr('Details')}</Link>
        </p>
      )}

      {(t.allowance.lateFrom && onCheckIn) || (r.isClassDay && !t.breakUntil && nothingLogged) ? (
        <div className="-mt-1 flex flex-wrap gap-x-4">
          {t.allowance.lateFrom && onCheckIn && (
            <button type="button" onClick={onCheckIn} className="min-h-11 font-extrabold text-blue hover:underline">{tr('Waiting for your baon · It came')}</button>
          )}
          {r.isClassDay && !t.breakUntil && nothingLogged && (
            <button type="button" onClick={markNoSpend} className="min-h-11 font-extrabold text-blue hover:underline">{tr('No spending today? Tap to log it')}</button>
          )}
        </div>
      ) : null}
    </section>
  )
}

/** Dark streak card (whole card opens the Streak page). Phone: compact, beside Ipon outlook. */
function StreakCard({ today, streak }: { today: string; streak: Streak }) {
  const n = streak.current
  const sunday = addDays(today, -weekday(today))
  return (
    <Link
      to="/streak"
      aria-label={tr('Streak: {0} in a row. Open streak and spending map.', n === 1 ? tr('{0} day', n) : tr('{0} days', n))}
      className="flex h-full animate-rise flex-col gap-3 rounded-[26px] bg-hero p-4 text-white lg:gap-[1.125rem] lg:rounded-[32px] lg:p-6"
    >
      <span className="flex items-center gap-2 lg:gap-3">
        <img src={streakFlame(n, streak.pending)} alt="" className="size-[2.125rem] shrink-0 lg:size-12" />
        <span className="flex min-w-0 flex-1 flex-col lg:gap-0.5">
          <span className="text-[1.375rem] leading-none font-black lg:text-[1.75rem]">{n === 1 ? tr('{0} day', n) : tr('{0} days', n)}</span>
          <span className="text-xs font-bold text-white/70 lg:text-sm">
            <span className="lg:hidden">{tr('in a row')}</span>
            <span className="hidden lg:inline">{n ? tr('in a row · keep logging!') : tr('Log today to start it.')}</span>
          </span>
        </span>
        <Icon name="chevron-right" className="hidden size-5 text-[#8fb0ff] lg:block" />
      </span>
      <ol className="grid grid-cols-7 gap-[3px] lg:gap-1" aria-hidden="true">
        {SHORT.map((label, i) => {
          const day = addDays(sunday, i)
          const status = streak.days.get(day)?.status
          const done = status === 'on' || status === 'over'
          const dot = done ? 'bg-blue' : day === today ? 'border-[2.5px] border-blue lg:border-[3px]' : status === 'off' || status === 'break' ? 'border-[1.5px] border-dashed border-white/35 lg:border-2' : 'bg-white/15'
          return (
            <li key={day} className="flex flex-col items-center gap-1 lg:gap-1.5">
              <span className="text-[0.625rem] font-extrabold text-white/70 lg:text-xs">{label}</span>
              <span className={`grid size-3.5 place-items-center rounded-full lg:size-8 ${dot}`}>
                {done && <Icon name="check" className="hidden size-3.5 lg:block" />}
              </span>
            </li>
          )
        })}
      </ol>
      <span className="text-xs font-extrabold text-white/70 lg:hidden">
        {tr('Best {0}', streak.best)} · <span className="text-white">{streak.passLeft === 1 ? tr('1 free pass') : tr('{0} free passes', streak.passLeft)}</span></span>
      <span className="hidden gap-2 lg:flex">
        <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 text-[0.8125rem] font-extrabold text-white/85">
          {tr('Best')} · <span className="font-black text-white">{streak.best === 1 ? tr('{0} day', streak.best) : tr('{0} days', streak.best)}</span></span>
        <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 text-[0.8125rem] font-extrabold text-white/85">
          {tr('Free pass')} · <span className="font-black text-white">{streak.passLeft}</span></span>
      </span>
    </Link>
  )
}

/** Desktop search box: matching entries appear right under it as you type; Enter opens them all in History. */
function HomeSearch() {
  const { transactions, wallets } = useSession()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const q = query.trim()
  const matches = q ? filterEntries(transactions, wallets, q, null).reverse() : [] // newest first
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (q) navigate(`/history?q=${encodeURIComponent(q)}`)
      }}
      className="relative z-20 hidden w-[18.75rem] lg:block"
    >
      <label className="flex min-h-12 items-center gap-2.5 rounded-full bg-card px-[1.125rem] focus-within:ring-2 focus-within:ring-blue/40">
        <Icon name="search" className="size-5 shrink-0 text-muted" />
        <span className="sr-only">{tr('Search entries')}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder={tr('Search entries')}
          className="min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:text-muted"
        />
      </label>
      {q && (
        <div className="absolute top-full right-0 mt-2 w-96 animate-rise rounded-2xl border border-pebble bg-card p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
          {matches.length ? (
            <>
              <ul className="divide-y divide-page">
                {matches.slice(0, 5).map((tx, i) => <TxRow key={tx.id} tx={tx} wallets={wallets} withDay index={i} />)}
              </ul>
              {matches.length > 5 && (
                <button type="submit" className="mt-1 min-h-11 w-full rounded-xl font-extrabold text-blue hover:bg-page">{tr('See all {0} in History', matches.length)}</button>
              )}
            </>
          ) : (
            <p className="p-3 font-semibold text-muted">{tr('Nothing matches that search.')}</p>
          )}
        </div>
      )}
    </form>
  )
}

/** Home screen. */
export function Home() {
  const { name } = useSession()
  const t = useToday()
  const streak = useStreak()
  const [pick] = useState(Math.random) // same greeting all visit; the name updates if it syncs
  const [checkingIn, setCheckingIn] = useState(false) // "It came" while waiting after "Not yet"
  const greeting = randomGreeting(name, pick)
  const today = t.result.today

  return (
    <Page>
      {/* Phone: logo + avatar (the sidebar shows them on larger screens). */}
      <header className="mb-3.5 flex items-center justify-between px-1 md:hidden">
        <span className="flex items-center gap-2 text-[1.75rem] font-black tracking-tight">
          <img src={logoIcon} alt="" className="size-[2.375rem]" />
          {tr('Baon')}</span>
        <Link to="/me" aria-label={tr('Me')} className="rounded-full"><Avatar className="size-10 bg-card" /></Link>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4 px-1 lg:px-0">
        <div className="min-w-0 max-w-full">
          <p className="text-xs font-black tracking-[0.08em] text-muted uppercase lg:text-[0.8125rem]">{dateLine.format(new Date())}</p>
          <h1 className="mt-0.5 truncate text-[1.75rem] leading-tight font-black tracking-tight lg:mt-1 lg:text-[2.125rem]" title={greeting}>{greeting}</h1>
        </div>
        <HomeSearch />
      </div>

      {/* Phone order: Today · streak + outlook · tip · One-tap add. Desktop: Today and One-tap add on the left, streak + outlook on the right. */}
      <div className="mt-3.5 grid gap-3.5 lg:mt-5 lg:grid-cols-3 lg:gap-5">
        <div className="lg:col-span-2">
          {t.result.allowanceDue || (checkingIn && t.allowance.lateFrom) ? (
            <AllowanceCheckIn t={t} onCancel={t.result.allowanceDue ? undefined : () => setCheckingIn(false)} />
          ) : (
            <TodayHero t={t} onCheckIn={() => setCheckingIn(true)} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:row-span-2 lg:grid-cols-1 lg:grid-rows-[auto_1fr] lg:gap-5">
          <StreakCard today={today} streak={streak} />
          <SavingsCard t={t} />
          <TipBox className="col-span-2 lg:hidden" />
        </div>
        <div className="lg:col-span-2"><OneTapAdd /></div>
      </div>

      <div className="mt-3.5 space-y-3.5 lg:mt-5 lg:space-y-5">
        <StorageWarning />
        <BackupReminder />
      </div>

      <div className="mt-5 mb-3.5 flex items-center gap-2.5 px-1 lg:mt-6 lg:mb-5 lg:gap-3" role="presentation">
        <span className="text-xs font-black tracking-[0.08em] text-muted uppercase lg:text-[0.8125rem]">{tr('Your money')}</span>
        <span className="h-px flex-1 bg-pebble-2" />
      </div>

      {/* Phone: entries, then spent per day. Desktop: spent per day (wide) beside entries. */}
      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-5">
        <EntriesCard today={today} spent={t.result.spentToday} />
        <SpentPerDayCard today={today} budget={t.result.dailyBudget} className="lg:order-first lg:col-span-2" />
      </div>
      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-5">
        <WalletsCard />
        <SetAsideCard />
        <LimitsCard />
      </div>
    </Page>
  )
}
