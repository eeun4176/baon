/*
 * QuickAdd.tsx — The most important flow (plan §4.2, design "Quick add"):
 *   amount on a big keypad → pick a category → Save, with Undo afterwards.
 * Tabs: Expense · Allowance (income) · Move (between spending wallets) · Save (to savings).
 * Defaults are today, the last-used wallet and no note — all optional to change.
 * Desktop: works with the physical keyboard too (digits, ".", Backspace, Enter).
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { addDays, manilaDate } from '../budget/days.ts'
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { byMostUsed, categoryLabel, lastUsedWalletId } from './categories.ts'
import { displayAmount, pressKey, type Key } from './keypad.ts'

type Mode = 'expense' | 'income' | 'transfer' | 'save'

const MODES: { id: Mode; tab: string; question: string; action: string }[] = [
  { id: 'expense', tab: 'Expense', question: 'How much did you spend?', action: 'Save expense' },
  { id: 'income', tab: 'Allowance', question: 'How much did you get?', action: 'Save allowance' },
  { id: 'transfer', tab: 'Move', question: 'How much are you moving?', action: 'Move money' },
  { id: 'save', tab: 'Save', question: 'How much are you saving?', action: 'Save to savings' },
]

const KEYS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']
const shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Today", "Yesterday" or "Mon, Nov 9" for the date chip. */
function dateLabel(day: string, today: string): string {
  if (day === today) return 'Today'
  if (day === addDays(today, -1)) return 'Yesterday'
  return shortDate.format(new Date(`${day}T00:00:00Z`))
}

/** Next item in a list, wrapping around (tapping a wallet chip cycles through wallets). */
function next<T extends { id: string }>(list: T[], currentId: string): T | undefined {
  return list[(list.findIndex((x) => x.id === currentId) + 1) % list.length]
}

