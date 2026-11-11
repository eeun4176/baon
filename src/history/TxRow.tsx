/*
 * TxRow.tsx — One entry in a list (design p9/p18/p19): letter avatar, title,
 * gray "Category · Wallet · time" line and the amount (−₱15 ink, +₱1,500 blue).
 * Tapping it opens the entry for editing or deleting.
 */
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import { useAddDialog } from '../shell/useAddDialog.ts'
import { describe } from './history.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const shortDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Manila', weekday: 'short' })

/** A tappable entry row. `withDay` adds the weekday (Home's "Recent" list mixes days). */
export function TxRow({ tx, wallets, withDay = false, index = 0 }: { tx: Transaction; wallets: Wallet[]; withDay?: boolean; index?: number }) {
  const { open } = useAddDialog()
  const d = describe(tx, wallets)
  const when = withDay ? shortDay.format(new Date(tx.occurredAt)) : timeFormat.format(new Date(tx.occurredAt))
  return (
    <li className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <button
        type="button"
        onClick={() => open(tx.id)}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-page active:scale-[0.99]"
        aria-label={tr('{0}, {1}, {2}, {3}. Tap to edit.', d.title, d.amount, d.detail, when)}
      >
        <span
          aria-hidden="true"
          className={`grid size-11 shrink-0 place-items-center rounded-full font-black ${d.tone === 'in' ? 'bg-blue text-white' : 'bg-pebble'}`}
        >
          {d.title.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] font-black">{d.title}</span>
          <span className="block truncate text-sm font-semibold text-muted">
            {d.detail} · {when}
          </span>
        </span>
        <span className={`shrink-0 text-[1.0625rem] font-black ${d.tone === 'in' ? 'text-blue' : d.tone === 'move' ? 'text-muted' : ''}`}>{d.amount}</span>
      </button>
    </li>
  )
}
