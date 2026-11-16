/*
 * MoneyCards.tsx — Home's money cards (Home v2 design): wallets near the top, the rest under "Activity & plans":
 *   EntriesCard     today's entries, newest first, under a daily summary line (phone: "See all N" link)
 *   SpentPerDayCard the last 7 days as bars (now on phones too)
 *   WalletsCard     total + each wallet (phone: sideways row; desktop: header row + top 4 tiles)
 *   SetAsideCard    money set aside for school and what's next (phone: the first item)
 */
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { manilaDate } from '../budget/days.ts'
import type { SafeToSpend } from '../budget/safeToSpend.ts'
import { daySummary } from './summary.ts'
import { SpentPerDay } from '../history/Charts.tsx'
import { spentPerDay } from '../history/history.ts'
import { TxRow } from '../history/TxRow.tsx'
import { balances, byBalance } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { setAsideTotal, sortForList, statusOf } from '../plan/school.ts'
import { useSession } from '../session.ts'
import { Pill, Icon } from '../ui/kit.tsx'
import { WalletChip, WalletTile } from '../ui/WalletTile.tsx'
import { LOCALE, tr } from '../i18n/i18n.ts'

const dueDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** White section card used by every money card. */
const moneyCard ='flex animate-rise flex-col rounded-[26px] bg-card p-[1.125rem] lg:rounded-[32px] lg:p-6'
const title = 'text-base font-black lg:text-lg'
const link = 'text-[0.8125rem] font-extrabold text-blue hover:underline lg:text-sm'

/** Today's entries, with the daily summary line under the title. */
export function EntriesCard({ today, result }: { today: string; result: SafeToSpend }) {
  const { transactions, wallets } = useSession()
  const list = transactions.filter((tx) => manilaDate(tx.occurredAt) === today).reverse()
  return (
    <section aria-labelledby="entries-title" className={moneyCard}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="entries-title" className={title}>{tr('Today’s entries')}</h2>
        {list.length > 5 && <Link to="/history" className={`${link} lg:hidden`}>{tr('See all {0}', list.length)}</Link>}
      </div>
      {list.length > 0 && <p className="pb-1 text-sm font-extrabold text-muted">{daySummary(result, transactions)}</p>}
      {list.length ? (
        <ul className="-mx-2 divide-y divide-page">
          {list.slice(0, 5).map((tx, i) => <TxRow key={tx.id} tx={tx} wallets={wallets} index={i} />)}
        </ul>
      ) : (
        <p className="my-auto py-3 font-semibold text-muted">{tr('Nothing logged today yet.')}</p>
      )}
      {list.length > 5 && <Link to="/history" className={`mt-auto hidden pt-2.5 lg:inline ${link}`}>{tr('See all {0} in History', list.length)}</Link>}
    </section>
  )
}

