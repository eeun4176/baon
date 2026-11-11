/*
 * Plan.tsx — Plan ahead (design p10 phone, p20 desktop).
 *   Dark hero: total set aside for school ("2 set aside · 1 planned · 1 paid" on desktop).
 *   School expenses: each row has Set aside / Mark paid; tap a row to edit or delete.
 *   Class days: which days the daily budget counts (edits the allowance setup), plus
 *     "No classes" breaks: the budget counts every day and the streak is frozen.
 *   Category limits: placeholder until category budgets are built.
 * Phone order: hero → list → two tiles. Desktop: hero + Category limits on the left,
 * Class days on the right, list below.
 */
import { useMemo, useState } from 'react'
import { breakOn, classDaysText } from '../budget/allowance.ts'
import { addDays, manilaDate } from '../budget/days.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { BigMoney, Card, Icon, Page, PageHeader, Switch } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { ItemDialog, PayDialog } from './PlanDialogs.tsx'
import { paidWith, setAsideTotal, sortForList, statusOf, TEMPLATES, templateLabel, type SchoolExpense, type Status } from './school.ts'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dueDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const paidDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })

// Templates shown as quick-add chips above the desktop list (design p20).
const QUICK = TEMPLATES.filter((t) => t.id !== 'thesis' && t.id !== 'other')

type Open = { kind: 'item'; item?: SchoolExpense; template?: SchoolExpense['template'] } | { kind: 'pay'; item: SchoolExpense } | { kind: 'days' } | null

const BADGE: Record<Status, [string, string]> = {
  setAside: ['Set aside', 'bg-ink text-card'],
  planned: ['Planned', 'bg-pebble text-ink/70'],
  paid: ['Paid', 'bg-blue-tint text-blue'],
}

/** Status pill: dark "Set aside", gray "Planned", blue "Paid". */
function Badge({ status, className = '' }: { status: Status; className?: string }) {
  const [text, color] = BADGE[status]
  return <span className={`shrink-0 items-center rounded-full px-3 py-1 text-sm font-black ${color} ${className}`}>{text}</span>
}

/**
 * [desktop-only prefix, text]: ["Due ", "Thu, Nov 12"], ["Paid ", "Nov 6"], ["", "Due today"]
 * or ["", "Overdue · Mon, Nov 9"]. Phones skip the prefix (the badge already says it).
 */
function whenText(item: SchoolExpense, paidAt: string | undefined, today: string): [string, string] {
  if (paidAt) return ['Paid ', paidDay.format(new Date(paidAt))]
  if (item.dueDate === today) return ['', 'Due today']
  const date = dueDay.format(new Date(`${item.dueDate}T00:00:00Z`))
  return item.dueDate < today ? ['', `Overdue · ${date}`] : ['Due ', date]
}

/** One school expense row: tap to edit; the pill on the right moves it along. */
function Row({ item, index, onOpen }: { item: SchoolExpense; index: number; onOpen: (o: Open) => void }) {
  const { transactions, saveSchoolExpense, showToast } = useSession()
  const paid = paidWith(item, transactions)
  const status = statusOf(item, transactions)
  const [prefix, when] = whenText(item, paid?.occurredAt, manilaDate())
  const action = 'min-h-11 rounded-full px-5 font-black whitespace-nowrap md:w-32'

  /** Planned → Set aside, with Undo. */
  async function setAside() {
    await saveSchoolExpense({ ...item, status: 'setAside' })
    showToast({ message: `Set aside ${formatPeso(item.estimatedCentavos)} for ${item.title}`, undo: () => saveSchoolExpense(item) })
  }

  return (
    <li className="flex animate-rise items-center gap-3 py-4 md:gap-4" style={{ animationDelay: `${index * 40}ms` }}>
      <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-page text-muted md:grid">
        <Icon name={item.template === 'printing' ? 'printer' : 'book'} className="size-5" />
      </span>
      <button type="button" onClick={() => onOpen({ kind: 'item', item })} className={`min-w-0 flex-1 rounded-xl text-left ${status === 'paid' ? 'text-ink/60' : ''}`}>
        <span className="block truncate text-lg font-black">{item.title}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-muted">
          <Badge status={status} className="inline-flex md:hidden" />
          <span>
            <span className="hidden md:inline">{templateLabel(item.template)} · {prefix}</span>
            {when}
          </span>
        </span>
      </button>
      <Badge status={status} className="hidden md:inline-flex" />
      <div className="flex shrink-0 flex-col items-end gap-2 md:flex-row md:items-center md:gap-6">
        <span className="text-lg font-black md:w-20 md:text-right">{formatPeso(paid?.amountCentavos ?? item.estimatedCentavos)}</span>
        {status === 'setAside' && (
          <button type="button" onClick={() => onOpen({ kind: 'pay', item })} className={`${action} bg-pebble hover:bg-pebble-2 md:bg-blue md:text-white md:hover:bg-blue md:hover:shadow-[0_8px_20px_-8px_rgba(30,94,255,0.7)]`}>
            Mark paid
          </button>
        )}
        {status === 'planned' && <button type="button" onClick={setAside} className={`${action} bg-pebble hover:bg-pebble-2`}>Set aside</button>}
        {status === 'paid' && <span className="hidden md:block md:w-32" />}
      </div>
    </li>
  )
}

