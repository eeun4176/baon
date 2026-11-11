/*
 * AllowanceCheckIn.tsx — "Did your baon arrive?" (design p13, plan §4.3). Shown on Home
 * instead of the safe-to-spend hero once the next allowance date is reached:
 *   Yes, ₱1,500   logs the allowance as income and moves the next date one cycle ahead
 *   Not yet       expects it tomorrow (today's budget covers just today) and asks again then
 *   It was a different amount → pick amount, wallet and the next date
 * Plus "Left from last week ₱95" — the new daily budget starts once the baon is in.
 * Every answer can be undone.
 */
import { useState, type FormEvent } from 'react'
import { acceptTyped, centavosToText } from '../add/keypad.ts'
import { advanceNextDate, FREQUENCIES } from '../budget/allowance.ts'
import { addDays } from '../budget/days.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { BigMoney, Card } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import type { Today } from './useToday.ts'

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40'
const label = 'block font-extrabold text-muted'
// "Left from last week ₱95" (design p13), worded for each allowance frequency.
const LEFT_FROM = { daily: 'yesterday', weekly: 'last week', biweekly: 'the last 2 weeks', monthly: 'last month', irregular: 'your last baon' } as const

/** "Did your baon arrive?" card + "Left from last week". */
export function AllowanceCheckIn({ t }: { t: Today }) {
  const { allowance, wallets, transactions, addTransaction, removeTransaction, updateAllowance, showToast } = useSession()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const today = t.result.today
  const usual = allowance.amountCentavos
  const next = advanceNextDate(allowance, today)
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  // Where the last allowance went (often Cash, sometimes GCash), else Cash.
  const lastIncome = [...transactions].reverse().find((tx) => tx.kind === 'income' && spending.some((w) => w.id === tx.walletId))
  const defaultWallet = lastIncome?.walletId ?? spending.find((w) => w.id === 'cash')?.id ?? spending[0]?.id ?? 'cash'
  const frequency = FREQUENCIES.find(([id]) => id === allowance.frequency)![1]

  /** Logs the allowance and moves the next date; Undo removes both. Throws a friendly message on failure. */
  async function receive(amountCentavos: number, walletId: string, nextDate: string) {
    const before = allowance
    const id = crypto.randomUUID()
    await addTransaction({ id, kind: 'income', amountCentavos, walletId, occurredAt: new Date().toISOString(), note: 'Allowance' })
    try {
      await updateAllowance({ ...allowance, nextDate })
    } catch (e) {
      await removeTransaction(id) // never leave the money added without moving the date
      throw e
    }
    showToast({
      message: `Added ${formatPeso(amountCentavos)} to ${wallets.find((w) => w.id === walletId)?.name ?? 'your wallet'}`,
      undo: async () => {
        await removeTransaction(id)
        await updateAllowance(before)
      },
    })
  }

  /** "Yes, ₱1,500" — one tap when the amount and next date are known, else ask. */
  async function yes() {
    if (!usual || !next) return setAsking(true)
    setBusy(true)
    try {
      await receive(usual, defaultWallet, next)
    } catch {
      showToast({ message: 'Couldn’t save. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  /** "Not yet" — expect it tomorrow and ask again then. */
  async function notYet() {
    const before = allowance
    setBusy(true)
    try {
      await updateAllowance({ ...allowance, nextDate: addDays(today, 1) })
      showToast({ message: 'No problem — we’ll ask again tomorrow', undo: () => updateAllowance(before) })
    } catch {
      showToast({ message: 'Couldn’t save. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="animate-rise px-5 py-7 text-center lg:px-7 lg:text-left">
        <p className="text-sm font-extrabold tracking-[0.12em] text-blue uppercase">Allowance day</p>
        <h2 className="mt-2 text-[clamp(1.6rem,7vw,2.1rem)] leading-tight font-black">Did your baon arrive?</h2>
        <p className="mt-1 font-semibold text-muted">
          {frequency}
          {usual ? ` · usually ${formatPeso(usual)}` : ''}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:max-w-md">
          <button type="button" disabled={busy} onClick={yes} className="min-h-14 rounded-full bg-blue px-3 text-lg font-black whitespace-nowrap text-white disabled:opacity-60">
            {usual ? `Yes, ${formatPeso(usual)}` : 'Yes'}
          </button>
          <button type="button" disabled={busy} onClick={notYet} className="min-h-14 rounded-full bg-pebble px-3 text-lg font-black hover:bg-pebble-2 disabled:opacity-60">
            Not yet
          </button>
        </div>
        <button type="button" onClick={() => setAsking(true)} className="mt-3 min-h-11 font-extrabold text-blue hover:underline">
          It was a different amount
        </button>
      </Card>

      <Card className="animate-rise px-5 py-7 text-center lg:px-7 lg:text-left">
        <p className="text-[1.0625rem] font-extrabold text-muted">Left from {LEFT_FROM[allowance.frequency]}</p>
        <p className="mt-1"><BigMoney centavos={Math.max(0, t.result.readyToSpend)} className="text-[clamp(3rem,18vw,4.5rem)]" /></p>
        <p className="mx-auto mt-2 max-w-xs font-semibold text-muted lg:mx-0">Your new daily budget starts once your baon is in.</p>
      </Card>

      {asking && <ReceivedDialog today={today} defaultWallet={defaultWallet} suggestedNext={next} onReceive={receive} onClose={() => setAsking(false)} />}
    </div>
  )
}

/** "It was a different amount": amount, which wallet, and the next allowance date. */
function ReceivedDialog({ today, defaultWallet, suggestedNext, onReceive, onClose }: {
  today: string
  defaultWallet: string
  suggestedNext: string | null
  onReceive: (amount: number, walletId: string, nextDate: string) => Promise<void>
  onClose: () => void
}) {
  const { allowance, wallets } = useSession()
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const [amount, setAmount] = useState(allowance.amountCentavos ? centavosToText(allowance.amountCentavos) : '')
  const [walletId, setWalletId] = useState(defaultWallet)
  const [nextDate, setNextDate] = useState(suggestedNext ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const irregular = allowance.frequency === 'irregular'

  /** Validates, then logs it. */
  async function save(e: FormEvent) {
    e.preventDefault()
    const centavos = parsePeso(amount)
    if (!centavos) return setError('Enter how much you got.')
    if (!nextDate || nextDate <= today) return setError(irregular ? 'Pick the day this baon should last until (after today).' : 'Pick when your next baon comes (after today).')
    setBusy(true)
    try {
      await onReceive(centavos, walletId, nextDate)
      onClose()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Couldn’t save. Try again.')
    }
  }

  return (
    <Modal title="How much did you get?" onClose={onClose}>
      <form onSubmit={save} noValidate>
        <label className={label}>
          Amount
          <span className={`${field} flex items-center gap-1`}>
            <span className="text-muted" aria-hidden="true">₱</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(e) => { const v = acceptTyped(e.target.value); if (v !== null) { setAmount(v); setError('') } }}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-pebble-2"
            />
          </span>
        </label>
        {spending.length > 1 && (
          <>
            <p className={`${label} mt-4`}>Added to</p>
            <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Added to">
              {spending.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={walletId === w.id}
                  onClick={() => setWalletId(w.id)}
                  className={`min-h-11 rounded-full px-4 font-extrabold ${walletId === w.id ? 'bg-ink text-card' : 'bg-pebble hover:bg-pebble-2'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </>
        )}
        <label className={`${label} mt-4`}>
          {irregular ? 'Make it last until' : 'Next baon'}
          <input type="date" min={addDays(today, 1)} value={nextDate} onChange={(e) => { setNextDate(e.target.value); setError('') }} className={field} />
        </label>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
        <div className="mt-5 flex">
          <button type="submit" disabled={busy} className="min-h-13 flex-1 rounded-full bg-blue px-6 text-lg font-black text-white disabled:opacity-60">
            Add to my money
          </button>
        </div>
      </form>
    </Modal>
  )
}
