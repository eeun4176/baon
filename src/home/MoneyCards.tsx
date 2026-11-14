/*
 * MoneyCards.tsx — Home's "Your money" section (Home v2 design):
 *   EntriesCard     today's entries, newest first (phone: "See all N" link; desktop: total spent)
 *   SpentPerDayCard the last 7 days as bars (now on phones too)
 *   WalletsCard     total + each wallet (phone: sideways row; desktop: total box + top 4 tiles)
 *   SetAsideCard    money set aside for school and what's next (phone: the first item)
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { manilaDate } from '../budget/days.ts'
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

/** White section card used by every "Your money" card. */
const moneyCard ='flex animate-rise flex-col rounded-[26px] bg-card p-[1.125rem] lg:rounded-[32px] lg:p-6'
const title = 'text-base font-black lg:text-lg'
const link = 'text-[0.8125rem] font-extrabold text-blue hover:underline lg:text-sm'

/** Today's entries. */
export function EntriesCard({ today, spent }: { today: string; spent: number }) {
  const { transactions, wallets } = useSession()
  const list = transactions.filter((tx) => manilaDate(tx.occurredAt) === today).reverse()
  return (
    <section aria-labelledby="entries-title" className={moneyCard}>
      <div className="flex items-baseline justify-between gap-3 pb-1">
        <h2 id="entries-title" className={title}>{tr('Today’s entries')}</h2>
        {list.length > 0 && <span className="hidden text-sm font-extrabold text-muted lg:inline">{tr('{0} spent', formatPeso(spent))}</span>}
        {list.length > 5 && <Link to="/history" className={`${link} lg:hidden`}>{tr('See all {0}', list.length)}</Link>}
      </div>
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
  return (
    <section aria-labelledby="spd-title" className={`${moneyCard} gap-1 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="spd-title" className={title}>{tr('Spent per day')}</h2>
        <Link to="/history" className={link}>{tr('Open history')}</Link>
      </div>
      <SpentPerDay days={spentPerDay(transactions, today)} today={today} budget={budget} />
    </section>
  )
}

/**
 * Wallets (full width, first in "Your money"). Phone: total, Move, and a sideways row of wallets.
 * Desktop: a dark total box, the top 3 wallets in one row (+N more shows the rest, Less hides them),
 * then Move money above Manage in a column on the right, all in one row (from 1280px wide; at 1024px
 * there is no room, so the total box sits above the wallets and the two buttons sit side by side underneath).
 */
export function WalletsCard() {
  const { wallets, transactions } = useSession()
  const [open, setOpen] = useState(false)
  const all = balances(wallets, transactions)
  const shown = byBalance(wallets.filter((w) => !w.archived), all)
  const sum = (list: typeof shown) => list.reduce((s, w) => s + all.get(w.id)!, 0)
  const spendable = sum(shown.filter((w) => w.type === 'spending'))
  const TOP = 3
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

      {/* Desktop */}
      <div className="hidden gap-2.5 rounded-[28px] bg-card p-3.5 lg:grid xl:grid-cols-[12rem_minmax(0,1fr)_auto]">
        <div className="flex flex-col justify-center gap-0.5 rounded-[20px] bg-hero px-[1.125rem] py-3.5 text-white">
          <h2 className="text-[0.8125rem] font-extrabold text-white/75">{tr('All wallets')}</h2>
          <p key={sum(shown)} className="animate-pop text-[1.75rem] leading-tight font-black tracking-[-0.03em]">{formatPeso(sum(shown))}</p>
          <p className="text-xs font-bold text-white/75">{tr('{0} wallets · {1} spendable', shown.length, formatPeso(spendable))}</p>
        </div>
        {/* Closed: exactly 3 tiles + "+N more" in one row. Open: every wallet, as many per row as fit, then Less. */}
        <ul className={`grid min-w-0 gap-2.5 ${open ? 'grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]' : hidden > 0 ? 'grid-cols-[repeat(3,minmax(0,1fr))_4.75rem]' : 'grid-flow-col auto-cols-fr'}`}>
          {(open ? shown : shown.slice(0, TOP)).map((w) => <li key={w.id} className="min-w-0"><WalletTile wallet={w} amount={all.get(w.id)!} /></li>)}
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
        <div className="col-span-full flex justify-end gap-2 xl:col-span-1 xl:flex-col xl:justify-center">
          <Link {...move} className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-blue-tint px-4 text-sm font-extrabold text-blue hover:brightness-95">
            <Icon name="arrow" className="size-4" />{tr('Move money')}</Link>
          <Link to="/me" className="flex h-11 items-center justify-center rounded-full bg-page px-4 text-sm font-extrabold hover:bg-pebble">{tr('Manage')}</Link>
        </div>
      </div>
    </section>
  )
}

/** Set aside for school: the total and what's due next. */
export function SetAsideCard() {
  const { schoolExpenses, transactions } = useSession()
  const total = setAsideTotal(schoolExpenses, transactions)
  const upcoming = sortForList(schoolExpenses, transactions).filter((i) => statusOf(i, transactions) !== 'paid')
  return (
    <section aria-labelledby="setaside-title" className={`${moneyCard} gap-3 lg:gap-0`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="setaside-title" className={title}>{tr('Set aside for school')}</h2>
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
