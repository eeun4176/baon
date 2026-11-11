/*
 * Home.tsx — Today at a glance.
 * Phone (design p6): logo, date line, greeting, Su–Sa week row, the safe-to-spend
 *   hero with "Add expense" / "How it's counted", and One-tap add.
 * Desktop (design p18): greeting row with search; hero (with "₱720 of ₱1,500 left" bar)
 *   beside a dark streak card; One-tap add + Set aside for school; Wallets;
 *   Spent per day + Recent.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import logoIcon from '../assets/logo-icon.png'
import flame from '../assets/streak-flame.png'
import { manilaDate, weekday } from '../budget/days.ts'
import { SpentPerDay } from '../history/Charts.tsx'
import { spentPerDay } from '../history/history.ts'
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
import { OneTapAdd } from './OneTapAdd.tsx'
import { useToday, type Today } from './useToday.ts'

const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dueDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const breakDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const dateLine = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

/** The big "Safe to spend today" card. */
function Hero({ t }: { t: Today }) {
  const { open } = useAddDialog()
  const { transactions, snapshots, saveSnapshot, showToast } = useSession()
  const r = t.result
  const over = r.isClassDay && r.leftToday < 0
  const spentOnDayOff = !r.isClassDay && r.spentToday > 0 // not "over": it comes out of the next class days
  const label = over ? 'Today' : r.isClassDay ? 'Safe to spend today' : spentOnDayOff ? 'No class today' : 'No class today — ₱0 planned'
  const snap = snapshots.find((s) => s.date === r.today)
  const nothingLogged = !snap?.noSpend && !transactions.some((tx) => manilaDate(tx.occurredAt) === r.today)

  /** "No spending today": counts as logged for the streak, with Undo. */
  async function markNoSpend() {
    const today = snap ?? { date: r.today, dailyBudgetCentavos: r.dailyBudget, isClassDay: r.isClassDay }
    await saveSnapshot({ ...today, noSpend: true })
    showToast({ message: 'Logged: no spending today', undo: () => saveSnapshot({ ...today, noSpend: false }) })
  }
  const allowance = t.allowance.amountCentavos
  const leftShare = allowance > 0 ? Math.min(1, Math.max(0, r.readyToSpend / allowance)) : 0
  return (
    <Card className="h-full animate-rise px-4 py-8 text-center sm:px-6 lg:px-7 lg:py-7 lg:text-left">
      <p className="text-[1.0625rem] font-extrabold text-muted">{label}</p>
      <p className="mt-2" aria-live="polite">
        <BigMoney centavos={spentOnDayOff ? r.spentToday : Math.abs(r.leftToday)} className="text-[clamp(3.5rem,22vw,5.25rem)] lg:text-[5.5rem]" />
        {(over || spentOnDayOff) && <span className="ml-1 text-3xl font-black">{over ? 'over' : 'spent'}</span>}
      </p>
      {over && <p className="mx-auto mt-3 max-w-xs font-bold lg:mx-0">That’s okay. Tomorrow’s budget adjusts — you’ve got this.</p>}
      {spentOnDayOff && <p className="mx-auto mt-3 max-w-xs font-bold lg:mx-0">It comes out of your next class days. Your streak isn’t affected.</p>}
      <p className="mt-3 font-semibold text-muted">
        {formatPeso(Math.max(0, r.readyToSpend))} left until {LONG[weekday(t.allowance.nextDate)]} · {r.budgetDays}{' '}
        {t.allowance.countClassDays && !t.breakUntil ? 'class ' : ''}
        {r.budgetDays === 1 ? 'day' : 'days'}
      </p>

      {/* Desktop: how much of this allowance is left (design p18) */}
      {allowance > 0 && (
        <div className="mt-4 hidden lg:block">
          <span className="block h-2.5 overflow-hidden rounded-full bg-page" aria-hidden="true">
            <span className="block h-full origin-left animate-grow-x rounded-full bg-blue" style={{ width: `${leftShare * 100}%` }} />
          </span>
          <p className="mt-2 flex justify-between text-sm font-extrabold text-muted">
            <span>
              {formatPeso(Math.max(0, r.readyToSpend))}
              {r.readyToSpend <= allowance ? ` of ${formatPeso(allowance)}` : ''} left
            </span>
            <span>{formatPeso(r.setAside)} set aside</span>
          </p>
        </div>
      )}

      {t.breakUntil && (
        <p className="mt-4 rounded-2xl bg-blue-tint p-3 font-extrabold text-blue">
          {t.breakUntil === r.today ? 'No classes today' : `No classes until ${breakDay.format(new Date(`${t.breakUntil}T00:00:00Z`))}`} · budget counts every day, streak paused
        </p>
      )}
      {r.setAsidesExceedMoney && <p className="mt-4 rounded-2xl bg-pebble p-3 font-bold">Your set-asides are more than your money right now. Want to review them?</p>}

      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:flex">
        <button
          type="button"
          onClick={() => open()}
          className="flex min-h-14 items-center justify-center gap-1.5 rounded-full bg-blue px-3 text-base font-black whitespace-nowrap text-white hover:shadow-[0_10px_24px_-8px_rgba(30,94,255,0.6)] sm:text-lg lg:min-h-12 lg:px-6"
        >
          <Icon name="plus" className="size-5" /> Add expense
        </button>
        <Link to="/breakdown" className="flex min-h-14 items-center justify-center rounded-full bg-pebble px-3 text-base font-black whitespace-nowrap hover:bg-pebble-2 sm:text-lg lg:min-h-12 lg:px-6">
          How it’s counted
        </Link>
      </div>
      {r.isClassDay && !t.breakUntil && nothingLogged && (
        <button type="button" onClick={markNoSpend} className="mt-4 min-h-11 font-extrabold text-blue hover:underline">
          No spending today? Tap to log it
        </button>
      )}
    </Card>
  )
}

