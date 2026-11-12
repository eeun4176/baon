/*
 * WhosePhone.tsx — Onboarding step 2 (design "Device"): picks the device mode.
 * My own phone: Baon opens right away. Shared: the next step makes a passphrase, and Baon
 * asks for it every time it opens (vault.ts, lock/LockScreen.tsx). Also the way into restoring a backup.
 */
import type { DeviceMode } from '../db/db.ts'
import { Button, Icon } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'
import { Step } from './Step.tsx'

/** Device-mode choice (controlled, so the choice survives going back). */
export function WhosePhone({ mode, onMode, onContinue, onRestore }: { mode: DeviceMode; onMode: (mode: DeviceMode) => void; onContinue: () => void; onRestore: () => void }) {
  const option = (value: DeviceMode) => `flex cursor-pointer items-center gap-3.5 rounded-3xl border-[3px] bg-page p-3.5 lg:p-4 ${mode === value ? 'border-blue' : 'border-pebble'}`
  const badge = (value: DeviceMode) => `grid size-12 shrink-0 place-items-center rounded-2xl lg:size-13 ${mode === value ? 'bg-blue-tint text-blue' : 'bg-card'}`
  return (
    <Step
      n={2}
      title={tr('Whose phone is this?')}
      sub={tr('This sets how your records are locked. Change it anytime.')}
      footer={<Button onClick={onContinue}>{tr('Continue')}</Button>}
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">{tr('Device type')}</legend>

        <label className={option('my-phone')}>
          <span className={badge('my-phone')}><Icon name="phone" /></span>
          <span className="flex-1">
            <span className="block text-lg font-black">{tr('My own phone')}</span>
            <span className="block font-semibold text-muted">{tr('Opens right away.')}</span>
          </span>
          <input type="radio" name="mode" checked={mode === 'my-phone'} onChange={() => onMode('my-phone')} className="size-6 shrink-0 accent-blue" />
        </label>

        <label className={option('shared')}>
          <span className={badge('shared')}><Icon name="users" /></span>
          <span className="flex-1">
            <span className="block text-lg font-black">{tr('Shared with others')}</span>
            <span className="block font-semibold text-muted">{tr('A passphrase keeps your records hidden.')}</span>
          </span>
          <input type="radio" name="mode" checked={mode === 'shared'} onChange={() => onMode('shared')} className="size-6 shrink-0 accent-blue" />
        </label>
      </fieldset>

      <button type="button" onClick={onRestore} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-extrabold text-blue hover:underline">
        {tr('Moving from another phone? Restore a backup')}</button>
    </Step>
  )
}
