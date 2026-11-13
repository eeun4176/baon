/*
 * SavingsCard.tsx — Home's "Ipon outlook" (Home v2 design): about how much the student could save in
 * a month (and 6 months) if they keep spending like the last 4 weeks, and what's in Savings now.
 * Phone: a compact card beside the streak card, with the tipid tip below both (TipBox).
 * Desktop: one taller card with the tip inside. The math is in savings.ts.
 */
import { useState } from 'react'
import { manilaDate } from '../budget/days.ts'
import { balances } from '../ledger/ledger.ts'
import { useStreak } from '../streak/useStreak.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { iponOutlook, MIN_DAYS, pickTip } from './savings.ts'
import type { Today } from './useToday.ts'
import { tr } from '../i18n/i18n.ts'

/**
 * Tipid tip: the tip picked from what the student spends most on, and "Another tip".
 * `className` places it (phone: its own row; desktop: inside the outlook card).
 */
export function TipBox({ className = '' }: { className?: string }) {
  const { transactions } = useSession()
  const [offset, setOffset] = useState(0)
  const today = manilaDate()
  return (
    <section aria-label={tr('Tipid tip')} className={`flex animate-rise flex-col gap-1.5 rounded-[20px] bg-card px-4 py-3.5 lg:bg-page ${className}`}>
      <h3 className="text-xs font-black tracking-[0.06em] text-blue uppercase">{tr('Tipid tip')}</h3>
      <p key={offset} className="animate-fade text-sm leading-snug font-bold" aria-live="polite">{pickTip(transactions, today, offset)}</p>
      <button type="button" onClick={() => setOffset((n) => n + 1)} className="min-h-8 self-start text-sm font-extrabold text-blue hover:underline">
        {tr('Another tip')}</button>
    </section>
  )
}

/** Ipon outlook card. */
export function SavingsCard({ t }: { t: Today }) {
  const { wallets, transactions } = useSession()
  const o = iponOutlook(useStreak().days, t.allowance, t.result.today)
  const all = balances(wallets, transactions)
  const inSavings = wallets.filter((w) => w.type === 'savings').reduce((s, w) => s + (all.get(w.id) ?? 0), 0)
  const ready = o.count >= MIN_DAYS

  return (
    <section aria-labelledby="ipon-title" className="flex h-full animate-rise flex-col gap-2 rounded-[26px] bg-card p-4 lg:gap-3.5 lg:rounded-[32px] lg:p-6">
      <div className="flex items-center gap-2 lg:gap-2.5">
        <span className="grid size-[2.125rem] shrink-0 place-items-center rounded-xl bg-blue-tint text-blue lg:size-10 lg:rounded-[14px]" aria-hidden="true">
          <Icon name="piggy" className="size-5 lg:size-[1.375rem]" />
        </span>
        <h2 id="ipon-title" className="font-black lg:text-lg">{tr('Ipon outlook')}</h2>
      </div>

      {!ready ? (
        <p className="text-sm font-bold text-muted">{tr('Log {0} more class days to see this.', MIN_DAYS - o.count)}</p>
      ) : o.perDay > 0 ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-extrabold text-muted lg:text-sm">
            <span className="lg:hidden">{tr('You could save')}</span>
            <span className="hidden lg:inline">{tr('If you keep this up, you could save')}</span>
          </span>
          <span className="text-[1.625rem] leading-none font-black tracking-tight text-blue lg:text-4xl lg:leading-tight">
            {formatPeso(o.perMonth)}
            <span className="text-sm tracking-normal lg:hidden">{tr('/mo')}</span>
            <span className="hidden text-xl tracking-normal lg:inline"> {tr('a month')}</span>
          </span>
        </div>
      ) : (
        <p className="text-sm font-bold">
          {o.over
            ? tr('Over budget lately. ₱20 less a day saves about {0} a month.', formatPeso(2000 * o.daysPerMonth))
            : tr('Right on budget. ₱20 less a day saves about {0} a month.', formatPeso(2000 * o.daysPerMonth))}</p>
      )}
      <p className="mt-auto text-xs leading-snug font-bold text-ink/80 lg:mt-0 lg:text-sm">
        {ready && o.perDay > 0 && <>{tr('{0} in 6 months', formatPeso(o.sixMonths))} · </>}
        {tr('In Savings now: {0}', formatPeso(inSavings))}</p>

      <TipBox className="mt-auto hidden lg:flex" />
      {ready && <p className="hidden text-xs font-bold text-muted lg:block">{tr('Based on your last 4 weeks.')}</p>}
    </section>
  )
}
