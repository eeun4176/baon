/*
 * QuickAdd.tsx — Add (or edit) an entry: the most important flow (plan §4.2).
 *   Phone (design p8): full-screen sheet sliding up — big keypad, category chips, Save.
 *   Desktop (design p23): centered dialog over the dimmed page — type the amount,
 *   "Enter to save · Esc to close", Cancel + Add.
 * Opened from anywhere with the URL "?add=1" (and "&edit=<id>" to fix an entry),
 * so the phone's Back button closes it. Uses the native <dialog> element, which
 * traps focus and handles Esc for keyboard and screen-reader users.
 */
import { useEffect, useRef, useState } from 'react'
import { addDays, manilaDate } from '../budget/days.ts'
import type { Transaction } from '../ledger/ledger.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon, Segmented } from '../ui/kit.tsx'
import { byMostUsed, categoryLabel, lastUsedWalletId } from './categories.ts'
import { acceptTyped, centavosToText, displayAmount, pressKey, type Key } from './keypad.ts'

type Mode = 'expense' | 'income' | 'transfer' | 'save'

const MODES = [
  ['expense', 'Expense'],
  ['income', 'Allowance'],
  ['transfer', 'Move'],
  ['save', 'Save'],
] as const

const COPY: Record<Mode, { question: string; action: string }> = {
  expense: { question: 'How much did you spend?', action: 'Save expense' },
  income: { question: 'How much came in?', action: 'Add allowance' },
  transfer: { question: 'How much are you moving?', action: 'Move money' },
  save: { question: 'How much are you saving?', action: 'Save to savings' },
}

const KEYS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']
const shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Today", "Yesterday" or "Mon, Nov 9" for the date chip. */
function dateLabel(day: string, today: string): string {
  if (day === today) return 'Today'
  if (day === addDays(today, -1)) return 'Yesterday'
  return shortDate.format(new Date(`${day}T00:00:00Z`))
}

