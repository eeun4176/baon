/*
 * Home.tsx — Today at a glance.
 * Phone (design p6): logo, date line, greeting, Su–Sa week row, the safe-to-spend
 *   hero with "Add expense" / "How it's counted", One-tap add, then today's entries.
 * Desktop (design p18): greeting row with a search box (matches show under it; Enter opens History); hero (with "₱720 of ₱1,500 left" bar) beside a dark
 *   streak card (week row, best streak, free pass); One-tap add + Set aside for school; Wallets;
 *   Spent per day + Today.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import logoIcon from '../assets/logo-icon.png'
import { streakFlame } from '../streak/flame.ts'
import { manilaDate, weekday } from '../budget/days.ts'
import { SpentPerDay } from '../history/Charts.tsx'
import { filterEntries, spentPerDay } from '../history/history.ts'
import { TxRow } from '../history/TxRow.tsx'
import { balances } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { sortForList, statusOf } from '../plan/school.ts'
import { useSession } from '../session.ts'
import { useAddDialog } from '../shell/useAddDialog.ts'
import type { Streak } from '../streak/streak.ts'
import { useStreak } from '../streak/useStreak.ts'
import { WeekRow } from '../streak/WeekRow.tsx'
import { BigMoney, Card, Icon, Page } from '../ui/kit.tsx'
import { randomGreeting } from './greetings.ts'
import { AllowanceCheckIn } from './AllowanceCheckIn.tsx'
import { BackupReminder } from '../backup/BackupReminder.tsx'
import { LimitsCard } from './LimitsCard.tsx'
import { OneTapAdd } from './OneTapAdd.tsx'
import { StorageWarning } from './StorageWarning.tsx'
import { useToday, type Today } from './useToday.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

const LONG = [tr('Sunday'), tr('Monday'), tr('Tuesday'), tr('Wednesday'), tr('Thursday'), tr('Friday'), tr('Saturday')]
const dueDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const breakDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const dateLine = new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

/** The big "Safe to spend today" card. `onCheckIn`: "It came" while waiting after "Not yet". */
function Hero({ t, onCheckIn }: { t: Today; onCheckIn?: () => void }) {
  const { open } = useAddDialog()
  const { transactions, snapshots, saveSnapshot, showToast } = useSession()
  const r = t.result
  const over = r.isClassDay && r.leftToday < 0
  const spentOnDayOff = !r.isClassDay && r.spentToday > 0 // not "over": it comes out of the next class days
  const label = over ? tr('Today') : r.isClassDay ? tr('Safe to spend today') : spentOnDayOff ? tr('No class today') : tr('No class today — ₱0 planned')
  const snap = snapshots.find((s) => s.date === r.today)
  const nothingLogged = !snap?.noSpend && !transactions.some((tx) => manilaDate(tx.occurredAt) === r.today)

  /** "No spending today": counts as logged for the streak, with Undo. */
  async function markNoSpend() {
    const today = snap ?? { date: r.today, dailyBudgetCentavos: r.dailyBudget, isClassDay: r.isClassDay }
    await saveSnapshot({ ...today, noSpend: true })
    showToast({ message: tr('Logged: no spending today'), undo: () => saveSnapshot({ ...today, noSpend: false }) })
  }
  const allowance = t.allowance.amountCentavos
  const leftShare = allowance > 0 ? Math.min(1, Math.max(0, r.readyToSpend / allowance)) : 0
  return (
    <Card className="h-full animate-rise px-4 py-8 text-center sm:px-6 lg:px-7 lg:py-7 lg:text-left">
      <p className="text-[1.0625rem] font-extrabold text-muted">{label}</p>
      <p className="mt-2" aria-live="polite">
        <BigMoney centavos={spentOnDayOff ? r.spentToday : Math.abs(r.leftToday)} className="text-[clamp(3rem,18vw,4.5rem)] lg:text-[5.5rem]" />
        {(over || spentOnDayOff) && <span className="ml-1 text-3xl font-black">{over ? tr('over') : tr('spent')}</span>}
      </p>
      {over && <p className="mx-auto mt-3 max-w-xs font-bold lg:mx-0">{tr('That’s okay. Tomorrow’s budget adjusts — you’ve got this.')}</p>}
      {spentOnDayOff && <p className="mx-auto mt-3 max-w-xs font-bold lg:mx-0">{tr('It comes out of your next class days. Your streak isn’t affected.')}</p>}
      <p className="mt-3 font-semibold text-muted">
        {tr('{0} left until {1}', formatPeso(Math.max(0, r.readyToSpend)), LONG[weekday(t.allowance.nextDate)])} · {t.allowance.countClassDays && !t.breakUntil
          ? r.budgetDays === 1 ? tr('{0} class day', r.budgetDays) : tr('{0} class days', r.budgetDays)
          : r.budgetDays === 1 ? tr('{0} day', r.budgetDays) : tr('{0} days', r.budgetDays)}
      </p>
      {t.allowance.lateFrom && onCheckIn && (
        <button type="button" onClick={onCheckIn} className="mt-2 min-h-11 font-extrabold text-blue hover:underline">
          {tr('Waiting for your baon · It came')}</button>
      )}

      {/* Desktop: how much of this allowance is left (design p18) */}
      {allowance > 0 && (
        <div className="mt-4 hidden lg:block">
          <span className="block h-2.5 overflow-hidden rounded-full bg-page" aria-hidden="true">
            <span className="block h-full origin-left animate-grow-x rounded-full bg-blue" style={{ width: `${leftShare * 100}%` }} />
          </span>
          <p className="mt-2 flex justify-between text-sm font-extrabold text-muted">
            <span>
              {r.readyToSpend <= allowance ? tr('{0} of {1} left', formatPeso(Math.max(0, r.readyToSpend)), formatPeso(allowance)) : tr('{0} left', formatPeso(Math.max(0, r.readyToSpend)))}</span>
            <span>{tr('{0} set aside', formatPeso(r.setAside))}</span>
          </p>
        </div>
      )}

      {t.breakUntil && (
        <p className="mt-4 rounded-2xl bg-blue-tint p-3 font-extrabold text-blue">
          {tr('{0} · budget counts every day, streak paused', t.breakUntil === r.today ? tr('No classes today') : tr('No classes until {0}', breakDay.format(new Date(`${t.breakUntil}T00:00:00Z`))))}</p>
      )}
      {r.setAsidesExceedMoney && <p className="mt-4 rounded-2xl bg-pebble p-3 font-bold">{tr('Your set-asides are more than your money right now. Want to review them?')}</p>}

      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:flex">
        <button
          type="button"
          onClick={() => open()}
          className="flex min-h-14 items-center justify-center gap-1.5 rounded-full bg-blue px-3 text-center text-base leading-tight font-black text-white hover:shadow-[0_10px_24px_-8px_rgba(30,94,255,0.6)] sm:text-lg lg:min-h-12 lg:px-6"
        >
          <Icon name="plus" className="size-5" /> {tr('Add expense')}</button>
        <Link to="/breakdown" className="flex min-h-14 items-center justify-center rounded-full bg-pebble px-3 text-center text-base leading-tight font-black hover:bg-pebble-2 sm:text-lg lg:min-h-12 lg:px-6">
          {tr('How it’s counted')}</Link>
      </div>
      {r.isClassDay && !t.breakUntil && nothingLogged && (
        <button type="button" onClick={markNoSpend} className="mt-4 min-h-11 font-extrabold text-blue hover:underline">
          {tr('No spending today? Tap to log it')}</button>
      )}
    </Card>
  )
}

