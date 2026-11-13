/*
 * Step.tsx — The frame around every onboarding step.
 * Phones: back button + 4 progress bars + "2 / 4", a blue step name, the title.
 * Desktop: the 4 named steps with numbers, "STEP 2 OF 4", the title, and Back beside the main button.
 * Without `n` (sign-in again from the lock screen) it shows only the title and Back.
 */
import type { ReactNode } from 'react'
import { Icon } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'
import type { StepNo } from './BrandPanel.tsx'

const LABELS = [tr('Sign in'), tr('Device'), tr('Your baon'), tr('Money now')]

/** One onboarding step. `footer` is the main action; on phones it sticks to the bottom. */
export function Step({ n, title, sub, onBack, footer, children }: {
  n?: StepNo
  title: ReactNode
  sub?: ReactNode
  onBack?: () => void
  footer?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] lg:min-h-0 lg:max-w-[34rem] lg:px-6 lg:py-8">
      <main className="flex flex-1 flex-col">
        {/* Phones: back + progress */}
        {(n || onBack) && (
          <div className="flex min-h-11 items-center gap-2.5 lg:hidden">
            {onBack && (
              <button type="button" onClick={onBack} aria-label={tr('Back')} className="grid size-11 shrink-0 place-items-center rounded-full bg-card">
                <Icon name="chevron-left" />
              </button>
            )}
            {n && (
              <>
                <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={n} aria-label={tr('Step {0} of 4', n)}>
                  {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= n ? 'bg-blue' : 'bg-pebble-2'}`} />)}
                </div>
                <span aria-hidden="true" className="text-xs font-black tracking-wider text-muted">{`${n} / 4`}</span>
              </>
            )}
          </div>
        )}

        {/* Desktop: the four named steps */}
        {n && (
          <ol aria-label={tr('Setup steps')} className="hidden grid-cols-4 gap-2 lg:grid">
            {LABELS.map((label, i) => {
              const done = i + 1 < n
              const current = i + 1 === n
              return (
                <li key={label} aria-current={current ? 'step' : undefined} className="flex flex-col gap-2">
                  <span className={`h-1.5 rounded-full ${done || current ? 'bg-blue' : 'bg-pebble-2'}`} />
                  <span className={`flex min-h-11 items-center gap-2 text-sm ${current ? 'font-black' : 'font-extrabold text-muted'}`}>
                    <span className={`grid size-6.5 shrink-0 place-items-center rounded-full text-[0.8125rem] font-black ${done ? 'bg-blue text-white' : current ? 'bg-ink text-page' : 'bg-card text-muted'}`}>
                      {done ? <Icon name="check" className="size-4" /> : i + 1}
                    </span>
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-4 mb-4 lg:mt-7 lg:mb-7">
          {n && (
            <>
              <p className="text-xs font-black tracking-widest text-blue uppercase lg:hidden">{LABELS[n - 1]}</p>
              <p aria-hidden="true" className="hidden text-[0.8125rem] font-black tracking-widest text-muted uppercase lg:block">{tr('Step {0} of 4', n)}</p>
            </>
          )}
          <h1 className="mt-1 text-[clamp(1.5rem,7vw,1.875rem)] leading-tight font-black lg:mt-2 lg:text-4xl">{title}</h1>
          {sub && <p className="mt-2 font-semibold text-muted lg:text-[1.0625rem]">{sub}</p>}
        </div>

        {children}
      </main>

      {(footer || onBack) && (
        <div className="sticky bottom-0 bg-page pt-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] lg:static lg:mt-3 lg:flex lg:items-end lg:gap-2.5 lg:pb-0">
          {onBack && (
            <button type="button" onClick={onBack} className="hidden min-h-14 shrink-0 rounded-full bg-card px-7 text-lg font-black hover:bg-pebble lg:block">{tr('Back')}</button>
          )}
          <div className="lg:flex-1">{footer}</div>
        </div>
      )}
      {n && <p className="mt-7 hidden text-center text-sm font-bold text-muted lg:block">{tr('Set up online once, then it works offline.')}</p>}
    </div>
  )
}
