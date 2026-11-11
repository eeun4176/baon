/*
 * MeDialogs.tsx — Pop-ups on the Me tab:
 *   AllowanceDialog  edit usual amount, how often and the next allowance date
 *                    (class days and breaks are edited on Plan)
 *   WalletDialog     add an e-wallet (with what's in it now), rename, or remove an
 *                    empty one (it's archived so old entries keep their wallet name)
 * Both save through the session, so Home's budget updates at once, with Undo.
 */
import { useState, type FormEvent } from 'react'
import { acceptTyped, centavosToText } from '../add/keypad.ts'
import { FREQUENCIES, type Allowance } from '../budget/allowance.ts'
import { manilaDate } from '../budget/days.ts'
import { balances, type Wallet } from '../ledger/ledger.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { tr } from '../i18n/i18n.ts'

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40'
const label = 'block font-extrabold text-muted'
const pill = (on: boolean) => `min-h-11 rounded-full px-4 font-extrabold ${on ? 'bg-ink text-card' : 'bg-pebble hover:bg-pebble-2'}`
const mainButton = 'min-h-13 flex-1 rounded-full bg-blue px-6 text-lg font-black text-white disabled:opacity-60'

/** Peso amount box (typed, centavos allowed). */
function PesoInput({ text, value, onChange, placeholder = '0' }: { text: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className={label}>
      {text}
      <span className={`${field} flex items-center gap-1`}>
        <span className="text-muted" aria-hidden="true">₱</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { const t = acceptTyped(e.target.value); if (t !== null) onChange(t) }}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-pebble-2"
        />
      </span>
    </label>
  )
}

/** Error line above the main button. */
const ErrorLine = ({ text }: { text: string }) => (text ? <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{text}</p> : null)

