/*
 * Snackbar.tsx — The dark message bar after saving ("Saved ₱15 · Jeep  Undo").
 * Sits above the phone's bottom nav, or at the bottom of the content on desktop.
 * Announced politely to screen readers; disappears after 5 seconds.
 */
import { useSession } from '../session.ts'

/** Shows the current toast, if any. */
export function Snackbar({ aboveNav }: { aboveNav: boolean }) {
  const { toast, dismissToast } = useSession()
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-md justify-center px-4 md:bottom-6 ${
        aboveNav ? 'bottom-[calc(max(env(safe-area-inset-bottom),0.875rem)+5rem)]' : 'bottom-[max(env(safe-area-inset-bottom),1rem)]'
      }`}
    >
      {toast && (
        <div className="pointer-events-auto flex min-h-14 w-full max-w-md items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-white shadow-lg">
          <p className="flex-1 truncate font-extrabold">{toast.message}</p>
          {toast.undo && (
            <button
              type="button"
              onClick={() => { toast.undo?.(); dismissToast() }}
              className="min-h-11 rounded-full bg-white/15 px-5 font-black text-white"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
