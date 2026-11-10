/*
 * kit.tsx — Small shared UI pieces matching the design's style guide
 * (white rounded cards, full pill buttons, Nunito 900 titles, 44px+ touch targets).
 *
 * Responsive rules every screen gets from <Screen>:
 * - Mobile-first; on wider screens the app stays a centered phone-width column.
 * - Respects notches and gesture bars (env(safe-area-inset-*)).
 * - Uses dvh so mobile browser toolbars don't hide the bottom button.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { formatPeso } from '../ledger/money.ts'

/** Full-height page column with safe-area padding. `footer` sticks to the bottom (main action). */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <main className="flex flex-1 flex-col">{children}</main>
      {footer && <div className="sticky bottom-0 bg-page pt-4 pb-[max(env(safe-area-inset-bottom),0.5rem)]">{footer}</div>}
    </div>
  )
}

/**
 * Page area inside the signed-in app (next to the sidebar on tablet/desktop).
 * Phone: single column with room at the bottom so the floating nav never covers
 * the last item. Desktop: wider content, centered, no bottom nav padding.
 */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-36 md:max-w-2xl md:px-8 md:pt-8 md:pb-10 lg:max-w-5xl">
      {children}
    </main>
  )
}

/** White rounded card (design: radius 26–30px, no border). */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[28px] bg-card p-5 ${className}`}>{children}</div>
}

const variants = {
  primary: 'bg-blue text-white',
  secondary: 'bg-pebble text-ink',
  dark: 'bg-ink text-white',
} as const

/** Full-width pill button. Disabled buttons fade but stay readable. */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type="button"
      {...props}
      className={`flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 text-lg font-black transition-opacity active:opacity-80 disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  )
}

/** Round back button + 4-segment blue progress bar used on onboarding screens 2–5. */
export function StepHeader({ step, onBack }: { step: 1 | 2 | 3 | 4; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back" className="grid size-11 shrink-0 place-items-center rounded-full bg-card">
          <Icon name="chevron-left" />
        </button>
      ) : (
        <span className="size-11 shrink-0" />
      )}
      <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label={`Step ${step} of 4`}>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-blue' : 'bg-pebble-2'}`} />
        ))}
      </div>
    </div>
  )
}

/** Screen title + optional gray subtitle (design: 900 weight, 32–34px). */
export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mt-7 mb-6">
      <h1 className="text-[clamp(1.75rem,8vw,2.125rem)] leading-tight font-black">{children}</h1>
      {sub && <p className="mt-2 text-[17px] font-semibold text-muted">{sub}</p>}
    </div>
  )
}

/** iOS-style on/off switch (role="switch" so screen readers announce on/off). */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue' : 'bg-[#c9caca]'}`}
    >
      <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : ''}`} />
    </button>
  )
}

/** Chip/pill that can be selected (selected = dark pill, as in the design). */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 rounded-full px-5 text-[17px] font-extrabold ${selected ? 'bg-ink text-white' : 'bg-card text-ink'}`}
    >
      {children}
    </button>
  )
}

/** Big display amount (design "Money · 900"): gray ₱ + digits. Pass a non-negative amount. */
export function BigMoney({ centavos, className = '' }: { centavos: number; className?: string }) {
  return (
    <span className={`leading-none font-black ${className}`}>
      <span className="text-[0.5em] opacity-50">₱</span>
      {formatPeso(centavos).slice(1)}
    </span>
  )
}

/** Big centered money field: gray ₱ + Nunito 900 digits. Shrinks on narrow phones. */
export function MoneyField({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="block text-center">
      <span className="text-[17px] font-extrabold text-muted">{label}</span>
      <span className="mt-1 flex items-center justify-center gap-2">
        <span className="text-[clamp(2rem,9vw,2.75rem)] font-black text-muted" aria-hidden="true">₱</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full max-w-[8ch] bg-transparent text-[clamp(3rem,16vw,4.5rem)] leading-none font-black outline-none placeholder:text-pebble-2"
        />
      </span>
    </label>
  )
}

const paths = {
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  plus: 'M12 5v14M5 12h14',
  sidebar: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
} as const

/** Outline icon (24px grid, 2px stroke) — decorative unless given a label by its parent. */
export function Icon({ name, className = 'size-6' }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
