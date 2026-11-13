/*
 * ProfileMenu.tsx — The profile button at the bottom of the sidebar. Clicking it opens
 * a small menu above it: Light / Dark / Device theme, Install baon (when the browser
 * allows it) and Sign out. Closes on outside click or Esc.
 */
import { useEffect, useRef, useState } from 'react'
import { promptInstall, useCanInstall } from '../install.ts'
import { Avatar } from '../me/Avatar.tsx'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { ThemePicker } from './ThemePicker.tsx'
import { tr } from '../i18n/i18n.ts'

/** Profile row + its pop-up menu. `collapsed` shows just the avatar. */
export function ProfileMenu({ collapsed }: { collapsed: boolean }) {
  const { name, signOut, vault } = useSession()
  const canInstall = useCanInstall()
  const [open, setOpen] = useState(false)
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

  const item = 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-bold hover:bg-page'

  return (
    <div ref={box} className="relative">
      {open && (
        <div
          id="profile-menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 animate-rise rounded-2xl border border-pebble bg-card p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]"
        >
          <ThemePicker />

          {canInstall && (
            <button type="button" className={`${item} mt-1`} onClick={() => { setOpen(false); promptInstall() }}>
              <Icon name="download" className="size-5" /> {tr('Install Baon')}</button>
          )}

          <hr className="my-1.5 border-pebble" />
          <button type="button" className={item} onClick={signOut}>
            <Icon name={vault.shared() ? 'lock' : 'logout'} className="size-5" /> {vault.shared() ? tr('Lock Baon') : tr('Sign out')}</button>
          <p className="px-3 pt-1 pb-1.5 text-sm font-semibold text-muted">{vault.shared() ? tr('Opens again only with your passphrase.') : tr('Signing out keeps your records encrypted on this device.')}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="profile-menu"
        aria-haspopup="true"
        title={collapsed ? tr('{0} — theme & sign out', name) : undefined}
        className={`flex w-full items-center gap-3 overflow-hidden rounded-2xl p-1 text-left hover:bg-page ${open ? 'bg-page' : ''}`}
      >
        <Avatar className="size-10" />
        {/* stays in place and fades (no re-wrapping while the sidebar animates) */}
        <span className={`min-w-0 transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100 delay-75'}`}>
          <span className="block truncate font-black">{name}</span>
          <span className="block truncate text-sm font-semibold text-muted">{tr('My phone · Works offline')}</span>
        </span>
      </button>
    </div>
  )
}
