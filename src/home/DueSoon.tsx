/*
 * DueSoon.tsx — Home reminder: school expenses and repeating items (load promo, subscription, rent)
 * that are due within 3 days or overdue and not paid yet. Hidden when there are none; Plan opens them.
 */
import { Link } from 'react-router'
import { daysBetween } from '../budget/days.ts'
import { formatPeso } from '../ledger/money.ts'
import { dueSoon } from '../plan/school.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

/** "Today", "Tomorrow", "In 3 days" or "2 days late". */
function whenDue(dueDate: string, today: string): string {
  const days = daysBetween(today, dueDate)
  if (days === 0) return tr('Today')
  if (days === 1) return tr('Tomorrow')
  return days > 0 ? tr('In {0} days', days) : tr('{0} days late', -days)
}

/** The "Due soon" card (nothing when nothing is due). */
export function DueSoon({ today }: { today: string }) {
  const { schoolExpenses, transactions } = useSession()
  const items = dueSoon(schoolExpenses, transactions, today)
  if (!items.length) return null
  return (
    <section aria-labelledby="due-title" className="animate-rise rounded-[26px] bg-card p-[1.125rem] lg:rounded-[32px] lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="due-title" className="flex items-center gap-2 text-base font-black lg:text-lg">
          <Icon name="calendar" className="size-5 text-blue" />{tr('Due soon')}</h2>
        <Link to="/plan" className="text-[0.8125rem] font-extrabold text-blue hover:underline lg:text-sm">{tr('Open Plan')}</Link>
      </div>
      <ul className="mt-2 divide-y divide-page">
        {items.slice(0, 3).map((i) => (
          <li key={i.id} className="flex min-h-12 items-center justify-between gap-3">
            <span className="min-w-0 truncate font-black">{i.title}</span>
            <span className="shrink-0 text-sm font-extrabold">
              <span className={i.dueDate < today ? 'text-trend-up' : 'text-muted'}>{whenDue(i.dueDate, today)}</span> · {formatPeso(i.estimatedCentavos)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
