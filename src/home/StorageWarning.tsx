/*
 * StorageWarning.tsx — Home card when the phone is almost out of space (plan §9 "warns when
 * storage is low"): new entries may fail to save and the browser may clear site data, so it
 * points to a backup. Renders nothing otherwise.
 */
import { Link } from 'react-router'
import { isStorageLow, useStorage } from '../storage.ts'
import { Icon } from '../ui/kit.tsx'

/** The warning card; `className` places it in the Home grid. */
export function StorageWarning({ className = '' }: { className?: string }) {
  const [storage] = useStorage()
  if (!storage || !isStorageLow(storage)) return null
  return (
    <section role="status" className={`flex animate-rise flex-wrap items-center gap-4 rounded-3xl bg-ink p-4 sm:rounded-[28px] sm:p-5 text-card ${className}`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-card/15"><Icon name="drive" /></span>
      <div className="min-w-48 flex-1">
        <h2 className="text-lg font-black">Your phone is almost full</h2>
        <p className="font-semibold opacity-80">baon may not be able to save new entries. Free up some space, and save a backup to be safe.</p>
      </div>
      <Link to="/backup" className="flex min-h-12 w-full items-center justify-center rounded-full bg-blue px-5 font-black whitespace-nowrap text-white sm:w-auto">
        Back up now
      </Link>
    </section>
  )
}
