/*
 * ledger.ts — Wallets, transactions and balances.
 *
 * Balances are never stored: each wallet's balance is its opening balance plus
 * the effect of every transaction. That way an expense lowers a balance exactly
 * once, and editing/deleting a transaction can't leave a stale total behind.
 *
 * Effects on balances:
 *   expense   wallet −amount          (counts as spending)
 *   refund    wallet +amount          (linked to the expense it reduces)
 *   income    wallet +amount          (money in: allowance, scholarship, salary… see `source`)
 *   transfer  from −, to +            (Cash ↔ GCash; total unchanged)
 *   save      spending −, savings +   (shown as "Saved", not spending)
 *   withdraw  savings −, spending +
 *   borrow    wallet +amount          (utang: money that isn't yours, held back until paid back)
 *   repay     wallet −amount          (paying utang back; not spending)
 *   lend      wallet −amount          (a friend owes you; not spending)
 *   collect   wallet +amount          (the friend paid you back)
 * repay/collect point to their borrow/lend entry (linkedId); see utang.ts.
 */
// zod/mini: same checks as full Zod at ~6 KB instead of ~30+ KB (plan C4: small bundle).
// Rules are written as .check(...) instead of chained methods.
import * as z from 'zod/mini'
import { manilaDate } from '../budget/days.ts'
import { tr } from '../i18n/i18n.ts'

/** A non-empty id string. */
const id = () => z.string().check(z.minLength(1))

/** Spending wallets count toward safe-to-spend; savings wallets never do. */
export const WalletSchema = z.object({
  id: id(),
  name: z.string().check(z.trim(), z.minLength(1), z.maxLength(40)),
  type: z.enum(['spending', 'savings']),
  openingCentavos: z.int().check(z.minimum(0)), // what the student had when the wallet was added
  archived: z.boolean(),
})
export type Wallet = z.infer<typeof WalletSchema>

const DAY = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/))

/** Where money in came from. Only 'allowance' answers "Did your baon arrive?" and starts a limits cycle. */
export const SOURCES = ['allowance', 'scholarship', 'salary', 'gift', 'other'] as const
export type Source = (typeof SOURCES)[number]
export const SOURCE_LABEL: Record<Source, string> = {
  allowance: tr('Allowance'),
  scholarship: tr('Scholarship'),
  salary: tr('Salary / sideline'),
  gift: tr('Gift'),
  other: tr('Other'),
}

export const TransactionSchema = z.object({
  id: id(),
  kind: z.enum(['expense', 'refund', 'income', 'transfer', 'save', 'withdraw', 'borrow', 'repay', 'lend', 'collect']),
  amountCentavos: z.int().check(z.positive()),
  walletId: id(), // the wallet money leaves (or arrives in, for income/refund/borrow/collect)
  toWalletId: z.optional(id()), // only for transfer/save/withdraw
  categoryId: z.optional(z.string()), // expenses (and refunds) only
  occurredAt: z.iso.datetime({ offset: true }), // when it happened; days are cut in Asia/Manila
  note: z.optional(z.string().check(z.maxLength(200))),
  linkedId: z.optional(z.string()), // refund → expense; paid school expense → plan item; repay/collect → borrow/lend
  source: z.optional(z.enum(SOURCES)), // income only; missing = allowance (entries made before sources existed)
  spreadUntil: z.optional(DAY), // income only (not allowance): "make it last until", see heldForLater()
  person: z.optional(z.string().check(z.trim(), z.minLength(1), z.maxLength(40))), // utang: who
  dueDate: z.optional(DAY), // borrow/lend: when it should be paid back (optional)
})
export type Transaction = z.infer<typeof TransactionSchema>

/** Utang entries: never spending, never income. */
export const UTANG_KINDS = new Set<Transaction['kind']>(['borrow', 'repay', 'lend', 'collect'])

/** True for money in that is the allowance (old entries have no source). */
export const isAllowance = (tx: Transaction) => tx.kind === 'income' && (tx.source ?? 'allowance') === 'allowance'

