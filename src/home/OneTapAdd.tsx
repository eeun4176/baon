/*
 * OneTapAdd.tsx — Home's "One-tap add" card (design: Jeep ₱15, Lunch ₱80, Print ₱5,
 * Load ₱50). One tap logs the expense right away with the last-used wallet,
 * then shows Undo for 5 seconds (plan criterion C1: preset expense ≤ 2 taps).
 */
import { useState } from 'react'
import { DEFAULT_PRESETS, lastUsedWalletId, type Preset } from '../add/categories.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Card, Icon } from '../ui/kit.tsx'

/** 2×2 grid of preset buttons. */
export function OneTapAdd() {
  const { transactions, wallets, addTransaction, removeTransaction, showToast } = useSession()
  const [busy, setBusy] = useState<string | null>(null)

  /** Logs a preset as an expense now, with Undo. */
  async function log(p: Preset) {
    const walletId = lastUsedWalletId(transactions, wallets.find((w) => w.type === 'spending')?.id ?? 'cash')
    const id = crypto.randomUUID()
    setBusy(p.id)
    try {
      await addTransaction({
        id, kind: 'expense', amountCentavos: p.amountCentavos, walletId,
        categoryId: p.categoryId, occurredAt: new Date().toISOString(), note: p.label,
      })
      showToast({ message: `Saved ${formatPeso(p.amountCentavos)} · ${p.label}`, undo: () => removeTransaction(id) })
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Couldn’t save. Try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-black">One-tap add</h2>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {DEFAULT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy !== null}
            onClick={() => log(p)}
            aria-label={`Add ${p.label}, ${formatPeso(p.amountCentavos)}`}
            className="flex min-h-14 items-center gap-2 rounded-[20px] bg-page px-3 text-left text-[1.0625rem] font-black active:bg-pebble disabled:opacity-60"
          >
            <Icon name={p.icon} className="size-6 shrink-0 text-blue" />
            <span className="truncate">{p.label} {formatPeso(p.amountCentavos)}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
