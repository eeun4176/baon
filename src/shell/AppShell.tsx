/*
 * AppShell.tsx — The frame around every signed-in screen.
 *
 * Phone (< 768px): the design's floating white pill nav (Home · History · Plan · Me)
 *   with the separate round blue (+) button, fixed at the bottom for thumbs.
 * Tablet/desktop (≥ 768px): a sidebar in the same style (white rounded panel,
 *   light-blue active pill) that collapses to icons or expands with labels.
 *   It starts collapsed on tablets and expanded on laptops; the student's choice is
 *   remembered on this device.
 */
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import logoIcon from '../assets/logo-icon.png'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Snackbar } from './Snackbar.tsx'

const TABS = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/plan', label: 'Plan', icon: 'calendar' },
  { to: '/me', label: 'Me', icon: 'user' },
] as const

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

/** Signed-in layout: sidebar (tablet/desktop) or bottom nav (phone) around the current page. */
export function AppShell() {
  const { name } = useSession()
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const onAddScreen = useLocation().pathname === '/add'

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
      {/* ── Sidebar: tablet & desktop ─────────────────────────────── */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 p-4 transition-[width] duration-200 md:block ${collapsed ? 'w-[6.5rem]' : 'w-72'}`}
      >
        <nav aria-label="Main" className="flex h-full flex-col rounded-[28px] bg-card p-3">
          <div className={`flex items-center gap-2.5 px-2 pt-2 pb-6 ${collapsed ? 'justify-center' : ''}`}>
            <img src={logoIcon} alt="" className="size-10 shrink-0" />
            {!collapsed && <span className="text-[28px] font-black tracking-tight">baon</span>}
          </div>

          <ul className="space-y-1.5">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end
                  title={collapsed ? t.label : undefined}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-full font-extrabold transition-colors ${collapsed ? 'justify-center' : 'px-4'} ${
                      isActive ? 'bg-blue-tint text-blue' : 'text-muted hover:bg-page hover:text-ink'
                    }`
                  }
                >
                  <Icon name={t.icon} />
                  <span className={collapsed ? 'sr-only' : ''}>{t.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <Link
            to="/add"
            title={collapsed ? 'Add expense' : undefined}
            className={`mt-5 flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue font-black text-white shadow-[0_10px_24px_-8px_rgba(30,94,255,0.6)] ${collapsed ? 'mx-auto size-14' : 'px-5'}`}
          >
            <Icon name="plus" />
            <span className={collapsed ? 'sr-only' : ''}>Add expense</span>
          </Link>

          <div className="mt-auto space-y-3">
            {!collapsed && (
              <div className="rounded-3xl bg-page p-4">
                <p className="truncate font-black">{name}</p>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                  <span className="size-2 shrink-0 rounded-full bg-blue" aria-hidden="true" />
                  Saved on this device · works offline
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`flex min-h-12 w-full items-center gap-3 rounded-full font-extrabold text-muted hover:bg-page hover:text-ink ${collapsed ? 'justify-center' : 'px-4'}`}
            >
              <Icon name="sidebar" />
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* ── Current page ──────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>

      <Snackbar aboveNav={!onAddScreen} />

      {/* ── Bottom nav + (+): phone only, hidden on Quick Add (its keypad needs the space) ── */}
      <nav
        aria-label="Main"
        hidden={onAddScreen}
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 px-3.5 pb-[max(env(safe-area-inset-bottom),0.875rem)] md:hidden"
      >
        <ul className="flex h-[68px] flex-1 items-center justify-around rounded-full bg-card px-1.5 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.18)]">
          {TABS.map((t) => (
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
          to="/add"
          aria-label="Add expense"
          className="grid size-16 shrink-0 place-items-center rounded-full bg-blue text-white shadow-[0_10px_24px_-6px_rgba(30,94,255,0.6)]"
        >
          <Icon name="plus" className="size-8" />
        </Link>
      </nav>
    </div>
  )
}
