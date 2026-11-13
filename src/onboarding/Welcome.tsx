/*
 * Welcome.tsx — Onboarding's first screen on phones (design "Get started", mobile): the big buddy
 * picture, the promise, and "Get started". Desktop skips it: the picture is already on the left.
 */
import { Button } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'
import { BuddyArt } from './BrandPanel.tsx'

/** First screen a new student sees. */
export function Welcome({ onStart, onBack }: { onStart: () => void; onBack?: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-3 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.25rem)]">
      <BuddyArt />
      <div className="px-3">
        <h1 className="text-[clamp(1.75rem,8.5vw,2.125rem)] leading-[1.12] font-black text-balance">{tr('Know what you can spend today.')}</h1>
        <p className="mt-2.5 text-[1.0625rem] font-semibold text-muted">{tr('Log your baon in seconds, even offline.')}</p>
      </div>
      <div className="px-3">
        <Button onClick={onStart}>{tr('Get started')}</Button>
        <p className="mt-2.5 text-center text-sm font-bold text-muted">{tr('Set up online once, then it works offline.')}</p>
        {onBack && (
          <button type="button" onClick={onBack} className="mt-1 min-h-11 w-full font-extrabold text-blue hover:underline">{tr('Back to accounts')}</button>
        )}
      </div>
    </main>
  )
}
