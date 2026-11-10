/*
 * Breakdown.tsx — "How it's counted" (design artboard): shows how today's number
 * is made — money in wallets, minus set-asides, divided by the days left.
 * Phone: its own screen (from the hero's "How it's counted" button).
 * Desktop: the same pieces sit beside the hero card on Home.
 */
import { Link } from 'react-router'
import { weekday } from '../budget/days.ts'
import { formatPeso } from '../ledger/money.ts'
import { BigMoney, Card, Page } from '../ui/kit.tsx'
import { divisionText, useToday, type Today } from './useToday.ts'

const SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Round pills for the days the money covers; today is blue. */
export function DayPills({ t, dark = false }: { t: Today; dark?: boolean }) {
  return (
    <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Days this budget covers">
      {t.budgetDays.map((d) => (
        <li
          key={d}
          aria-label={LONG[weekday(d)]}
          className={`grid h-11 min-w-11 place-items-center rounded-full px-2.5 font-black ${
            d === t.result.today ? 'bg-blue text-white' : dark ? 'bg-white/15 text-white' : 'bg-pebble text-ink'
          }`}
        >
          {SHORT[weekday(d)]}
        </li>
      ))}
    </ul>
  )
}

/** "In wallets", "Set aside" and "Ready to spend" cards. */
export function MoneyTiles({ t }: { t: Today }) {
  const r = t.result
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="text-center">
        <p className="text-lg font-black">In wallets</p>
        <p className="truncate font-semibold text-muted">{t.spendingWallets.map((w) => w.name).join(' + ')}</p>
        <p className="mt-3 text-[clamp(1.5rem,7vw,2rem)] font-black">{formatPeso(r.inWallets)}</p>
      </Card>
      <Card className="text-center">
        <p className="text-lg font-black">Set aside</p>
        <p className="truncate font-semibold text-muted">{r.setAside ? 'For school' : 'Nothing yet'}</p>
        <p className="mt-3 text-[clamp(1.5rem,7vw,2rem)] font-black">{formatPeso(-r.setAside)}</p>
      </Card>
      <Card className="col-span-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black">Ready to spend</p>
          <p className="font-semibold text-muted">Until {LONG[weekday(t.allowance.nextDate)]}’s allowance</p>
        </div>
        <p className="text-[clamp(1.5rem,7vw,2rem)] font-black text-blue">{formatPeso(r.readyToSpend)}</p>
      </Card>
    </div>
  )
}

/** Full "How it's counted" screen (phone). */
export function Breakdown() {
  const t = useToday()
  return (
    <Page>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[clamp(1.5rem,7vw,2rem)] font-black">How it’s counted</h1>
        <Link to="/" className="grid min-h-11 place-items-center rounded-full bg-card px-5 font-black">Done</Link>
      </div>

      {t === null && <p role="alert" className="mt-6 font-bold">Couldn’t open your records.</p>}
      {t && (
        <div className="mx-auto mt-6 max-w-xl space-y-3">
          <section className="rounded-[30px] bg-ink p-6 text-center text-white">
            <p className="font-extrabold text-white/70">Safe to spend today</p>
            <BigMoney centavos={t.result.dailyBudget} className="mt-1 block text-[clamp(3.5rem,20vw,5.25rem)]" />
            <p className="mt-2 mb-5 text-lg font-extrabold text-white/70">{divisionText(t)}</p>
            <DayPills t={t} dark />
          </section>
          <MoneyTiles t={t} />
          <p className="px-4 pt-6 text-center font-semibold text-muted">
            Savings aren’t counted. Spend a bit more today and tomorrow’s budget adjusts on its own.
          </p>
        </div>
      )}
    </Page>
  )
}
