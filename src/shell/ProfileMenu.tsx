/*
 * ProfileMenu.tsx — The profile button at the bottom of the sidebar. Clicking it opens
 * a small menu above it: Light / Dark / Device theme, Install baon (when the browser
 * allows it) and Sign out. Closes on outside click or Esc.
 */
import { useEffect, useRef, useState } from 'react'
import { firstName } from '../home/greetings.ts'
import { promptInstall, useCanInstall } from '../install.ts'
import { useSession } from '../session.ts'
import { getTheme, setTheme, type ThemeChoice } from '../theme.ts'
import { Icon, type IconName } from '../ui/kit.tsx'

const THEMES: { id: ThemeChoice; label: string; icon: IconName }[] = [
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'device', label: 'Device', icon: 'monitor' },
]

/** Profile row + its pop-up menu. `collapsed` shows just the avatar. */
export function ProfileMenu({ collapsed }: { collapsed: boolean }) {
  const { name, signOut } = useSession()
  const canInstall = useCanInstall()
  const [open, setOpen] = useState(false)
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme)
  const box = useRef<HTMLDivElement>(null)

  // Close when clicking anywhere else or pressing Esc.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** Saves the theme choice and repaints the app. */
  function choose(t: ThemeChoice) {
    setTheme(t)
    setThemeState(t)
  }

  const item = 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-bold hover:bg-page'

  return (
    <div ref={box} className="relative">
      {open && (
        <div
          id="profile-menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 animate-rise rounded-2xl border border-pebble bg-card p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]"
        >
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => choose(t.id)}
                className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold ${
                  theme === t.id ? 'bg-card text-blue shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon name={t.icon} className="size-4" />
                {t.label}
              </button>
            ))}
          </div>

          {canInstall && (
            <button type="button" className={`${item} mt-1`} onClick={() => { setOpen(false); promptInstall() }}>
              <Icon name="download" className="size-5" /> Install baon
            </button>
          )}

          <hr className="my-1.5 border-pebble" />
          <button type="button" className={item} onClick={signOut}>
            <Icon name="logout" className="size-5" /> Sign out
          </button>
          <p className="px-3 pt-1 pb-1.5 text-sm font-semibold text-muted">Signing out keeps your records encrypted on this device.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="profile-menu"
        aria-haspopup="true"
        title={collapsed ? `${name} — theme & sign out` : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl p-1.5 text-left hover:bg-page ${collapsed ? 'justify-center' : ''} ${open ? 'bg-page' : ''}`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-tint font-black text-blue" aria-hidden="true">
          {firstName(name).charAt(0).toUpperCase()}
        </span>
        <span className={collapsed ? 'sr-only' : 'min-w-0'}>
          <span className="block truncate font-black">{name}</span>
          <span className="block text-sm font-semibold text-muted">My phone · works offline</span>
        </span>
      </button>
    </div>
  )
}
