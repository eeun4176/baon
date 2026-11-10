/*
 * PresetEditor.tsx — "Edit one-tap buttons" pop-up (opened from Home's One-tap add card).
 * List view: reorder (↑ ↓), edit, delete, add (up to 8). Form view: name, amount,
 * category, wallet ("Last used" or a fixed wallet).
 * Changes stay in a draft until Save, so Cancel / Esc throws them away; Save shows Undo.
 */
import { useState, type FormEvent } from 'react'
import { acceptTyped, centavosToText } from '../add/keypad.ts'
import { CATEGORIES, categoryLabel } from '../add/categories.ts'
import { MAX_PRESETS, presetIcon, type Preset } from '../add/presets.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40'
const label = 'block font-extrabold text-muted'
const pill = (on: boolean) => `min-h-10 rounded-full px-4 font-extrabold ${on ? 'bg-ink text-card' : 'bg-pebble hover:bg-pebble-2'}`
const mainButton = 'min-h-13 flex-1 rounded-full bg-blue px-6 text-lg font-black text-white disabled:opacity-60'
const grayButton = 'min-h-13 flex-1 rounded-full bg-pebble px-6 text-lg font-black hover:bg-pebble-2'
const iconButton = 'grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-pebble hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent'

/** Name/amount/category/wallet form for one button. */
function PresetForm({ preset, onDone, onBack }: { preset: Preset | null; onDone: (p: Preset) => void; onBack: () => void }) {
  const { wallets } = useSession()
  const spending = wallets.filter((w) => w.type === 'spending' && !w.archived)
  const [name, setName] = useState(preset?.label ?? '')
  const [amount, setAmount] = useState(preset ? centavosToText(preset.amountCentavos) : '')
  const [categoryId, setCategoryId] = useState(preset?.categoryId ?? 'fare')
  const [walletId, setWalletId] = useState(preset?.walletId ?? '')
  const [error, setError] = useState('')

  /** Validates and hands the button back to the list. */
  function done(e: FormEvent) {
    e.preventDefault()
    const centavos = parsePeso(amount)
    if (!name.trim()) return setError('Give it a short name, e.g. Tricycle.')
    if (!centavos) return setError('Enter how much it usually costs.')
    onDone({
      id: preset?.id ?? crypto.randomUUID(),
      label: name.trim(),
      amountCentavos: centavos,
      categoryId,
      ...(walletId ? { walletId } : {}),
      // keep the starter "Print" printer icon only while it's still a school expense
      ...(preset?.icon && categoryId === preset.categoryId ? { icon: preset.icon } : {}),
    })
  }

  return (
    <form onSubmit={done} noValidate>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <label className={label}>
          Name
          <input value={name} maxLength={24} autoFocus onChange={(e) => { setName(e.target.value); setError('') }} placeholder="e.g. Tricycle" className={`${field} placeholder:text-muted/60`} />
        </label>
        <label className={label}>
          Amount
          <span className={`${field} flex items-center gap-1`}>
            <span className="text-muted" aria-hidden="true">₱</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => { const t = acceptTyped(e.target.value); if (t !== null) { setAmount(t); setError('') } }}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-pebble-2"
            />
          </span>
        </label>
      </div>

      <p className={`${label} mt-4`}>Category</p>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={categoryId === c.id} onClick={() => setCategoryId(c.id)} className={`${pill(categoryId === c.id)} flex items-center gap-1.5`}>
            <Icon name={c.icon} className="size-4" /> {c.label}
          </button>
        ))}
      </div>

      {spending.length > 1 && (
        <>
          <p className={`${label} mt-4`}>Pay from</p>
          <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Pay from">
            <button type="button" role="radio" aria-checked={!walletId} onClick={() => setWalletId('')} className={pill(!walletId)}>Last used</button>
            {spending.map((w) => (
              <button key={w.id} type="button" role="radio" aria-checked={walletId === w.id} onClick={() => setWalletId(w.id)} className={pill(walletId === w.id)}>{w.name}</button>
            ))}
          </div>
        </>
      )}

      {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={onBack} className={grayButton}>Back</button>
        <button type="submit" className={mainButton}>Done</button>
      </div>
    </form>
  )
}

