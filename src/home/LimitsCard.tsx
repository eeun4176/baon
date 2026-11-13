/*
 * LimitsCard.tsx — Category limits on Home (Home v2 design), and the one-limit row Plan uses too.
 * Each row: category icon + name, a heads-up chip ("Almost there", "Limit reached", "Over limit"),
 * a bar (ink once the limit is reached) and "₱100 of ₱100 this cycle · ₱0 left".
 * Kind wording: a limit is a gentle reminder, never a block — the daily budget already accounts for it.
 */
import { Link } from 'react-router'
import { categoryLabel, pickableCategories } from '../add/categories.ts'
import { formatPeso } from '../ledger/money.ts'
import { limitStatuses, type LimitStatus } from '../plan/limits.ts'
import { useSession } from '../session.ts'
import { Pill, Icon } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

/** One limit: name, chip, bar, numbers. */
export function LimitRow({ s }: { s: LimitStatus }) {
  const reached = s.spent >= s.limit
  const icon = pickableCategories().find((c) => c.id === s.categoryId)?.icon ?? 'tag'
  const chip = s.level === 'over' && s.spent > s.limit ? tr('Over limit') : reached ? tr('Limit reached') : s.level === 'close' ? tr('Almost there') : null
  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-page p-4">
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex min-w-0 items-center gap-2 font-black">
          <Icon name={icon} className="size-[1.125rem] shrink-0 text-blue" />
          <span className="truncate">{categoryLabel(s.categoryId)}</span>
        </span>
        {chip && <Pill tone="amber">{chip}</Pill>}
      </div>
      <span className="block h-2.5 overflow-hidden rounded-full bg-pebble-2" aria-hidden="true">
        <span className={`block h-full origin-left animate-grow-x rounded-full ${reached ? 'bg-ink' : 'bg-blue'}`} style={{ width: `${Math.min(100, (s.spent / s.limit) * 100)}%` }} />
      </span>
      <span className="text-[0.8125rem] font-bold text-muted">
        {tr('{0} of {1} this cycle', formatPeso(s.spent), formatPeso(s.limit))} · {s.left >= 0 ? tr('{0} left', formatPeso(s.left)) : tr('{0} over', formatPeso(-s.left))}</span>
    </div>
  )
}

/** Home card: the most-used limits (up to 2), or how to add one. */
export function LimitsCard() {
  const { limits, transactions } = useSession()
  const rows = limitStatuses(limits, transactions).slice(0, 2)
  return (
    <section aria-labelledby="limits-title" className="flex animate-rise flex-col gap-3 rounded-[26px] bg-card p-[1.125rem] lg:gap-3.5 lg:rounded-[32px] lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="limits-title" className="text-base font-black lg:text-lg">{tr('Category limits')}</h2>
        {rows.length > 0 && <Link to="/plan" className="text-[0.8125rem] font-extrabold text-blue hover:underline lg:text-sm">{tr('See all')}</Link>}
      </div>
      {rows.length ? rows.map((s) => <LimitRow key={s.categoryId} s={s} />) : (
        <p className="font-semibold text-muted">{tr('Cap a category, like snacks under ₱200.')}</p>
      )}
      <p className="text-[0.8125rem] leading-snug font-bold text-muted">{tr('Just a reminder. You can still log anything.')}</p>
      <Link to="/plan" className="mt-auto flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-page text-sm font-extrabold hover:bg-pebble">
        <Icon name="plus" className="size-4" /> {tr('Add a limit')}</Link>
    </section>
  )
}
