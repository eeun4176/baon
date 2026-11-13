/*
 * AppShell.tsx — The frame around every signed-in screen.
 *
 * Phone (< 768px): floating white pill nav (Home · History · Plan · Me) + round blue (+).
 * Tablet/desktop (≥ 768px): sidebar — logo + tagline, Add expense, Home · History · Plan ·
 *   Streak · Me, then Backup · Help & privacy, storage used and the profile at the bottom.
 *   Collapses to icons; starts collapsed on tablets, expanded on laptops; remembered per device.
 *   Smooth toggle: icons keep the same spot in both states and text never wraps — labels
 *   just fade and are clipped while the width animates (no jumping or re-wrapping).
 * Also hosts the Add dialog (opened by "?add=1" in the URL) and the Undo toast.
 */
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router'
import logoIcon from '../assets/logo-icon.png'
import { QuickAdd } from '../add/QuickAdd.tsx'
import { Icon, type IconName } from '../ui/kit.tsx'
import { useKeepTodaySnapshot } from '../streak/useStreak.ts'
import { useGooglePhotoSync } from '../me/photo.ts'
import { ProfileMenu } from './ProfileMenu.tsx'
import { Snackbar } from './Snackbar.tsx'
import { pageTitle } from '../pageTitle.ts'
import { formatBytes, keepStorage, useStorage } from '../storage.ts'
import { useAutoSync } from '../sync/useSync.ts'
import { useAddDialog } from './useAddDialog.ts'
import { useSession } from '../session.ts'
import { tr } from '../i18n/i18n.ts'

const MAIN: { to: string; label: string; icon: IconName; phone: boolean }[] = [
  { to: '/', label: tr('Home'), icon: 'home', phone: true },
  { to: '/history', label: tr('History'), icon: 'history', phone: true },
  { to: '/plan', label: tr('Plan'), icon: 'calendar', phone: true },
  { to: '/streak', label: tr('Streak'), icon: 'flame', phone: false },
  { to: '/me', label: tr('Me'), icon: 'user', phone: true },
]
const MORE: { to: string; label: string; icon: IconName }[] = [
  { to: '/backup', label: tr('Backup'), icon: 'cloud' },
  { to: '/help', label: tr('Help & privacy'), icon: 'help' },
]

const STORAGE_KEY = 'baon.sidebar'
let demoStarted = false // DEV ONLY: "?demo=" already ran on this page load

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

/** Label fade used by every sidebar text while the width animates. */
const fade = (collapsed: boolean) => `transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100 delay-75'}`

