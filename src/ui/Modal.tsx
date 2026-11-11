/*
 * Modal.tsx — Shared pop-up shell (native <dialog>: focus trap, Esc, dimmed backdrop).
 * Phones: sheet that slides up from the bottom. Desktop: centered card.
 * Used by Plan (school expenses, class days) and the one-tap button editor.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './kit.tsx'
import { tr } from '../i18n/i18n.ts'

/** Native <dialog> shell (focus trap + Esc): sheet from the bottom on phones, card on desktop. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => e.target === ref.current && onClose()} // click on the dimmed backdrop
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none animate-sheet overflow-y-auto rounded-t-[32px] border-0 bg-card p-0 text-ink shadow-2xl md:m-auto md:max-w-lg md:animate-dialog md:rounded-[32px]"
    >
      <div className="p-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black md:text-2xl">{title}</h2>
          <button type="button" onClick={onClose} aria-label={tr('Close')} className="grid size-11 shrink-0 place-items-center rounded-full bg-pebble hover:bg-pebble-2">
            <Icon name="x" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