/** Add/edit dialog. `editId` pre-fills an existing entry; `onClose` removes "?add" from the URL. */
export function QuickAdd({ editId, onClose }: { editId: string | null; onClose: () => void }) {
  const { wallets, transactions, addTransaction, removeTransaction, showToast } = useSession()
  const today = manilaDate()
  const editing = transactions.find((t) => t.id === editId)

  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const savings = wallets.find((w) => w.type === 'savings')
  const categories = byMostUsed(transactions)

  const [mode, setMode] = useState<Mode>(() => (editing && editing.kind !== 'refund' && editing.kind !== 'withdraw' ? editing.kind : 'expense'))
  const [amount, setAmount] = useState(() => (editing ? centavosToText(editing.amountCentavos) : ''))
  const [categoryId, setCategoryId] = useState(() => editing?.categoryId ?? categories[0].id)
  const [showMore, setShowMore] = useState(() => !!editing?.categoryId && !categories.slice(0, 5).some((c) => c.id === editing.categoryId))
  const [walletId, setWalletId] = useState(() => editing?.walletId ?? lastUsedWalletId(transactions, spending[0]?.id ?? 'cash'))
  const [toWalletId, setToWalletId] = useState(() => editing?.toWalletId ?? spending.find((w) => w.id !== walletId)?.id ?? '')
  const [day, setDay] = useState(() => (editing ? manilaDate(editing.occurredAt) : today))
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const dateInput = useRef<HTMLInputElement>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const amountInput = useRef<HTMLInputElement>(null)

  const copy = COPY[mode]
  const to = mode === 'save' ? savings : spending.find((w) => w.id === toWalletId)
  const isMove = mode === 'transfer' || mode === 'save'

  // Open as a modal as soon as it mounts (page behind becomes inert). showModal() focuses
  // the first button (Close), so on desktop move focus to the amount box — otherwise
  // typing and Enter would go to Close instead of the amount and Save.
  useEffect(() => {
    dialog.current?.showModal()
    if (window.matchMedia('(min-width: 768px)').matches) amountInput.current?.focus()
  }, [])

  /** Applies a keypad press and clears any old error. */
  function press(key: Key) {
    setError('')
    setAmount((a) => pressKey(a, key))
  }

  /** Builds, saves and confirms the entry, then closes with Undo. */
  async function save() {
    const centavos = parsePeso(amount)
    if (!centavos) return setError('Enter an amount first.')
    if (mode === 'transfer' && spending.length < 2) return setError('Add another wallet in Me to move money between wallets.')

    const keepTime = editing && manilaDate(editing.occurredAt) === day
    const tx: Transaction = {
      id: editing?.id ?? crypto.randomUUID(),
      kind: mode,
      amountCentavos: centavos,
      walletId,
      ...(isMove ? { toWalletId: to?.id } : {}),
      ...(mode === 'expense' ? { categoryId } : {}),
      occurredAt: keepTime ? editing.occurredAt : day === today ? new Date().toISOString() : `${day}T12:00:00+08:00`,
      ...(note.trim() ? { note: note.trim() } : {}),
    }

    setBusy(true)
    try {
      await addTransaction(tx)
    } catch (e) {
      setBusy(false)
      return setError(e instanceof Error ? e.message : 'Couldn’t save. Try again.')
    }
    const money = formatPeso(centavos)
    const from = wallets.find((w) => w.id === walletId)?.name
    const message = editing
      ? 'Changes saved'
      : {
          expense: `Saved ${money} · ${note.trim() || categoryLabel(categoryId)}`,
          income: `Added ${money} to ${from}`,
          transfer: `Moved ${money} · ${from} → ${to?.name}`,
          save: `Saved ${money} to Savings`,
        }[mode]
    const undo = editing ? () => addTransaction(editing) : () => removeTransaction(tx.id)
    onClose()
    showToast({ message, undo })
  }

  /** Deletes the entry being edited, with Undo. */
  async function remove() {
    if (!editing) return
    await removeTransaction(editing.id)
    onClose()
    showToast({ message: 'Entry deleted', undo: () => addTransaction(editing) })
  }

  // Phone keypad also works with a hardware keyboard; desktop types into the amount box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        return saveButton.current?.click()
      }
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[0-9.]$/.test(e.key)) press(e.key as Key)
      else if (e.key === 'Backspace') press('back')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const chip = 'flex min-h-11 items-center gap-1.5 rounded-full bg-pebble px-4 font-extrabold hover:bg-pebble-2'

  return (
    <dialog
      ref={dialog}
      aria-label={editing ? 'Edit entry' : 'Add'}
      onCancel={(e) => { e.preventDefault(); onClose() }} // Esc
      onClick={(e) => e.target === dialog.current && onClose()} // click on the dimmed backdrop (desktop)
      className="m-0 h-dvh max-h-none w-full max-w-none animate-sheet overflow-y-auto border-0 bg-page p-0 text-ink md:m-auto md:h-fit md:max-h-[calc(100dvh-2rem)] md:max-w-xl md:animate-dialog md:rounded-[32px] md:bg-card md:shadow-2xl"
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] md:max-w-none md:p-6">
        {/* Title row: centered "Add" + Close pill (phone) / left "Add" + round × (desktop) */}
        <div className="relative flex min-h-12 items-center justify-center md:justify-start">
          <h2 className="text-xl font-black md:text-2xl">{editing ? 'Edit entry' : 'Add'}</h2>
          <button type="button" onClick={onClose} className="absolute right-0 min-h-11 rounded-full bg-card px-5 font-black md:hidden">
            Close
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-0 hidden size-11 place-items-center rounded-full bg-pebble hover:bg-pebble-2 md:grid">
            <Icon name="x" className="size-5" />
          </button>
        </div>

        <Segmented options={MODES} value={mode} onChange={(m) => { setMode(m); setError('') }} label="What are you adding?" className="mt-3" />

        {/* Amount */}
        <section className="mt-3 rounded-[28px] bg-card px-4 py-5 text-center md:bg-page md:px-5 md:text-left">
          <p className="font-extrabold text-muted">{copy.question}</p>
          {/* Phone: shows what the keypad typed */}
          <p className="mt-1 text-[clamp(3rem,16vw,4.5rem)] leading-tight font-black md:hidden" aria-live="polite">
            <span className="text-[0.55em] text-muted">₱</span>
            <span className={amount ? '' : 'text-pebble-2'}>{displayAmount(amount)}</span>
          </p>
          {/* Desktop: type the amount directly */}
          <label className="mt-1 hidden items-baseline gap-1 md:flex">
            <span className="text-3xl font-black text-muted" aria-hidden="true">₱</span>
            <span className="sr-only">Amount in pesos</span>
            <input
              ref={amountInput}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => { const t = acceptTyped(e.target.value); if (t !== null) { setAmount(t); setError('') } }}
              className="w-full bg-transparent text-6xl leading-tight font-black outline-none placeholder:text-pebble-2"
            />
          </label>
        </section>

        {/* Category (expenses) */}
        {mode === 'expense' && (
          <fieldset className="mt-3">
            <legend className="mb-2 hidden text-sm font-extrabold text-muted md:block">Category</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
              {(showMore ? categories : categories.slice(0, 5)).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-full border-2 font-extrabold md:rounded-2xl ${
                    categoryId === c.id
                      ? 'border-ink bg-ink text-card md:border-blue md:bg-blue-tint md:text-blue'
                      : 'border-transparent bg-pebble-2 md:bg-pebble md:hover:bg-pebble-2'
                  }`}
                >
                  <Icon name={c.icon} className="hidden size-5 md:block" />
                  {c.label}
                </button>
              ))}
              {!showMore && (
                <button type="button" onClick={() => setShowMore(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-transparent bg-pebble-2 font-extrabold md:rounded-2xl md:bg-pebble">
                  <Icon name="dots" className="hidden size-5 md:block" />
                  More
                </button>
              )}
            </div>
          </fieldset>
        )}

        {/* Wallet(s), date, note */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Segmented
            options={spending.map((w) => [w.id, w.name] as const)}
            value={walletId}
            onChange={(id) => { setWalletId(id); if (id === toWalletId) setToWalletId(walletId) }}
            label={isMove ? 'From' : 'Wallet'}
          />
          {isMove && (
            <>
              <Icon name="arrow" className="size-5 text-muted" />
              {mode === 'save' ? (
                <span className={chip}>Savings</span>
              ) : (
                <Segmented
                  options={spending.filter((w) => w.id !== walletId).map((w) => [w.id, w.name] as const)}
                  value={toWalletId}
                  onChange={setToWalletId}
                  label="To"
                />
              )}
            </>
          )}
          <button type="button" className={chip} onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.focus()}>
            <Icon name="calendar" className="size-4" />
            {dateLabel(day, today)}
          </button>
          <input ref={dateInput} type="date" aria-label="Date" className="sr-only" max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <input
            maxLength={200}
            placeholder="Add a note (optional)"
            aria-label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-11 min-w-40 flex-1 rounded-full bg-pebble px-4 font-bold outline-blue placeholder:text-muted"
          />
        </div>

        {/* Phone keypad */}
        <div className="mt-3 grid flex-1 grid-cols-3 content-end gap-2 md:hidden">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              aria-label={k === 'back' ? 'Delete' : k === '.' ? 'Decimal point' : k}
              className="grid h-[clamp(3rem,7dvh,4rem)] place-items-center rounded-[20px] bg-card text-[1.625rem] font-black active:bg-pebble"
            >
              {k === 'back' ? <Icon name="backspace" className="size-7" /> : k}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-3 animate-rise rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}

        <div className="mt-3 flex gap-2 md:mt-5">
          {editing && (
            <button type="button" onClick={remove} className="flex min-h-14 items-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
              <Icon name="trash" className="size-5" />
              <span className="sr-only md:not-sr-only">Delete</span>
            </button>
          )}
          {!editing && (
            <button type="button" onClick={onClose} className="hidden min-h-14 flex-1 rounded-full bg-pebble text-lg font-black hover:bg-pebble-2 md:block">
              Cancel
            </button>
          )}
          <button ref={saveButton} type="button" onClick={save} disabled={busy} className="min-h-14 flex-[2] rounded-full bg-blue text-lg font-black text-white hover:shadow-[0_10px_24px_-8px_rgba(30,94,255,0.6)] disabled:opacity-40">
            {busy ? 'Saving…' : editing ? 'Save changes' : copy.action}
          </button>
        </div>
        <p className="mt-3 hidden text-center text-sm font-semibold text-muted md:block">Tip: press Enter to save · Esc to close</p>
      </div>
    </dialog>
  )
}
