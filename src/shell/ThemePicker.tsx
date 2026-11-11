/*
 * ThemePicker.tsx — Light / Dark / Device switch (Device follows the phone or computer).
 * Used in the sidebar profile menu and on Me → Preferences. Saved per device.
 */
import { useState } from 'react'
import { getTheme, setTheme, type ThemeChoice } from '../theme.ts'
import { Icon, type IconName } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

const THEMES: { id: ThemeChoice; label: string; icon: IconName }[] = [
  { id: 'light', label: tr('Light'), icon: 'sun' },
  { id: 'dark', label: tr('Dark'), icon: 'moon' },
  { id: 'device', label: tr('Device'), icon: 'monitor' },
]

/** Three-way theme switch. `large` = bigger touch targets (Me page). */
export function ThemePicker({ large = false }: { large?: boolean }) {
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme)

  /** Saves the theme choice and repaints the app. */
  function choose(t: ThemeChoice) {
    setTheme(t)
    setThemeState(t)
  }

  return (
    <div role="radiogroup" aria-label={tr('Theme')} className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          onClick={() => choose(t.id)}
          className={`flex items-center justify-center gap-1.5 rounded-lg font-extrabold ${large ? 'min-h-11' : 'min-h-9 text-sm'} ${
            theme === t.id ? 'bg-card text-blue shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <Icon name={t.icon} className="size-4" />
          {t.label}
        </button>
      ))}
    </div>
  )
}
