/*
 * AdjustmentDialog.tsx — What opens when a "Balance adjusted" entry is tapped (History, Home).
 * Adjustments come from Me → wallet → Match my balance, so there's nothing to edit here:
 * it explains the entry and lets the student delete it (with Undo). To change it, match again.
 */
import type { Transaction } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Icon } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { LOCALE, tr } from '../i18n/i18n.ts'

const when = new Intl.DateTimeFormat(LOCALE, { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' })

/** One balance adjustment: amount, wallet, date, and Delete. */
export function AdjustmentDialog({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { wallets, addTransaction, removeTransaction, showToast } = useSession()
  const wallet = wallets.find((w) => w.id === tx.walletId)?.name ?? tr('This wallet')

  /** Deletes it, with Undo. */
  async function remove() {
    await removeTransaction(tx.id)
    onClose()
    showToast({ message: tr('Entry deleted'), undo: () => addTransaction(tx) })
  }

  return (
    <Modal title={tr('Balance adjusted')} onClose={onClose}>
      <p className="text-center text-[clamp(2.5rem,12vw,3.5rem)] leading-tight font-black">
        {tx.kind === 'adjust-up' ? '+' : '−'}{formatPeso(tx.amountCentavos)}</p>
      <p className="text-center font-extrabold text-muted">{wallet} · {when.format(new Date(tx.occurredAt))}</p>
      <p className="mt-4 rounded-2xl bg-page p-4 font-semibold text-muted">
        {tr('Added by Match my balance so Baon shows what your wallet really has, like bank interest or a fee. It isn’t spending or money in. To change it, match the balance again on Me.')}</p>
      <button type="button" onClick={remove} className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
        <Icon name="trash" className="size-5" /> {tr('Delete')}</button>
    </Modal>
  )
}
