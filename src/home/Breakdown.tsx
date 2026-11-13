/*
 * Breakdown.tsx — "How it's counted": shows how today's number
 * is made — money in wallets, minus set-asides, divided by the days left.
 * Phone: its own screen (from the hero's "How it's counted" button).
 * Desktop: the same pieces sit beside the hero card on Home.
 */
import { Link } from 'react-router'
import { weekday } from '../budget/days.ts'
import { formatPeso } from '../ledger/money.ts'
import { BigMoney, Card, Page } from '../ui/kit.tsx'
import { divisionText, useToday, type Today } from './useToday.ts'
import { tr } from '../i18n/i18n.ts'

const SHORT = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]
const LONG = [tr('Sunday'), tr('Monday'), tr('Tuesday'), tr('Wednesday'), tr('Thursday'), tr('Friday'), tr('Saturday')]

/** Round pills for the days the money covers; today is blue. */
export function DayPills({ t, dark = false }: { t: Today; dark?: boolean }) {
  return (
    <ul className="flex flex-wrap justify-center gap-1.5" aria-label={tr('Days this budget covers')}>
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
        <p className="text-lg font-black">{tr('In wallets')}</p>
        <p className="truncate font-semibold text-muted">{t.spendingWallets.map((w) => w.name).join(' + ')}</p>
        <p className="mt-3 text-[clamp(1.5rem,7vw,2rem)] font-black">{formatPeso(r.inWallets)}</p>
      </Card>
      <Card className="text-center">
        <p className="text-lg font-black">{tr('Set aside')}</p>
        <p className="truncate font-semibold text-muted">{r.setAside ? tr('For school') : tr('Nothing yet')}</p>
        <p className="mt-3 text-[clamp(1.5rem,7vw,2rem)] font-black">{formatPeso(-r.setAside)}</p>
      </Card>
      <Card className="col-span-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black">{tr('Ready to spend')}</p>
          <p className="font-semibold text-muted">{tr('Until {0}’s allowance', LONG[weekday(t.allowance.nextDate)])}</p>
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
        <h1 className="text-[clamp(1.5rem,7vw,2rem)] font-black">{tr('How it’s counted')}</h1>
        <Link to="/" className="grid min-h-11 place-items-center rounded-full bg-card px-5 font-black">{tr('Done')}</Link>
      </div>

      <div className="mx-auto mt-6 max-w-xl space-y-3">
        {t.result.allowanceDue ? (
          // Allowance day, not answered yet: no budget to explain until the baon is in.
          <section className="rounded-3xl bg-hero p-4 sm:rounded-[30px] sm:p-6 text-center text-white">
            <p className="font-extrabold text-white/70">{tr('Allowance day')}</p>
            <p className="mt-2 text-2xl font-black">{tr('Your new daily budget starts once your baon is in.')}</p>
            <Link to="/" className="mt-5 inline-grid min-h-12 place-items-center rounded-full bg-blue px-6 font-black text-white">{tr('Did it arrive?')}</Link>
          </section>
        ) : (
          <section className="rounded-3xl bg-hero p-4 sm:rounded-[30px] sm:p-6 text-center text-white">
            <p className="font-extrabold text-white/70">{tr('Safe to spend today')}</p>
            <BigMoney centavos={t.result.dailyBudget} className="mt-1 block text-[clamp(3rem,17vw,4.5rem)]" />
            <p className="mt-2 mb-5 text-lg font-extrabold text-white/70">{divisionText(t)}</p>
            <DayPills t={t} dark />
          </section>
        )}
        <MoneyTiles t={t} />
        <p className="px-4 pt-6 text-center font-semibold text-muted">
          {tr('Savings aren’t counted. Spend more today and tomorrow’s budget adjusts.')}</p>
      </div>
    </Page>
  )
}
