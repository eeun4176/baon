/*
 * Charts.tsx — Lightweight CSS charts (plan §8: no chart library, keeps the app small).
 *   SpentPerDay: 7 rounded bars, today in blue, dashed line at today's budget (design p18).
 *   CategoryBars: horizontal blue bars per category, biggest first (design p19).
 * Bars grow in when shown. Each chart has a text summary for screen readers (plan §5.1).
 */
import { weekday } from '../budget/days.ts'
import { formatPeso } from '../ledger/money.ts'
import { tr } from '../i18n/i18n.ts'

const SHORT = [tr('Sun'), tr('Mon'), tr('Tue'), tr('Wed'), tr('Thu'), tr('Fri'), tr('Sat')]

/** Vertical "Spent per day" bars with a budget line. */
export function SpentPerDay({ days, today, budget }: { days: { day: string; spent: number }[]; today: string; budget: number }) {
  const top = Math.max(budget, ...days.map((d) => d.spent), 1)
  // Averages round down to whole pesos, like the daily budget.
  const average = Math.floor(days.reduce((s, d) => s + d.spent, 0) / days.length / 100) * 100
  return (
    <figure>
      <figcaption className="mb-4 text-sm font-semibold text-muted">
        {tr('{0} on average · budget line at {1}', formatPeso(average), formatPeso(budget))}
      </figcaption>
      <div aria-hidden="true">
        <div className="grid grid-cols-7 gap-2 text-center">
          {days.map((d) => (
            <span key={d.day} className={`text-xs font-extrabold ${d.day === today ? 'text-blue' : 'text-muted'}`}>{formatPeso(d.spent)}</span>
          ))}
        </div>
        {/* Bars area: the dashed budget line is positioned inside it, so it lines up exactly. */}
        <div className="relative mt-1.5 grid h-32 grid-cols-7 items-end gap-2">
          {days.map((d, i) => (
            <span key={d.day} className="mx-auto flex h-full w-full max-w-12 items-end overflow-hidden rounded-xl bg-page">
              <span
                className={`w-full origin-bottom animate-grow-y rounded-xl ${d.day === today ? 'bg-blue' : 'bg-bar'}`}
                style={{ height: `${(d.spent / top) * 100}%`, animationDelay: `${i * 50}ms` }}
              />
            </span>
          ))}
          {budget > 0 && <span className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-blue/50" style={{ bottom: `${(budget / top) * 100}%` }} />}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-2 text-center">
          {days.map((d) => (
            <span key={d.day} className={`text-sm font-black ${d.day === today ? 'text-blue' : ''}`}>{SHORT[weekday(d.day)]}</span>
          ))}
        </div>
      </div>
      <p className="sr-only">
        {days.map((d) => `${SHORT[weekday(d.day)]} ${formatPeso(d.spent)}`).join(', ')}
      </p>
    </figure>
  )
}

/** Horizontal bars per category. */
export function CategoryBars({ rows }: { rows: { categoryId: string; label: string; spent: number }[] }) {
  if (rows.length === 0) return <p className="font-semibold text-muted">{tr('No spending yet this week.')}</p>
  const top = rows[0].spent
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.categoryId}>
          <p className="mb-1.5 flex justify-between font-extrabold">
            <span>{r.label}</span>
            <span>{formatPeso(r.spent)}</span>
          </p>
          <span className="block h-2.5 overflow-hidden rounded-full bg-page" aria-hidden="true">
            <span
              className="block h-full origin-left animate-grow-x rounded-full bg-blue"
              style={{ width: `${(r.spent / top) * 100}%`, animationDelay: `${i * 60}ms` }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}
