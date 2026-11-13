/*
 * MoneyCards.tsx — Home's "Your money" section (Home v2 design):
 *   EntriesCard     today's entries, newest first (phone: "See all N" link; desktop: total spent)
 *   SpentPerDayCard the last 7 days as bars (now on phones too)
 *   WalletsCard     total + each wallet (phone: 2-column tiles; desktop: a list with icons)
 *   SetAsideCard    money set aside for school and what's next (phone: the first item)
 */
import { Link } from 'react-router'
import { manilaDate } from '../budget/days.ts'
import { SpentPerDay } from '../history/Charts.tsx'
import { spentPerDay } from '../history/history.ts'
import { TxRow } from '../history/TxRow.tsx'
import { balances } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { setAsideTotal, sortForList, statusOf } from '../plan/school.ts'
import { useSession } from '../session.ts'
import { Pill, Icon } from '../ui/kit.tsx'
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

/** Wallets: total and each one. */
export function WalletsCard() {
  const { wallets, transactions } = useSession()
  const all = balances(wallets, transactions)
  const shown = wallets.filter((w) => !w.archived)
  const total = shown.filter((w) => w.type === 'spending').reduce((s, w) => s + all.get(w.id)!, 0)
  return (
    <section aria-labelledby="wallets-title" className={`${moneyCard} gap-2.5 lg:gap-0`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="wallets-title" className={title}>{tr('Wallets')}</h2>
        <span className="text-lg font-black lg:hidden">{formatPeso(total)}</span>
        <Link to="/me" className={`hidden lg:inline ${link}`}>{tr('Manage')}</Link>
      </div>
      <p key={total} className="hidden animate-pop pt-1.5 pb-2 text-[1.875rem] font-black tracking-tight lg:block">{formatPeso(total)}</p>
      {/* Phone: tiles */}
      <ul className="grid grid-cols-2 gap-2 lg:hidden">
        {shown.map((w) => (
          <li key={w.id} className="flex min-w-0 flex-col rounded-2xl bg-page px-3 py-2.5">
            <span className="truncate text-xs font-extrabold text-muted">{w.type === 'savings' ? tr('{0} · not spendable', w.name) : w.name}</span>
            <span className="font-black">{formatPeso(all.get(w.id)!)}</span>
          </li>
        ))}
      </ul>
      {/* Desktop: list */}
      <ul className="hidden lg:block">
        {shown.map((w) => (
          <li key={w.id} className="flex min-h-12 items-center gap-3 border-t border-page">
            <Icon name={w.type === 'savings' ? 'piggy' : w.id === 'cash' ? 'wallet' : 'phone'} className={`size-5 ${w.type === 'savings' ? 'text-muted' : 'text-blue'}`} />
            <span className="flex flex-1 flex-col">
              <span className="font-extrabold">{w.name}</span>
              {w.type === 'savings' && <span className="text-xs font-bold text-muted">{tr('Not counted as spendable')}</span>}
            </span>
            <span className="font-black">{formatPeso(all.get(w.id)!)}</span>
          </li>
        ))}
      </ul>
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
