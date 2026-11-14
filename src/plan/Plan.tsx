/*
 * Plan.tsx — Plan ahead (Plan v2 design).
 *   Dark hero "Kept out of your daily budget": school set-asides + utang owed, a split bar of the two
 *     (drawn like Home's), a tile for each, plus "Owed to you" (dashed: not counted until it's back).
 *     Money made to "last until" a date isn't here: it's set up in Add → Money in and shows on
 *     Home's "How it's counted".
 *   Class days: Su–Sa toggles, "Count only class days", and "No classes" breaks.
 *   School expenses: Upcoming / Paid tabs; Set it aside, Mark paid; tap a row to edit; quick-add chips.
 *   Category limits: every limit with its bar; Edit / Add a limit open the limits pop-up.
 *   Utang (UtangCard.tsx): what's owed is held back like a set-aside.
 * Phone order: hero → School expense / Utang buttons → school expenses → utang → class days → limits.
 * Desktop: hero + class days, then school expenses + limits, then utang (full width).
 */
import { useMemo, useState } from 'react'
import { breakOn } from '../budget/allowance.ts'
import { addDays, daysBetween, manilaDate } from '../budget/days.ts'
import { LimitRow } from '../home/LimitsCard.tsx'
import { formatPeso } from '../ledger/money.ts'
import { utangList } from '../ledger/utang.ts'
import { useSession } from '../session.ts'
import { Icon, Page, Pill, SplitBar, Switch } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { limitStatuses } from './limits.ts'
import { LimitsDialog } from './LimitsDialog.tsx'
import { ItemDialog, PayDialog } from './PlanDialogs.tsx'
import { paidWith, setAsideTotal, sortForList, statusOf, TEMPLATES, type SchoolExpense } from './school.ts'
import { NewUtangDialog, UtangCard } from './UtangCard.tsx'
import { LOCALE, tr } from '../i18n/i18n.ts'

const DAYS = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]
const DAY_NAMES = [tr('Sunday'), tr('Monday'), tr('Tuesday'), tr('Wednesday'), tr('Thursday'), tr('Friday'), tr('Saturday')]
const dueDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const paidDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })

// Quick-add chips under the school expenses list.
const QUICK = TEMPLATES.filter((t) => t.id !== 'thesis' && t.id !== 'other')

type Open = { kind: 'item'; item?: SchoolExpense; template?: SchoolExpense['template'] } | { kind: 'pay'; item: SchoolExpense } | { kind: 'limits' } | { kind: 'utang' } | null

const card = 'flex animate-rise flex-col rounded-[26px] bg-card p-[1.125rem] lg:rounded-[32px] lg:p-6'
const cardTitle = 'text-base font-black lg:text-lg'

/** "Due Thu, Nov 19 · in 6 days", "Due today", "Overdue · Mon, Nov 9" or "Paid Nov 13". */
function whenText(item: SchoolExpense, paidAt: string | undefined, today: string): string {
  if (paidAt) return tr('Paid {0}', paidDay.format(new Date(paidAt)))
  if (item.dueDate === today) return tr('Due today')
  const date = dueDay.format(new Date(`${item.dueDate}T00:00:00Z`))
  if (item.dueDate < today) return tr('Overdue · {0}', date)
  const days = daysBetween(today, item.dueDate)
  return tr('Due {0}', date) + (days <= 14 ? ` · ${days === 1 ? tr('tomorrow') : tr('in {0} days', days)}` : '')
}

