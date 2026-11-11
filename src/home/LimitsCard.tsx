/*
 * LimitsCard.tsx — Home heads-up for category limits that are close (80%+) or over this allowance
 * cycle. Hidden when every limit is fine or none are set. Kind wording: going over is information,
 * not a failure — the daily budget already accounts for it.
 */
import { Link } from 'react-router'
import { categoryLabel } from '../add/categories.ts'
import { formatPeso } from '../ledger/money.ts'
import { limitStatuses } from '../plan/limits.ts'
import { useSession } from '../session.ts'
import { Card } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

/** The card (renders nothing when there's nothing to say). */
export function LimitsCard({ className = '' }: { className?: string }) {
  const { limits, transactions } = useSession()
  const warn = limitStatuses(limits, transactions).filter((s) => s.level !== 'ok')
  if (!warn.length) return null
  return (
    <Card className={`animate-rise ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{tr('Category limits')}</h2>
        <Link to="/plan" className="flex min-h-11 items-center font-extrabold text-blue hover:underline">{tr('See all')}</Link>
      </div>
      <ul className="mt-1 space-y-3">
        {warn.map((s) => (
          <li key={s.categoryId}>
            <div className="flex items-baseline justify-between gap-3 font-black">
              <span>{categoryLabel(s.categoryId)}</span>
              <span>{s.level === 'over' ? tr('{0} over', formatPeso(-s.left)) : tr('{0} left', formatPeso(s.left))}</span>
            </div>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-page" aria-hidden="true">
              <span className={`block h-full rounded-full ${s.level === 'over' ? 'bg-ink' : 'bg-blue'}`} style={{ width: `${Math.min(100, (s.spent / s.limit) * 100)}%` }} />
            </span>
            <p className="mt-1 text-sm font-semibold text-muted">{tr('{0} of {1} this cycle', formatPeso(s.spent), formatPeso(s.limit))}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