/** The editor pop-up. `startNew` opens straight on an empty form (from "Add a button"). */
export function PresetEditor({ onClose, startNew = false }: { onClose: () => void; startNew?: boolean }) {
  const { presets, savePresets, wallets, showToast } = useSession()
  const [draft, setDraft] = useState(presets.items)
  const [editing, setEditing] = useState<number | 'new' | null>(startNew ? 'new' : null)
  const [busy, setBusy] = useState(false)

  /** Moves button `i` up (-1) or down (+1). */
  function move(i: number, by: -1 | 1) {
    const next = [...draft]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setDraft(next)
  }

  /** Puts the finished form back into the draft list. */
  function done(p: Preset) {
    setDraft(editing === 'new' ? [...draft, p] : draft.map((x, i) => (i === editing ? p : x)))
    setEditing(null)
  }

  /** Saves the whole list, with Undo back to the old buttons. */
  async function save() {
    const before = presets
    setBusy(true)
    try {
      await savePresets({ ...presets, items: draft })
    } catch {
      setBusy(false)
      return showToast({ message: 'Couldn’t save. Try again.' })
    }
    onClose()
    showToast({ message: 'One-tap buttons saved', undo: () => savePresets(before) })
  }

  // Both views return <Modal> at the top, so React keeps the same open <dialog> while switching.
  const preset = editing === null || editing === 'new' ? null : draft[editing]
  const title = editing === null ? 'One-tap buttons' : preset ? `Edit ${preset.label}` : 'New one-tap button'
  if (editing !== null) {
    return (
      <Modal title={title} onClose={onClose}>
        <PresetForm key={String(editing)} preset={preset} onDone={done} onBack={() => (startNew && draft === presets.items ? onClose() : setEditing(null))} />
      </Modal>
    )
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="font-semibold text-muted">One tap on Home logs the expense right away. Up to {MAX_PRESETS} buttons; the first ones show first.</p>
      {draft.length ? (
        <ul className="mt-4 divide-y divide-page rounded-3xl bg-page/60">
          {draft.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 py-2 pr-1 pl-3">
              <Icon name={presetIcon(p)} className="size-5 shrink-0 text-blue" />
              <button type="button" onClick={() => setEditing(i)} className="min-w-0 flex-1 rounded-xl py-1 text-left">
                <span className="block truncate font-black">{p.label} {formatPeso(p.amountCentavos)}</span>
                <span className="block truncate text-sm font-semibold text-muted">
                  {categoryLabel(p.categoryId)} · {wallets.find((w) => w.id === p.walletId)?.name ?? 'Last used wallet'}
                </span>
              </button>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.label} up`} className={iconButton}><Icon name="chevron-up" className="size-5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label={`Move ${p.label} down`} className={iconButton}><Icon name="chevron-down" className="size-5" /></button>
              <button type="button" onClick={() => setDraft(draft.filter((_, j) => j !== i))} aria-label={`Delete ${p.label}`} className={iconButton}><Icon name="trash" className="size-5" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-3xl bg-page p-4 font-semibold text-muted">No buttons yet. Add the things you buy most, like your jeep fare or lunch.</p>
      )}
      <button
        type="button"
        onClick={() => setEditing('new')}
        disabled={draft.length >= MAX_PRESETS}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-pebble-2 font-black text-blue hover:bg-page disabled:text-muted disabled:opacity-60"
      >
        <Icon name="plus" className="size-5" /> {draft.length >= MAX_PRESETS ? `All ${MAX_PRESETS} buttons used` : 'Add a button'}
      </button>
      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={onClose} className={grayButton}>Cancel</button>
        <button type="button" onClick={save} disabled={busy} className={mainButton}>Save</button>
      </div>
    </Modal>
  )
}
