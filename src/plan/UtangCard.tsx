/*
 * UtangCard.tsx — Plan → Utang: money borrowed from or lent to someone.
 *   You owe      held back from the daily budget until it's paid back ("Pay back")
 *   Owed to you  not counted as the student's money until it comes back ("Got paid")
 * Partial payments are fine (a small progress bar shows them). Fully paid utang leaves the list
 * (it stays in History). Each row has a due chip: Anytime, In 3 days, Today, 2 days late.
 * Phone: "You owe" / "Owed to you" tabs with their totals. Desktop: both side by side.
 * Tapping a row opens the entry to fix or delete it. The math is in ledger/utang.ts.
 */
import { useState, type FormEvent } from 'react'
import { lastUsedWalletId } from '../add/categories.ts'
import { centavosToText } from '../add/keypad.ts'
import { manilaDate } from '../budget/days.ts'
import type { Transaction } from '../ledger/ledger.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { dueStatus, utangList, type Utang } from '../ledger/utang.ts'
import { useSession } from '../session.ts'
import { useAddDialog } from '../shell/useAddDialog.ts'
import { Icon, Pill, Segmented } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { AmountInput, ErrorLine } from './PlanDialogs.tsx'
import { LOCALE, tr } from '../i18n/i18n.ts'

const dueDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40'
const label = 'block font-extrabold text-muted'
const mainButton = 'min-h-13 flex-1 rounded-full bg-blue px-6 text-lg font-black text-white disabled:opacity-60'