/** Dark hero: everything kept out of the daily budget, and why. */
function KeptHero() {
  const { schoolExpenses, transactions } = useSession()
  const school = setAsideTotal(schoolExpenses, transactions)
  const open = utangList(transactions).filter((u) => u.left > 0)
  const owe = open.filter((u) => u.owe)
  const owed = open.filter((u) => !u.owe).reduce((s, u) => s + u.left, 0)
  const owing = owe.reduce((s, u) => s + u.left, 0)
  // Only what's planned here. Money in made to "last until" a date is held back too, but it's set up
  // from Add → Money in, so it shows on Home's "How it's counted" instead.
  const total = school + owing
  const counts = { setAside: 0, paid: 0 }
  for (const i of schoolExpenses) {
    const s = statusOf(i, transactions)
    if (s === 'setAside') counts.setAside++
    if (s === 'paid') counts.paid++
  }
  const tile = 'flex flex-col gap-0.5 rounded-[18px] bg-white/10 px-3.5 py-3 lg:rounded-[20px] lg:px-4 lg:py-3.5'
  const key = (color: string) => <span className={`size-2 rounded-[2px] lg:size-2.5 lg:rounded-[3px] ${color}`} />

  return (
    <section aria-labelledby="kept-title" className="flex animate-rise flex-col gap-3.5 rounded-[30px] bg-hero px-5 py-[1.375rem] text-white lg:gap-[1.125rem] lg:rounded-[32px] lg:px-[1.875rem] lg:py-7">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 id="kept-title" className="font-black lg:text-base">{tr('Kept out of your daily budget')}</h2>
        <span className="hidden h-[1.875rem] items-center gap-1.5 rounded-full bg-white/10 px-3 text-[0.8125rem] font-extrabold text-white/85 lg:inline-flex">
          <Icon name="wallet" className="size-3.5" /> {tr('Still in your wallets')}</span>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1.5">
        <p className="flex items-baseline gap-1 font-black tracking-tighter lg:gap-1.5">
          <span className="text-[1.875rem] text-white/50 lg:text-[2.375rem]">₱</span>
          <span key={total} className="animate-pop text-[clamp(3rem,16vw,3.75rem)] leading-[0.95] lg:text-[5rem]">{formatPeso(total).slice(1)}</span>
        </p>
        <p className="max-w-[21rem] text-[0.8125rem] leading-snug font-bold text-white/70 lg:pb-2 lg:text-[0.9375rem]">
          {tr('Still in your wallets, but saved for school and utang.')}</p>
      </div>

      <SplitBar
        className="h-2.5 lg:h-3"
        label={tr('{0} for school, {1} for utang you owe', formatPeso(school), formatPeso(owing))}
        parts={[{ amount: school, color: 'bg-blue' }, { amount: owing, color: 'bg-map-2' }]}
      />

      <div className="grid grid-cols-2 gap-2 lg:mt-auto lg:grid-cols-3 lg:gap-2.5">
        <div className={tile}>
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-white/70 lg:text-[0.8125rem]">{key('bg-blue')}{tr('School, set aside')}</span>
          <span className="text-xl font-black lg:text-2xl lg:tracking-tight">{formatPeso(school)}</span>
          <span className="hidden text-xs font-bold text-white/70 lg:block">{tr('{0} set aside · {1} paid', counts.setAside, counts.paid)}</span>
        </div>
        <div className={tile}>
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-white/70 lg:text-[0.8125rem]">{key('bg-map-2')}{tr('Utang you owe')}</span>
          <span className="text-xl font-black lg:text-2xl lg:tracking-tight">{formatPeso(owing)}</span>
          <span className="hidden text-xs font-bold text-white/70 lg:block">{owe.length === 1 ? tr('1 to pay back') : tr('{0} to pay back', owe.length)}</span>
        </div>
        {/* Owed to you: dashed, because it isn't counted until it's back */}
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-white/25 px-3.5 py-2.5 lg:col-span-1 lg:flex-col lg:items-start lg:justify-start lg:gap-0.5 lg:rounded-[20px] lg:py-3">
          <span className="text-[0.8125rem] font-extrabold text-white/70">
            <span className="lg:hidden">{tr('Owed to you · counted once it’s back')}</span>
            <span className="hidden lg:inline">{tr('Owed to you')}</span></span>
          <span className="font-black lg:text-2xl lg:tracking-tight">{formatPeso(owed)}</span>
          <span className="hidden text-xs font-bold text-white/70 lg:block">{tr('Counted once it’s back')}</span>
        </div>
      </div>
    </section>
  )
}

