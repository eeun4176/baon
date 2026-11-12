/*
 * ShareSpendingDialog.tsx — History → Share: pick Today / This week / This month, see the picture,
 * then share it (phone share sheet → Instagram/Facebook story) or download it on a computer.
 * Warns that the picture shows amounts and notes before anything is shared.
 */
import { useEffect, useState } from 'react'
import { manilaDate } from '../budget/days.ts'
import { useSession } from '../session.ts'
import { sharePicture } from '../streak/share.ts'
import { Icon, Segmented } from '../ui/kit.tsx'
import { Modal } from '../ui/Modal.tsx'
import { periodLabel, spendingImage, spendingSummary, type Period } from './shareSpending.ts'
import { tr } from '../i18n/i18n.ts'

/** The pop-up. */
export function ShareSpendingDialog({ onClose }: { onClose: () => void }) {
  const { transactions, showToast } = useSession()
  const [period, setPeriod] = useState<Period>('today')
  const [picture, setPicture] = useState<{ period: Period; png: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const today = manilaDate()
  const summary = spendingSummary(transactions, period, today)
  const empty = summary.count === 0

  // Redraw the preview when the period (or the entries) change
  useEffect(() => {
    if (empty) return
    let stale = false
    // A data: address, not blob:. Baon's saved copy of the page keeps the security rules it was saved
    // with, and those allow data: pictures only; a blob: preview shows as a broken image.
    spendingImage(summary, periodLabel(period, summary.from, today))
      .then((png) => new Promise<{ png: Blob; url: string }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ png, url: String(reader.result) })
        reader.onerror = reject
        reader.readAsDataURL(png)
      }))
      .then(({ png, url }) => !stale && setPicture({ period, png, url }), () => {})
    return () => {
      stale = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- summary is derived from these
  }, [period, transactions, today, empty])

  /** Opens the share sheet (or downloads on a computer). */
  async function share() {
    if (!picture) return
    setBusy(true)
    try {
      const result = await sharePicture(picture.png, `baon-spending-${period}-${today}.png`, tr('Tracked with Baon'))
      if (result === 'downloaded') showToast({ message: tr('Picture saved to your downloads') })
      if (result !== 'cancelled') onClose()
    } catch {
      showToast({ message: tr('Couldn’t make the picture. Try again.') })
    } finally {
      setBusy(false)
    }
  }

  const ready = !empty && picture?.period === period
  return (
    <Modal title={tr('Share your spending')} onClose={onClose}>
      <Segmented options={[['today', tr('Today')], ['week', tr('This week|share tab')], ['month', tr('This month')]] as const} value={period} onChange={setPeriod} label={tr('Period')} />
      <div className="mt-3 grid aspect-[9/16] max-h-[50vh] w-full place-items-center justify-self-center overflow-hidden rounded-2xl bg-hero mx-auto" style={{ maxWidth: 'calc(50vh * 9 / 16)' }}>
        {empty ? (
          <p className="px-6 text-center font-bold text-white/80">{tr('Nothing spent yet in this period.')}</p>
        ) : ready ? (
          <img src={picture.url} alt={tr('Picture of your spending')} className="size-full object-contain" />
        ) : null}
      </div>
      <p className="mt-3 text-sm font-semibold text-muted">{tr('The picture shows your amounts and notes.')}</p>
      <button type="button" disabled={!ready || busy} onClick={share} className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-blue px-5 text-lg font-black text-white disabled:opacity-60">
        <Icon name="share" className="size-5" /> {tr('Share')}</button>
    </Modal>
  )
}
