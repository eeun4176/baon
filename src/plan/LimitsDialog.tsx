/*
 * LimitsDialog.tsx — Plan → Category limits: one peso box per category (empty = no limit) for this
 * allowance cycle, with what's been spent so far. Saving shows a toast with Undo.
 */
import { useState, type FormEvent } from 'react'
import { CATEGORIES } from '../add/categories.ts'
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
  const { limits, transactions, saveLimits, showToast } = useSession()
  const spent = spentThisCycle(transactions)
  const start = cycleStart(transactions)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.id, limits[c.id] ? centavosToText(limits[c.id]) : ''])),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** Checks every box, then saves the limits (with Undo). */
  async function save(e: FormEvent) {
    e.preventDefault()
    const next: Limits = {}
    for (const c of CATEGORIES) {
      const text = values[c.id].trim()
      if (!text) continue
      const centavos = parsePeso(text)
      if (!centavos) return setError(tr('Check the limit for {0}, or leave it empty.', c.label))
      next[c.id] = centavos
    }
    const before = limits
    setBusy(true)
    try {
      await saveLimits(next)
      onClose()
      showToast({ message: Object.keys(next).length ? tr('Limits saved') : tr('Limits removed'), undo: () => saveLimits(before) })
    } catch {
      setBusy(false)
      setError(tr('Couldn’t save. Try again.'))
    }
  }

  return (
    <Modal title={tr('Category limits')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <p className="font-semibold text-muted">
          {tr('A cap for this allowance cycle{0}. It starts over when your next baon comes in. Leave a box empty for no limit.', start ? tr(' (since {0})', since.format(new Date(`${start}T00:00:00Z`))) : '')}</p>
        <ul className="mt-3 divide-y divide-page">
          {CATEGORIES.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <Icon name={c.icon} className="size-5 shrink-0 text-blue" />
              <label htmlFor={`limit-${c.id}`} className="min-w-0 flex-1">
                <span className="block font-black">{c.label}</span>
                <span className="block text-sm font-semibold text-muted">{tr('{0} spent', formatPeso(Math.max(0, spent.get(c.id) ?? 0)))}</span>
              </label>
              <span className="flex min-h-11 w-28 shrink-0 items-center gap-1 rounded-2xl bg-page px-3 font-bold focus-within:ring-2 focus-within:ring-blue/40">
                <span className="text-muted" aria-hidden="true">₱</span>
                <input
                  id={`limit-${c.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={tr('No limit')}
                  value={values[c.id]}
                  onChange={(e) => {
                    const t = acceptTyped(e.target.value)
                    if (t !== null) setValues((v) => ({ ...v, [c.id]: t }))
                    setError('')
                  }}
                  className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-sm placeholder:text-muted/70"
                />
              </span>
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
        <button type="submit" disabled={busy} className="mt-4 min-h-13 w-full rounded-full bg-blue px-5 text-lg font-black text-white disabled:opacity-60">{tr('Save limits')}</button>
      </form>
    </Modal>
  )
}
