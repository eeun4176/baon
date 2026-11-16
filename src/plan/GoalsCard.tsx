/*
 * GoalsCard.tsx — Plan's "Savings goals": each Savings wallet with its goal (what for, how much, by when).
 *   With a goal: a bar of the wallet's balance toward it, and "₱450 a week to reach it by Mar 1".
 *   Without: "Set a goal". GoalDialog sets, changes or removes it (stored on the wallet, so it syncs).
 * Saving money in is still Add → Save; the goal only reads the balance.
 */
import { useState, type FormEvent } from 'react'
import { centavosToText } from '../add/keypad.ts'
import { manilaDate } from '../budget/days.ts'
import { balances, type Wallet } from '../ledger/ledger.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { goalProgress } from './goals.ts'
import { AmountInput, ErrorLine } from './PlanDialogs.tsx'
import { LOCALE, tr } from '../i18n/i18n.ts'

const byDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40'

/** The wallet with its goal fields taken off. */
function withoutGoal(wallet: Wallet): Wallet {
  const copy = { ...wallet }
  delete copy.goalName
  delete copy.goalCentavos
  delete copy.goalDate
  return copy
}

/** Set, change or remove a Savings wallet's goal. */
function GoalDialog({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const { saveWallet, showToast } = useSession()
  const [name, setName] = useState(wallet.goalName ?? '')
  const [amount, setAmount] = useState(wallet.goalCentavos ? centavosToText(wallet.goalCentavos) : '')
  const [date, setDate] = useState(wallet.goalDate ?? '')
  const [error, setError] = useState('')
  const today = manilaDate()

  /** Saves the goal on the wallet, with Undo. */
  async function save(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    const centavos = parsePeso(amount)
    if (!clean) return setError(tr('What are you saving for? e.g. Laptop'))
    if (!centavos) return setError(tr('Enter how much you want to save.'))
    if (date && date <= today) return setError(tr('Pick a date after today, or leave it empty.'))
    await saveWallet({ ...withoutGoal(wallet), goalName: clean.slice(0, 40), goalCentavos: centavos, ...(date ? { goalDate: date } : {}) })
    onClose()
    showToast({ message: tr('Goal saved · {0} {1}', clean, formatPeso(centavos)), undo: () => saveWallet(wallet) })
  }

  /** Removes the goal (the money stays in the wallet), with Undo. */
  async function remove() {
    await saveWallet(withoutGoal(wallet))
    onClose()
    showToast({ message: tr('Goal removed. Your savings stay.'), undo: () => saveWallet(wallet) })
  }

  return (
    <Modal title={wallet.goalCentavos ? tr('Edit goal') : tr('Set a savings goal')} onClose={onClose}>
      <form onSubmit={save} noValidate className="space-y-4">
        <label className="block font-extrabold text-muted">
          {tr('Saving for')}<input value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setError('') }} placeholder={tr('e.g. Laptop')} className={`${field} placeholder:text-muted/60`} />
        </label>
        <AmountInput value={amount} onChange={(v) => { setAmount(v); setError('') }} />
        <label className="block font-extrabold text-muted">
          {tr('By when? (optional)')}<input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <ErrorLine text={error} />
        <div className="flex gap-2.5">
          {wallet.goalCentavos && (
            <button type="button" onClick={remove} aria-label={tr('Remove goal')} className="grid min-h-13 place-items-center rounded-full bg-pebble px-4 hover:bg-pebble-2">
              <Icon name="trash" className="size-5" /></button>
          )}
          <button type="submit" className="min-h-13 flex-1 rounded-full bg-blue px-6 text-lg font-black text-white">{tr('Save goal')}</button>
        </div>
      </form>
    </Modal>
  )
}

/** One Savings wallet: its goal's bar and pace, or "Set a goal". */
function GoalRow({ wallet, balance, onEdit }: { wallet: Wallet; balance: number; onEdit: () => void }) {
  if (!wallet.goalCentavos) {
    return (
      <li className="flex items-center justify-between gap-3 border-t border-page pt-3">
        <span className="min-w-0">
          <span className="block truncate font-black">{wallet.name}</span>
          <span className="text-xs font-bold text-muted">{tr('{0} saved', formatPeso(balance))}</span>
        </span>
        <button type="button" onClick={onEdit} className="min-h-11 shrink-0 rounded-full bg-page px-4 text-sm font-extrabold hover:bg-pebble">{tr('Set a goal')}</button>
      </li>
    )
  }
  const p = goalProgress(balance, wallet.goalCentavos, wallet.goalDate, manilaDate())
  const by = wallet.goalDate && byDay.format(new Date(`${wallet.goalDate}T00:00:00Z`))
  const pace = p.left === 0 ? tr('Goal reached! 🎉')
    : p.late ? tr('{0} to go · the date passed. Pick a new one?', formatPeso(p.left))
    : p.perWeek ? tr('{0} a week to reach it by {1}', formatPeso(p.perWeek), by)
    : tr('{0} to go', formatPeso(p.left))
  return (
    <li className="border-t border-page pt-3">
      <button type="button" onClick={onEdit} className="w-full text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-black">{wallet.goalName ?? wallet.name}</span>
          <span className="shrink-0 text-sm font-extrabold">{formatPeso(Math.max(0, balance))} <span className="text-muted">/ {formatPeso(wallet.goalCentavos)}</span></span>
        </span>
        <span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-page" role="img" aria-label={tr('{0}% of the goal', p.percent)}>
          <span className="block h-full origin-left animate-grow-x rounded-full bg-blue" style={{ width: `${p.percent}%` }} />
        </span>
        <span className={`mt-1.5 block text-xs font-bold ${p.late ? 'text-trend-up' : 'text-muted'}`}>{pace}</span>
      </button>
    </li>
  )
}

/** Savings goals card on Plan. */
export function GoalsCard({ className = '' }: { className?: string }) {
  const { wallets, transactions } = useSession()
  const [editing, setEditing] = useState<Wallet | null>(null)
  const savings = wallets.filter((w) => w.type === 'savings' && !w.archived)
  const all = balances(wallets, transactions)
  return (
    <section aria-labelledby="goals-title" className={`flex animate-rise flex-col gap-3 rounded-[26px] bg-card p-[1.125rem] lg:rounded-[32px] lg:p-6 ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-[14px] bg-blue-tint text-blue" aria-hidden="true"><Icon name="piggy" className="size-5" /></span>
        <span>
          <h2 id="goals-title" className="text-base font-black lg:text-lg">{tr('Savings goals')}</h2>
          <p className="text-xs font-bold text-muted lg:text-sm">{tr('Add → Save moves money toward it.')}</p>
        </span>
      </div>
      {savings.length ? (
        <ul className="flex flex-col gap-3">
          {savings.map((w) => <GoalRow key={w.id} wallet={w} balance={all.get(w.id) ?? 0} onEdit={() => setEditing(w)} />)}
        </ul>
      ) : (
        <p className="text-sm font-bold text-muted">{tr('You don’t have a Savings wallet yet.')}</p>
      )}
      {editing && <GoalDialog wallet={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