/** Spent per day, last 7 days. */
export function SpentPerDayCard({ today, budget, className = '' }: { today: string; budget: number; className?: string }) {
  const { transactions } = useSession()
  const id = useId() // Home renders this card twice (phone / desktop spot), so ids must differ
  return (
    <section aria-labelledby={id} className={`${moneyCard} gap-1 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className={title}>{tr('Spent per day')}</h2>
        <Link to="/history" className={link}>{tr('Open history')}</Link>
      </div>
      <SpentPerDay days={spentPerDay(transactions, today)} today={today} budget={budget} />
    </section>
  )
}

/**
 * Wallets (under One-tap add, in the left column on desktop). Phone: total, Move, and a sideways row of wallets.
 * Desktop: "Wallets", the total, the wallet count and spendable money, Move money and Manage in one row;
 * under it the top 4 wallets as tiles (+N more shows the rest, Less hides them).
 */
export function WalletsCard() {
  const { wallets, transactions } = useSession()
  const [open, setOpen] = useState(false)
  const all = balances(wallets, transactions)
  const shown = byBalance(wallets.filter((w) => !w.archived), all)
  const sum = (list: typeof shown) => list.reduce((s, w) => s + all.get(w.id)!, 0)
  const spendable = sum(shown.filter((w) => w.type === 'spending'))
  const TOP = 4
  const hidden = shown.length - TOP
  const move = { to: '?add=1&mode=transfer', state: { modal: true } }

  return (
    <section aria-label={tr('Wallets')} className="animate-rise">
      {/* Phone */}
      <div className="flex flex-col gap-2.5 rounded-[26px] bg-card py-3.5 pl-3.5 lg:hidden">
        <div className="flex items-center justify-between gap-2 pr-3.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-[0.9375rem] font-black">{tr('Wallets')}</h2>
            <span key={spendable} className="animate-pop truncate text-xl font-black tracking-[-0.02em]">{formatPeso(spendable)}</span>
          </div>
          <Link {...move} className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-blue-tint px-3 text-[0.8125rem] font-extrabold text-blue">
            <Icon name="arrow" className="size-4" />{tr('Move')}</Link>
        </div>
        {/* tabIndex: the row scrolls sideways, so keyboard users must be able to reach it */}
        <ul tabIndex={0} aria-label={tr('Wallets')} className="flex gap-2 overflow-x-auto rounded-r-[18px] pr-3.5 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-blue">
          {shown.map((w) => <li key={w.id} className="shrink-0"><WalletChip wallet={w} amount={all.get(w.id)!} /></li>)}
        </ul>
      </div>

      {/* Desktop (web Home v2): header row with the total and buttons, then the top 4 tiles + "+N more". */}
      <div className="hidden flex-col gap-3.5 rounded-[32px] bg-card px-[1.375rem] py-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-black">{tr('Wallets')}</h2>
            <p key={sum(shown)} className="animate-pop text-[1.625rem] leading-tight font-black tracking-[-0.03em]">{formatPeso(sum(shown))}</p>
            <p className="text-[0.8125rem] font-bold text-muted">{tr('{0} wallets · {1} spendable', shown.length, formatPeso(spendable))}</p>
          </div>
          <div className="flex gap-2">
            <Link {...move} className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-blue-tint px-3.5 text-sm font-extrabold text-blue hover:brightness-95">
              <Icon name="arrow" className="size-4" />{tr('Move money')}</Link>
            <Link to="/me" className="flex h-10 items-center justify-center rounded-full bg-page px-3.5 text-sm font-extrabold hover:bg-pebble">{tr('Manage')}</Link>
          </div>
        </div>
        {/* Closed: the top 4 tiles + "+N more" in one row. Open: every wallet, as many per row as fit, then Less. */}
        <ul className={`grid min-w-0 gap-2.5 ${open ? 'grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))]' : hidden > 0 ? 'grid-cols-[repeat(4,minmax(0,1fr))_4.75rem]' : 'grid-flow-col auto-cols-fr'}`}>
          {(open ? shown : shown.slice(0, TOP)).map((w) => <li key={w.id} className="min-w-0"><WalletTile wallet={w} amount={all.get(w.id)!} stacked /></li>)}
          {hidden > 0 && (
            <li>
              <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-full min-h-16 w-full flex-col items-center justify-center rounded-[20px] bg-blue-tint text-blue hover:brightness-95">
                {open
                  ? <span className="text-sm font-extrabold">{tr('Less|show fewer')}</span>
                  : <><span className="text-[1.0625rem] font-black text-ink">+{hidden}</span><span className="text-xs font-extrabold">{tr('more|wallets')}</span></>}
              </button>
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}

/** Set aside for school: the total and what's due next. */
export function SetAsideCard({ className = '' }: { className?: string }) {
  const id = useId() // Home renders this card twice (phone / desktop spot), so ids must differ
  const { schoolExpenses, transactions } = useSession()
  const total = setAsideTotal(schoolExpenses, transactions)
  const upcoming = sortForList(schoolExpenses, transactions).filter((i) => statusOf(i, transactions) !== 'paid')
  return (
    <section aria-labelledby={id} className={`${moneyCard} gap-3 lg:gap-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className={title}>{tr('Set aside for school')}</h2>
        <span className="text-lg font-black lg:hidden">{formatPeso(total)}</span>
        <Link to="/plan" className={`hidden lg:inline ${link}`}>{tr('See all')}</Link>
      </div>
      <p key={total} className="hidden animate-pop pt-1.5 pb-2 text-[1.875rem] font-black tracking-tight lg:block">{formatPeso(total)}</p>
      {upcoming.length ? (
        <ul className="flex flex-col gap-2 lg:gap-0">
          {upcoming.map((i, n) => (
            <li key={i.id} className={`items-center gap-3 rounded-[18px] bg-page p-3 lg:min-h-16 lg:rounded-none lg:border-t lg:border-page lg:bg-transparent lg:p-0 ${n === 0 ? 'flex' : 'hidden lg:flex'} ${n > 2 ? 'lg:hidden' : ''}`}>
              <span className="grid size-[2.375rem] shrink-0 place-items-center rounded-xl bg-card lg:size-10 lg:rounded-[14px] lg:bg-page">
                <Icon name={i.template === 'printing' ? 'printer' : 'book'} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-black">{i.title}</span>
                <span className="text-xs font-bold text-muted">{tr('Due {0}', dueDay.format(new Date(`${i.dueDate}T00:00:00Z`)))}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="hidden font-black lg:inline">{formatPeso(i.estimatedCentavos)}</span>
                <Pill tone={i.status === 'setAside' ? 'dark' : 'gray'}>{i.status === 'setAside' ? tr('Set aside') : tr('Planned')}</Pill>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-1 font-semibold text-muted lg:py-3">{tr('Nothing set aside yet.')}</p>
      )}
      <div className="mt-auto lg:pt-4">
        <Link to="/plan" className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-page text-sm font-extrabold hover:bg-pebble">
          <Icon name="plus" className="size-4" /> {tr('School expense')}</Link>
      </div>
    </section>
  )
}
