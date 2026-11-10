/*
 * PlanDialogs.tsx — Pop-ups on the Plan tab:
 *   ItemDialog  add / edit a school expense (template, title, amount, due date, set aside now)
 *   PayDialog   "Mark paid": creates the real expense (prefilled amount, editable) which
 *               releases the reservation in the same step (plan §4.4)
 * Everything saves through the session, so Home's safe-to-spend updates at once, with Undo.
 */
import { useState, type FormEvent } from 'react'
import { lastUsedWalletId } from '../add/categories.ts'
import { acceptTyped, centavosToText } from '../add/keypad.ts'
import { addDays, manilaDate } from '../budget/days.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon, Switch } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { paidWith, TEMPLATES, templateLabel, type SchoolExpense } from './school.ts'

const paidDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' })

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold outline-none focus:ring-2 focus:ring-blue/40'
const label = 'block font-extrabold text-muted'

/** Peso amount box (typed, centavos allowed). */
function AmountInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className={label}>
      Amount
      <span className={`${field} flex items-center gap-1`}>
        <span className="text-muted" aria-hidden="true">₱</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => { const t = acceptTyped(e.target.value); if (t !== null) onChange(t) }}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-pebble-2"
        />
      </span>
    </label>
  )
}

/** Error line shown above the main button. */
function ErrorLine({ text }: { text: string }) {
  return text ? <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{text}</p> : null
}

const mainButton = 'min-h-13 flex-1 rounded-full bg-blue px-6 text-lg font-black text-white disabled:opacity-60'
const grayButton = 'min-h-13 rounded-full bg-pebble px-6 text-lg font-black hover:bg-pebble-2'