/** Wallet picker shown when the student has more than one spending wallet. */
function WalletPick({ value, onChange, title }: { value: string; onChange: (id: string) => void; title: string }) {
  const { wallets } = useSession()
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  if (spending.length < 2) return null
  return (
    <div className="mt-4">
      <p className={label}>{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={title}>
        {spending.map((w) => (
          <button key={w.id} type="button" role="radio" aria-checked={value === w.id} onClick={() => onChange(w.id)}
            className={`min-h-11 rounded-full px-5 font-extrabold ${value === w.id ? 'bg-ink text-card' : 'bg-pebble hover:bg-pebble-2'}`}>
            {w.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Add an utang: "I borrowed" (money in, held back) or "I lent" (money out, not spending). */
export function NewUtangDialog({ onClose }: { onClose: () => void }) {
  const { wallets, transactions, addTransaction, removeTransaction, showToast } = useSession()
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const [kind, setKind] = useState<'borrow' | 'lend'>('borrow')
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [walletId, setWalletId] = useState(() => lastUsedWalletId(transactions, spending[0]?.id ?? 'cash'))
  const [due, setDue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Saves the borrow/lend entry, then confirms with Undo. */
  async function save(e: FormEvent) {
    e.preventDefault()
    const centavos = parsePeso(amount)
    if (!person.trim()) return setError(kind === 'borrow' ? tr('Who did you borrow from?') : tr('Who did you lend to?'))
    if (!centavos) return setError(tr('Enter an amount first.'))
    const tx: Transaction = { id: crypto.randomUUID(), kind, amountCentavos: centavos, walletId, person: person.trim(), occurredAt: new Date().toISOString(), ...(due ? { dueDate: due } : {}) }
    setBusy(true)
    try {
      await addTransaction(tx)
    } catch (err) {
      setBusy(false)
      return setError(err instanceof Error ? err.message : tr('Couldn’t save. Try again.'))
    }
    onClose()
    const money = formatPeso(centavos)
    showToast({ message: kind === 'borrow' ? tr('Borrowed {0} from {1}', money, tx.person) : tr('Lent {0} to {1}', money, tx.person), undo: () => removeTransaction(tx.id) })
  }

  return (
    <Modal title={tr('New utang')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <Segmented options={[['borrow', tr('I borrowed')], ['lend', tr('I lent')]] as const} value={kind} onChange={(k) => { setKind(k); setError('') }} label={tr('Kind')} />
        <p className="mt-3 text-sm font-semibold text-muted">
          {kind === 'borrow' ? tr('Goes to your wallet, held back until you pay it.') : tr('Leaves your wallet, not counted as spending.')}</p>
        <div className="mt-4 space-y-4">
          <label className={label}>
            {kind === 'borrow' ? tr('Borrowed from') : tr('Lent to')}
            <input value={person} maxLength={40} onChange={(e) => { setPerson(e.target.value); setError('') }} placeholder={tr('e.g. Mia')} className={`${field} placeholder:text-muted/60`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <AmountInput value={amount} onChange={(v) => { setAmount(v); setError('') }} />
            <label className={label}>
              {tr('Pay back by')}<input type="date" value={due} min={manilaDate()} onChange={(e) => setDue(e.target.value)} className={field} />
            </label>
          </div>
        </div>
        <WalletPick value={walletId} onChange={setWalletId} title={kind === 'borrow' ? tr('Went into') : tr('Came from')} />
        <ErrorLine text={error} />
        <div className="mt-5 flex">
          <button type="submit" disabled={busy} className={mainButton}>{tr('Save')}</button>
        </div>
      </form>
    </Modal>
  )
}

/** "Pay back" (repay) or "Got paid" (collect): any amount up to what's left. */
function SettleDialog({ u, onClose }: { u: Utang; onClose: () => void }) {
  const { addTransaction, removeTransaction, showToast } = useSession()
  const person = u.tx.person ?? ''
  const [amount, setAmount] = useState(centavosToText(u.left))
  const [walletId, setWalletId] = useState(u.tx.walletId)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Saves the payment linked to the utang; the list and Home update at once. */
  async function save(e: FormEvent) {
    e.preventDefault()
    const centavos = parsePeso(amount)
    if (!centavos) return setError(tr('Enter an amount first.'))
    if (centavos > u.left) return setError(tr('That’s more than the {0} left.', formatPeso(u.left)))
    const tx: Transaction = { id: crypto.randomUUID(), kind: u.owe ? 'repay' : 'collect', amountCentavos: centavos, walletId, person, linkedId: u.tx.id, occurredAt: new Date().toISOString() }
    setBusy(true)
    try {
      await addTransaction(tx)
    } catch (err) {
      setBusy(false)
      return setError(err instanceof Error ? err.message : tr('Couldn’t save. Try again.'))
    }
    onClose()
    const money = formatPeso(centavos)
    showToast({ message: u.owe ? tr('Paid {0} back to {1}', money, person) : tr('{0} paid you {1}', person, money), undo: () => removeTransaction(tx.id) })
  }

  return (
    <Modal title={u.owe ? tr('Pay back {0}', person) : tr('{0} paid you back', person)} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <p className="mb-4 font-semibold text-muted">{tr('{0} left of {1}.', formatPeso(u.left), formatPeso(u.tx.amountCentavos))}</p>
        <AmountInput value={amount} onChange={(v) => { setAmount(v); setError('') }} autoFocus />
        <WalletPick value={walletId} onChange={setWalletId} title={u.owe ? tr('Paid from') : tr('Went into')} />
        <ErrorLine text={error} />
        <div className="mt-5 flex">
          <button type="submit" disabled={busy} className={mainButton}>{u.owe ? tr('Pay back') : tr('Got paid')}</button>
        </div>
      </form>
    </Modal>
  )
}

/** "In 3 days", "Today", "2 days late", "Anytime" chip for a row. */
function DueChip({ due }: { due: string | undefined }) {
  const s = dueStatus(due, manilaDate())
  if (s.kind === 'none') return <Pill>{tr('Anytime')}</Pill>
  if (s.kind === 'today') return <Pill tone="amber">{tr('Today')}</Pill>
  if (s.kind === 'late') return <Pill tone="amber">{s.days === -1 ? tr('1 day late') : tr('{0} days late', -s.days)}</Pill>
  return <Pill>{s.days === 1 ? tr('Tomorrow') : tr('In {0} days', s.days)}</Pill>
}

/** One open utang: initial, name + due chip, "Due Mon, Nov 16 · ₱50 paid of ₱200", progress, what's left, and the button. */
function Row({ u, onSettle }: { u: Utang; onSettle: () => void }) {
  const { open } = useAddDialog()
  const due = u.tx.dueDate
  const late = due !== undefined && due < manilaDate()
  const date = due ? dueDay.format(new Date(`${due}T00:00:00Z`)) : ''
  const meta = [
    !due ? tr('No due date') : late ? tr('Was due {0}', date) : tr('Due {0}', date),
    u.paid ? tr('{0} paid of {1}', formatPeso(u.paid), formatPeso(u.tx.amountCentavos)) : null,
  ].filter(Boolean).join(' · ')
  return (
    <li className="flex min-h-16 items-center gap-2.5 border-t border-page py-2 lg:min-h-[4.25rem] lg:gap-3">
      <button type="button" onClick={() => open(u.tx.id)} aria-label={tr('Edit utang with {0}', u.tx.person ?? '')} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left lg:gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full font-black ${u.owe ? 'bg-page' : 'bg-blue-tint text-blue'}`} aria-hidden="true">{(u.tx.person ?? '?').charAt(0).toUpperCase()}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5 lg:gap-2">
            <span className="truncate font-black">{u.tx.person}</span>
            <DueChip due={due} />
          </span>
          <span className="text-xs font-bold text-muted">{meta}</span>
          {u.paid > 0 && (
            <span className="block h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-pebble" aria-hidden="true">
              <span className="block h-full rounded-full bg-blue" style={{ width: `${(u.paid / u.tx.amountCentavos) * 100}%` }} />
            </span>
          )}
        </span>
      </button>
      <span className="shrink-0 font-black lg:text-base">{formatPeso(u.left)}</span>
      <button type="button" onClick={onSettle} className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-extrabold whitespace-nowrap lg:px-4 ${u.owe ? 'bg-page hover:bg-pebble' : 'bg-blue text-white'}`}>
        {u.owe ? tr('Pay back') : tr('Got paid')}</button>
    </li>
  )
}

/** "You owe" or "Owed to you" box (desktop): heading, note, total, rows. */
function Group({ list, owe, onSettle }: { list: Utang[]; owe: boolean; onSettle: (u: Utang) => void }) {
  const total = list.reduce((s, u) => s + u.left, 0)
  return (
    <section className="flex flex-col rounded-3xl border border-pebble px-5 pt-[1.125rem] pb-2">
      <div className="flex items-start justify-between gap-2.5 pb-2.5">
        <span className="flex flex-col">
          <h3 className="font-black">{owe ? tr('You owe') : tr('Owed to you')}</h3>
          <span className="text-[0.8125rem] font-bold text-muted">{owe ? tr('Held back from your daily budget') : tr('Counted once it’s back')}</span>
        </span>
        <span className={`text-2xl font-black tracking-tight ${owe ? '' : 'text-blue'}`}>{formatPeso(total)}</span>
      </div>
      {list.length ? (
        <ul>{list.map((u) => <Row key={u.tx.id} u={u} onSettle={() => onSettle(u)} />)}</ul>
      ) : (
        <p className="border-t border-page py-5 text-sm font-bold text-muted">{owe ? tr('You don’t owe anyone.') : tr('Nobody owes you.')}</p>
      )}
      {!owe && (
        <p className="mt-auto mb-2.5 flex items-start gap-2.5 rounded-[18px] bg-page px-3.5 py-3 text-[0.8125rem] leading-snug font-bold text-ink/80">
          <Icon name="info" className="mt-0.5 size-[1.125rem] shrink-0 text-muted" />
          {tr('Not in your budget until it’s back.')}</p>
      )}
    </section>
  )
}

/** Plan → Utang section. `onAdd` opens the new-utang pop-up (also reachable from the page header). */
export function UtangCard({ onAdd, className = '' }: { onAdd: () => void; className?: string }) {
  const { transactions } = useSession()
  const [settling, setSettling] = useState<Utang | null>(null)
  const [tab, setTab] = useState<'owe' | 'owed'>('owe')
  const open = utangList(transactions).filter((u) => u.left > 0)
  const owe = open.filter((u) => u.owe)
  const owed = open.filter((u) => !u.owe)
  const total = (list: Utang[]) => formatPeso(list.reduce((s, u) => s + u.left, 0))
  const shown = tab === 'owe' ? owe : owed

  return (
    <section aria-labelledby="utang-title" className={`flex animate-rise flex-col gap-3 rounded-[26px] bg-card p-[1.125rem] lg:gap-4 lg:rounded-[32px] lg:px-7 lg:pt-6 lg:pb-7 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <h2 id="utang-title" className="text-base font-black lg:text-lg">{tr('Utang')}</h2>
          <span className="hidden text-sm font-bold text-muted lg:block">{tr('Kept separate from your spending.')}</span>
        </span>
        <button type="button" onClick={onAdd} className="flex min-h-10 items-center gap-1.5 rounded-full bg-page px-4 text-sm font-extrabold hover:bg-pebble">
          <Icon name="plus" className="size-4" /> {tr('Add')}</button>
      </div>

      {open.length === 0 ? (
        <p className="py-3 font-semibold text-muted">{tr('Borrowed or lent money? Track it here.')}</p>
      ) : (
        <>
          {/* Phone: two tabs with their totals */}
          <div role="tablist" aria-label={tr('Utang')} className="grid grid-cols-2 gap-1 rounded-[18px] bg-page p-1 lg:hidden">
            {(['owe', 'owed'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex flex-col items-center rounded-[14px] py-2 ${tab === k ? 'bg-card shadow-sm' : ''}`}>
                <span className="text-xs font-extrabold text-muted">{k === 'owe' ? tr('You owe') : tr('Owed to you')}</span>
                <span className={`text-lg font-black ${k === 'owed' ? 'text-blue' : ''}`}>{total(k === 'owe' ? owe : owed)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs font-bold text-muted lg:hidden">{tab === 'owe' ? tr('Held back until you pay it.') : tr('Counted once it’s back.')}</p>
          <ul className="lg:hidden">
            {shown.length ? shown.map((u) => <Row key={u.tx.id} u={u} onSettle={() => setSettling(u)} />) : (
              <li className="border-t border-page py-4 text-sm font-bold text-muted">{tab === 'owe' ? tr('You don’t owe anyone.') : tr('Nobody owes you.')}</li>
            )}
          </ul>
          {/* Desktop: both boxes side by side */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-2">
            <Group list={owe} owe onSettle={setSettling} />
            <Group list={owed} owe={false} onSettle={setSettling} />
          </div>
        </>
      )}
      {settling && <SettleDialog u={settling} onClose={() => setSettling(null)} />}
    </section>
  )
}
