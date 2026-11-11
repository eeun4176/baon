/*
 * ledger.ts — Wallets, transactions and balances (plan §5 "Transaction kinds", §10).
 *
 * Balances are never stored: each wallet's balance is its opening balance plus
 * the effect of every transaction. That way an expense lowers a balance exactly
 * once, and editing/deleting a transaction can't leave a stale total behind.
 *
 * Effects on balances:
 *   expense   wallet −amount          (counts as spending)
 *   refund    wallet +amount          (linked to the expense it reduces)
 *   income    wallet +amount          (allowance, freelance pay…)
 *   transfer  from −, to +            (Cash ↔ GCash; total unchanged)
 *   save      spending −, savings +   (shown as "Saved", not spending)
 *   withdraw  savings −, spending +
 */
// zod/mini: same checks as full Zod at ~6 KB instead of ~30+ KB (plan C4: small bundle).
// Rules are written as .check(...) instead of chained methods.
import * as z from 'zod/mini'

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

export const TransactionSchema = z.object({
  id: id(),
  kind: z.enum(['expense', 'refund', 'income', 'transfer', 'save', 'withdraw']),
  amountCentavos: z.int().check(z.positive()),
  walletId: id(), // the wallet money leaves (or arrives in, for income/refund)
  toWalletId: z.optional(id()), // only for transfer/save/withdraw
  categoryId: z.optional(z.string()), // expenses (and refunds) only
  occurredAt: z.iso.datetime({ offset: true }), // when it happened; days are cut in Asia/Manila
  note: z.optional(z.string().check(z.maxLength(200))),
  linkedId: z.optional(z.string()), // refund → original expense; paid school expense → its plan item
})
export type Transaction = z.infer<typeof TransactionSchema>

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
  if (!from) return 'That wallet no longer exists.'

  if (!MOVES.has(tx.kind)) {
    if (tx.toWalletId) return 'Only moves between wallets have a second wallet.'
    if (tx.kind === 'refund' && !tx.linkedId) return 'A refund must point to the expense it corrects.'
    if (from.type === 'savings' && tx.kind === 'expense') return 'Move money out of savings before spending it.'
    return null
  }

  const to = wallets.find((w) => w.id === tx.toWalletId)
  if (!to) return 'Pick where the money goes.'
  if (to.id === from.id) return 'Pick two different wallets.'
  if (tx.kind === 'transfer' && (from.type !== 'spending' || to.type !== 'spending'))
    return 'Moves are between spending wallets. Use Save or Withdraw for savings.'
  if (tx.kind === 'save' && (from.type !== 'spending' || to.type !== 'savings'))
    return 'Saving moves money from a spending wallet into savings.'
  if (tx.kind === 'withdraw' && (from.type !== 'savings' || to.type !== 'spending'))
    return 'Withdrawing moves money from savings into a spending wallet.'
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
    if (tx.kind === 'expense') add(tx.walletId, -tx.amountCentavos)
    else if (tx.kind === 'income' || tx.kind === 'refund') add(tx.walletId, tx.amountCentavos)
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
