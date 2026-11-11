/*
 * History.tsx — What happened (design p9 phone, p19 desktop).
 * Phone: "History" + List/Charts toggle, search, then day cards (or the charts).
 * Desktop: title + subtitle, search on the right, category chips, day cards on the
 *   left and a summary column on the right ("Spent since Sunday", By category, export).
 * Tap any entry to edit or delete it. Share (header) makes a picture of today's / this week's /
 * this month's spending for a story (ShareSpendingDialog).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { addDays, manilaDate } from '../budget/days.ts'
import { useToday } from '../home/useToday.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { useAddDialog } from '../shell/useAddDialog.ts'
import { Card, Icon, Page, PageHeader, Segmented } from '../ui/kit.tsx'
import { CategoryBars, SpentPerDay } from './Charts.tsx'
import { ShareSpendingDialog } from './ShareSpendingDialog.tsx'
import { filterEntries, groupByDay, spentByCategory, spentPerDay, spentThisWeek } from './history.ts'
import { TxRow } from './TxRow.tsx'
import { LOCALE, tr } from '../i18n/i18n.ts'

const longDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Today · Tue, Nov 10", "Yesterday · Mon, Nov 9" or "Sun, Nov 8". */
function dayTitle(day: string, today: string): string {
  const date = longDay.format(new Date(`${day}T00:00:00Z`))
  if (day === today) return tr('Today · {0}', date)
  if (day === addDays(today, -1)) return tr('Yesterday · {0}', date)
  return date
}

/** Search box (pill). */
function Search({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`flex min-h-12 items-center gap-2.5 rounded-full bg-card px-5 focus-within:ring-2 focus-within:ring-blue/40 ${className}`}>
      <Icon name="search" className="size-5 shrink-0 text-muted" />
      <span className="sr-only">{tr('Search entries')}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tr('Search jeep, lunch, print…')}
        className="min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:text-muted"
      />
    </label>
  )
}

/** History screen. */
export function History() {
  const { transactions, wallets, snapshots } = useSession()
  const budgets = useMemo(() => new Map(snapshots.filter((s) => s.isClassDay).map((s) => [s.date, s.dailyBudgetCentavos])), [snapshots])
  const t = useToday()
  const { open } = useAddDialog()
  const today = manilaDate()
  const [view, setView] = useState<'list' | 'charts'>('list')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const days = useMemo(() => groupByDay(filterEntries(transactions, wallets, query, categoryId)), [transactions, wallets, query, categoryId])
  const week = useMemo(() => spentThisWeek(transactions, today), [transactions, today])
  const categories = useMemo(() => spentByCategory(transactions, week.since, today), [transactions, week.since, today])
  const perDay = useMemo(() => spentPerDay(transactions, today), [transactions, today])
  // Chips: categories the student has actually used, most-spent first.
  const chips = useMemo(() => spentByCategory(transactions, '0000-01-01', today).slice(0, 6), [transactions, today])

  const list =
    days.length === 0 ? (
      <Card className="animate-rise py-10 text-center">
        <p className="text-lg font-black">{transactions.length ? tr('Nothing matches that search.') : tr('Nothing logged yet.')}</p>
        <p className="mt-1 font-semibold text-muted">{transactions.length ? tr('Try another word or category.') : tr('Your expenses show up here, newest first.')}</p>
        {!transactions.length && (
          <button type="button" onClick={() => open()} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-blue px-6 font-black text-white">
            <Icon name="plus" className="size-5" /> {tr('Add your first expense')}</button>
        )}
      </Card>
    ) : (
      <div className="space-y-3">
        {days.map((d, i) => (
          <section key={d.day} className="animate-rise rounded-3xl bg-card px-3 pt-4 pb-2 sm:rounded-[28px]" style={{ animationDelay: `${Math.min(i, 5) * 50}ms` }} aria-label={dayTitle(d.day, today)}>
            <header className="flex items-baseline justify-between gap-3 px-2 pb-1">
              <h2 className="text-lg font-black">{dayTitle(d.day, today)}</h2>
              <p className="shrink-0 text-sm font-extrabold text-muted">{formatPeso(d.spent)} {budgets.has(d.day) ? `of ${formatPeso(budgets.get(d.day)!)}` : tr('spent')}</p>
            </header>
            <ul className="divide-y divide-page">
              {d.txs.map((tx, j) => <TxRow key={tx.id} tx={tx} wallets={wallets} index={j} />)}
            </ul>
          </section>
        ))}
      </div>
    )

  const summary = (
    <>
      <section className="animate-rise rounded-3xl bg-hero p-4 sm:rounded-[28px] sm:p-6 text-white">
        <p className="font-extrabold text-white/70">{tr('Spent since Sunday')}</p>
        <p key={week.total} className="mt-1 animate-pop text-5xl font-black">{formatPeso(week.total)}</p>
        <p className="mt-1 font-semibold text-white/70">{tr('{0} a day on average', formatPeso(week.perDay))}</p>
      </section>
      <Card className="animate-rise">
        <h2 className="mb-4 text-xl font-black">{tr('By category')}</h2>
        <CategoryBars rows={categories} />
      </Card>
    </>
  )

  return (
    <Page>
      <PageHeader
        title={tr('History')}
        sub={tr('Everything you logged, newest first.')}
        actions={
          <>
            <Segmented options={[['list', tr('List')], ['charts', tr('Charts')]] as const} value={view} onChange={setView} label={tr('View')} className="lg:hidden" />
            <Search value={query} onChange={setQuery} className="hidden w-72 lg:flex" />
            <button type="button" onClick={() => setSharing(true)} aria-label={tr('Share your spending')} className="grid size-11 shrink-0 place-items-center rounded-full bg-blue text-white">
              <Icon name="share" className="size-5" />
            </button>
          </>
        }
      />

      {/* Phone/tablet: List or Charts */}
      <div className="lg:hidden">
        {view === 'list' ? (
          <>
            <Search value={query} onChange={setQuery} className="mb-3" />
            {list}
          </>
        ) : (
          <div className="space-y-3">
            <Card className="animate-rise">
              <h2 className="mb-1 text-xl font-black">{tr('Spent per day')}</h2>
              <SpentPerDay days={perDay} today={today} budget={t.result.dailyBudget} />
            </Card>
            {summary}
          </div>
        )}
      </div>

      {/* Desktop: chips + list | summary column */}
      <div className="hidden lg:block">
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label={tr('Filter by category')}>
          {[{ categoryId: null, label: tr('All') }, ...chips].map((c) => (
            <button
              key={c.categoryId ?? 'all'}
              type="button"
              role="radio"
              aria-checked={categoryId === c.categoryId}
              onClick={() => setCategoryId(c.categoryId)}
              className={`min-h-11 rounded-full px-5 font-extrabold ${categoryId === c.categoryId ? 'bg-ink text-card' : 'bg-card hover:bg-pebble'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-5">
          {list}
          <aside className="sticky top-6 space-y-4">
            {summary}
            <Link to="/backup" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-card font-black hover:bg-pebble">
              <Icon name="download" className="size-5" /> {tr('Export encrypted backup')}</Link>
          </aside>
        </div>
      </div>
      {sharing && <ShareSpendingDialog onClose={() => setSharing(false)} />}
    </Page>
  )
}
