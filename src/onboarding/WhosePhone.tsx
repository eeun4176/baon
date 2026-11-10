/*
 * WhosePhone.tsx — Onboarding screen 3 (design "3 Whose phone?"): picks the device
 * mode. "Shared" (passphrase + Recovery Kit) isn't built yet, so it is shown but
 * disabled with an honest note — the app must not claim shared-device safety
 * before those tests pass (plan §9 release gate).
 */
import { Button, Icon, Screen, StepHeader, Title } from '../ui/kit.tsx'

/** Device-mode choice. Only "My own phone" is available for now. */
export function WhosePhone({ onContinue }: { onContinue: () => void }) {
  return (
    <Screen footer={<Button onClick={onContinue}>Continue</Button>}>
      <StepHeader step={2} />
      <Title sub="This decides how your records are locked. You can change it later.">Whose phone is this?</Title>

      <fieldset className="space-y-3">
        <legend className="sr-only">Device type</legend>

        <label className="flex cursor-pointer items-center gap-4 rounded-[28px] border-[3px] border-blue bg-card p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-blue-tint text-blue"><Icon name="phone" /></span>
          <span className="flex-1">
            <span className="block text-lg font-black">My own phone</span>
            <span className="block font-semibold text-muted">Opens right away. Add a PIN or fingerprint lock if you want.</span>
          </span>
          <input type="radio" name="mode" defaultChecked className="size-7 shrink-0 accent-blue" />
        </label>

        <label className="flex items-center gap-4 rounded-[28px] border-[3px] border-transparent bg-card p-4 opacity-60">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-pebble"><Icon name="users" /></span>
          <span className="flex-1">
            <span className="block text-lg font-black">Shared with family or classmates</span>
            <span className="block font-semibold text-muted">Coming soon — passphrase lock so others can’t see your records.</span>
          </span>
          <input type="radio" name="mode" disabled className="size-7 shrink-0" />
        </label>
      </fieldset>
    </Screen>
  )
}
