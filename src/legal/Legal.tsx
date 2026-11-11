/*
 * Legal.tsx — Privacy Policy, Terms and Conditions, and Local Storage Policy as a pop-up
 * (text in docs.ts). Opened from Help & privacy → Policies and from the Sign in screen;
 * there are no separate policy pages. Uses no router links, so it also works before sign-in.
 */
import { Modal } from '../ui/Modal.tsx'
import { DOCS, LAST_UPDATED, type DocId } from './docs.ts'

/** One policy in a pop-up: date, intro, short sections. */
export function PolicyDialog({ id, onClose }: { id: DocId; onClose: () => void }) {
  const doc = DOCS[id]
  return (
    <Modal title={doc.title} onClose={onClose}>
      <p className="text-sm font-extrabold tracking-[0.12em] text-muted uppercase">Last updated {LAST_UPDATED}</p>
      <p className="mt-2 text-lg font-semibold">{doc.intro}</p>
      <dl className="mt-4 space-y-4">
        {doc.sections.map(([heading, body]) => (
          <div key={heading}>
            <dt className="font-black">{heading}</dt>
            <dd className="mt-0.5 font-semibold text-muted">{body}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onClose} className="mt-6 min-h-13 w-full rounded-full bg-pebble px-6 text-lg font-black hover:bg-pebble-2">Close</button>
    </Modal>
  )
}