/** Quick Add screen. */
export function QuickAdd() {
  const { wallets, transactions, addTransaction, removeTransaction, showToast } = useSession()
  const navigate = useNavigate()
  const today = manilaDate()

  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const savings = wallets.find((w) => w.type === 'savings')
  const categories = byMostUsed(transactions)

  const [mode, setMode] = useState<Mode>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0].id)
  const [showMore, setShowMore] = useState(false)
  const [walletId, setWalletId] = useState(() => lastUsedWalletId(transactions, spending[0]?.id ?? 'cash'))
  const [toWalletId, setToWalletId] = useState(() => spending.find((w) => w.id !== walletId)?.id ?? '')
  const [day, setDay] = useState(today)
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dateInput = useRef<HTMLInputElement>(null)

  const current = MODES.find((m) => m.id === mode)!
  const from = spending.find((w) => w.id === walletId) ?? spending[0]
  const to: Wallet | undefined = mode === 'save' ? savings : spending.find((w) => w.id === toWalletId)
  const canMove = spending.length > 1

  /** Applies a keypad press and clears any old error. */
  function press(key: Key) {
    setError('')
    setAmount((a) => pressKey(a, key))
  }

  /** Builds, saves and confirms the transaction, then returns Home with Undo. */
  async function save() {
    const centavos = parsePeso(amount)
    if (!centavos) return setError('Enter an amount first.')
    if (mode === 'transfer' && !canMove) return setError('Add another wallet in Me to move money between wallets.')

    const tx: Transaction = {
      id: crypto.randomUUID(),
      kind: mode,
      amountCentavos: centavos,
      walletId: from.id,
      ...(mode === 'transfer' || mode === 'save' ? { toWalletId: to?.id } : {}),
      ...(mode === 'expense' ? { categoryId } : {}),
      occurredAt: day === today ? new Date().toISOString() : `${day}T12:00:00+08:00`,
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
    const message = {
      expense: `Saved ${money} · ${note.trim() || categoryLabel(categoryId)}`,
      income: `Added ${money} to ${from.name}`,
      transfer: `Moved ${money} · ${from.name} → ${to?.name}`,
      save: `Saved ${money} to Savings`,
    }[mode]
    showToast({ message, undo: () => removeTransaction(tx.id) })
    navigate('/')
  }

  // Desktop: physical keyboard works like the keypad (ignored while typing a note).
  const saveButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[0-9.]$/.test(e.key)) press(e.key as Key)
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Enter') saveButton.current?.click()
      else if (e.key === 'Escape') navigate('/')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const chip = 'flex min-h-10 items-center gap-1.5 rounded-full bg-pebble px-4 font-extrabold'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] md:min-h-0 md:py-8">
      <div className="relative flex min-h-12 items-center justify-center">
        <h1 className="text-xl font-black">Add</h1>
        <button type="button" onClick={() => navigate('/')} className="absolute right-0 min-h-11 rounded-full bg-card px-5 font-black">
          Close
        </button>
      </div>

      {/* Expense · Allowance · Move · Save */}
      <div role="tablist" aria-label="What are you adding?" className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-pebble-2 p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            type="button"
            aria-selected={mode === m.id}
            onClick={() => { setMode(m.id); setError('') }}
            className={`min-h-11 rounded-full text-[15px] font-extrabold ${mode === m.id ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}
          >
            {m.tab}
          </button>
        ))}
      </div>

      {/* Amount + wallet / date / note chips */}
      <section className="mt-3 rounded-[28px] bg-card px-4 py-5 text-center">
        <p className="font-extrabold text-muted">{current.question}</p>
        <p className="mt-1 text-[clamp(3rem,16vw,4.5rem)] leading-tight font-black" aria-live="polite">
          <span className="text-[0.55em] text-muted">₱</span>
          <span className={amount ? '' : 'text-pebble-2'}>{displayAmount(amount)}</span>
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className={chip}
            aria-label={`${mode === 'transfer' || mode === 'save' ? 'From' : 'Wallet'}: ${from?.name}. Tap to change.`}
            onClick={() => {
              const n = next(spending, walletId)
              if (n) setWalletId(n.id)
              if (n && n.id === toWalletId) setToWalletId(walletId)
            }}
          >
            {from?.name}
          </button>
          {(mode === 'transfer' || mode === 'save') && (
            <>
              <Icon name="arrow" className="size-5 text-muted" />
              <button
                type="button"
                className={chip}
                disabled={mode === 'save' || !canMove}
                aria-label={`To: ${to?.name ?? 'no other wallet'}${mode === 'transfer' ? '. Tap to change.' : ''}`}
                onClick={() => {
                  const n = next(spending.filter((w) => w.id !== walletId), toWalletId)
                  if (n) setToWalletId(n.id)
                }}
              >
                {to?.name ?? '—'}
              </button>
            </>
          )}
          <button type="button" className={chip} onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.focus()}>
            {dateLabel(day, today)}
          </button>
          <input
            ref={dateInput}
            type="date"
            aria-label="Date"
            className="sr-only"
            max={today}
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
          {!noteOpen && (
            <button type="button" className={`${chip} text-muted`} onClick={() => setNoteOpen(true)}>
              + Note
            </button>
          )}
        </div>
        {noteOpen && (
          <input
            autoFocus
            maxLength={200}
            placeholder="e.g. Jeep to school"
            aria-label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-3 min-h-11 w-full rounded-full bg-pebble px-4 text-center font-bold outline-blue"
          />
        )}
      </section>

      {/* Categories: 5 most used + More (expenses only) */}
      {mode === 'expense' && (
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
          {(showMore ? categories : categories.slice(0, 5)).map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              className={`min-h-12 rounded-full font-extrabold ${categoryId === c.id ? 'bg-ink text-white' : 'bg-pebble-2'}`}
            >
              {c.label}
            </button>
          ))}
          {!showMore && (
            <button type="button" onClick={() => setShowMore(true)} className="min-h-12 rounded-full bg-pebble-2 font-extrabold">
              More
            </button>
          )}
        </div>
      )}

      {/* Keypad */}
      <div className="mt-3 grid flex-1 grid-cols-3 content-end gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === 'back' ? 'Delete' : k === '.' ? 'Decimal point' : k}
            className="grid h-[clamp(3rem,7dvh,4rem)] place-items-center rounded-[20px] bg-card text-[26px] font-black active:bg-pebble"
          >
            {k === 'back' ? <Icon name="backspace" className="size-7" /> : k}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
      <button
        ref={saveButton}
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-3 min-h-14 rounded-full bg-blue text-lg font-black text-white disabled:opacity-40"
      >
        {busy ? 'Saving…' : current.action}
      </button>
    </main>
  )
}
