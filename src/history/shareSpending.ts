/*
 * shareSpending.ts — History → Share: a story-size "receipt" of what the student spent today, this
 * week (since Sunday) or this month: the total, then what they bought (note, or category if no
 * note), the same thing added up ("Jeep ×5"), biggest first. It shows notes and amounts, so the
 * pop-up says so before sharing. Drawn with the streak picture's frame (streak/share.ts).
 */
import { categoryLabel } from '../add/categories.ts'
import { addDays, manilaDate, weekday } from '../budget/days.ts'
import type { Transaction } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { H, storyCanvas, toPng, W } from '../streak/share.ts'
import { LOCALE, tr } from '../i18n/i18n.ts'

export type Period = 'today' | 'week' | 'month'
const ROWS = 7 // items that fit above the story's reply bar

export interface SpendingSummary {
  from: string // first Manila day counted
  total: number // expenses minus refunds, centavos
  count: number // expenses logged
  items: { title: string; amount: number; times: number }[] // biggest first
}

/** First day of the period: today, Sunday of this week, or the 1st of this month. */
export function periodStart(period: Period, today: string): string {
  return period === 'today' ? today : period === 'week' ? addDays(today, -weekday(today)) : `${today.slice(0, 8)}01`
}

/** What was spent from the period's start to today, with same-named items added together. */
export function spendingSummary(txs: Transaction[], period: Period, today: string): SpendingSummary {
  const from = periodStart(period, today)
  const items = new Map<string, { title: string; amount: number; times: number }>()
  let total = 0
  let count = 0
  for (const tx of txs) {
    const day = manilaDate(tx.occurredAt)
    if (day < from || day > today) continue
    if (tx.kind === 'refund') total -= tx.amountCentavos
    if (tx.kind !== 'expense') continue
    total += tx.amountCentavos
    count++
    const title = tx.note?.trim() || categoryLabel(tx.categoryId)
    const key = title.toLowerCase()
    const item = items.get(key) ?? { title, amount: 0, times: 0 }
    items.set(key, { ...item, amount: item.amount + tx.amountCentavos, times: item.times + 1 })
  }
  return { from, total: Math.max(0, total), count, items: [...items.values()].sort((a, b) => b.amount - a.amount) }
}

/** "Today · Wed, Nov 11", "This week · Nov 8–11", "November 2026". */
export function periodLabel(period: Period, from: string, today: string): string {
  const fmt = (o: Intl.DateTimeFormatOptions, day: string) => new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...o }).format(new Date(`${day}T00:00:00Z`))
  if (period === 'today') return tr('Today · {0}', fmt({ weekday: 'short', month: 'short', day: 'numeric' }, today))
  if (period === 'month') return fmt({ month: 'long', year: 'numeric' }, today)
  return tr('This week · {0}', from === today ? fmt({ month: 'short', day: 'numeric' }, today) : `${fmt({ month: 'short', day: 'numeric' }, from)}–${fmt({ day: 'numeric' }, today)}`)
}

/** Cuts `text` with "…" so it fits `max` pixels in the current font. */
function fit(c: CanvasRenderingContext2D, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** Draws the spending picture (1080×1920). */
export async function spendingImage(s: SpendingSummary, label: string): Promise<Blob> {
  const { canvas, c } = await storyCanvas(700)
  c.fillStyle = 'rgba(255,255,255,0.7)'
  c.font = '800 52px Nunito, sans-serif'
  c.fillText(label, W / 2, 540)
  c.fillStyle = '#fff'
  c.font = '900 200px Nunito, sans-serif'
  c.fillText(fit(c, formatPeso(s.total), W - 160), W / 2, 760)
  c.fillStyle = 'rgba(255,255,255,0.7)'
  c.font = '800 48px Nunito, sans-serif'
  c.fillText(s.count === 1 ? tr('spent · 1 item') : tr('spent · {0} items', s.count), W / 2, 850)

  // The list, on a lighter card
  const shown = s.items.slice(0, ROWS)
  const more = s.items.length - shown.length
  const top = 940
  const rowH = 84
  const cardH = 40 + shown.length * rowH + (more ? 70 : 0)
  c.fillStyle = 'rgba(255,255,255,0.08)'
  c.beginPath()
  c.roundRect(90, top, W - 180, cardH, 40)
  c.fill()
  shown.forEach((item, i) => {
    const y = top + 20 + i * rowH + 60
    c.font = '900 46px Nunito, sans-serif'
    c.fillStyle = '#fff'
    c.textAlign = 'right'
    const amount = formatPeso(item.amount)
    c.fillText(amount, W - 140, y)
    const amountW = c.measureText(amount).width
    c.textAlign = 'left'
    const times = item.times > 1 ? `  ×${item.times}` : ''
    c.font = '800 44px Nunito, sans-serif'
    const timesW = times ? c.measureText(times).width : 0
    const title = fit(c, item.title, W - 280 - amountW - 40 - timesW)
    c.fillText(title, 140, y)
    if (times) {
      c.fillStyle = 'rgba(140,170,255,0.95)' // light blue, readable on the dark card
      c.fillText(times, 140 + c.measureText(title).width, y)
    }
    if (i < shown.length - 1) {
      c.fillStyle = 'rgba(255,255,255,0.08)'
      c.fillRect(140, y + 28, W - 280, 2)
    }
  })
  c.textAlign = 'center'
  if (more) {
    c.fillStyle = 'rgba(255,255,255,0.6)'
    c.font = '800 40px Nunito, sans-serif'
    c.fillText(tr('…and {0} more', more), W / 2, top + 20 + shown.length * rowH + 50)
  }

  c.fillStyle = 'rgba(255,255,255,0.6)'
  c.font = '800 40px Nunito, sans-serif'
  c.fillText(tr('Tracked with Baon'), W / 2, Math.min(H - 220, Math.max(top + cardH + 110, 1700)))
  return toPng(canvas)
}
