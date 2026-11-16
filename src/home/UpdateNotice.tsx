/*
 * UpdateNotice.tsx — The dark notice at the bottom of Home (Home v2 design). Two cases:
 *   1. A new version took over while Baon was open (the service worker changed): "New version ready"
 *      with Refresh. Closing it hides it until the next visit, which opens the new version anyway.
 *   2. What's new, once per release: shown to students who already had entries before RELEASE.
 *      Any tap ("See what's new" or ✕) remembers it on this device, so it never shows again.
 * Hidden while a toast is showing (they share the bottom of the screen).
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from '../session.ts'
import { Icon, type IconName } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { tr } from '../i18n/i18n.ts'

const RELEASE = '2026-11-16' // bump with each release that has news; entries before it = an existing student
const SEEN_KEY = 'baon.whatsNew' // holds the RELEASE the student already saw

const NEWS: [IconName, string, string][] = [
  ['pie', tr('Usual expenses'), tr('Home shows where your money went this week.')],
  ['users', tr('Split the bill'), tr('Add → Expense. Friends owe you their share.')],
  ['piggy', tr('Savings goals'), tr('Plan. See how much to save each week.')],
  ['calendar', tr('Repeating bills'), tr('Plan → School expense → Repeats. Home reminds you.')],
  ['file', tr('Spreadsheet download'), tr('Me → Backup. Every entry as a CSV file.')],
]

/** True when this device already saw this release's news (or can't store it: then don't nag). */
function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === RELEASE
  } catch {
    return true
  }
}

/** Remembers that the news was seen on this device. */
function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, RELEASE)
  } catch {
    // private window: it may show again next time, that's all
  }
}

/** The notice (nothing when there's nothing to say). */
export function UpdateNotice() {
  const { transactions, toast } = useSession()
  const [ready, setReady] = useState(false)
  const [news, setNews] = useState(() => !seen() && transactions.some((tx) => tx.occurredAt < RELEASE))
  const [open, setOpen] = useState(false)

  // A new service worker taking over a page it already controlled = a new version is in.
  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw?.controller) return // first visit: the worker taking control isn't an update
    const onChange = () => setReady(true)
    sw.addEventListener('controllerchange', onChange)
    return () => sw.removeEventListener('controllerchange', onChange)
  }, [])

  /** Closes the what's-new notice for good. */
  function done() {
    markSeen()
    setNews(false)
  }

  /** Refresh (new version) or open the what's-new list (which counts as seen). */
  function act() {
    if (ready) return location.reload()
    done()
    setOpen(true)
  }

  /** ✕: hides the update until the next visit, or the news for good. */
  function close() {
    if (ready) setReady(false)
    else done()
  }

  const show = !toast && (ready || news)
  // Portal to <body>: the page's slide-in animation leaves a transform on <main>, which would pin a
  // "fixed" bar to the end of the page instead of the screen. Same spot as the Snackbar (toast).
  return createPortal(
    <>
      {show && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),0.875rem)+5.25rem)] z-40 flex justify-center px-4 md:bottom-6">
          <div className="pointer-events-auto flex w-full max-w-md animate-toast-in items-center gap-2.5 rounded-[22px] bg-hero py-2.5 pr-2.5 pl-3 text-white shadow-[0_18px_40px_-14px_rgba(29,31,30,0.55)] md:w-auto md:max-w-xl md:gap-3 md:rounded-full md:py-2 md:pr-2 md:pl-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[#8fb0ff]" aria-hidden="true"><Icon name="star" className="size-4" /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[0.8125rem] font-black md:text-sm">{ready ? tr('New version ready') : tr('Baon just updated')}</span>
              <span className="truncate text-[0.6875rem] font-bold text-white/75 md:text-xs">
                {ready ? tr('Refresh to get the latest.') : tr('New: usual expenses, bill splits, savings goals.')}</span>
            </span>
            <button type="button" onClick={act}
              className="h-9 shrink-0 rounded-full bg-blue px-3.5 text-[0.8125rem] font-extrabold text-white md:h-10 md:px-[1.125rem] md:text-sm">
              {ready ? tr('Refresh') : tr('What’s new')}</button>
            <button type="button" aria-label={tr('Close')} onClick={close}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/75 md:size-9">
              <Icon name="x" className="size-3.5" /></button>
          </div>
        </div>
      )}
      {open && (
        <Modal title={tr('What’s new in Baon')} onClose={() => setOpen(false)}>
          <ul className="flex flex-col gap-3">
            {NEWS.map(([icon, title, where]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-blue-tint text-blue" aria-hidden="true"><Icon name={icon} className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block font-black">{title}</span>
                  <span className="text-sm font-semibold text-muted">{where}</span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setOpen(false)} className="mt-5 min-h-13 w-full rounded-full bg-blue text-lg font-black text-white">{tr('Got it')}</button>
        </Modal>
      )}
    </>,
    document.body,
  )
}
