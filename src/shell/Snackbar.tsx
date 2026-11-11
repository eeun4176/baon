/*
 * Snackbar.tsx — The message after saving, deleting or undoing ("Saved ₱15 · Jeep  Undo").
 * Always at the bottom center: above the floating nav on phones, at the bottom of the
 * screen on desktop. Design system: Ink pill (like the hero cards), a blue check badge,
 * white bold text and a blue primary "Undo" pill. Slides up in, slides down out.
 * Announced politely to screen readers.
 */
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'

/** Shows the current toast, if any. */
export function Snackbar() {
  const { toast, dismissToast } = useSession()
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),0.875rem)+5.25rem)] z-40 flex justify-center px-4 md:bottom-6"
    >
      {toast && (
        <div
          key={toast.message}
          className={`pointer-events-auto flex min-h-14 w-full max-w-md items-center gap-3 rounded-full bg-hero py-2 pr-2 pl-2 text-white shadow-[0_16px_40px_-12px_rgba(29,31,30,0.6)] ${
            toast.leaving ? 'animate-toast-out' : 'animate-toast-in'
          }`}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue" aria-hidden="true">
            <Icon name="check" className="size-5" />
          </span>
          <p className="min-w-0 flex-1 truncate font-extrabold">{toast.message}</p>
          {toast.undo ? (
            <button
              type="button"
              onClick={() => { toast.undo?.(); dismissToast() }}
              className="min-h-11 shrink-0 rounded-full bg-blue px-5 font-black text-white hover:bg-[#3d74ff]"
            >
              Undo
            </button>
          ) : (
            <button type="button" onClick={dismissToast} aria-label="Dismiss" className="grid size-11 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10">
              <Icon name="x" className="size-5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