/** Display order everywhere: Cash, then other spending wallets A–Z, then savings. */
export function sortWallets(wallets: Wallet[]): Wallet[] {
  const rank = (w: Wallet) => (w.id === 'cash' ? 0 : w.type === 'spending' ? 1 : 2)
  return [...wallets].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

/** Kinds that move money between two of the student's own wallets. */
const MOVES = new Set<Transaction['kind']>(['transfer', 'save', 'withdraw'])

/**
 * Checks the rules Zod can't express (they depend on the wallets).
 * Returns a plain-language problem, or null if the transaction is fine.
 */
export function checkTransaction(tx: Transaction, wallets: Wallet[]): string | null {
  const from = wallets.find((w) => w.id === tx.walletId)
  if (!from) return tr('That wallet no longer exists.')

  if ((tx.source || tx.spreadUntil) && tx.kind !== 'income') return tr('Only money in has a source.')
  if (tx.spreadUntil && isAllowance(tx)) return tr('Your allowance already lasts until the next one.')
  if (tx.spreadUntil && tx.spreadUntil < manilaDate(tx.occurredAt)) return tr('Pick a date after the money came in.')
  if ((tx.person || tx.dueDate) && !UTANG_KINDS.has(tx.kind)) return tr('Only utang has a person.')

  if (UTANG_KINDS.has(tx.kind)) {
    if (from.type !== 'spending') return tr('Use a spending wallet for utang.')
    if (!tx.person) return tr('Who is it with?')
    if (tx.dueDate && (tx.kind === 'repay' || tx.kind === 'collect')) return tr('Only the utang itself has a due date.')
    if ((tx.kind === 'repay' || tx.kind === 'collect') && !tx.linkedId) return tr('A payment must point to its utang.')
  }

  if (!MOVES.has(tx.kind)) {
    if (tx.toWalletId) return tr('Only moves between wallets have a second wallet.')
    if (tx.kind === 'refund' && !tx.linkedId) return tr('A refund must point to the expense it corrects.')
    if (from.type === 'savings' && tx.kind === 'expense') return tr('Move money out of savings before spending it.')
    return null
  }

  const to = wallets.find((w) => w.id === tx.toWalletId)
  if (!to) return tr('Pick where the money goes.')
  if (to.id === from.id) return tr('Pick two different wallets.')
  if (tx.kind === 'transfer' && (from.type !== 'spending' || to.type !== 'spending'))
    return tr('Moves are between spending wallets. Use Save or Withdraw for savings.')
  if (tx.kind === 'save' && (from.type !== 'spending' || to.type !== 'savings'))
    return tr('Saving moves money from a spending wallet into savings.')
  if (tx.kind === 'withdraw' && (from.type !== 'savings' || to.type !== 'spending'))
    return tr('Withdrawing moves money from savings into a spending wallet.')
  return null
}

/** Computes every wallet's current balance (in centavos) from its opening balance + transactions. */
export function balances(wallets: Wallet[], txs: Transaction[]): Map<string, number> {
  const result = new Map(wallets.map((w) => [w.id, w.openingCentavos]))
  /** Adds `delta` to a wallet's running balance. */
  const add = (id: string | undefined, delta: number) => {
    if (id !== undefined && result.has(id)) result.set(id, result.get(id)! + delta)
  }

  for (const tx of txs) {
    if (tx.kind === 'expense' || tx.kind === 'repay' || tx.kind === 'lend') add(tx.walletId, -tx.amountCentavos)
    else if (tx.kind === 'income' || tx.kind === 'refund' || tx.kind === 'borrow' || tx.kind === 'collect') add(tx.walletId, tx.amountCentavos)
    else {
      add(tx.walletId, -tx.amountCentavos)
      add(tx.toWalletId, tx.amountCentavos)
    }
  }
  return result
}

/** Total money in spending wallets ("In wallets" on the How-it's-counted screen). Savings excluded. */
export function spendingTotal(wallets: Wallet[], txs: Transaction[]): number {
  const all = balances(wallets, txs)
  return wallets.filter((w) => w.type === 'spending').reduce((sum, w) => sum + all.get(w.id)!, 0)
}
