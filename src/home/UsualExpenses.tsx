/*
 * UsualExpenses.tsx — Home's "Usual expenses" card (Home v2 design): where the last 7 days' spending
 * went, as a donut (top 4 categories + Others) with a tappable legend, the top category in words
 * ("Food took ₱820 of your ₱1,200…", opens History → Charts), and the tipid tip picked from it.
 * Tapping a legend row shows that category in the donut's center; tapping it again shows the total.
 * The center uses the short amount (₱123.5K) so big totals fit; the sentence below has the exact one.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { manilaDate } from '../budget/days.ts'
import { formatPeso, formatPesoShort } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { pickTip, topSpending, usualExpenses } from './savings.ts'
import { tr } from '../i18n/i18n.ts'

// Slice colors, biggest first (tokens, so dark mode works); "Others" is always the last, gray one.
const COLORS = ['var(--color-blue)', 'var(--color-map-2)', 'var(--color-ink)', 'var(--color-chart-amber)', 'var(--color-bar)']

/** "50%", or "<1%" for a sliver that rounds to 0 (it's still there). */
const pct = (n: number) => (n === 0 ? '<1%' : `${n}%`)

/** The Usual expenses card, with the tip inside. */
export function UsualExpenses() {
  const { transactions } = useSession()
  const [choice, setPicked] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)
  const today = manilaDate()
  const { total, rows } = usualExpenses(transactions, today)
  const picked = choice !== null && choice < rows.length ? choice : null // a new entry can shrink the list
  const top = topSpending(transactions, today)
  const color = (i: number) => (rows[i].label === tr('Others') ? COLORS[4] : COLORS[i])

  // Conic gradient: each slice from where the last ended. A picked category stays colored, the rest go gray.
  const ends = rows.map((_, i) => (rows.slice(0, i + 1).reduce((s, r) => s + r.spent, 0) / total) * 360)
  const slices = rows.map((_, i) =>
    `${picked === null || picked === i ? color(i) : 'var(--color-pebble)'} ${(i ? ends[i - 1] : 0).toFixed(2)}deg ${ends[i].toFixed(2)}deg`)
  const sel = picked !== null ? rows[picked] : null

  return (
    <section aria-labelledby="usual-title" className="flex animate-rise flex-col gap-3.5 rounded-[26px] bg-card p-[1.125rem] lg:gap-4 lg:rounded-[32px] lg:p-6">
      <div className="flex items-center gap-2 lg:gap-2.5">
        <span className="grid size-[2.125rem] shrink-0 place-items-center rounded-xl bg-blue-tint text-blue lg:size-10 lg:rounded-[14px]" aria-hidden="true">
          <Icon name="pie" className="size-5" /></span>
        <h2 id="usual-title" className="flex-1 font-black lg:text-lg">{tr('Usual expenses')}</h2>
        <span className="inline-flex h-[1.625rem] items-center rounded-full bg-page px-2.5 text-[0.6875rem] font-extrabold text-ink/80 lg:h-7 lg:text-xs">{tr('Last 7 days')}</span>
      </div>

      {rows.length ? (
        <>
          <div className="flex items-center gap-3.5 lg:gap-4">
            <div role="img" aria-label={tr('{0} spent in the last 7 days', formatPeso(total))} className="grid size-[7.375rem] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${slices.join(', ')})` }}>
              <span className="flex size-[64%] flex-col items-center justify-center rounded-full bg-card text-center">
                <span className="text-[0.8125rem] font-black tracking-[-0.02em] lg:text-[0.9375rem]" title={formatPeso(sel ? sel.spent : total)}>{formatPesoShort(sel ? sel.spent : total)}</span>
                <span className="max-w-full truncate px-1.5 text-[0.625rem] leading-tight font-extrabold text-muted lg:text-[0.6875rem]">{sel ? `${pct(sel.percent)} · ${sel.label}` : tr('last 7 days')}</span>
              </span>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-px">
              {rows.map((r, i) => (
                <li key={r.label}>
                  <button type="button" aria-pressed={picked === i} onClick={() => setPicked(picked === i ? null : i)}
                    className={`flex h-7 w-full items-center gap-2 rounded-xl px-1.5 text-left lg:h-8 lg:px-2 ${picked === i ? 'bg-page' : 'hover:bg-page'}`}>
                    <span className="size-3 shrink-0 rounded-[4px]" style={{ background: color(i) }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-extrabold lg:text-[0.8125rem]">{r.label}</span>
                    <span className="text-xs font-black lg:text-[0.8125rem]">{pct(r.percent)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {top && (
            <Link to="/history?view=charts" className="text-[0.8125rem] leading-snug font-extrabold hover:underline lg:text-sm">
              {tr('{0} took {1} of your {2} in the last 7 days ({3}%).', top.label, formatPeso(top.spent), formatPeso(top.total), top.percent)}</Link>
          )}
        </>
      ) : (
        <p className="text-sm font-bold text-muted">{tr('Nothing spent in the last 7 days.')}</p>
      )}

      <div className="mt-auto flex flex-col gap-1 rounded-[18px] bg-page px-3.5 py-3 lg:gap-1.5 lg:rounded-[20px] lg:px-4 lg:py-3.5">
        <h3 className="text-[0.6875rem] font-black tracking-[0.06em] text-blue uppercase lg:text-xs">{tr('Tipid tip')}</h3>
        <p key={offset} className="animate-fade text-[0.8125rem] leading-snug font-bold lg:text-sm" aria-live="polite">{pickTip(transactions, today, offset)}</p>
        <button type="button" onClick={() => setOffset((n) => n + 1)} className="min-h-8 self-start text-[0.8125rem] font-extrabold text-blue hover:underline lg:text-sm">
          {tr('Another tip')}</button>
      </div>
    </section>
  )
}
