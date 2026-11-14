/*
 * History.tsx — What happened.
 * Phone: "History" + List/Charts toggle, search, then day cards (or the charts).
 * Desktop: title + subtitle, search on the right, category chips, day cards on the
 *   left and a summary column on the right ("Spent since Sunday", By category, export).
 * Tap any entry to edit or delete it. Share (header) makes a picture of today's / this week's /
 * this month's spending for a story (ShareSpendingDialog).
 * Filter row above the list: "Show" chips (All · Today · Yesterday · This week · This month) on the
 * left, a category dropdown at the right edge. The Spent total and By category follow the chips
 * (All keeps this week's numbers). Opens with ?q= from Home's search.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { addDays, manilaDate } from '../budget/days.ts'
import { useToday } from '../home/useToday.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { useAddDialog } from '../shell/useAddDialog.ts'
import { Card, Icon, Page, PageHeader, Segmented } from '../ui/kit.tsx'
import { CategoryBars, SpentPerDay } from './Charts.tsx'
import { ShareSpendingDialog } from './ShareSpendingDialog.tsx'
import { filterEntries, groupByDay, rangeDays, spentBetween, spentByCategory, spentPerDay, type Range } from './history.ts'
import { TxRow } from './TxRow.tsx'
import { LOCALE, tr } from '../i18n/i18n.ts'

const RANGES: [Range, string][] = [['all', tr('All')], ['today', tr('Today')], ['yesterday', tr('Yesterday')], ['week', tr('This week')], ['month', tr('This month')]]
// The total's title for each filter ("All" shows this week's numbers).
const SPENT_TITLE: Record<Range, string> = { all: tr('Spent since Sunday'), week: tr('Spent since Sunday'), today: tr('Spent today'), yesterday: tr('Spent yesterday'), month: tr('Spent this month') }

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

/**
 * Category dropdown (Baon's own menu, not the browser's): "All categories" plus every category the
 * student has entries in, their own ones included. Closes on a pick, a click elsewhere or Esc.
 */
function CategoryFilter({ value, options, onChange }: { value: string | null; options: { categoryId: string; label: string }[]; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.categoryId === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** One row of the menu; the picked one is bold with a check. */
  const item = (id: string | null, text: string) => (
    <li key={id ?? 'all'} role="option" aria-selected={value === id}>
      <button
        type="button"
        onClick={() => { onChange(id); setOpen(false) }}
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left hover:bg-page ${value === id ? 'font-black' : 'font-bold'}`}
      >
        <span className="min-w-0 flex-1 truncate">{text}</span>
        {value === id && <Icon name="check" className="size-5 shrink-0 text-blue" />}
      </button>
    </li>
  )

  return (
    <div ref={box} className="relative mb-1 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tr('Filter by category')}
        className={`flex min-h-11 max-w-36 items-center gap-1.5 rounded-full pr-3.5 pl-4 font-extrabold sm:max-w-56 ${current ? 'bg-ink text-card' : 'bg-card hover:bg-pebble'}`}
      >
        <span className="min-w-0 truncate">{current ? current.label : tr('Category')}</span>
        <Icon name="chevron-down" className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label={tr('Filter by category')} className="absolute top-full right-0 z-30 mt-2 max-h-80 w-56 animate-rise overflow-y-auto rounded-2xl border border-pebble bg-card p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
          {item(null, tr('All categories'))}
          {options.map((o) => item(o.categoryId, o.label))}
        </ul>
      )}
    </div>
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
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '') // Home's search opens History with its text
  const [range, setRange] = useState<Range>('all')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const days = useMemo(() => {
    const { from, to } = rangeDays(range, today)
    return groupByDay(filterEntries(transactions, wallets, query, categoryId)).filter((d) => d.day >= from && d.day <= to)
  }, [transactions, wallets, query, categoryId, range, today])
  // The numbers beside the list cover the chosen days; "All" keeps this week's.
  const shown = useMemo(() => rangeDays(range === 'all' ? 'week' : range, today), [range, today])
  const spent = useMemo(() => spentBetween(transactions, shown.from, shown.to), [transactions, shown])
  const categories = useMemo(() => spentByCategory(transactions, shown.from, shown.to), [transactions, shown])
  const perDay = useMemo(() => spentPerDay(transactions, today), [transactions, today])
  // Dropdown: categories the student has actually used, most-spent first.
  const used = useMemo(() => spentByCategory(transactions, '0000-01-01', today), [transactions, today])

  const list =
    days.length === 0 ? (
      <Card className="animate-rise py-10 text-center">
        <p className="text-lg font-black">{!transactions.length ? tr('Nothing logged yet.') : query || categoryId ? tr('Nothing matches that search.') : tr('Nothing logged in these days.')}</p>
        <p className="mt-1 font-semibold text-muted">{!transactions.length ? tr('Your expenses show up here, newest first.') : query || categoryId ? tr('Try another word or category.') : tr('Pick All to see everything.')}</p>
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
        <p className="font-extrabold text-white/70">{SPENT_TITLE[range]}</p>
        <p key={spent.total} className="mt-1 animate-pop text-5xl font-black">{formatPeso(spent.total)}</p>
        {shown.from !== shown.to && <p className="mt-1 font-semibold text-white/70">{tr('{0} a day on average', formatPeso(spent.perDay))}</p>}
      </section>
      <Card className="animate-rise">
        <h2 className="mb-4 text-xl font-black">{tr('By category')}</h2>
        <CategoryBars rows={categories} />
      </Card>
    </>
  )

  // Which days (chips, left) and which category (dropdown, at the list's right edge)
  const filters = (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label={tr('Show')}>
        {RANGES.map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={range === id}
            onClick={(e) => {
              setRange(id)
              e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' }) // phones: keep the picked chip in view
            }}
            className={`min-h-11 shrink-0 rounded-full px-4 font-extrabold whitespace-nowrap ${range === id ? 'bg-ink text-card' : 'bg-card hover:bg-pebble'}`}
          >
            {text}
          </button>
        ))}
      </div>
      <CategoryFilter value={categoryId} options={used} onChange={setCategoryId} />
    </div>
  )

  return (
    <Page>
      <PageHeader
        title={tr('History')}
        sub={tr('Everything you logged, newest first.')}
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Segmented options={[['list', tr('List')], ['charts', tr('Charts')]] as const} value={view} onChange={setView} label={tr('View')} className="flex-1 sm:flex-none lg:hidden" />
            <Search value={query} onChange={setQuery} className="hidden w-72 lg:flex" />
            {/* Phone: round icon button (like Streak). Larger screens: blue "Share" pill. ! beats dark mode's lighter .text-blue. */}
            <button type="button" onClick={() => setSharing(true)} aria-label={tr('Share your spending')} className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-blue md:flex md:w-auto md:gap-2 md:bg-blue md:px-5 md:font-black md:text-white! lg:h-12">
              <Icon name="share" className="size-5" /><span className="sr-only md:not-sr-only">{tr('Share')}</span></button>
          </div>
        }
      />

      {/* Phone/tablet: List or Charts */}
      <div className="lg:hidden">
        {filters}
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

      {/* Desktop: filters + list | summary column */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-5">
          <div className="min-w-0">
            {filters}
            {list}
          </div>
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
