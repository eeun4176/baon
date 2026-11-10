/*
 * repo.ts — Saves and loads wallets and transactions through the encrypted vault.
 * Every record is checked with Zod on the way in AND on the way out (plan §8:
 * "validate decrypted payloads"), so a corrupted or tampered record can't reach the math.
 */
import * as z from 'zod/mini'
import type { Vault } from '../vault/vault.ts'
import { checkTransaction, TransactionSchema, WalletSchema, type Transaction, type Wallet } from './ledger.ts'

/** Validates and saves a wallet (insert or update). */
export async function saveWallet(vault: Vault, wallet: Wallet): Promise<void> {
  await vault.put('wallet', wallet.id, WalletSchema.parse(wallet))
}

/** Loads and validates every wallet. */
export async function loadWallets(vault: Vault): Promise<Wallet[]> {
  return z.array(WalletSchema).parse(await vault.list('wallet'))
}

/**
 * Validates and saves a transaction. Throws with a plain-language message
 * if it breaks a wallet rule (e.g. spending straight from savings).
 */
export async function saveTransaction(vault: Vault, tx: Transaction, wallets: Wallet[]): Promise<void> {
  const parsed = TransactionSchema.parse(tx)
  const problem = checkTransaction(parsed, wallets)
  if (problem) throw new Error(problem)
  await vault.put('transaction', parsed.id, parsed)
}

/** Loads and validates every transaction, oldest first. */
export async function loadTransactions(vault: Vault): Promise<Transaction[]> {
  const txs = z.array(TransactionSchema).parse(await vault.list('transaction'))
  return txs.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
}

/** Deletes a transaction (used by Undo and by delete in History). */
export function deleteTransaction(vault: Vault, id: string): Promise<void> {
  return vault.remove(id)
}
