/*
 * QuickAdd.tsx — Add (or edit) an entry: the most important flow.
 *   Phone: full-screen sheet sliding up — big keypad, category chips, Save.
 *   Desktop: centered dialog over the dimmed page — type the amount,
 *   "Enter to save · Esc to close", Cancel + Add.
 * Money in has a source (allowance, scholarship, salary…); anything but the allowance can be made
 * to "last until" a date. Taking out more than a wallet holds offers two choices: add the
 * missing money as money in first (the usual cause is money in that was never logged), or save anyway.
 * Utang entries are added on Plan; here they can only be fixed (amount, wallet, date, note).
 * Opened from anywhere with the URL "?add=1" (and "&edit=<id>" to fix an entry),
 * so the phone's Back button closes it. Uses the native <dialog> element, which
 * traps focus and handles Esc for keyboard and screen-reader users.
 */
import { useEffect, useRef, useState } from 'react'
import { afterAllowanceLogged } from '../budget/allowance.ts'
import { spentThisCycle } from '../plan/limits.ts'
import { addDays, manilaDate } from '../budget/days.ts'
import { balances, SOURCE_LABEL, SOURCES, UTANG_KINDS, type Source, type Transaction } from '../ledger/ledger.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon, Segmented, Switch } from '../ui/kit.tsx'
import { byMostUsed, categoryLabel, lastUsedWalletId } from './categories.ts'
import { acceptTyped, centavosToText, displayAmount, pressKey, type Key } from './keypad.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

type Mode = 'expense' | 'income' | 'transfer' | 'save'

const MODES = [
  ['expense', tr('Expense')],
  ['income', tr('Money in')],
  ['transfer', tr('Move')],
  ['save', tr('Save|savings tab')],
] as const

const COPY: Record<Mode, { question: string; action: string }> = {
  expense: { question: tr('How much did you spend?'), action: tr('Save expense') },
  income: { question: tr('How much came in?'), action: tr('Add money') },
  transfer: { question: tr('How much are you moving?'), action: tr('Move money') },
  save: { question: tr('How much are you saving?'), action: tr('Save to savings') },
}

const KEYS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']
const shortDate = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })

/** "Borrowed from Mia", "Lent to Carlo"… the line shown instead of the tabs when fixing an utang entry. */
function describeUtang(kind: Transaction['kind'], person: string): string {
  if (kind === 'borrow') return tr('Borrowed from {0}', person)
  if (kind === 'repay') return tr('Paid back to {0}', person)
  if (kind === 'lend') return tr('Lent to {0}', person)
  return tr('{0} paid you back', person)
}

/** "Today", "Yesterday" or "Mon, Nov 9" for the date chip. */
function dateLabel(day: string, today: string): string {
  if (day === today) return tr('Today')
  if (day === addDays(today, -1)) return tr('Yesterday')
  return shortDate.format(new Date(`${day}T00:00:00Z`))
}

