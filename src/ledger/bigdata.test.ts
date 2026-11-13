/*
 * bigdata.test.ts — Big-data check (non-functional test): fills one account with years of fake
 * expenses and times what every screen does on open: load + unscramble all, then History's math.
 * Skipped in `npm test`. Run: $env:BIG=1; npx vitest run src/ledger/bigdata.test.ts
 * Times come from Node + fake IndexedDB on a PC: a real phone is slower, so read them as a trend.
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createVault } from '../vault/vault.ts'
import { groupByDay, filterEntries } from '../history/history.ts'
import { spendingTotal, type Transaction, type Wallet } from './ledger.ts'
import { loadTransactions, loadWallets, saveTransaction, saveWallet } from './repo.ts'

const cash: Wallet = { id: 'cash', name: 'Cash', type: 'spending', openingCentavos: 10_000_000, archived: false }
const CATEGORIES = ['food', 'fare', 'school', 'load', 'other']

/** Milliseconds `job` takes. */
async function time(job: () => Promise<unknown> | unknown): Promise<number> {
  const start = performance.now()
  await job()
  return Math.round(performance.now() - start)
}

describe.skipIf(!process.env.BIG)('big data', () => {
  // About 5 expenses a school day: 1,000 ≈ 1 semester, 2,000 ≈ 1 year, 10,000 ≈ 5 years.
  it.each([1_000, 2_000, 10_000])('%i expenses', async (count) => {
    for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
    const vault = await createVault('big-user', 'Big')
    await saveWallet(vault, cash)

    const start = Date.parse('2022-01-01T08:00:00+08:00')
    const save = await time(async () => {
      for (let i = 0; i < count; i++) {
        const tx: Transaction = {
          id: `tx-${i}`, kind: 'expense', amountCentavos: 2000 + (i % 50) * 100, walletId: 'cash',
          categoryId: CATEGORIES[i % CATEGORIES.length], occurredAt: new Date(start + i * 3 * 3600_000).toISOString(), note: `Lunch ${i}`,
        }
        await saveTransaction(vault, tx, [cash])
      }
    })

    let txs: Transaction[] = []
    const load = await time(async () => (txs = await loadTransactions(vault)))
    const wallets = await loadWallets(vault)
    const math = await time(() => {
      spendingTotal(wallets, txs)
      groupByDay(filterEntries(txs, wallets, 'lunch', null))
    })
    expect(txs).toHaveLength(count)
    console.log(`${count} expenses | save all ${save} ms (${(save / count).toFixed(1)} ms each) | open (load+unscramble) ${load} ms | History math ${math} ms`)
  }, 600_000)
})
