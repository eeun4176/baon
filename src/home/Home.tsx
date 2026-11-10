/*
 * Home.tsx — Today at a glance (design artboard "Home", plan §6):
 * date line, random greeting, Su–Sa week row, and the safe-to-spend hero card.
 *
 * Phone: one column, in the design's order; "How it's counted" opens its own screen.
 * Desktop: hero card on the left; week row and the "How it's counted" breakdown
 * on the right, so the extra width shows more instead of stretching cards.
 *
 * Coming in later branches: ✓ marks + 🔥 streak chip (feat/streak), One-tap add
 * presets (feat/quick-add), "Set aside for school" preview (feat/school-expenses).
 */
import { useState } from 'react'
import { Link } from 'react-router'
import logoIcon from '../assets/logo-icon.png'
import { addDays, weekday } from '../budget/days.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { BigMoney, Card, Icon, Page } from '../ui/kit.tsx'
import { DayPills, MoneyTiles } from './Breakdown.tsx'
import { randomGreeting } from './greetings.ts'
import { divisionText, useToday, type Today } from './useToday.ts'

const SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dateLine = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

/** Su–Sa row for this week: today is a blue ring with a dot; other days stay gray until streaks exist. */
function WeekRow({ today }: { today: string }) {
  const sunday = addDays(today, -weekday(today))
  return (
    <ol className="grid grid-cols-7 gap-1.5 text-center" aria-label="This week">
      {SHORT.map((label, i) => {
        const day = addDays(sunday, i)
        const isToday = day === today
        return (
          <li key={day} aria-current={isToday ? 'date' : undefined} aria-label={`${LONG[i]}${isToday ? ', today' : ''}`}>
            <span className="text-[15px] font-extrabold" aria-hidden="true">{label}</span>
            <span
              aria-hidden="true"
              className={`mx-auto mt-2 block aspect-square w-full max-w-11 rounded-full ${isToday ? 'border-[3px] border-blue bg-card' : 'bg-pebble-2'}`}
            />
            <span aria-hidden="true" className={`mx-auto mt-1.5 block size-1.5 rounded-full ${isToday ? 'bg-blue' : ''}`} />
          </li>
        )
      })}
    </ol>
  )
}

/** The big "Safe to spend today" card with its two actions. */
function Hero({ t }: { t: Today }) {
  const r = t.result
  const over = r.leftToday < 0
  const label = over ? 'Today' : r.isClassDay ? 'Safe to spend today' : 'No class today — ₱0 planned'
  return (
    <Card className="px-4 py-8 text-center sm:px-6 lg:py-12">
      <p className="text-[17px] font-extrabold text-muted">{label}</p>
      <p className="mt-2" aria-live="polite">
        <BigMoney centavos={Math.abs(r.leftToday)} className="text-[clamp(3.5rem,22vw,5.25rem)] lg:text-[6.5rem]" />
        {over && <span className="ml-1 text-3xl font-black">over</span>}
      </p>
      {over && <p className="mx-auto mt-3 max-w-xs font-bold">That’s okay. Tomorrow’s budget adjusts — you’ve got this.</p>}
      <p className="mt-3 font-semibold text-muted">
        {formatPeso(Math.max(0, r.readyToSpend))} left until {LONG[weekday(t.allowance.nextDate)]} · {r.budgetDays}{' '}
        {t.allowance.countClassDays ? 'class ' : ''}
        {r.budgetDays === 1 ? 'day' : 'days'}
      </p>

      {r.allowanceDue && <p className="mt-4 rounded-2xl bg-blue-tint p-3 font-extrabold text-blue">Allowance day — did your baon arrive?</p>}
      {r.setAsidesExceedMoney && (
        <p className="mt-4 rounded-2xl bg-pebble p-3 font-bold">Your set-asides are more than your money right now. Want to review them?</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-1 lg:px-8">
        <Link to="/add" className="flex min-h-14 items-center justify-center gap-1.5 rounded-full bg-blue px-3 text-base font-black whitespace-nowrap text-white sm:text-lg">
          <Icon name="plus" className="size-5" /> Add expense
        </Link>
        <Link to="/breakdown" className="flex min-h-14 items-center justify-center rounded-full bg-pebble px-3 text-base font-black whitespace-nowrap sm:text-lg lg:hidden">
          How it’s counted
        </Link>
      </div>
    </Card>
  )
}

/** Home screen. */
export function Home() {
  const { name } = useSession()
  const t = useToday()
  const [greeting] = useState(() => randomGreeting(name))

  return (
    <Page>
      {/* Logo only on phones — the sidebar shows it on larger screens. */}
      <header className="mb-6 flex items-center gap-2.5 text-[34px] font-black tracking-tight md:hidden">
        <img src={logoIcon} alt="" className="size-10" />
        baon
      </header>

      <p className="text-sm font-extrabold tracking-[0.12em] text-muted uppercase">{dateLine.format(new Date())}</p>
      <h1 className="mt-1 text-[clamp(1.5rem,7vw,2rem)] leading-tight font-black lg:text-4xl">{greeting}</h1>

      {t === undefined && <p className="mt-8 font-bold text-muted">Loading…</p>}
      {t === null && <p role="alert" className="mt-8 font-bold">Couldn’t open your records. Close and reopen baon.</p>}
      {t && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-6">
          <section className="lg:col-start-2 lg:row-start-1 lg:rounded-[28px] lg:bg-card lg:p-5">
            <h2 className="mb-3 hidden text-lg font-black lg:block">This week</h2>
            <WeekRow today={t.result.today} />
          </section>

          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <Hero t={t} />
          </div>

          {/* Desktop: the breakdown sits beside the hero instead of on its own screen. */}
          <section className="hidden space-y-3 lg:col-start-2 lg:block" aria-labelledby="how-counted">
            <Card className="text-center">
              <h2 id="how-counted" className="text-lg font-black">How it’s counted</h2>
              <p className="mt-1 mb-4 font-extrabold text-muted">{divisionText(t)}</p>
              <DayPills t={t} />
            </Card>
            <MoneyTiles t={t} />
          </section>
        </div>
      )}
    </Page>
  )
}
