/*
 * History.tsx — What happened (design p9 phone, p19 desktop).
 * Phone: "History" + List/Charts toggle, search, then day cards (or the charts).
 * Desktop: title + subtitle, search on the right, category chips, day cards on the
 *   left and a summary column on the right ("Spent since Sunday", By category, export).
 * Tap any entry to edit or delete it.
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
import { filterEntries, groupByDay, spentByCategory, spentPerDay, spentThisWeek } from './history.ts'
import { TxRow } from './TxRow.tsx'

const longDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Today · Tue, Nov 10", "Yesterday · Mon, Nov 9" or "Sun, Nov 8". */
function dayTitle(day: string, today: string): string {
  const date = longDay.format(new Date(`${day}T00:00:00Z`))
  if (day === today) return `Today · ${date}`
  if (day === addDays(today, -1)) return `Yesterday · ${date}`
  return date
}

/** Search box (pill). */
function Search({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`flex min-h-12 items-center gap-2.5 rounded-full bg-card px-5 focus-within:ring-2 focus-within:ring-blue/40 ${className}`}>
      <Icon name="search" className="size-5 shrink-0 text-muted" />
      <span className="sr-only">Search entries</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search jeep, lunch, print…"
        className="min-w-0 flex-1 bg-transparent font-bold outline-none placeholder:text-muted"
      />
    </label>
  )
}

/** History screen. */
export function History() {
  const { transactions, wallets } = useSession()
  const t = useToday()
  const { open } = useAddDialog()
  const today = manilaDate()
  const [view, setView] = useState<'list' | 'charts'>('list')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const days = useMemo(() => groupByDay(filterEntries(transactions, wallets, query, categoryId)), [transactions, wallets, query, categoryId])
  const week = useMemo(() => spentThisWeek(transactions, today), [transactions, today])
  const categories = useMemo(() => spentByCategory(transactions, week.since, today), [transactions, week.since, today])
  const perDay = useMemo(() => spentPerDay(transactions, today), [transactions, today])
  // Chips: categories the student has actually used, most-spent first.
  const chips = useMemo(() => spentByCategory(transactions, '0000-01-01', today).slice(0, 6), [transactions, today])

  const list =
    days.length === 0 ? (
      <Card className="animate-rise py-10 text-center">
        <p className="text-lg font-black">{transactions.length ? 'Nothing matches that search.' : 'Nothing logged yet.'}</p>
        <p className="mt-1 font-semibold text-muted">{transactions.length ? 'Try another word or category.' : 'Your expenses show up here, newest first.'}</p>
        {!transactions.length && (
          <button type="button" onClick={() => open()} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-blue px-6 font-black text-white">
            <Icon name="plus" className="size-5" /> Add your first expense
          </button>
        )}
      </Card>
    ) : (
      <div className="space-y-3">
        {days.map((d, i) => (
          <section key={d.day} className="animate-rise rounded-[28px] bg-card px-3 pt-4 pb-2" style={{ animationDelay: `${Math.min(i, 5) * 50}ms` }} aria-label={dayTitle(d.day, today)}>
            <header className="flex items-baseline justify-between gap-3 px-2 pb-1">
              <h2 className="text-lg font-black">{dayTitle(d.day, today)}</h2>
              <p className="shrink-0 text-sm font-extrabold text-muted">{formatPeso(d.spent)} spent</p>
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
      <section className="animate-rise rounded-[28px] bg-hero p-6 text-white">
        <p className="font-extrabold text-white/70">Spent since Sunday</p>
        <p key={week.total} className="mt-1 animate-pop text-5xl font-black">{formatPeso(week.total)}</p>
        <p className="mt-1 font-semibold text-white/70">{formatPeso(week.perDay)} a day on average</p>
      </section>
      <Card className="animate-rise">
        <h2 className="mb-4 text-xl font-black">By category</h2>
        <CategoryBars rows={categories} />
      </Card>
    </>
  )

  return (
    <Page>
      <PageHeader
        title="History"
        sub="Everything you logged, newest first."
        actions={
          <>
            <Segmented options={[['list', 'List'], ['charts', 'Charts']] as const} value={view} onChange={setView} label="View" className="lg:hidden" />
            <Search value={query} onChange={setQuery} className="hidden w-72 lg:flex" />
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
              <h2 className="mb-1 text-xl font-black">Spent per day</h2>
              <SpentPerDay days={perDay} today={today} budget={t.result.dailyBudget} />
            </Card>
            {summary}
          </div>
        )}
      </div>

      {/* Desktop: chips + list | summary column */}
      <div className="hidden lg:block">
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Filter by category">
          {[{ categoryId: null, label: 'All' }, ...chips].map((c) => (
            <button
              key={c.categoryId ?? 'all'}
              type="button"
              role="radio"
              aria-checked={categoryId === c.categoryId}
              onClick={() => setCategoryId(c.categoryId)}
              className={`min-h-10 rounded-full px-5 font-extrabold ${categoryId === c.categoryId ? 'bg-ink text-card' : 'bg-card hover:bg-pebble'}`}
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
              <Icon name="download" className="size-5" /> Export encrypted backup
            </Link>
          </aside>
        </div>
      </div>
    </Page>
  )
}
