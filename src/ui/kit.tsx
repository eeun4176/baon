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
import {
  ArrowRight, Book, Bus, Calendar, ChartPie, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, CloudUpload, Coffee, Delete, Download,
  Ellipsis, Flame, HardDrive, History, House, Lock, LogOut, Mail, Monitor, Moon, PanelLeftClose, Pencil, PiggyBank, Plus, Printer,
  Search, Share2, Shield, Tag, Smartphone, Sun, Ticket, Trash2, User, Users, Utensils, Wallet, X,
} from 'lucide-react'
import { formatPeso } from '../ledger/money.ts'
import { tr } from '../i18n/i18n.ts'

/** Full-height page column with safe-area padding. `footer` sticks to the bottom (main action). */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
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
    <main className="mx-auto w-full max-w-md animate-rise px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-36 md:max-w-2xl md:px-8 md:pt-8 md:pb-10 lg:max-w-6xl">
      {children}
    </main>
  )
}

/** Page heading (design pages 19–22): title + gray subtitle, actions on the right. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-5">
      <div>
        <h1 className="text-[clamp(1.5rem,7vw,2rem)] leading-tight font-black">{title}</h1>
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
    // Tabs grow from their own text width (not equal columns), so a long label like
    // "Preferences" never spills out of its pill on narrow phones.
    <div role="tablist" aria-label={label} className={`flex gap-1 rounded-full bg-pebble-2 p-1 ${className}`}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`min-h-11 flex-auto rounded-full px-2 text-sm font-extrabold whitespace-nowrap min-[360px]:px-2.5 min-[400px]:text-[0.9375rem] sm:px-4 sm:text-base ${value === id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** White rounded card (design: radius 26–30px, no border). Phones: tighter corners and padding, same on every card. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-card p-4 sm:rounded-[28px] sm:p-5 ${className}`}>{children}</div>
}

const variants = {
  primary: 'bg-blue text-white',
  secondary: 'bg-pebble text-ink',
  dark: 'bg-ink text-card',
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
        <button type="button" onClick={onBack} aria-label={tr('Back')} className="grid size-11 shrink-0 place-items-center rounded-full bg-card">
          <Icon name="chevron-left" />
        </button>
      ) : (
        <span className="size-11 shrink-0" />
      )}
      <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} aria-label={tr('Step {0} of 4', step)}>
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
    <div className="mt-6 mb-5">
      <h1 className="text-[clamp(1.5rem,7vw,2rem)] leading-tight font-black">{children}</h1>
      {sub && <p className="mt-2 font-semibold text-muted">{sub}</p>}
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
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue' : 'bg-bar'}`}
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
      className={`min-h-12 rounded-full px-5 text-[1.0625rem] font-extrabold ${selected ? 'bg-ink text-card' : 'bg-card text-ink'}`}
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
      <span className="text-[1.0625rem] font-extrabold text-muted">{label}</span>
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

// Icons come from Lucide (lucide.dev, ISC license); only the ones listed here are bundled.
const ICONS = {
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  phone: Smartphone,
  users: Users,
  shield: Shield,
  mail: Mail,
  home: House,
  history: History,
  calendar: Calendar,
  user: User,
  plus: Plus,
  sidebar: PanelLeftClose,
  check: Check,
  bus: Bus,
  utensils: Utensils,
  printer: Printer,
  backspace: Delete,
  arrow: ArrowRight,
  flame: Flame,
  cloud: CloudUpload,
  help: CircleHelp,
  search: Search,
  x: X,
  trash: Trash2,
  pencil: Pencil,
  book: Book,
  cup: Coffee,
  dots: Ellipsis,
  wallet: Wallet,
  piggy: PiggyBank,
  download: Download,
  drive: HardDrive,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  logout: LogOut,
  pie: ChartPie,
  ticket: Ticket,
  share: Share2,
  tag: Tag,
  lock: Lock,
} as const

/** Icon name type, for components that take an icon as a prop. */
export type IconName = keyof typeof ICONS

/** Outline icon (Lucide, 2px stroke) — decorative unless given a label by its parent. */
export function Icon({ name, className = 'size-6' }: { name: IconName; className?: string }) {
  const Svg = ICONS[name]
  return <Svg className={className} aria-hidden="true" />
}