/** One sidebar link: icon at a fixed spot + label that fades (still read by screen readers when collapsed). */
function SideLink({ to, label, icon, collapsed }: { to: string; label: string; icon: IconName; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex min-h-12 items-center gap-3 overflow-hidden rounded-2xl pl-[0.875rem] font-extrabold whitespace-nowrap ${
          isActive ? 'bg-blue-tint text-blue' : 'text-ink/80 hover:bg-page hover:text-ink'
        }`
      }
    >
      <Icon name={icon} className="size-5 shrink-0" />
      <span className={fade(collapsed)}>{label}</span>
    </NavLink>
  )
}

/** Signed-in layout: sidebar (tablet/desktop) or bottom nav (phone) around the current page. */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const addDialog = useAddDialog()
  const [storageState] = useStorage()
  const storage = storageState?.usage ? formatBytes(storageState.usage) : null
  const addOpen = params.has('add')
  useKeepTodaySnapshot()

  // Browser tab title follows the page ("Plan | Baon Student Budget Tracker").
  useEffect(() => {
    document.title = pageTitle(pathname)
  }, [pathname])
  useGooglePhotoSync() // copies the Google profile photo when online
  useAutoSync() // keeps other devices in step, if sync is on for this one
  useEffect(() => void keepStorage(), []) // ask the browser not to clear Baon when space runs low

  // DEV ONLY: "?demo=add" / "?demo=clear" fills or empties sample data (src/dev/demo.ts).
  // import.meta.env.DEV is false in the live build, so this and demo.ts are left out of it.
  const { vault, allowance, reload, showToast } = useSession()
  const demo = params.get('demo')
  useEffect(() => {
    if (!import.meta.env.DEV || !demo || demoStarted) return
    demoStarted = true // dev runs effects twice; the demo must run once per page load
    import('../dev/demo.ts')
      .then(({ runDemo }) => runDemo(vault, allowance, demo))
      .then((message) => showToast({ message }), (e: unknown) => showToast({ message: `Demo failed: ${e instanceof Error ? e.message : e}` }))
      .finally(() => {
        reload()
        window.history.replaceState(null, '', window.location.pathname) // drop "?demo" so a refresh doesn't run it again
      })
  }, [demo]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once per "?demo=" visit

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
      {/* ── Sidebar: tablet & desktop ───────────────────── */}
      <aside className={`sticky top-0 hidden h-dvh shrink-0 p-3 transition-[width] duration-300 ease-(--ease-soft) md:block ${collapsed ? 'w-24' : 'w-[18.5rem]'}`}>
        <nav aria-label={tr('Main')} className="flex h-full flex-col rounded-[28px] bg-card p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
          <div className="mb-4 flex items-center gap-2.5 overflow-hidden pt-1">
            {collapsed ? (
              // Collapsed: the logo itself expands the sidebar (no separate toggle button).
              <button
                type="button"
                onClick={toggle}
                aria-expanded={false}
                aria-label={tr('Expand sidebar')}
                title={tr('Expand sidebar')}
                className="ml-[0.125rem] shrink-0 rounded-xl ring-blue/40 hover:ring-2"
              >
                <img src={logoIcon} alt="" className="size-11" />
              </button>
            ) : (
              <img src={logoIcon} alt="" className="ml-[0.125rem] size-11 shrink-0" />
            )}
            <div className={`shrink-0 whitespace-nowrap ${fade(collapsed)}`} aria-hidden={collapsed}>
              <p className="text-2xl leading-none font-black tracking-tight">{tr('Baon')}</p>
              <p className="text-xs leading-tight font-bold text-muted">{tr('Your daily sakto baon')}</p>
            </div>
            {!collapsed && (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={true}
                aria-label={tr('Collapse sidebar')}
                title={tr('Collapse sidebar')}
                className="ml-auto grid size-10 shrink-0 animate-fade place-items-center rounded-xl text-muted hover:bg-page hover:text-ink"
              >
                <Icon name="sidebar" className="size-5" />
              </button>
            )}
          </div>

          <Link
            to="?add=1"
            state={{ modal: true }}
            title={collapsed ? tr('Add expense') : undefined}
            className="mb-4 flex h-12 items-center justify-center overflow-hidden rounded-2xl bg-blue font-black whitespace-nowrap text-white shadow-[0_4px_10px_-4px_rgba(30,94,255,0.5)] hover:bg-[#1a52e0]"
          >
            <Icon name="plus" className="size-5 shrink-0" />
            {/* the label's width animates too, so the + glides to the center instead of jumping */}
            <span className={`overflow-hidden transition-[max-width,margin,opacity] duration-300 ease-(--ease-soft) ${collapsed ? 'max-w-0 opacity-0' : 'ml-2 max-w-40 opacity-100'}`}>
              {tr('Add expense')}</span>
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
              <p className="flex animate-fade items-center gap-2 overflow-hidden rounded-2xl border border-pebble px-3 py-2.5 text-sm font-bold whitespace-nowrap text-muted">
                <Icon name="drive" className="size-4 shrink-0" />
                {storage} {tr('· Saved on this device')}</p>
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

      {/* ── Bottom nav + (+): phone only ─────────────────── */}
      <nav aria-label={tr('Main')} className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 px-3.5 pb-[max(env(safe-area-inset-bottom),0.875rem)] md:hidden">
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
          aria-label={tr('Add expense')}
          className="grid size-16 shrink-0 place-items-center rounded-full bg-blue text-white shadow-[0_10px_24px_-6px_rgba(30,94,255,0.6)]"
        >
          <Icon name="plus" className="size-8" />
        </Link>
      </nav>

      {addOpen && <QuickAdd key={params.get('edit') ?? 'new'} editId={params.get('edit')} startMode={params.get('mode')} onClose={addDialog.close} />}
    </div>
  )
}