/** Su–Sa toggles + "Count only class days" switch; saves the allowance setup right away. */
function ClassDaysEditor() {
  const { allowance, updateAllowance, showToast } = useSession()

  /** Saves a change to the allowance; Home's daily budget follows instantly. */
  const save = (patch: Partial<typeof allowance>) =>
    updateAllowance({ ...allowance, ...patch }).catch(() => showToast({ message: 'Couldn’t save. Try again.' }))

  /** Turns one class day on/off. */
  const toggle = (d: number) =>
    save({ classWeekdays: allowance.classWeekdays.includes(d) ? allowance.classWeekdays.filter((x) => x !== d) : [...allowance.classWeekdays, d].sort() })

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Class days">
        {DAYS.map((label, d) => {
          const on = allowance.countClassDays && allowance.classWeekdays.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={DAY_NAMES[d]}
              disabled={!allowance.countClassDays}
              onClick={() => toggle(d)}
              className={`aspect-square min-h-10 rounded-full text-[0.9375rem] font-black transition-colors disabled:opacity-50 ${on ? 'bg-blue text-white' : 'bg-pebble text-muted hover:bg-pebble-2'}`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-muted">Count only class days</p>
        <Switch label="Count only class days" checked={allowance.countClassDays} onChange={(countClassDays) => save({ countClassDays })} />
      </div>
      <BreakControl />
    </>
  )
}

/**
 * "No classes" break (typhoon day … sembreak): from today until a chosen day.
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
      showToast({ message: 'Couldn’t save. Try again.' })
    }
  }

  /** "No classes today" or "No classes until Mon, Dec 1". */
  const untilText = (to: string) => (to === today ? 'No classes today' : `No classes until ${dueDay.format(new Date(`${to}T00:00:00Z`))}`)

  /** Starts a break today, ending on `to` (inclusive). */
  const start = (to: string) => saveBreaks([...(allowance.breaks ?? []), { from: today, to }], `${untilText(to)} · streak paused`)

  /** Ends the current break: it stops yesterday (or disappears if it started today). */
  const end = () =>
    current &&
    saveBreaks(
      (allowance.breaks ?? []).flatMap((b) => (b !== current ? [b] : b.from < today ? [{ ...b, to: addDays(today, -1) }] : [])),
      'Welcome back! Class days count again',
    )

  if (current) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-tint p-4">
        <p className="font-bold text-blue">{untilText(current.to)} · budget counts every day, streak paused</p>
        <button type="button" onClick={end} className="min-h-11 rounded-full bg-card px-5 font-black">Classes are back</button>
      </div>
    )
  }
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="mt-3 min-h-11 font-extrabold text-blue hover:underline">
        No classes for a while? Set a break
      </button>
    )
  }
  return (
    <div className="mt-4 rounded-2xl bg-page p-4">
      <p className="font-black">No classes</p>
      <p className="text-sm font-semibold text-muted">For suspensions, holidays or sembreak. Your budget counts every day and your streak is paused.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <button type="button" onClick={() => start(today)} className="min-h-11 rounded-full bg-card px-4 font-black hover:bg-pebble">Just today</button>
        <label className="text-sm font-extrabold text-muted">
          Until
          <input type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} className="mt-1 block min-h-11 rounded-full bg-card px-4 font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40" />
        </label>
        <button type="button" disabled={!until || until < today} onClick={() => start(until)} className="min-h-11 rounded-full bg-blue px-5 font-black text-white disabled:opacity-60">Save break</button>
        <button type="button" onClick={() => setAsking(false)} className="min-h-11 px-2 font-extrabold text-muted">Cancel</button>
      </div>
    </div>
  )
}