/** Add or edit a school expense. `template` pre-picks a template for a new item. */
export function ItemDialog({ item, template, onClose }: { item?: SchoolExpense; template?: SchoolExpense['template']; onClose: () => void }) {
  const { transactions, saveSchoolExpense, removeSchoolExpense, addTransaction, removeTransaction, showToast } = useSession()
  const today = manilaDate()
  const paid = item && paidWith(item, transactions)
  const [kind, setKind] = useState<SchoolExpense['template']>(item?.template ?? template ?? 'printing')
  const [title, setTitle] = useState(item?.title ?? (template && template !== 'other' ? templateLabel(template) : ''))
  const [amount, setAmount] = useState(item ? centavosToText(item.estimatedCentavos) : '')
  const [due, setDue] = useState(item?.dueDate ?? addDays(today, 7))
  const [setAside, setSetAside] = useState(item ? item.status === 'setAside' : true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Picks a template; fills the title if it's still empty or still another template's name. */
  function pick(id: SchoolExpense['template']) {
    setKind(id)
    if (id !== 'other' && (!title.trim() || TEMPLATES.some((t) => t.label === title))) setTitle(templateLabel(id))
  }

  /** Validates and saves, then confirms with Undo. */
  async function save(e: FormEvent) {
    e.preventDefault()
    const centavos = parsePeso(amount)
    if (!title.trim()) return setError('What is it for? e.g. Thesis printing')
    if (!centavos) return setError('Enter about how much it costs.')
    if (!due) return setError('Pick when it’s due.')
    const next: SchoolExpense = {
      id: item?.id ?? crypto.randomUUID(),
      title: title.trim(),
      template: kind,
      estimatedCentavos: centavos,
      dueDate: due,
      status: setAside ? 'setAside' : 'planned',
    }
    setBusy(true)
    try {
      await saveSchoolExpense(next)
    } catch {
      setBusy(false)
      return setError('Couldn’t save. Try again.')
    }
    onClose()
    showToast(
      item
        ? { message: 'Changes saved', undo: () => saveSchoolExpense(item) }
        : { message: setAside ?`Set aside ${formatPeso(centavos)} for ${next.title}` : `Planned ${next.title}`, undo: () => removeSchoolExpense(next.id) },
    )
  }

  /** Deletes the item (its payment, if any, stays in History), with Undo. */
  async function remove() {
    if (!item) return
    await removeSchoolExpense(item.id)
    onClose()
    showToast({ message: `Removed ${item.title}`, undo: () => saveSchoolExpense(item) })
  }

  /** Deletes the payment, so the item goes back to set aside / planned. */
  async function unpay() {
    if (!paid) return
    await removeTransaction(paid.id)
    onClose()
    showToast({ message: 'Payment removed', undo: () => addTransaction(paid) })
  }

  return (
    <Modal title={item ? 'Edit school expense' : 'New school expense'} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kind">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={kind === t.id}
              onClick={() => pick(t.id)}
              className={`min-h-10 rounded-full px-4 font-extrabold ${kind === t.id ? 'bg-ink text-card' : 'bg-pebble hover:bg-pebble-2'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          <label className={label}>
            What for?
            <input value={title} maxLength={60} onChange={(e) => { setTitle(e.target.value); setError('') }} placeholder="e.g. Thesis printing" className={`${field} text-ink placeholder:text-muted/60`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <AmountInput value={amount} onChange={(v) => { setAmount(v); setError('') }} />
            <label className={label}>
              Due
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${field} text-ink`} />
            </label>
          </div>
        </div>

        {paid ? (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-blue-tint p-4">
            <p className="font-bold text-blue">Paid {formatPeso(paid.amountCentavos)} on {paidDay.format(new Date(paid.occurredAt))}</p>
            <button type="button" onClick={unpay} className="shrink-0 font-black text-blue underline underline-offset-4">Not paid yet</button>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-page p-4">
            <div>
              <p className="font-black">Set aside now</p>
              <p className="text-sm font-semibold text-muted">Stays in your wallet but isn’t counted in your daily budget.</p>
            </div>
            <Switch label="Set aside now" checked={setAside} onChange={setSetAside} />
          </div>
        )}

        <ErrorLine text={error} />
        <div className="mt-5 flex gap-2.5">
          {item && (
            <button type="button" onClick={remove} aria-label="Delete" className={`${grayButton} grid place-items-center px-4`}>
              <Icon name="trash" className="size-5" />
            </button>
          )}
          <button type="submit" disabled={busy} className={mainButton}>{item ? 'Save changes' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

/** "Mark paid": logs the real expense (amount editable) linked to the item. */
export function PayDialog({ item, onClose }: { item: SchoolExpense; onClose: () => void }) {
  const { wallets, transactions, addTransaction, removeTransaction, showToast } = useSession()
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const [amount, setAmount] = useState(centavosToText(item.estimatedCentavos))
  const [walletId, setWalletId] = useState(() => lastUsedWalletId(transactions, spending[0]?.id ?? 'cash'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Saves the expense; the item turns "Paid" because the expense links to it. */
  async function pay(e: FormEvent) {
    e.preventDefault()
    const centavos = parsePeso(amount)
    if (!centavos) return setError('Enter how much you paid.')
    const id = crypto.randomUUID()
    setBusy(true)
    try {
      await addTransaction({
        id,
        kind: 'expense',
        amountCentavos: centavos,
        walletId,
        categoryId: 'school',
        occurredAt: new Date().toISOString(),
        note: item.title,
        linkedId: item.id,
      })
    } catch (err) {
      setBusy(false)
      return setError(err instanceof Error ? err.message : 'Couldn’t save. Try again.')
    }
    onClose()
    showToast({ message: `Paid ${formatPeso(centavos)} · ${item.title}`, undo: () => removeTransaction(id) })
  }

  return (
    <Modal title={`Pay ${item.title}`} onClose={onClose}>
      <form onSubmit={pay} noValidate>
        <p className="mb-4 font-semibold text-muted">
          This logs the expense and frees the {formatPeso(item.estimatedCentavos)} you set aside. Change the amount if it cost more or less.
        </p>
        <AmountInput value={amount} onChange={(v) => { setAmount(v); setError('') }} autoFocus />
        {spending.length > 1 && (
          <div className="mt-4">
            <p className={label}>Paid from</p>
            <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Paid from">
              {spending.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={walletId === w.id}
                  onClick={() => setWalletId(w.id)}
                  className={`min-h-11 rounded-full px-5 font-extrabold ${walletId === w.id ? 'bg-ink text-card' : 'bg-pebble hover:bg-pebble-2'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <ErrorLine text={error} />
        <div className="mt-5 flex">
          <button type="submit" disabled={busy} className={mainButton}>Mark paid</button>
        </div>
      </form>
    </Modal>
  )
}
