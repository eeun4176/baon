/*
 * AppShell.tsx — The frame around every signed-in screen (design p6–p11 phone, p18–p22 desktop).
 *
 * Phone (< 768px): floating white pill nav (Home · History · Plan · Me) + round blue (+).
 * Tablet/desktop (≥ 768px): sidebar — logo + tagline, Add expense, Home · History · Plan ·
 *   Streak · Me, then Backup · Help & privacy, storage used and the profile at the bottom.
 *   Collapses to icons; starts collapsed on tablets, expanded on laptops; remembered per device.
 * Also hosts the Add dialog (opened by "?add=1" in the URL) and the Undo toast.
 */
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useSearchParams } from 'react-router'
import logoIcon from '../assets/logo-icon.png'
import { QuickAdd } from '../add/QuickAdd.tsx'
import { Icon, type IconName } from '../ui/kit.tsx'
import { useKeepTodaySnapshot } from '../streak/useStreak.ts'
import { ProfileMenu } from './ProfileMenu.tsx'
import { Snackbar } from './Snackbar.tsx'
import { useAddDialog } from './useAddDialog.ts'

const MAIN: { to: string; label: string; icon: IconName; phone: boolean }[] = [
  { to: '/', label: 'Home', icon: 'home', phone: true },
  { to: '/history', label: 'History', icon: 'history', phone: true },
  { to: '/plan', label: 'Plan', icon: 'calendar', phone: true },
  { to: '/streak', label: 'Streak', icon: 'flame', phone: false },
  { to: '/me', label: 'Me', icon: 'user', phone: true },
]
const MORE: { to: string; label: string; icon: IconName }[] = [
  { to: '/backup', label: 'Backup', icon: 'cloud' },
  { to: '/help', label: 'Help & privacy', icon: 'help' },
]

const STORAGE_KEY = 'baon.sidebar'

/** Initial sidebar state: the remembered choice, else collapsed below 1024px. */
function initialCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved === 'collapsed'
  } catch {
    // storage blocked (private mode): fall through to the screen-size default
  }
  return !window.matchMedia('(min-width: 1024px)').matches
}

/** How much this site stores on the device, e.g. "1.2 MB" (null if the browser won't say). */
function useStorageUsed(): string | null {
  const [used, setUsed] = useState<string | null>(null)
  useEffect(() => {
    navigator.storage?.estimate?.().then(({ usage = 0 }) => {
      setUsed(usage < 1_000_000 ? `${Math.max(1, Math.round(usage / 1000))} KB` : `${(usage / 1_000_000).toFixed(1)} MB`)
    }, () => {})
  }, [])
  return used
}

/** One sidebar link (icon + label, or icon only when collapsed). */
function SideLink({ to, label, icon, collapsed }: { to: string; label: string; icon: IconName; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex min-h-12 items-center gap-3 rounded-2xl font-extrabold ${collapsed ? 'justify-center' : 'px-4'} ${
          isActive ? 'bg-blue-tint text-blue' : 'text-ink/80 hover:bg-page hover:text-ink'
        }`
      }
    >
      <Icon name={icon} className="size-5" />
      <span className={collapsed ? 'sr-only' : ''}>{label}</span>
    </NavLink>
  )
}

/** Signed-in layout: sidebar (tablet/desktop) or bottom nav (phone) around the current page. */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [params] = useSearchParams()
  const addDialog = useAddDialog()
  const storage = useStorageUsed()
  const addOpen = params.has('add')
  useKeepTodaySnapshot()

  /** Collapses/expands the sidebar and remembers it. */
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? 'expanded' : 'collapsed')
      } catch {
        // not remembered — fine
      }
      return !c
    })
  }

  return (
    <div className="flex min-h-dvh">
      {/* ── Sidebar: tablet & desktop (design p18) ───────────────────── */}
      <aside className={`sticky top-0 hidden h-dvh shrink-0 p-3 transition-[width] duration-300 ease-(--ease-soft) md:block ${collapsed ? 'w-24' : 'w-[18.5rem]'}`}>
        <nav aria-label="Main" className="flex h-full flex-col rounded-[28px] bg-card p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
          {collapsed ? (
            // Collapsed: the logo itself expands the sidebar (no separate toggle button).
            <button
              type="button"
              onClick={toggle}
              aria-expanded={false}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="mx-auto mt-1 mb-4 rounded-xl ring-blue/40 hover:ring-4"
            >
              <img src={logoIcon} alt="" className="size-11" />
            </button>
          ) : (
            <div className="flex items-center gap-2.5 px-1 pt-1 pb-4">
              <img src={logoIcon} alt="" className="size-11 shrink-0" />
              <div className="min-w-0 flex-1 animate-fade">
                <p className="text-2xl leading-none font-black tracking-tight">baon</p>
                <p className="text-xs leading-tight font-bold text-muted">Your daily sakto baon</p>
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-expanded={true}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-page hover:text-ink"
              >
                <Icon name="sidebar" className="size-5" />
              </button>
            </div>
          )}

          <Link
            to="?add=1"
            state={{ modal: true }}
            title={collapsed ? 'Add expense' : undefined}
            className={`mb-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue font-black text-white shadow-[0_4px_10px_-4px_rgba(30,94,255,0.5)] hover:bg-[#1a52e0] ${collapsed ? 'mx-auto size-12' : 'px-5'}`}
          >
            <Icon name="plus" className="size-5" />
            <span className={collapsed ? 'sr-only' : ''}>Add expense</span>
          </Link>

          <ul className="space-y-1">
            {MAIN.map((t) => <li key={t.to}><SideLink {...t} collapsed={collapsed} /></li>)}
          </ul>
          <hr className="mx-2 my-4 border-pebble" />
          <ul className="space-y-1">
            {MORE.map((t) => <li key={t.to}><SideLink {...t} collapsed={collapsed} /></li>)}
          </ul>

          <div className="mt-auto space-y-3 pt-4">
            {storage && !collapsed && (
              <p className="flex animate-fade items-center gap-2 rounded-2xl border border-pebble px-3 py-2.5 text-sm font-bold text-muted">
                <Icon name="drive" className="size-4 shrink-0" />
                {storage} · saved on this device
              </p>
            )}
            <ProfileMenu collapsed={collapsed} />
          </div>
        </nav>
      </aside>

      {/* ── Current page (each page fades up as it opens) ──────────── */}
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>

      <Snackbar />

      {/* ── Bottom nav + (+): phone only (design p6) ─────────────────── */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 px-3.5 pb-[max(env(safe-area-inset-bottom),0.875rem)] md:hidden">
        <ul className="flex h-[68px] flex-1 items-center justify-around rounded-full bg-card px-1.5 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.18)]">
          {MAIN.filter((t) => t.phone).map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end
                className={({ isActive }) =>
                  `mx-auto flex h-14 max-w-20 flex-col items-center justify-center rounded-full text-xs font-extrabold ${isActive ? 'bg-blue-tint text-blue' : 'text-muted'}`
                }
              >
                <Icon name={t.icon} />
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <Link
          to="?add=1"
          state={{ modal: true }}
          aria-label="Add expense"
          className="grid size-16 shrink-0 place-items-center rounded-full bg-blue text-white shadow-[0_10px_24px_-6px_rgba(30,94,255,0.6)]"
        >
          <Icon name="plus" className="size-8" />
        </Link>
      </nav>

      {addOpen && <QuickAdd key={params.get('edit') ?? 'new'} editId={params.get('edit')} onClose={addDialog.close} />}
    </div>
  )
}