/** Plan screen. */
export function Plan() {
  const { schoolExpenses, transactions, allowance, showToast } = useSession()
  const [open, setOpen] = useState<Open>(null)
  const items = useMemo(() => sortForList(schoolExpenses, transactions), [schoolExpenses, transactions])
  const total = setAsideTotal(schoolExpenses, transactions)
  const counts = { setAside: 0, planned: 0, paid: 0 }
  for (const i of schoolExpenses) counts[statusOf(i, transactions)]++

  const tile = 'flex min-h-40 animate-rise flex-col items-start rounded-3xl bg-card p-4 text-left sm:rounded-[28px] sm:p-5 lg:hidden'
  const tileIcon = 'grid size-10 shrink-0 place-items-center rounded-xl bg-blue-tint text-blue'

  /** Category budgets aren't built yet; say so instead of a dead button. */
  const limitsSoon = () => showToast({ message: 'Category limits are coming soon' })
  const close = () => setOpen(null)

  return (
    <Page>
      <PageHeader
        title="Plan"
        sub="Set money aside so your daily budget stays honest."
        actions={
          <button
            type="button"
            onClick={() => setOpen({ kind: 'item' })}
            className="flex min-h-12 items-center gap-2 rounded-full bg-blue px-5 text-lg font-black text-white md:bg-ink md:text-card"
          >
            <Icon name="plus" className="size-5" />
            <span className="md:hidden">Add</span>
            <span className="hidden md:inline">School expense</span>
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Left (desktop): hero with Category limits right under it, so neither column is half empty */}
        <div className="flex flex-col gap-5 lg:col-span-7">{/* gap, not space-y: the hidden desktop card must not leave a margin */}
        <section className="animate-rise rounded-3xl bg-hero p-4 sm:rounded-[28px] sm:p-6 text-white md:p-8" aria-labelledby="set-aside-title">
          <h2 id="set-aside-title" className="text-lg font-extrabold text-white/80">Set aside for school</h2>
          <p className="mt-2"><BigMoney centavos={total} className="text-[clamp(2.75rem,15vw,4.25rem)]" /></p>
          <p className="mt-3 max-w-md font-semibold text-white/75">
            This stays in your wallets, but it isn’t counted in your daily budget until you mark it paid.
          </p>
          {schoolExpenses.length > 0 && (
            <ul className="mt-5 hidden flex-wrap gap-2 text-sm font-black md:flex">
              <li className="rounded-full bg-white/12 px-3.5 py-1.5">{counts.setAside} set aside</li>
              <li className="rounded-full bg-white/12 px-3.5 py-1.5">{counts.planned} planned</li>
              <li className="rounded-full bg-blue px-3.5 py-1.5">{counts.paid} paid</li>
            </ul>
          )}
        </section>
          {/* Desktop: Category limits, styled like the Class days card */}
          <Card className="hidden animate-rise lg:block">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-black">Category limits</h2>
              <p className="text-sm font-bold text-muted">Optional</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={tileIcon}><Icon name="pie" className="size-5" /></span>
              <p className="min-w-0 flex-1 font-semibold text-muted">Cap a category each week, like snacks under ₱200.</p>
              <button type="button" onClick={limitsSoon} className="min-h-11 shrink-0 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">Set up</button>
            </div>
          </Card>
        </div>

        {/* Phone/tablet: two small tiles. Desktop: the Class days card beside the hero */}
        <div className="order-3 grid grid-cols-2 gap-3 lg:order-none lg:col-span-5 lg:grid-cols-1 lg:gap-5">
          {/* Phone/tablet tiles share one shape (icon · title · note · value at the bottom) so they line up */}
          <button type="button" onClick={() => setOpen({ kind: 'days' })} className={tile}>
            <span className={tileIcon}><Icon name="calendar" className="size-5" /></span>
            <span className="mt-3 block leading-tight font-black">Class days</span>
            <span className="block text-sm font-semibold text-muted">Budget counts these</span>
            <span className="mt-auto block pt-3 text-xl leading-tight font-black">{breakOn(manilaDate(), allowance) ? 'On break' : classDaysText(allowance)}</span>
          </button>
          <Card className="hidden animate-rise lg:block">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-black">Class days</h2>
              <p className="text-sm font-bold text-muted">Budget counts these</p>
            </div>
            <ClassDaysEditor />
          </Card>

          <button type="button" onClick={limitsSoon} className={tile}>
            <span className={tileIcon}><Icon name="pie" className="size-5" /></span>
            <span className="mt-3 block leading-tight font-black">Category limits</span>
            <span className="block text-sm font-semibold text-muted">Optional</span>
            <span className="mt-auto block pt-3 text-xl leading-tight font-black text-blue">Set up</span>
          </button>
        </div>

        {/* School expenses */}
        <Card className="animate-rise lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-page pb-3">
            <h2 className="text-xl font-black">School expenses</h2>
            <div className="hidden flex-wrap gap-2 md:flex">
              {QUICK.map((t) => (
                <button key={t.id} type="button" onClick={() => setOpen({ kind: 'item', template: t.id })} className="min-h-9 rounded-full bg-page px-3.5 text-sm font-extrabold hover:bg-pebble">
                  {t.label === 'Org / class fee' ? 'Org fee' : t.label}
                </button>
              ))}
            </div>
          </div>
          {items.length ? (
            <ul className="divide-y divide-page">
              {items.map((item, i) => <Row key={item.id} item={item} index={i} onOpen={setOpen} />)}
            </ul>
          ) : (
            <div className="py-6">
              <p className="font-semibold text-muted">
                Nothing planned yet. Add printing, projects or org fees before they’re due, so your daily budget doesn’t count money that’s already spoken for.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 md:hidden">
                {QUICK.map((t) => (
                  <button key={t.id} type="button" onClick={() => setOpen({ kind: 'item', template: t.id })} className="min-h-11 rounded-full bg-page px-4 font-extrabold">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {open?.kind === 'item' && <ItemDialog item={open.item} template={open.template} onClose={close} />}
      {open?.kind === 'pay' && <PayDialog item={open.item} onClose={close} />}
      {open?.kind === 'days' && (
        <Modal title="Class days" onClose={close}>
          <p className="mb-4 font-semibold text-muted">Your daily budget spreads over these days.</p>
          <ClassDaysEditor />
        </Modal>
      )}
    </Page>
  )
}