/** Desktop dark streak card (design p18): streak, this week's ✓ row, link to the map. */
function StreakCard({ today, streak }: { today: string; streak: Streak }) {
  const n = streak.current
  return (
    <section className="flex h-full animate-rise flex-col rounded-[28px] bg-hero p-6 text-white" aria-labelledby="streak-title">
      <div className="flex items-center gap-3">
        <img src={flame} alt="" className="size-11 shrink-0" />
        <div>
          <h2 id="streak-title" className="text-2xl font-black">{n ? `${n} ${n === 1 ? 'day' : 'days'} in a row` : 'Your streak'}</h2>
          <p className="font-semibold text-white/70">{n ? 'Keep logging — you’re doing great.' : 'Log today to start it.'}</p>
        </div>
      </div>
      <div className="mt-6">
        <WeekRow today={today} streak={streak} dark />
      </div>
      <Link to="/streak" className="mt-auto inline-flex items-center gap-1 pt-6 font-extrabold text-[#8fb0ff] hover:text-white">
        See spending map <Icon name="chevron-right" className="size-4" />
      </Link>
    </section>
  )
}

/** Wallet balances (design p18 "Wallets"). */
function Wallets() {
  const { wallets, transactions } = useSession()
  const all = balances(wallets, transactions)
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const total = spending.reduce((s, w) => s + all.get(w.id)!, 0)
  return (
    <Card className="animate-rise">
      <h2 className="text-xl font-black">Wallets</h2>
      <p key={total} className="mt-1 animate-pop text-4xl font-black">{formatPeso(total)}</p>
      <ul className="mt-3 divide-y divide-page">
        {wallets.filter((w) => !w.archived).map((w) => (
          <li key={w.id} className="flex items-center gap-3 py-3">
            <Icon name={w.type === 'savings' ? 'piggy' : w.id === 'cash' ? 'wallet' : 'phone'} className="size-5 text-blue" />
            <span className="flex-1">
              <span className="block font-black">{w.name}</span>
              {w.type === 'savings' && <span className="block text-sm font-semibold text-muted">Not counted as spendable</span>}
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
  const { name, transactions, wallets, schoolExpenses } = useSession()
  const t = useToday()
  const streak = useStreak()
  const upcoming = sortForList(schoolExpenses, transactions).filter((i) => statusOf(i, transactions) !== 'paid').slice(0, 3)
  const [greeting] = useState(() => randomGreeting(name))
  const today = t.result.today
  const recent = [...transactions].reverse().slice(0, 5)

  return (
    <Page>
      {/* Phone: logo header (the sidebar shows it on larger screens). */}
      <header className="mb-6 flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight md:hidden">
        <img src={logoIcon} alt="" className="size-10" />
        baon
        <Link to="/streak" aria-label={`${streak.current}-day streak`} className="ml-auto flex items-center gap-1 rounded-full bg-card px-3.5 py-1.5 text-xl font-black tracking-normal">
          <img src={flame} alt="" className="size-6" /> {streak.current}
        </Link>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold tracking-[0.12em] text-muted uppercase">{dateLine.format(new Date())}</p>
          <h1 className="mt-1 text-[clamp(1.5rem,7vw,2rem)] leading-tight font-black lg:text-[2rem]">{greeting}</h1>
        </div>
        <Link to="/history" className="hidden min-h-11 w-64 items-center gap-2.5 rounded-full bg-card px-4 font-bold text-muted hover:text-ink lg:flex">
          <Icon name="search" className="size-5" /> Search entries
        </Link>
      </div>

      {/* Phone/tablet: week row above the hero (design p6) */}
      <div className="mt-6 lg:hidden">
        <Link to="/streak" aria-label="This week · open your streak" className="block rounded-2xl">
          <WeekRow today={today} streak={streak} />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:gap-5">
        {/* Allowance day: ask first — the new daily budget starts once the baon is in (design p13) */}
        <div className="lg:col-span-7">{t.result.allowanceDue ? <AllowanceCheckIn t={t} /> : <Hero t={t} />}</div>
        <div className="hidden lg:col-span-5 lg:block"><StreakCard today={today} streak={streak} /></div>

        <div className="lg:col-span-6"><OneTapAdd /></div>
        <Card className="hidden animate-rise md:block lg:col-span-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-black">Set aside for school</h2>
            <Link to="/plan" className="font-extrabold text-blue">See all</Link>
          </div>
          <p key={t.result.setAside} className="mt-1 animate-pop text-4xl font-black">{formatPeso(t.result.setAside)}</p>
          {upcoming.length ? (
            <ul className="mt-2 divide-y divide-page">
              {upcoming.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-black">{i.title}</span>
                    <span className="block text-sm font-semibold text-muted">
                      {i.status === 'setAside' ? 'Set aside' : 'Planned'} · due {dueDay.format(new Date(`${i.dueDate}T00:00:00Z`))}
                    </span>
                  </span>
                  <span className="font-black">{formatPeso(i.estimatedCentavos)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 font-semibold text-muted">Nothing set aside yet. Plan printing, projects and org fees so your daily budget stays honest.</p>
          )}
        </Card>

        <BackupReminder className="lg:col-span-12" />
        <div className="hidden md:block lg:col-span-12"><Wallets /></div>

        <Card className="hidden animate-rise md:block lg:col-span-7">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-xl font-black">Spent per day</h2>
            <Link to="/history" className="font-extrabold text-blue">Open history</Link>
          </div>
          <SpentPerDay days={spentPerDay(transactions, today)} today={today} budget={t.result.dailyBudget} />
        </Card>
        <Card className="hidden animate-rise md:block lg:col-span-5">
          <h2 className="mb-2 text-xl font-black">Recent</h2>
          {recent.length ? (
            <ul className="-mx-2 divide-y divide-page">
              {recent.map((tx, i) => <TxRow key={tx.id} tx={tx} wallets={wallets} withDay index={i} />)}
            </ul>
          ) : (
            <p className="font-semibold text-muted">Nothing logged yet — your latest entries show up here.</p>
          )}
        </Card>
      </div>
    </Page>
  )
}
