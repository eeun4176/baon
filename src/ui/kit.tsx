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
    <main className="mx-auto w-full max-w-md animate-rise px-5 pt-[max(env(safe-area-inset-top),1.5rem)] pb-36 md:max-w-2xl md:px-8 md:pt-8 md:pb-10 lg:max-w-6xl">
      {children}
    </main>
  )
}

/** Page heading (design pages 19–22): title + gray subtitle, actions on the right. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[clamp(1.75rem,8vw,2.125rem)] leading-tight font-black">{title}</h1>
        {/* Subtitles are a desktop thing in the design; phones keep the title row compact. */}
        {sub && <p className="mt-1 hidden font-semibold text-muted md:block">{sub}</p>}
      </div>
      {actions}
    </div>
  )
}

/** Pill segmented control (design: List · Charts, Expense · Allowance · Move · Save). */
export function Segmented<T extends string>({ options, value, onChange, label, className = '' }: {
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={`grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-pebble-2 p-1 ${className}`}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`min-h-10 rounded-full px-2 text-[15px] font-extrabold sm:px-4 sm:text-base ${value === id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
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
      className={`flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 text-lg font-black disabled:opacity-40 ${variants[variant]} ${className}`}
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
    // key = amount: React re-mounts the span when the number changes, replaying the pop.
    <span key={centavos} className={`inline-block animate-pop leading-none font-black ${className}`}>
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
  bus: 'M6 3h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 11h16M8 18v3M16 18v3',
  utensils: 'M4 2v7a3 3 0 0 0 3 3v10M10 2v7M7 2v7M17 22V2c-2 1.5-3 4-3 7v4h3',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  backspace: 'M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  flame: 'M12 22a7 7 0 0 0 7-7c0-4-3.5-6.5-4.5-10C12 7 11 9 10 9.5 9 8 8.5 7 8.5 6 6 8 5 11 5 15a7 7 0 0 0 7 7z',
  cloud: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8M12 12v8M9 15l3-3 3 3',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  x: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  pencil: 'M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  cup: 'M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M21 12h-5a2 2 0 0 0 0 4h5z',
  piggy: 'M19 10c1 0 2 .5 2 2v2h-2l-1 3h-3v-2h-4v2H8l-1-3a5 5 0 0 1 3-9h3a5 5 0 0 1 4 2zM2 9a3 3 0 0 0 3 3',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  drive: 'M22 12H2M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6zM6 16h.01M10 16h.01',
} as const

/** Icon name type, for components that take an icon as a prop. */
export type IconName = keyof typeof paths

/** Outline icon (24px grid, 2px stroke) — decorative unless given a label by its parent. */
export function Icon({ name, className = 'size-6' }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