/** Add/edit dialog. `editId` pre-fills an existing entry; `startMode` ("?mode=transfer") picks the tab; `onClose` removes "?add" from the URL. */
export function QuickAdd({ editId, startMode, onClose }: { editId: string | null; startMode?: string | null; onClose: () => void }) {
  const { wallets, transactions, allowance, limits, addTransaction, removeTransaction, updateAllowance, showToast } = useSession()
  const today = manilaDate()
  const editing = transactions.find((t) => t.id === editId)
  // Fixing an utang entry: it stays the same kind, with the same person and link.
  const utang = editing && UTANG_KINDS.has(editing.kind) ? editing : null

  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const savings = wallets.find((w) => w.type === 'savings')
  const categories = byMostUsed(transactions)

  const [mode, setMode] = useState<Mode>(() => {
    if (editing) return (MODES.some(([m]) => m === editing.kind) ? editing.kind : 'expense') as Mode
    return MODES.find(([m]) => m === startMode)?.[0] ?? 'expense'
  })
  const [amount, setAmount] = useState(() => (editing ? centavosToText(editing.amountCentavos) : ''))
  const [categoryId, setCategoryId] = useState(() => editing?.categoryId ?? categories[0].id)
  const [showMore, setShowMore] = useState(() => !!editing?.categoryId && !categories.slice(0, 5).some((c) => c.id === editing.categoryId))
  const [walletId, setWalletId] = useState(() => editing?.walletId ?? lastUsedWalletId(transactions, spending[0]?.id ?? 'cash'))
  const [toWalletId, setToWalletId] = useState(() => editing?.toWalletId ?? spending.find((w) => w.id !== walletId)?.id ?? '')
  const [day, setDay] = useState(() => (editing ? manilaDate(editing.occurredAt) : today))
  const [note, setNote] = useState(editing?.note ?? '')
  const [source, setSource] = useState<Source>(editing?.source ?? 'allowance')
  const [spread, setSpread] = useState(!!editing?.spreadUntil)
  const [until, setUntil] = useState(() => editing?.spreadUntil ?? addDays(today, 29))
  // Taking out more than the wallet holds: what it has now and how much is missing (shows two choices).
  const [short, setShort] = useState<{ has: number; missing: number; name: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const dateInput = useRef<HTMLInputElement>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const amountInput = useRef<HTMLInputElement>(null)

  const copy = utang ? { question: tr('How much?'), action: tr('Save changes') } : COPY[mode]
  // Category limit for this allowance cycle: what's left after this entry (if the category has one).
  const limit = mode === 'expense' && !utang ? limits[categoryId] : undefined
  const limitLeft = limit ? limit - (spentThisCycle(transactions, editing?.id).get(categoryId) ?? 0) - (parsePeso(amount) ?? 0) : 0
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
    setShort(null)
    setAmount((a) => pressKey(a, key))
  }

  /**
   * Builds, saves and confirms the entry, then closes with Undo.
   * `how`: 'check' stops at the two choices if the wallet is short; 'anyway' saves as it is;
   * 'topUp' first logs the missing money as money in (source Other), so the wallet ends at ₱0.
   */
  async function save(how: 'check' | 'anyway' | 'topUp' = 'check') {
    const centavos = parsePeso(amount)
    if (!centavos) return setError(tr('Enter an amount first.'))
    if (mode === 'transfer' && spending.length < 2) return setError(tr('Add another wallet in Me to move money between wallets.'))

    const keepTime = editing && manilaDate(editing.occurredAt) === day
    const occurredAt = keepTime ? editing.occurredAt : day === today ? new Date().toISOString() : `${day}T12:00:00+08:00`
    const keepNote = note.trim() ? { note: note.trim() } : {}
    const tx: Transaction = utang
      ? // Utang: same kind, person, due date and link; only amount, wallet, date and note change.
        { id: utang.id, kind: utang.kind, amountCentavos: centavos, walletId, occurredAt, person: utang.person, ...keepNote,
          ...(utang.dueDate ? { dueDate: utang.dueDate } : {}), ...(utang.linkedId ? { linkedId: utang.linkedId } : {}) }
      : {
          id: editing?.id ?? crypto.randomUUID(),
          kind: mode,
          amountCentavos: centavos,
          walletId,
          ...(isMove ? { toWalletId: to?.id } : {}),
          ...(mode === 'expense' ? { categoryId } : {}),
          // Keep the link to a paid school expense, or editing would put it back to "Set aside".
          ...(mode === 'expense' && editing?.linkedId ? { linkedId: editing.linkedId } : {}),
          ...(mode === 'income' ? { source } : {}),
          ...(mode === 'income' && source !== 'allowance' && spread ? { spreadUntil: until } : {}),
          occurredAt,
          ...keepNote,
        }

    // Taking out more than the wallet holds: stop and offer two choices (see the panel below).
    const takesOut = tx.kind === 'expense' || tx.kind === 'transfer' || tx.kind === 'save' || tx.kind === 'repay' || tx.kind === 'lend'
    const has = balances(wallets, transactions.filter((t) => t.id !== editing?.id)).get(walletId) ?? 0
    const from = wallets.find((w) => w.id === walletId)?.name ?? tr('This wallet')
    if (how === 'check' && takesOut && centavos > has) return setShort({ has, missing: centavos - has, name: from })

    // "Add the missing money in": brings the wallet to exactly ₱0 after this entry (also fixes one already below zero).
    const topUp: Transaction | null = how === 'topUp' && short
      ? { id: crypto.randomUUID(), kind: 'income', source: 'other', amountCentavos: short.missing, walletId, occurredAt, note: tr('Not logged before') }
      : null

    // Logging the allowance here answers "Did your baon arrive?" when Baon is asking or waiting.
    const moved = tx.kind === 'income' && source === 'allowance' && !editing ? afterAllowanceLogged(allowance, today) : null
    setBusy(true)
    try {
      if (topUp) await addTransaction(topUp)
      try {
        await addTransaction(tx)
      } catch (e) {
        if (topUp) await removeTransaction(topUp.id) // never leave the money in without the entry it was for
        throw e
      }
      if (moved) await updateAllowance(moved)
    } catch (e) {
      setBusy(false)
      return setError(e instanceof Error ? e.message : tr('Couldn’t save. Try again.'))
    }
    const money = formatPeso(centavos)
    const saved = editing
      ? tr('Changes saved')
      : {
          expense: tr('Saved {0} · {1}', money, note.trim() || categoryLabel(categoryId)),
          income: tr('Added {0} to {1}', money, from),
          transfer: tr('Moved {0} · {1} → {2}', money, from, to?.name),
          save: tr('Saved {0} to Savings', money),
        }[mode]
    const message = topUp ? `${tr('Added {0} to {1}', formatPeso(topUp.amountCentavos), from)} · ${saved}` : saved
    // One Undo takes back everything this save did (the entry, the added money in, the allowance date).
    const undo = async () => {
      if (editing) await addTransaction(editing)
      else await removeTransaction(tx.id)
      if (topUp) await removeTransaction(topUp.id)
      if (moved) await updateAllowance(allowance)
    }
    onClose()
    showToast({ message, undo })
  }

  /** Deletes the entry being edited, with Undo. */
  async function remove() {
    if (!editing) return
    // An utang with payments: those would point at nothing, so they go first (from History).
    if (transactions.some((t) => t.linkedId === editing.id && (t.kind === 'repay' || t.kind === 'collect'))) return setError(tr('Delete the payments for this utang first.'))
    await removeTransaction(editing.id)
    onClose()
    showToast({ message: tr('Entry deleted'), undo: () => addTransaction(editing) })
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
      aria-label={editing ? tr('Edit entry') : tr('Add')}
      onCancel={(e) => { e.preventDefault(); onClose() }} // Esc
      onClick={(e) => e.target === dialog.current && onClose()} // click on the dimmed backdrop (desktop)
      className="m-0 h-dvh max-h-none w-full max-w-none animate-sheet overflow-y-auto border-0 bg-page p-0 text-ink md:m-auto md:h-fit md:max-h-[calc(100dvh-2rem)] md:max-w-xl md:animate-dialog md:rounded-[32px] md:bg-card md:shadow-2xl"
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] md:max-w-none md:p-6">
        {/* Title row: centered "Add" + Close pill (phone) / left "Add" + round × (desktop) */}
        <div className="relative flex min-h-12 items-center justify-center md:justify-start">
          <h2 className="text-xl font-black md:text-2xl">{editing ? tr('Edit entry') : tr('Add')}</h2>
          <button type="button" onClick={onClose} className="absolute right-0 min-h-11 rounded-full bg-card px-5 font-black md:hidden">
            {tr('Close')}</button>
          <button type="button" onClick={onClose} aria-label={tr('Close')} className="absolute right-0 hidden size-11 place-items-center rounded-full bg-pebble hover:bg-pebble-2 md:grid">
            <Icon name="x" className="size-5" />
          </button>
        </div>

        {utang
          ? <p className="mt-3 text-center font-extrabold text-muted md:text-left">{describeUtang(utang.kind, utang.person ?? '')}</p>
          : <Segmented options={MODES} value={mode} onChange={(m) => { setMode(m); setError(''); setShort(null) }} label={tr('What are you adding?')} className="mt-3" />}

        {/* Amount */}
        <section className="mt-3 rounded-3xl bg-card px-4 py-5 sm:rounded-[28px] text-center md:bg-page md:px-5 md:text-left">
          <p className="font-extrabold text-muted">{copy.question}</p>
          {/* Phone: shows what the keypad typed */}
          <p className="mt-1 text-[clamp(3rem,16vw,4.5rem)] leading-tight font-black md:hidden" aria-live="polite">
            <span className="text-[0.55em] text-muted">₱</span>
            <span className={amount ? '' : 'text-pebble-2'}>{displayAmount(amount)}</span>
          </p>
          {/* Desktop: type the amount directly */}
          <label className="mt-1 hidden items-baseline gap-1 md:flex">
            <span className="text-3xl font-black text-muted" aria-hidden="true">₱</span>
            <span className="sr-only">{tr('Amount in pesos')}</span>
            <input
              ref={amountInput}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => { const t = acceptTyped(e.target.value); if (t !== null) { setAmount(t); setError(''); setShort(null) } }}
              className="w-full bg-transparent text-6xl leading-tight font-black outline-none placeholder:text-pebble-2"
            />
          </label>
        </section>

        {/* Source (money in) and "make it last until" for anything but the allowance */}
        {mode === 'income' && !utang && (
          <fieldset className="mt-3">
            <legend className="mb-2 text-sm font-extrabold text-muted">{tr('Where did it come from?')}</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tr('Where did it come from?')}>
              {SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={source === s}
                  onClick={() => setSource(s)}
                  className={`flex min-h-12 items-center justify-center rounded-full border-2 px-2 text-center leading-tight font-extrabold md:rounded-2xl ${
                    source === s
                      ? 'border-ink bg-ink text-card md:border-blue md:bg-blue-tint md:text-blue'
                      : 'border-transparent bg-pebble-2 md:bg-pebble md:hover:bg-pebble-2'
                  }`}
                >
                  {SOURCE_LABEL[s]}
                </button>
              ))}
            </div>
            {source !== 'allowance' && (
              <div className="mt-3 rounded-3xl bg-card p-4 md:bg-page">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black">{tr('Make it last until')}</p>
                    <p className="text-sm font-semibold text-muted">{tr('Spreads it over the coming weeks.')}</p>
                  </div>
                  <Switch label={tr('Make it last until')} checked={spread} onChange={setSpread} />
                </div>
                {spread && (
                  <input type="date" aria-label={tr('Last until')} min={day} value={until} onChange={(e) => e.target.value && setUntil(e.target.value)} className="mt-3 min-h-12 w-full rounded-2xl bg-pebble px-4 text-lg font-bold md:bg-card" />
                )}
              </div>
            )}
          </fieldset>
        )}

        {/* Category (expenses) */}
        {mode === 'expense' && !utang && (
          <fieldset className="mt-3">
            <legend className="mb-2 hidden text-sm font-extrabold text-muted md:block">{tr('Category')}</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tr('Category')}>
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
                  {tr('More')}</button>
              )}
            </div>
            {limit && (
              <p aria-live="polite" className="mt-2 text-sm font-bold text-muted">
                {categoryLabel(categoryId)}: {limitLeft >= 0 ? tr('{0} left of {1} this cycle', formatPeso(limitLeft), formatPeso(limit)) : tr('{0} over this cycle’s {1} limit', formatPeso(-limitLeft), formatPeso(limit))}
              </p>
            )}
          </fieldset>
        )}

        {/* Wallet(s), date, note */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Segmented
            options={spending.map((w) => [w.id, w.name] as const)}
            value={walletId}
            onChange={(id) => { setWalletId(id); setShort(null); if (id === toWalletId) setToWalletId(walletId) }}
            label={isMove ? tr('From') : tr('Wallet')}
          />
          {isMove && (
            <>
              <Icon name="arrow" className="size-5 text-muted" />
              {mode === 'save' ? (
                <span className={chip}>{tr('Savings')}</span>
              ) : (
                <Segmented
                  options={spending.filter((w) => w.id !== walletId).map((w) => [w.id, w.name] as const)}
                  value={toWalletId}
                  onChange={setToWalletId}
                  label={tr('To')}
                />
              )}
            </>
          )}
          <button type="button" className={chip} onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.focus()}>
            <Icon name="calendar" className="size-4" />
            {dateLabel(day, today)}
          </button>
          <input ref={dateInput} type="date" aria-label={tr('Date')} className="sr-only" max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <input
            maxLength={200}
            placeholder={tr('Add a note (optional)')}
            aria-label={tr('Note')}
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
              aria-label={k === 'back' ? tr('Delete') : k === '.' ? tr('Decimal point') : k}
              className="grid h-[clamp(3rem,7dvh,4rem)] place-items-center rounded-[20px] bg-card text-[1.625rem] font-black active:bg-pebble"
            >
              {k === 'back' ? <Icon name="backspace" className="size-7" /> : k}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-3 animate-rise rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}

        {/* Wallet short: usually money in that was never logged, so offer to add it first */}
        {short && !error && (
          <div role="alert" className="mt-3 animate-rise rounded-3xl bg-card p-4 text-center md:bg-page">
            <p className="font-bold">
              {short.has > 0
                ? tr('{0} only has {1} ({2} short).', short.name, formatPeso(short.has), formatPeso(short.missing))
                : short.has === 0 ? tr('{0} is empty.', short.name) : tr('{0} is {1} below zero.', short.name, formatPeso(-short.has))}</p>
            <button type="button" onClick={() => save('topUp')} disabled={busy} className="mt-3 min-h-12 w-full rounded-full bg-blue px-4 font-black text-white disabled:opacity-40">
              {tr('Add the missing {0} as money in, then save', formatPeso(short.missing))}</button>
            <button type="button" onClick={() => save('anyway')} disabled={busy} className="mt-2 min-h-12 w-full rounded-full bg-pebble px-4 font-black hover:bg-pebble-2 disabled:opacity-40">
              {tr('Save anyway')}</button>
          </div>
        )}

        <div className="mt-3 flex gap-2 md:mt-5">
          {editing && (
            <button type="button" onClick={remove} className="flex min-h-14 items-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
              <Icon name="trash" className="size-5" />
              <span className="sr-only md:not-sr-only">{tr('Delete')}</span>
            </button>
          )}
          {!editing && (
            <button type="button" onClick={onClose} className="hidden min-h-14 flex-1 rounded-full bg-pebble text-lg font-black hover:bg-pebble-2 md:block">
              {tr('Cancel')}</button>
          )}
          <button ref={saveButton} type="button" onClick={() => save()} disabled={busy} className="min-h-14 flex-[2] rounded-full bg-blue text-lg font-black text-white hover:shadow-[0_10px_24px_-8px_rgba(30,94,255,0.6)] disabled:opacity-40">
            {busy ? tr('Saving…') : editing ? tr('Save changes') : copy.action}
          </button>
        </div>
        <p className="mt-3 hidden text-center text-sm font-semibold text-muted md:block">{tr('Tip: press Enter to save · Esc to close')}</p>
      </div>
    </dialog>
  )
}
