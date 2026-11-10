/*
 * history.ts — The numbers behind History and Home's charts (design pages 9, 18, 19):
 * entries grouped by day, search/category filter, spent per day, spent by
 * category, and "spent since Sunday". Pure functions so they can be tested.
 * Days are Manila days; "spending" = expenses minus refunds (moves/saves aren't spending).
 */
import { categoryLabel } from '../add/categories.ts'
import { addDays, manilaDate, weekday } from '../budget/days.ts'
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'

/** Net spending of one transaction: expense +, refund −, everything else 0. */
function spendOf(tx: Transaction): number {
  return tx.kind === 'expense' ? tx.amountCentavos : tx.kind === 'refund' ? -tx.amountCentavos : 0
}

/** Entries grouped by Manila day, newest day first and newest entry first within a day. */
export function groupByDay(txs: Transaction[]): { day: string; txs: Transaction[]; spent: number }[] {
  const days = new Map<string, Transaction[]>()
  for (const tx of [...txs].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))) {
    const day = manilaDate(tx.occurredAt)
    days.set(day, [...(days.get(day) ?? []), tx])
  }
  return [...days].map(([day, list]) => ({ day, txs: list, spent: list.reduce((s, t) => s + spendOf(t), 0) }))
}

/** How an entry reads in a list: title, gray detail line, signed amount, and its tone. */
export function describe(tx: Transaction, wallets: Wallet[]): { title: string; detail: string; amount: string; tone: 'out' | 'in' | 'move' } {
  const name = (id?: string) => wallets.find((w) => w.id === id)?.name ?? 'Wallet'
  const money = formatPeso(tx.amountCentavos)
  switch (tx.kind) {
    case 'expense':
      return { title: tx.note || categoryLabel(tx.categoryId), detail: `${categoryLabel(tx.categoryId)} · ${name(tx.walletId)}`, amount: `−${money}`, tone: 'out' }
    case 'refund':
      return { title: tx.note || 'Refund', detail: `Refund · ${name(tx.walletId)}`, amount: `+${money}`, tone: 'in' }
    case 'income':
      return { title: tx.note || 'Allowance', detail: `Allowance · ${name(tx.walletId)}`, amount: `+${money}`, tone: 'in' }
    case 'transfer':
      return { title: tx.note || 'Moved money', detail: `${name(tx.walletId)} → ${name(tx.toWalletId)}`, amount: money, tone: 'move' }
    case 'save':
      return { title: tx.note || 'Saved', detail: `${name(tx.walletId)} → Savings`, amount: money, tone: 'move' }
    case 'withdraw':
      return { title: tx.note || 'From savings', detail: `Savings → ${name(tx.toWalletId)}`, amount: money, tone: 'move' }
  }
}

/** Entries matching the search text (title, note, category, wallet) and category chip. */
export function filterEntries(txs: Transaction[], wallets: Wallet[], query: string, categoryId: string | null): Transaction[] {
  const q = query.trim().toLowerCase()
  return txs.filter((tx) => {
    if (categoryId && tx.categoryId !== categoryId) return false
    if (!q) return true
    const d = describe(tx, wallets)
    return `${d.title} ${d.detail} ${tx.note ?? ''}`.toLowerCase().includes(q)
  })
}

/** Spending for each of the last `n` days ending today (oldest first) — the "Spent per day" bars. */
export function spentPerDay(txs: Transaction[], today: string, n = 7): { day: string; spent: number }[] {
  const totals = new Map<string, number>()
  for (const tx of txs) {
    const day = manilaDate(tx.occurredAt)
    totals.set(day, (totals.get(day) ?? 0) + spendOf(tx))
  }
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1)
    return { day, spent: Math.max(0, totals.get(day) ?? 0) }
  })
}

/** Spending per category from `from` to `to` (inclusive), biggest first, zero categories left out. */
export function spentByCategory(txs: Transaction[], from: string, to: string): { categoryId: string; label: string; spent: number }[] {
  const totals = new Map<string, number>()
  for (const tx of txs) {
    const day = manilaDate(tx.occurredAt)
    if (day < from || day > to || !tx.categoryId) continue
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + spendOf(tx))
  }
  return [...totals]
    .filter(([, spent]) => spent > 0)
    .map(([categoryId, spent]) => ({ categoryId, label: categoryLabel(categoryId), spent }))
    .sort((a, b) => b.spent - a.spent)
}

/** "Spent since Sunday" card: total this week (Sun–today) and the average per day so far. */
export function spentThisWeek(txs: Transaction[], today: string): { since: string; total: number; perDay: number } {
  const since = addDays(today, -weekday(today))
  const days = spentPerDay(txs, today, weekday(today) + 1)
  const total = days.reduce((s, d) => s + d.spent, 0)
  return { since, total, perDay: Math.floor(total / days.length / 100) * 100 } // whole pesos
}
