/*
 * WhosePhone.tsx — Onboarding screen 3 (design "3 Whose phone?"): picks the device mode.
 * My own phone: Baon opens right away. Shared: the next step makes a passphrase, and Baon
 * asks for it every time it opens (vault.ts, lock/LockScreen.tsx). Also the way into restoring a backup.
 */
import type { DeviceMode } from '../db/db.ts'
import { Button, Icon, Screen, StepHeader, Title } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

/** Device-mode choice (controlled, so the choice survives going back). */
export function WhosePhone({ mode, onMode, onContinue, onRestore }: { mode: DeviceMode; onMode: (mode: DeviceMode) => void; onContinue: () => void; onRestore: () => void }) {
  const option = (value: DeviceMode) => `flex cursor-pointer items-center gap-4 rounded-3xl sm:rounded-[28px] border-[3px] bg-card p-4 ${mode === value ? 'border-blue' : 'border-transparent'}`
  const badge = (value: DeviceMode) => `grid size-14 shrink-0 place-items-center rounded-2xl ${mode === value ? 'bg-blue-tint text-blue' : 'bg-pebble'}`
  return (
    <Screen footer={<Button onClick={onContinue}>{tr('Continue')}</Button>}>
      <StepHeader step={2} />
      <Title sub={tr('This decides how your records are locked. You can change it later.')}>{tr('Whose phone is this?')}</Title>

      <fieldset className="space-y-3">
        <legend className="sr-only">{tr('Device type')}</legend>

        <label className={option('my-phone')}>
          <span className={badge('my-phone')}><Icon name="phone" /></span>
          <span className="flex-1">
            <span className="block text-lg font-black">{tr('My own phone')}</span>
            <span className="block font-semibold text-muted">{tr('Opens right away. Add a PIN or fingerprint lock if you want.')}</span>
          </span>
          <input type="radio" name="mode" checked={mode === 'my-phone'} onChange={() => onMode('my-phone')} className="size-7 shrink-0 accent-blue" />
        </label>

        <label className={option('shared')}>
          <span className={badge('shared')}><Icon name="users" /></span>
          <span className="flex-1">
            <span className="block text-lg font-black">{tr('Shared with family or classmates')}</span>
            <span className="block font-semibold text-muted">{tr('Asks for a passphrase every time Baon opens, so others can’t see your records.')}</span>
          </span>
          <input type="radio" name="mode" checked={mode === 'shared'} onChange={() => onMode('shared')} className="size-7 shrink-0 accent-blue" />
        </label>
      </fieldset>

      <button type="button" onClick={onRestore} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-extrabold text-blue hover:underline">
        {tr('Moving from another phone? Restore a backup')}</button>
    </Screen>
  )
}
