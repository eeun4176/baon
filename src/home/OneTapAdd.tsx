/*
 * OneTapAdd.tsx — Home's "One-tap add" card (design: Jeep ₱15, Lunch ₱80, Print ₱5,
 * Load ₱50). One tap logs the expense right away (the button's wallet, else the
 * last-used one), then shows Undo for 5 seconds (plan criterion C1: ≤ 2 taps).
 * "Edit" opens the button editor; after the same expense is logged 3 times the card
 * offers to make it a button (plan §4.2).
 */
import { useMemo, useState } from 'react'
import { lastUsedWalletId } from '../add/categories.ts'
import { presetIcon, suggestPreset, type Preset } from '../add/presets.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { Card, Icon } from '../ui/kit.tsx'
import { PresetEditor } from './PresetEditor.tsx'

/** Grid of one-tap buttons + Edit + the "Make it a button?" suggestion. */
export function OneTapAdd() {
  const { transactions, wallets, presets, savePresets, addTransaction, removeTransaction, showToast } = useSession()
  const [busy, setBusy] = useState<string | null>(null)
  const [editor, setEditor] = useState<'list' | 'new' | null>(null)
  const suggestion = useMemo(() => suggestPreset(transactions, presets), [transactions, presets])

  /** Logs a button as an expense now, with Undo. */
  async function log(p: Preset) {
    const fixed = wallets.find((w) => w.id === p.walletId && w.type === 'spending' && !w.archived)
    const walletId = fixed?.id ?? lastUsedWalletId(transactions, wallets.find((w) => w.type === 'spending')?.id ?? 'cash')
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

  /** Accepts or dismisses the suggestion, with Undo. */
  async function answer(accept: boolean) {
    if (!suggestion) return
    const before = presets
    const { key, label, amountCentavos, categoryId } = suggestion
    await savePresets(
      accept
        ? { ...presets, items: [...presets.items, { id: crypto.randomUUID(), label, amountCentavos, categoryId }] }
        : { ...presets, dismissed: [...presets.dismissed, key] },
    )
    showToast({ message: accept ? `Added ${label} ${formatPeso(amountCentavos)} to one-tap` : 'Okay, we won’t ask again', undo: () => savePresets(before) })
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">One-tap add</h2>
        <button type="button" onClick={() => setEditor('list')} className="-mr-2 flex min-h-10 items-center gap-1.5 rounded-full px-3 font-extrabold text-blue hover:bg-blue-tint">
          <Icon name="pencil" className="size-4" /> Edit
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {presets.items.map((p, i) => (
          <button
            key={p.id}
            type="button"
            disabled={busy !== null}
            onClick={() => log(p)}
            aria-label={`Add ${p.label}, ${formatPeso(p.amountCentavos)}`}
            className="flex min-h-14 animate-rise items-center gap-2 rounded-[20px] bg-page px-3 text-left text-[1.0625rem] font-black hover:bg-pebble active:bg-pebble disabled:opacity-60"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <Icon name={presetIcon(p)} className="size-6 shrink-0 text-blue" />
            <span className="truncate">{p.label} {formatPeso(p.amountCentavos)}</span>
          </button>
        ))}
        {presets.items.length === 0 && (
          <button type="button" onClick={() => setEditor('new')} className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-pebble-2 font-black text-blue">
            <Icon name="plus" className="size-5" /> Add a one-tap button
          </button>
        )}
      </div>

      {suggestion && (
        <div className="mt-4 animate-rise rounded-[20px] bg-blue-tint p-4">
          <p className="font-bold">
            You logged <strong className="font-black">{suggestion.label} {formatPeso(suggestion.amountCentavos)}</strong> {suggestion.times} times. Make it a one-tap button?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => answer(true)} className="min-h-11 rounded-full bg-blue px-5 font-black text-white">Add button</button>
            <button type="button" onClick={() => answer(false)} className="min-h-11 rounded-full px-4 font-extrabold text-muted hover:bg-card">No thanks</button>
          </div>
        </div>
      )}

      {editor && <PresetEditor startNew={editor === 'new'} onClose={() => setEditor(null)} />}
    </Card>
  )
}