/** Edit allowance: amount, frequency, next date. */
export function AllowanceDialog({ onClose }: { onClose: () => void }) {
  const { allowance, updateAllowance, showToast } = useSession()
  const [amount, setAmount] = useState(allowance.amountCentavos ? centavosToText(allowance.amountCentavos) : '')
  const [frequency, setFrequency] = useState<Allowance['frequency']>(allowance.frequency)
  const [nextDate, setNextDate] = useState(allowance.nextDate)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const today = manilaDate()

  /** Validates and saves; the daily budget follows right away. */
  async function save(e: FormEvent) {
    e.preventDefault()
    const centavos = amount.trim() === '' ? 0 : parsePeso(amount)
    if (centavos === null || (centavos === 0 && frequency !== 'irregular')) return setError(tr('Enter how much you usually get.'))
    if (!nextDate || nextDate <= today) return setError(frequency === 'irregular' ? tr('Pick a day after today to make it last until.') : tr('Pick when your next baon comes (after today).'))
    const before = allowance
    setBusy(true)
    try {
      await updateAllowance({ ...allowance, amountCentavos: centavos, frequency, nextDate, lateFrom: undefined })
    } catch {
      setBusy(false)
      return setError(tr('Couldn’t save. Try again.'))
    }
    onClose()
    showToast({ message: tr('Allowance updated · daily budget recalculated'), undo: () => updateAllowance(before) })
  }

  return (
    <Modal title={tr('Edit allowance')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <PesoInput text={tr('Usual amount')} value={amount} onChange={(v) => { setAmount(v); setError('') }} placeholder={frequency === 'irregular' ? tr('It varies') : '0'} />
        <p className={`${label} mt-4`}>{tr('How often')}</p>
        <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={tr('How often')}>
          {FREQUENCIES.map(([id, text]) => (
            <button key={id} type="button" role="radio" aria-checked={frequency === id} onClick={() => { setFrequency(id); setError('') }} className={pill(frequency === id)}>
              {text}
            </button>
          ))}
        </div>
        <label className={`${label} mt-4`}>
          {frequency === 'irregular' ? tr('Make it last until') : tr('Next allowance')}
          <input type="date" min={today} value={nextDate} onChange={(e) => { setNextDate(e.target.value); setError('') }} className={field} />
        </label>
        <p className="mt-3 text-sm font-semibold text-muted">{tr('Class days and breaks are on the Plan tab.')}</p>
        <ErrorLine text={error} />
        <div className="mt-5 flex">
          <button type="submit" disabled={busy} className={mainButton}>{tr('Save')}</button>
        </div>
      </form>
    </Modal>
  )
}

/** Add a spending wallet, or rename / remove one. Cash and Savings can be renamed but not removed. */
export function WalletDialog({ wallet, onClose }: { wallet?: Wallet; onClose: () => void }) {
  const { wallets, transactions, saveWallet, showToast } = useSession()
  const [name, setName] = useState(wallet?.name ?? '')
  const [opening, setOpening] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const balance = wallet ? balances(wallets, transactions).get(wallet.id) ?? 0 : 0
  const removable = !!wallet && wallet.type === 'spending' && wallet.id !== 'cash'

  /** Saves the wallet, with Undo. */
  async function store(next: Wallet, message: string) {
    setBusy(true)
    try {
      await saveWallet(next)
    } catch {
      setBusy(false)
      return setError(tr('Couldn’t save. Try again.'))
    }
    onClose()
    showToast({ message, undo: wallet ? () => saveWallet(wallet) : () => saveWallet({ ...next, archived: true }) })
  }

  /** Validates the form, then adds or renames. */
  function save(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) return setError(tr('Name it after your bank or e-wallet, e.g. BPI.'))
    if (clean.length > 40) return setError(tr('Keep the name under 40 letters.'))
    if (wallets.some((w) => !w.archived && w.id !== wallet?.id && w.name.toLowerCase() === clean.toLowerCase())) return setError(tr('You already have a wallet with that name.'))
    const centavos = opening.trim() === '' ? 0 : parsePeso(opening)
    if (centavos === null) return setError(tr('Enter how much is in it now (or leave it empty for ₱0).'))
    if (wallet) return store({ ...wallet, name: clean }, tr('Renamed to {0}', clean))
    return store({ id: crypto.randomUUID(), name: clean, type: 'spending', openingCentavos: centavos, archived: false }, tr('Added {0} · {1}', clean, formatPeso(centavos)))
  }

  return (
    <Modal title={wallet ? tr('Edit {0}', wallet.name) : tr('Add a wallet')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="space-y-4">
          <label className={label}>
            {tr('Name')}<input value={name} maxLength={40} autoFocus onChange={(e) => { setName(e.target.value); setError('') }} placeholder={tr('e.g. BPI, SeaBank, GoTyme')} className={`${field} placeholder:text-muted/60`} />
          </label>
          {!wallet && <PesoInput text={tr('How much is in it now?')} value={opening} onChange={(v) => { setOpening(v); setError('') }} />}
        </div>
        {wallet && (
          <p className="mt-4 rounded-2xl bg-page p-4 font-semibold text-muted">
            {tr('Balance now:')} <strong className="font-black text-ink">{formatPeso(balance)}</strong>
            {wallet.type === 'savings' ? tr(' · not counted as spendable') : ''}
          </p>
        )}
        <ErrorLine text={error} />
        <div className="mt-5 flex gap-2.5">
          {removable && (
            <button
              type="button"
              disabled={busy || balance !== 0}
              onClick={() => store({ ...wallet, archived: true }, tr('Removed {0}', wallet.name))}
              aria-label={tr('Remove {0}', wallet.name)}
              title={balance !== 0 ? tr('Move its money out first') : undefined}
              className="grid min-h-13 place-items-center rounded-full bg-pebble px-4 hover:bg-pebble-2 disabled:opacity-40"
            >
              <Icon name="trash" className="size-5" />
            </button>
          )}
          <button type="submit" disabled={busy} className={mainButton}>{wallet ? tr('Save') : tr('Add wallet')}</button>
        </div>
        {removable && balance !== 0 && <p className="mt-3 text-sm font-semibold text-muted">{tr('To remove it, move its money to another wallet first.')}</p>}
      </form>
    </Modal>
  )
}