/** Class days card: Su–Sa toggles, "Count only class days" switch, and breaks. Saves right away. */
function ClassDaysCard({ className = '' }: { className?: string }) {
  const { allowance, updateAllowance, showToast } = useSession()
  const on = DAYS.filter((_, d) => allowance.classWeekdays.includes(d))

  /** Saves a change to the allowance; Home's daily budget follows instantly. */
  const save = (patch: Partial<typeof allowance>) =>
    updateAllowance({ ...allowance, ...patch }).catch(() => showToast({ message: tr('Couldn’t save. Try again.') }))

  /** Turns one class day on/off. */
  const toggle = (d: number) =>
    save({ classWeekdays: allowance.classWeekdays.includes(d) ? allowance.classWeekdays.filter((x) => x !== d) : [...allowance.classWeekdays, d].sort() })

  const summary = !allowance.countClassDays
    ? tr('Every day counts')
    : on.length === 0 ? tr('Pick at least one class day.') : `${on.length === 1 ? tr('1 class day a week') : tr('{0} class days a week', on.length)} · ${on.join(', ')}`

  return (
    <section aria-labelledby="days-title" className={`${card} gap-3 lg:gap-4 ${className}`}>
      <div className="flex flex-col">
        <h2 id="days-title" className={cardTitle}>{tr('Class days')}</h2>
        <span className="text-xs font-bold text-muted lg:hidden">{summary}</span>
        <span className="hidden text-sm font-bold text-muted lg:block">{tr('Your budget is split across these days.')}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={tr('Class days')}>
        {DAYS.map((label, d) => {
          const isOn = allowance.countClassDays && allowance.classWeekdays.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={isOn}
              aria-label={DAY_NAMES[d]}
              disabled={!allowance.countClassDays}
              onClick={() => toggle(d)}
              className={`mx-auto aspect-square w-full max-w-12 rounded-full text-sm font-black transition-colors disabled:opacity-50 ${isOn ? 'bg-blue text-white' : 'bg-page text-muted hover:bg-pebble'}`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <p className="hidden rounded-[14px] bg-blue-tint px-3 py-2.5 text-sm font-extrabold text-blue lg:block">{summary}</p>
      <div className="flex items-center justify-between gap-3 border-t border-page pt-3 lg:pt-3.5">
        <span className="flex flex-col">
          <span className="text-sm font-black lg:text-[0.9375rem]">{tr('Count only class days')}</span>
          <span className="hidden text-xs font-bold text-muted lg:block">{tr('Off: every day gets a budget')}</span>
        </span>
        <Switch label={tr('Count only class days')} checked={allowance.countClassDays} onChange={(countClassDays) => save({ countClassDays })} />
      </div>
      <BreakControl />
    </section>
  )
}

/**
 * "No classes" break (typhoon day … sembreak): from today until a chosen day. Asked in a pop-up, so the page doesn't shift.
 * While on break the budget counts every day and the streak is frozen.
 */
function BreakControl() {
  const { allowance, updateAllowance, showToast } = useSession()
  const today = manilaDate()
  const current = breakOn(today, allowance)
  const [until, setUntil] = useState(() => addDays(today, 6))
  const [asking, setAsking] = useState(false)

  /** Saves the break list, with Undo back to the previous setup. */
  async function saveBreaks(breaks: { from: string; to: string }[], message: string) {
    const before = allowance
    try {
      await updateAllowance({ ...allowance, breaks })
      setAsking(false)
      showToast({ message, undo: () => updateAllowance(before) })
    } catch {
      showToast({ message: tr('Couldn’t save. Try again.') })
    }
  }

  /** "No classes today" or "No classes until Mon, Dec 1". */
  const untilText = (to: string) => (to === today ? tr('No classes today') : tr('No classes until {0}', dueDay.format(new Date(`${to}T00:00:00Z`))))

  /** Starts a break today, ending on `to` (inclusive). */
  const start = (to: string) => saveBreaks([...(allowance.breaks ?? []), { from: today, to }], tr('{0} · Streak paused', untilText(to)))

  /** Ends the current break: it stops yesterday (or disappears if it started today). */
  const end = () =>
    current &&
    saveBreaks(
      (allowance.breaks ?? []).flatMap((b) => (b !== current ? [b] : b.from < today ? [{ ...b, to: addDays(today, -1) }] : [])),
      tr('Welcome back! Class days count again'),
    )

  if (current) {
    return (
      <div className="mt-auto flex items-center justify-between gap-3 rounded-2xl bg-blue-tint py-2 pr-2 pl-4">
        <p className="min-w-0 text-sm font-bold text-blue">{tr('{0} · Streak paused', untilText(current.to))}</p>
        <button type="button" onClick={end} className="min-h-11 shrink-0 rounded-full bg-card px-4 text-sm font-black">{tr('Classes are back')}</button>
      </div>
    )
  }
  return (
    <>
      <button type="button" onClick={() => setAsking(true)} className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-full bg-page text-sm font-extrabold hover:bg-pebble">
        <Icon name="pause" className="size-4" /> {tr('No classes for a while? Set a break')}</button>
      {asking && (
        <Modal title={tr('No classes')} onClose={() => setAsking(false)}>
          <p className="font-semibold text-muted">{tr('Suspensions, holidays or sembreak. Streak is paused.')}</p>
          <button type="button" onClick={() => start(today)} className="mt-4 min-h-12 w-full rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">{tr('Just today')}</button>
          <label className="mt-4 block font-extrabold text-muted">
            {tr('Until')}<input type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} className="mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40" />
          </label>
          <button type="button" disabled={!until || until < today} onClick={() => start(until)} className="mt-4 min-h-12 w-full rounded-full bg-blue px-5 font-black text-white disabled:opacity-60">{tr('Save break')}</button>
        </Modal>
      )}
    </>
  )
}

/** One school expense: tap to edit; the button moves it along (Set it aside → Mark paid). */
function SchoolRow({ item, onOpen }: { item: SchoolExpense; onOpen: (o: Open) => void }) {
  const { transactions, saveSchoolExpense, showToast } = useSession()
  const paid = paidWith(item, transactions)
  const status = statusOf(item, transactions)
  const [chipText, chipTone]: [string, 'dark' | 'gray' | 'blue'] = status === 'paid' ? [tr('Paid'), 'blue'] : status === 'setAside' ? [tr('Set aside'), 'dark'] : [tr('Planned'), 'gray']

  /** Planned → Set aside, with Undo. */
  async function setAside() {
    await saveSchoolExpense({ ...item, status: 'setAside' })
    showToast({ message: tr('Set aside {0} for {1}', formatPeso(item.estimatedCentavos), item.title), undo: () => saveSchoolExpense(item) })
  }

  const action = status === 'setAside'
    ? <button type="button" onClick={() => onOpen({ kind: 'pay', item })} className="min-h-11 rounded-full bg-blue px-[1.125rem] text-sm font-extrabold text-white whitespace-nowrap">{tr('Mark paid')}</button>
    : status === 'planned'
      ? <button type="button" onClick={setAside} className="min-h-11 rounded-full bg-page px-[1.125rem] text-sm font-extrabold whitespace-nowrap hover:bg-pebble">{tr('Set it aside')}</button>
      : null

  return (
    <li className="flex flex-col gap-2.5 border-t border-page pt-3 pb-1.5 lg:min-h-[4.75rem] lg:flex-row lg:items-center lg:gap-3.5 lg:py-0">
      <button type="button" onClick={() => onOpen({ kind: 'item', item })} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left lg:gap-3.5">
        <span className="grid size-[2.625rem] shrink-0 place-items-center rounded-[14px] bg-page lg:size-[2.875rem] lg:rounded-2xl" aria-hidden="true">
          <Icon name={item.template === 'printing' ? 'printer' : 'book'} className="size-5 lg:size-[1.375rem]" />
        </span>
        <span className={`flex min-w-0 flex-1 flex-col lg:gap-0.5 ${status === 'paid' ? 'text-ink/60' : ''}`}>
          <span className="truncate font-black lg:text-base">{item.title}</span>
          <span className="text-xs font-bold text-muted lg:text-[0.8125rem]">{whenText(item, paid?.occurredAt, manilaDate())}</span>
        </span>
        {/* Phone: amount above the chip */}
        <span className="flex flex-col items-end gap-1 lg:hidden">
          <span className="font-black">{formatPeso(paid?.amountCentavos ?? item.estimatedCentavos)}</span>
          <Pill tone={chipTone}>{chipText}</Pill>
        </span>
      </button>
      <Pill tone={chipTone} className="hidden h-[1.625rem] lg:inline-flex">{chipText}</Pill>
      <span className="hidden w-20 text-right text-[1.0625rem] font-black lg:block">{formatPeso(paid?.amountCentavos ?? item.estimatedCentavos)}</span>
      {action && <div className="grid lg:w-32 lg:justify-items-end">{action}</div>}
    </li>
  )
}

/** School expenses card with Upcoming / Paid tabs and quick-add chips. */
function SchoolCard({ onOpen, className = '' }: { onOpen: (o: Open) => void; className?: string }) {
  const { schoolExpenses, transactions } = useSession()
  const [tab, setTab] = useState<'upcoming' | 'paid'>('upcoming')
  const items = useMemo(() => sortForList(schoolExpenses, transactions), [schoolExpenses, transactions])
  const upcoming = items.filter((i) => statusOf(i, transactions) !== 'paid')
  const paid = items.filter((i) => statusOf(i, transactions) === 'paid')
  const shown = tab === 'upcoming' ? upcoming : paid
  const tabClass = (on: boolean) => `min-h-8 rounded-full px-3 text-xs font-extrabold lg:min-h-[2.125rem] lg:px-3.5 lg:text-[0.8125rem] ${on ? 'bg-card shadow-sm' : 'text-muted hover:text-ink'}`

  return (
    <section aria-labelledby="school-title" className={`${card} gap-1 lg:gap-1.5 lg:px-7 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <h2 id="school-title" className={cardTitle}>{tr('School expenses')}</h2>
        <div role="tablist" aria-label={tr('Filter school expenses')} className="flex gap-0.5 rounded-full bg-page p-[3px] lg:gap-1 lg:p-1">
          <button type="button" role="tab" aria-selected={tab === 'upcoming'} onClick={() => setTab('upcoming')} className={tabClass(tab === 'upcoming')}>
            {tr('Upcoming')}<span className="hidden lg:inline"> · {upcoming.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'paid'} onClick={() => setTab('paid')} className={tabClass(tab === 'paid')}>
            {tr('Paid')}<span className="hidden lg:inline"> · {paid.length}</span></button>
        </div>
      </div>
      {shown.length ? (
        <ul>{shown.map((item) => <SchoolRow key={item.id} item={item} onOpen={onOpen} />)}</ul>
      ) : (
        <p className="border-t border-page py-5 text-sm font-bold text-muted">
          {tab === 'paid' ? tr('Nothing paid yet.') : tr('Nothing planned yet.')}</p>
      )}
      <div className="mt-2 flex flex-col gap-2 rounded-[18px] bg-page p-3 lg:mt-auto lg:gap-2.5 lg:rounded-[20px] lg:px-4 lg:py-3.5">
        <span className="text-xs font-black text-ink/80 lg:text-[0.8125rem]">
          <span className="lg:hidden">{tr('Quick add')}</span><span className="hidden lg:inline">{tr('Quick add a school expense')}</span></span>
        <div className="flex flex-wrap gap-1.5 lg:gap-2">
          {QUICK.map((t) => (
            <button key={t.id} type="button" onClick={() => onOpen({ kind: 'item', template: t.id })} className="flex min-h-[2.125rem] items-center gap-1 rounded-full bg-card pr-3 pl-2 text-[0.8125rem] font-extrabold lg:min-h-[2.375rem] lg:gap-1.5 lg:pr-3.5 lg:pl-2.5 lg:text-sm">
              <Icon name="plus" className="size-3 text-blue lg:size-3.5" /> {t.label === 'Org / class fee' ? tr('Org fee') : t.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Category limits card: every limit with its bar. */
function PlanLimitsCard({ onEdit, className = '' }: { onEdit: () => void; className?: string }) {
  const { limits, transactions } = useSession()
  const rows = limitStatuses(limits, transactions)
  return (
    <section aria-labelledby="plan-limits-title" className={`${card} gap-2.5 lg:gap-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="hidden size-10 place-items-center rounded-[14px] bg-blue-tint text-blue lg:grid" aria-hidden="true"><Icon name="pie" className="size-5" /></span>
          <h2 id="plan-limits-title" className={cardTitle}>{tr('Category limits')}</h2>
        </span>
        {rows.length > 0 && <button type="button" onClick={onEdit} className="min-h-8 rounded-full bg-page px-3 text-[0.8125rem] font-extrabold hover:bg-pebble lg:min-h-9 lg:px-3.5 lg:text-sm">{tr('Edit')}</button>}
      </div>
      <p className="hidden text-sm font-bold text-muted lg:block">
        {rows.length ? tr('{0} {1} a cap this allowance cycle.', rows.length, rows.length === 1 ? tr('category has') : tr('categories have')) : tr('Cap a category, like snacks under ₱200.')}</p>
      {rows.length === 0 && <p className="text-sm font-bold text-muted lg:hidden">{tr('Cap a category, like snacks under ₱200.')}</p>}
      {rows.map((s) => <LimitRow key={s.categoryId} s={s} />)}
      <p className="text-xs leading-snug font-bold text-muted lg:text-[0.8125rem]">{tr('Just a reminder. You can still log anything.')}</p>
      <button type="button" onClick={onEdit} className="mt-auto flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-page text-sm font-extrabold hover:bg-pebble">
        <Icon name="plus" className="size-4" /> {tr('Add a limit')}</button>
    </section>
  )
}

/** Plan screen. */
export function Plan() {
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const addSchool = () => setOpen({ kind: 'item' })
  const addUtang = () => setOpen({ kind: 'utang' })
  const button = 'flex min-h-[3.125rem] items-center justify-center gap-1.5 rounded-full px-4 font-extrabold whitespace-nowrap lg:min-h-12 lg:px-5'

  return (
    <Page>
      <header className="mb-3.5 flex flex-wrap items-end justify-between gap-3 px-1 lg:mb-5 lg:px-0">
        <div>
          <h1 className="text-[1.875rem] leading-tight font-black tracking-tight lg:text-[2.125rem]">{tr('Plan')}</h1>
          <p className="text-sm font-bold text-muted lg:text-base">{tr('Set money aside so your daily budget stays honest.')}</p>
        </div>
        <div className="hidden gap-2.5 lg:flex">
          <button type="button" onClick={addUtang} className={`${button} bg-card`}><Icon name="plus" className="size-[1.125rem]" /> {tr('Utang')}</button>
          <button type="button" onClick={addSchool} className={`${button} bg-ink text-card`}><Icon name="plus" className="size-[1.125rem]" /> {tr('School expense')}</button>
        </div>
      </header>

      {/* Phone: hero, buttons, school, utang, class days, limits. Desktop: rows of 2 + 1, utang last. */}
      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-5">
        <div className="lg:col-span-2 lg:row-start-1"><KeptHero /></div>
        {/* School expense takes the room Utang doesn't need, so its label stays on one line even at 320px. */}
        <div className="flex gap-2 lg:hidden">
          <button type="button" onClick={addSchool} className={`${button} flex-1 bg-ink text-card`}><Icon name="plus" className="size-4 shrink-0" /> {tr('School expense')}</button>
          <button type="button" onClick={addUtang} className={`${button} bg-card`}><Icon name="plus" className="size-4 shrink-0" /> {tr('Utang')}</button>
        </div>
        <SchoolCard onOpen={setOpen} className="lg:col-span-2 lg:row-start-2" />
        <UtangCard onAdd={addUtang} className="lg:col-span-3 lg:row-start-3" />
        <ClassDaysCard className="lg:col-start-3 lg:row-start-1" />
        <PlanLimitsCard onEdit={() => setOpen({ kind: 'limits' })} className="lg:col-start-3 lg:row-start-2" />
      </div>

      {open?.kind === 'item' && <ItemDialog item={open.item} template={open.template} onClose={close} />}
      {open?.kind === 'pay' && <PayDialog item={open.item} onClose={close} />}
      {open?.kind === 'limits' && <LimitsDialog onClose={close} />}
      {open?.kind === 'utang' && <NewUtangDialog onClose={close} />}
    </Page>
  )
}