/** Desktop dark streak card (design p18): streak, this week's ✓ row, best streak + free pass, link to the map. */
function StreakCard({ today, streak }: { today: string; streak: Streak }) {
  const n = streak.current
  return (
    <section className="flex h-full animate-rise flex-col rounded-[28px] bg-hero p-6 text-white" aria-labelledby="streak-title">
      <div className="flex items-center gap-3">
        <img src={streakFlame(n, streak.pending)} alt="" className="size-11 shrink-0" />
        <div>
          <h2 id="streak-title" className="text-2xl font-black">{n ? tr('{0} {1} in a row', n, n === 1 ? tr('day') : tr('days')) : tr('Your streak')}</h2>
          <p className="font-semibold text-white/70">{n ? tr('Keep logging — you’re doing great.') : tr('Log today to start it.')}</p>
        </div>
      </div>
      <div className="mt-5">
        <WeekRow today={today} streak={streak} dark />
      </div>
      {/* The stretchy part: when the hero beside this card grows, these tiles grow with it, so no gap opens */}
      <dl className="mt-4 grid flex-1 grid-cols-2 gap-3">
        <div className="flex flex-col justify-center rounded-2xl bg-white/10 px-4 py-3">
          <dt className="text-sm font-extrabold text-white/70">{tr('Best streak')}</dt>
          <dd className="text-xl font-black">{streak.best} {streak.best === 1 ? tr('day') : tr('days')}</dd>
        </div>
        <div className="flex flex-col justify-center rounded-2xl bg-white/10 px-4 py-3">
          <dt className="text-sm font-extrabold text-white/70">{tr('Free pass')}</dt>
          <dd className="text-xl font-black">{streak.passLeft} <span className="text-sm font-extrabold text-white/70">{streak.passLeft ? tr('saved') : tr('next one on Monday')}</span></dd>
        </div>
      </dl>
      <Link to="/streak" className="mt-4 inline-flex items-center gap-1 font-extrabold text-[#8fb0ff] hover:text-white">
        {tr('See spending map')}{' '}<Icon name="chevron-right" className="size-4" />
      </Link>
    </section>
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
      className="relative z-20 hidden w-72 lg:block"
    >
      <label className="flex min-h-11 items-center gap-2.5 rounded-full bg-card px-4 focus-within:ring-2 focus-within:ring-blue/40">
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

/** Today's entries, newest first, so the day is easy to follow without opening History. */
function TodayCard({ today, spent, className = '' }: { today: string; spent: number; className?: string }) {
  const { transactions, wallets } = useSession()
  const list = transactions.filter((tx) => manilaDate(tx.occurredAt) === today).reverse()
  return (
    <Card className={`flex animate-rise flex-col ${className}`}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-black">{tr('Today')}</h2>
        {list.length > 0 && <p className="text-sm font-extrabold text-muted">{tr('{0} spent', formatPeso(spent))}</p>}
      </div>
      {list.length ? (
        <ul className="-mx-2 divide-y divide-page">
          {list.slice(0, 5).map((tx, i) => <TxRow key={tx.id} tx={tx} wallets={wallets} index={i} />)}
        </ul>
      ) : (
        <p className="my-auto py-2 font-semibold text-muted">{tr('Nothing logged today yet.')}</p>
      )}
      {list.length > 5 && (
        <Link to="/history" className="mt-1 inline-flex min-h-11 items-center font-extrabold text-blue hover:underline">{tr('See all {0} in History', list.length)}</Link>
      )}
    </Card>
  )
}

/** Wallet balances (design p18 "Wallets"). */
function Wallets() {
  const { wallets, transactions } = useSession()
  const all = balances(wallets, transactions)
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const total = spending.reduce((s, w) => s + all.get(w.id)!, 0)
  return (
    <Card className="h-full animate-rise">
      <h2 className="text-xl font-black">{tr('Wallets')}</h2>
      <p key={total} className="mt-1 animate-pop text-4xl font-black">{formatPeso(total)}</p>
      <ul className="mt-3 divide-y divide-page">
        {wallets.filter((w) => !w.archived).map((w) => (
          <li key={w.id} className="flex items-center gap-3 py-3">
            <Icon name={w.type === 'savings' ? 'piggy' : w.id === 'cash' ? 'wallet' : 'phone'} className="size-5 text-blue" />
            <span className="flex-1">
              <span className="block font-black">{w.name}</span>
              {w.type === 'savings' && <span className="block text-sm font-semibold text-muted">{tr('Not counted as spendable')}</span>}
            </span>
            <span className="font-black">{formatPeso(all.get(w.id)!)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Home screen. */
export function Home() {
  const { name, transactions, schoolExpenses } = useSession()
  const t = useToday()
  const streak = useStreak()
  const upcoming = sortForList(schoolExpenses, transactions).filter((i) => statusOf(i, transactions) !== 'paid').slice(0, 3)
  const [pick] = useState(Math.random) // same greeting all visit; the name updates if it syncs
  const [checkingIn, setCheckingIn] = useState(false) // "It came" while waiting after "Not yet"
  const greeting = randomGreeting(name, pick)
  const today = t.result.today

  return (
    <Page>
      {/* Phone: logo header (the sidebar shows it on larger screens). */}
      <header className="mb-6 flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight md:hidden">
        <img src={logoIcon} alt="" className="size-10" />
        {tr('Baon')}<Link to="/streak" aria-label={tr('{0}-day streak', streak.current)} className="ml-auto flex min-h-11 items-center gap-1 rounded-full bg-card px-3.5 text-xl font-black tracking-normal">
          <img src={streakFlame(streak.current, streak.pending)} alt="" className="size-6" /> {streak.current}
        </Link>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-full">
          <p className="text-sm font-extrabold tracking-[0.12em] text-muted uppercase">{dateLine.format(new Date())}</p>
          <h1 className="mt-1 truncate text-[clamp(1.375rem,6.4vw,2rem)] leading-tight font-black lg:text-[2rem]" title={greeting}>{greeting}</h1>
        </div>
        <HomeSearch />
      </div>

      {/* Phone/tablet: week row above the hero (design p6) */}
      <div className="mt-6 lg:hidden">
        <Link to="/streak" aria-label={tr('This week · open your streak')} className="block rounded-2xl">
          <WeekRow today={today} streak={streak} />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:gap-5">
        {/* Allowance day: ask first — the new daily budget starts once the baon is in (design p13) */}
        <div className="lg:col-span-7">
          {t.result.allowanceDue || (checkingIn && t.allowance.lateFrom) ? (
            <AllowanceCheckIn t={t} onCancel={t.result.allowanceDue ? undefined : () => setCheckingIn(false)} />
          ) : (
            <Hero t={t} onCheckIn={() => setCheckingIn(true)} />
          )}
        </div>
        <div className="hidden lg:col-span-5 lg:block"><StreakCard today={today} streak={streak} /></div>

        <StorageWarning className="lg:col-span-12" />
        <LimitsCard className="lg:col-span-12" />
        <div className="lg:col-span-6"><OneTapAdd /></div>
        {/* Phones: right under One-tap add. Desktop: last, beside Spent per day. */}
        <TodayCard today={today} spent={t.result.spentToday} className="lg:order-1 lg:col-span-5" />
        <Card className="hidden animate-rise md:flex md:flex-col lg:col-span-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-black">{tr('Set aside for school')}</h2>
            <Link to="/plan" className="font-extrabold text-blue">{tr('See all')}</Link>
          </div>
          <p key={t.result.setAside} className="mt-1 animate-pop text-4xl font-black">{formatPeso(t.result.setAside)}</p>
          {upcoming.length ? (
            <ul className="mt-2 divide-y divide-page">
              {upcoming.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-black">{i.title}</span>
                    <span className="block text-sm font-semibold text-muted">
                      {tr('{0} · due {1}', i.status === 'setAside' ? tr('Set aside') : tr('Planned'), dueDay.format(new Date(`${i.dueDate}T00:00:00Z`)))}
                    </span>
                  </span>
                  <span className="font-black">{formatPeso(i.estimatedCentavos)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="mt-3 font-semibold text-muted">{tr('Nothing set aside yet. Plan printing, projects or org fees ahead.')}</p>
              {/* The button sits at the bottom, so a taller One-tap add beside this card never leaves it looking cut short */}
              <Link to="/plan" className="mt-auto flex min-h-11 items-center justify-center gap-2 self-stretch rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
                <Icon name="plus" className="size-5" /> {tr('Plan an expense')}</Link>
            </>
          )}
        </Card>

        <BackupReminder className="lg:col-span-12" />
        <div className="hidden md:block lg:col-span-12"><Wallets /></div>

        <Card className="hidden animate-rise md:flex md:flex-col lg:col-span-7">{/* the bars stretch when Today beside it is taller */}
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-xl font-black">{tr('Spent per day')}</h2>
            <Link to="/history" className="font-extrabold text-blue">{tr('Open history')}</Link>
          </div>
          <SpentPerDay days={spentPerDay(transactions, today)} today={today} budget={t.result.dailyBudget} />
        </Card>
      </div>
    </Page>
  )
}
