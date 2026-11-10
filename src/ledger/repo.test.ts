/*
 * repo.test.ts — Tests saving/loading the ledger through the real encrypted vault
 * (fake IndexedDB). Run: npm test
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createVault, type Vault } from '../vault/vault.ts'
import type { Transaction, Wallet } from './ledger.ts'
import { spendingTotal } from './ledger.ts'
import { deleteTransaction, loadTransactions, loadWallets, saveTransaction, saveWallet } from './repo.ts'

const cash: Wallet = { id: 'cash', name: 'Cash', type: 'spending', openingCentavos: 65000, archived: false }
const savings: Wallet = { id: 'savings', name: 'Savings', type: 'savings', openingCentavos: 0, archived: false }
const jeep: Transaction = {
  id: 'jeep-1', kind: 'expense', amountCentavos: 1500, walletId: 'cash',
  categoryId: 'fare', occurredAt: '2026-11-10T07:10:00+08:00', note: 'Jeep',
}

let vault: Vault
beforeEach(async () => {
  for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
  vault = await createVault('user-a', 'Jasmine')
  await saveWallet(vault, cash)
  await saveWallet(vault, savings)
})

describe('ledger repo', () => {
  it('round-trips wallets and transactions through encrypted storage', async () => {
    await saveTransaction(vault, jeep, [cash, savings])
    const wallets = await loadWallets(vault)
    const txs = await loadTransactions(vault)
    expect(txs).toEqual([jeep])
    expect(spendingTotal(wallets, txs)).toBe(63500)
  })

  it('returns transactions oldest first', async () => {
    const later = { ...jeep, id: 'jeep-2', occurredAt: '2026-11-10T17:30:00+08:00' }
    await saveTransaction(vault, later, [cash])
    await saveTransaction(vault, jeep, [cash])
    expect((await loadTransactions(vault)).map((t) => t.id)).toEqual(['jeep-1', 'jeep-2'])
  })

  it('refuses invalid amounts (float, zero, negative) before anything is stored', async () => {
    for (const amountCentavos of [15.5, 0, -1500]) {
      await expect(saveTransaction(vault, { ...jeep, amountCentavos }, [cash])).rejects.toThrow()
    }
    expect(await loadTransactions(vault)).toEqual([])
  })

  it('refuses wallet-rule violations with a friendly message', async () => {
    await expect(saveTransaction(vault, { ...jeep, walletId: 'savings' }, [cash, savings])).rejects.toThrow(
      'Move money out of savings before spending it.',
    )
  })

  it('undo deletes the transaction and the balance comes back', async () => {
    await saveTransaction(vault, jeep, [cash])
    await deleteTransaction(vault, jeep.id)
    expect(spendingTotal(await loadWallets(vault), await loadTransactions(vault))).toBe(65000)
  })

  it('rejects a stored record that no longer matches the schema', async () => {
    await vault.put('transaction', 'bad', { ...jeep, id: 'bad', amountCentavos: 'lots' })
    await expect(loadTransactions(vault)).rejects.toThrow()
  })
})
