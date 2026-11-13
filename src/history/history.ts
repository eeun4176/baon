/*
 * history.ts — The numbers behind History and Home's charts:
 * entries grouped by day, search/category filter, spent per day, spent by
 * category, and "spent since Sunday". Pure functions so they can be tested.
 * Days are Manila days; "spending" = expenses minus refunds (moves, saves and utang aren't spending).
 */
import { categoryLabel } from '../add/categories.ts'
import { addDays, daysBetween, manilaDate, weekday } from '../budget/days.ts'
import { SOURCE_LABEL, type Transaction, type Wallet } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { tr } from '../i18n/i18n.ts'

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
    case 'income': {
      const source = SOURCE_LABEL[tx.source ?? 'allowance']
      return { title: tx.note || source, detail: `${source} · ${name(tx.walletId)}`, amount: `+${money}`, tone: 'in' }
    }
    // Utang: gray like moves, because it's neither spending nor the student's own money.
    case 'borrow':
      return { title: tx.person ?? '', detail: `${tr('Borrowed')} · ${name(tx.walletId)}`, amount: `+${money}`, tone: 'move' }
    case 'repay':
      return { title: tx.person ?? '', detail: `${tr('Paid back')} · ${name(tx.walletId)}`, amount: `−${money}`, tone: 'move' }
    case 'lend':
      return { title: tx.person ?? '', detail: `${tr('Lent')} · ${name(tx.walletId)}`, amount: `−${money}`, tone: 'move' }
    case 'collect':
      return { title: tx.person ?? '', detail: `${tr('Paid you back')} · ${name(tx.walletId)}`, amount: `+${money}`, tone: 'move' }
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

/** History's "show" filter. */
export type Range = 'all' | 'today' | 'yesterday' | 'week' | 'month'

/** First and last day (inclusive) a filter covers. "all" = everything. Weeks start on Sunday, months on the 1st. */
export function rangeDays(range: Range, today: string): { from: string; to: string } {
  switch (range) {
    case 'all':
      return { from: '0000-01-01', to: '9999-12-31' }
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case 'week':
      return { from: addDays(today, -weekday(today)), to: today }
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}

/** Total spent from `from` to `to` (inclusive) and the average per day, in whole pesos. */
export function spentBetween(txs: Transaction[], from: string, to: string): { total: number; perDay: number } {
  const days = spentPerDay(txs, to, daysBetween(from, to) + 1)
  const total = days.reduce((s, d) => s + d.spent, 0)
  return { total, perDay: Math.floor(total / days.length / 100) * 100 }
}

/**
 * This week so far (Sunday → today) against the same days last week, for Home's up/down arrow.
 * `diff` is in centavos (+ = spent more), not a percent: a percent rise has no ceiling, so a small
 * last week turned a normal week into "2,019% more". null when last week had nothing to compare with.
 */
export function weekTrend(txs: Transaction[], today: string): { now: number; before: number; diff: number | null } {
  const since = addDays(today, -weekday(today))
  const now = spentBetween(txs, since, today).total
  const before = spentBetween(txs, addDays(since, -7), addDays(today, -7)).total
  return { now, before, diff: before > 0 ? now - before : null }
}

/** "Spent since Sunday" card: total this week (Sun–today) and the average per day so far. */
export function spentThisWeek(txs: Transaction[], today: string): { since: string; total: number; perDay: number } {
  const since = addDays(today, -weekday(today))
  const days = spentPerDay(txs, today, weekday(today) + 1)
  const total = days.reduce((s, d) => s + d.spent, 0)
  return { since, total, perDay: Math.floor(total / days.length / 100) * 100 } // whole pesos
}
