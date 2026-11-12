/*
 * LimitsDialog.tsx — Plan → Category limits: one peso box per category (empty = no limit) for this
 * allowance cycle, with what's been spent so far. "Other" can't get a limit (it's a mix); instead
 * the student adds their own category ("Milk tea"), which then shows up in Add too.
 * Saving shows a toast with Undo.
 */
import { useState, type FormEvent } from 'react'
import { MAX_OWN, OWN_NAME_MAX, pickableCategories } from '../add/categories.ts'
import { acceptTyped, centavosToText } from '../add/keypad.ts'
import { formatPeso, parsePeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { cycleStart, spentThisCycle, type Limits } from './limits.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

const since = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'short', day: 'numeric' })

/** The pop-up. */
export function LimitsDialog({ onClose }: { onClose: () => void }) {
  const { limits, ownCategories, transactions, saveLimits, saveOwnCategories, showToast } = useSession()
  const spent = spentThisCycle(transactions)
  const start = cycleStart(transactions)
  const [own, setOwn] = useState(ownCategories)
  const rows = pickableCategories(own).filter((c) => c.id !== 'other')
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(limits).map(([id, c]) => [id, centavosToText(c)])),
  )
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const activeOwn = own.filter((c) => !c.removed)

  /** Adds the typed category (or brings back a removed one with the same name, so its old entries match). */
  function addOwn() {
    const label = newName.trim().replace(/\s+/g, ' ')
    if (!label) return setError(tr('Type a name for your category.'))
    if (rows.some((c) => c.label.toLowerCase() === label.toLowerCase()) || label.toLowerCase() === tr('Other').toLowerCase()) return setError(tr('You already have “{0}”.', label))
    if (activeOwn.length >= MAX_OWN) return setError(tr('You can add up to {0} of your own categories.', MAX_OWN))
    const old = own.find((c) => c.removed && c.label.toLowerCase() === label.toLowerCase())
    setOwn(old ? own.map((c) => (c === old ? { id: c.id, label } : c)) : [...own, { id: `own-${crypto.randomUUID()}`, label }])
    setNewName('')
    setError('')
  }

  /** Removes one of the student's own categories (kept as "removed" so old entries keep its name). */
  function removeOwn(id: string) {
    setOwn(own.map((c) => (c.id === id ? { ...c, removed: true } : c)))
    setValues((v) => ({ ...v, [id]: '' }))
  }

  /** Checks every box, then saves the categories and limits (with Undo). */
  async function save(e: FormEvent) {
    e.preventDefault()
    if (newName.trim()) return addOwn() // typed a name but didn't tap Add
    const next: Limits = {}
    for (const c of rows) {
      const text = values[c.id]?.trim()
      if (!text) continue
      const centavos = parsePeso(text)
      if (!centavos) return setError(tr('Check the limit for {0}, or leave it empty.', c.label))
      next[c.id] = centavos
    }
    const before = { limits, own: ownCategories }
    setBusy(true)
    try {
      if (own !== ownCategories) await saveOwnCategories(own)
      await saveLimits(next)
      onClose()
      showToast({
        message: Object.keys(next).length ? tr('Limits saved') : Object.keys(limits).length ? tr('Limits removed') : tr('Categories saved'),
        undo: async () => {
          await saveOwnCategories(before.own)
          await saveLimits(before.limits)
        },
      })
    } catch {
      setBusy(false)
      setError(tr('Couldn’t save. Try again.'))
    }
  }

  return (
    <Modal title={tr('Category limits')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <p className="font-semibold text-muted">
          {tr('A cap until your next baon{0}. Leave a box empty for no limit.', start ? tr(' (since {0})', since.format(new Date(`${start}T00:00:00Z`))) : '')}</p>
        <ul className="mt-3 divide-y divide-page">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <Icon name={c.icon} className="size-5 shrink-0 text-blue" />
              <label htmlFor={`limit-${c.id}`} className="min-w-0 flex-1">
                <span className="block font-black break-words">{c.label}</span>
                <span className="block text-sm font-semibold text-muted">{tr('{0} spent', formatPeso(Math.max(0, spent.get(c.id) ?? 0)))}</span>
              </label>
              <span className="flex min-h-11 w-28 shrink-0 items-center gap-1 rounded-2xl bg-page px-3 font-bold focus-within:ring-2 focus-within:ring-blue/40">
                <span className="text-muted" aria-hidden="true">₱</span>
                <input
                  id={`limit-${c.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={tr('No limit')}
                  value={values[c.id] ?? ''}
                  onChange={(e) => {
                    const t = acceptTyped(e.target.value)
                    if (t !== null) setValues((v) => ({ ...v, [c.id]: t }))
                    setError('')
                  }}
                  className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-sm placeholder:text-muted/70"
                />
              </span>
              {c.id.startsWith('own-') && (
                <button type="button" onClick={() => removeOwn(c.id)} aria-label={tr('Remove {0}', c.label)} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-red">
                  <Icon name="x" className="size-5" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-3 rounded-2xl bg-page p-3">
          <label htmlFor="own-name" className="block font-black">{tr('Add your own category')}</label>
          <p className="text-sm font-semibold text-muted">{tr('For things you buy often, like milk tea.')}</p>
          <div className="mt-2 flex gap-2">
            <input
              id="own-name"
              value={newName}
              maxLength={OWN_NAME_MAX}
              autoComplete="off"
              placeholder={tr('e.g. Milk tea')}
              onChange={(e) => {
                setNewName(e.target.value)
                setError('')
              }}
              className="min-h-11 min-w-0 flex-1 rounded-2xl bg-card px-3 font-bold text-ink outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-blue/40"
            />
            <button type="button" onClick={addOwn} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-pebble px-4 font-black">
              <Icon name="plus" className="size-5" />
              {tr('Add')}</button>
          </div>
        </div>

        {error && <p role="alert" className="mt-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
        <button type="submit" disabled={busy} className="mt-4 min-h-13 w-full rounded-full bg-blue px-5 text-lg font-black text-white disabled:opacity-60">{tr('Save limits')}</button>
      </form>
    </Modal>
  )
}
