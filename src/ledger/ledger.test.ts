/*
 * ledger.test.ts — Tests for balances and wallet rules (no double-counting,
 * correct totals). Uses the design's
 * sample student: Cash ₱650 + GCash ₱400 = ₱1,050, Savings ₱0. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { balances, checkTransaction, isAllowance, sortWallets, spendingTotal, type Transaction, type Wallet } from './ledger.ts'
import { dueStatus, owedTotal, utangList } from './utang.ts'

describe('utang due chip', () => {
  it('anytime, in N days, today, N days late', () => {
    expect(dueStatus(undefined, '2026-11-13')).toEqual({ kind: 'none', days: 0 })
    expect(dueStatus('2026-11-16', '2026-11-13')).toEqual({ kind: 'later', days: 3 })
    expect(dueStatus('2026-11-13', '2026-11-13')).toEqual({ kind: 'today', days: 0 })
    expect(dueStatus('2026-11-12', '2026-11-13')).toEqual({ kind: 'late', days: -1 })
  })
})

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'spending', openingCentavos: 65000, archived: false },
  { id: 'gcash', name: 'GCash', type: 'spending', openingCentavos: 40000, archived: false },
  { id: 'savings', name: 'Savings', type: 'savings', openingCentavos: 0, archived: false },
]

let n = 0
/** Builds a valid transaction with sensible defaults for tests. */
function tx(kind: Transaction['kind'], amountCentavos: number, walletId: string, extra: Partial<Transaction> = {}): Transaction {
  return { id: `t${++n}`, kind, amountCentavos, walletId, occurredAt: '2026-11-10T08:00:00+08:00', ...extra }
}

describe('balances', () => {
  it('starts from opening balances (design: ₱1,050 in wallets)', () => {
    expect(spendingTotal(wallets, [])).toBe(105000)
  })

  it('an expense lowers its wallet exactly once', () => {
    const b = balances(wallets, [tx('expense', 1500, 'cash')])
    expect(b.get('cash')).toBe(63500)
    expect(b.get('gcash')).toBe(40000)
  })

  it('income (allowance) adds to its wallet', () => {
    expect(balances(wallets, [tx('income', 150000, 'cash')]).get('cash')).toBe(215000)
  })

  it('a transfer changes two wallets but not the total', () => {
    const txs = [tx('transfer', 20000, 'cash', { toWalletId: 'gcash' })]
    const b = balances(wallets, txs)
    expect([b.get('cash'), b.get('gcash')]).toEqual([45000, 60000])
    expect(spendingTotal(wallets, txs)).toBe(105000)
  })

  it('saving lowers spendable money; savings are never counted as spendable', () => {
    const txs = [tx('save', 10000, 'cash', { toWalletId: 'savings' })]
    expect(balances(wallets, txs).get('savings')).toBe(10000)
    expect(spendingTotal(wallets, txs)).toBe(95000)
  })

  it('withdrawing from savings makes it spendable again', () => {
    const txs = [
      tx('save', 10000, 'cash', { toWalletId: 'savings' }),
      tx('withdraw', 4000, 'savings', { toWalletId: 'gcash' }),
    ]
    expect(balances(wallets, txs).get('savings')).toBe(6000)
    expect(spendingTotal(wallets, txs)).toBe(99000)
  })

  it('a refund gives money back to its wallet', () => {
    const expense = tx('expense', 8000, 'cash')
    const refund = tx('refund', 3000, 'cash', { linkedId: expense.id })
    expect(balances(wallets, [expense, refund]).get('cash')).toBe(60000)
  })

  it('a full day from the design adds up: ₱160 spent, ₱1,500 allowance in', () => {
    const day = [
      tx('expense', 1500, 'cash'), // Jeep
      tx('expense', 8000, 'cash'), // Lunch
      tx('expense', 5000, 'gcash'), // Thesis printing
      tx('expense', 1500, 'cash'), // Jeep
      tx('income', 150000, 'cash'), // Weekly allowance
    ]
    expect(spendingTotal(wallets, day)).toBe(105000 - 16000 + 150000)
  })

  it('totals stay integers no matter how many centavo amounts are added', () => {
    const txs = Array.from({ length: 1000 }, () => tx('expense', 1, 'cash'))
    const total = spendingTotal(wallets, txs)
    expect(Number.isInteger(total)).toBe(true)
    expect(total).toBe(104000)
  })
})

describe('checkTransaction', () => {
  it.each<[string, Transaction]>([
    ['normal expense', tx('expense', 1500, 'cash')],
    ['transfer Cash → GCash', tx('transfer', 1000, 'cash', { toWalletId: 'gcash' })],
    ['save Cash → Savings', tx('save', 1000, 'cash', { toWalletId: 'savings' })],
    ['withdraw Savings → GCash', tx('withdraw', 1000, 'savings', { toWalletId: 'gcash' })],
    ['refund linked to an expense', tx('refund', 500, 'cash', { linkedId: 't1' })],
  ])('allows %s', (_, t) => {
    expect(checkTransaction(t, wallets)).toBeNull()
  })

  it.each<[string, Transaction]>([
    ['unknown wallet', tx('expense', 1500, 'maya')],
    ['spending straight from savings', tx('expense', 1500, 'savings')],
    ['transfer to the same wallet', tx('transfer', 1000, 'cash', { toWalletId: 'cash' })],
    ['transfer into savings (must be "save")', tx('transfer', 1000, 'cash', { toWalletId: 'savings' })],
    ['save into a spending wallet', tx('save', 1000, 'cash', { toWalletId: 'gcash' })],
    ['withdraw from a spending wallet', tx('withdraw', 1000, 'cash', { toWalletId: 'gcash' })],
    ['move with no destination', tx('transfer', 1000, 'cash')],
    ['expense with a second wallet', tx('expense', 1000, 'cash', { toWalletId: 'gcash' })],
    ['refund not linked to anything', tx('refund', 500, 'cash')],
  ])('rejects %s', (_, t) => {
    expect(checkTransaction(t, wallets)).toEqual(expect.any(String))
  })
})

describe('sortWallets', () => {
  it('lists Cash first, other spending wallets A–Z, savings last', () => {
    const w = (id: string, name: string, type: 'spending' | 'savings' = 'spending') => ({ id, name, type, openingCentavos: 0, archived: false })
    const sorted = sortWallets([w('savings', 'Savings', 'savings'), w('x1', 'Maya'), w('gcash', 'GCash'), w('cash', 'Cash')])
    expect(sorted.map((x) => x.name)).toEqual(['Cash', 'GCash', 'Maya', 'Savings'])
  })
})

describe('money in sources', () => {
  it('old entries without a source count as the allowance; others don\'t', () => {
    expect(isAllowance(tx('income', 150000, 'cash'))).toBe(true)
    expect(isAllowance(tx('income', 300000, 'cash', { source: 'scholarship' }))).toBe(false)
  })

  it('only money in has a source, and the allowance can\'t be made to last until a date', () => {
    expect(checkTransaction(tx('expense', 100, 'cash', { source: 'gift' }), wallets)).toMatch(/source/)
    expect(checkTransaction(tx('income', 100, 'cash', { source: 'allowance', spreadUntil: '2026-12-01' }), wallets)).toMatch(/allowance/)
    expect(checkTransaction(tx('income', 100, 'cash', { source: 'salary', spreadUntil: '2026-11-01' }), wallets)).toMatch(/after/)
    expect(checkTransaction(tx('income', 100, 'cash', { source: 'salary', spreadUntil: '2026-12-01' }), wallets)).toBeNull()
  })
})

describe('utang', () => {
  const borrow = tx('borrow', 20000, 'cash', { person: 'Mia', dueDate: '2026-11-20' })
  const lend = tx('lend', 10000, 'gcash', { person: 'Carlo' })
  const repay = tx('repay', 5000, 'cash', { person: 'Mia', linkedId: borrow.id })

  it('moves wallets: borrowed in, paid back out, lent out, collected in', () => {
    const collect = tx('collect', 10000, 'gcash', { person: 'Carlo', linkedId: lend.id })
    const b = balances(wallets, [borrow, repay, lend, collect])
    expect([b.get('cash'), b.get('gcash')]).toEqual([65000 + 20000 - 5000, 40000])
  })

  it('tracks what\'s left, including part payments', () => {
    const list = utangList([borrow, repay, lend])
    expect(list.map((u) => [u.tx.person, u.owe, u.paid, u.left])).toEqual([['Mia', true, 5000, 15000], ['Carlo', false, 0, 10000]])
    expect(owedTotal([borrow, repay, lend])).toBe(15000) // only what the student owes is held back
  })

  it('needs a person, a spending wallet, and a link for payments', () => {
    expect(checkTransaction(tx('borrow', 100, 'cash'), wallets)).toMatch(/Who/)
    expect(checkTransaction(tx('lend', 100, 'savings', { person: 'Ana' }), wallets)).toMatch(/spending wallet/)
    expect(checkTransaction(tx('repay', 100, 'cash', { person: 'Mia' }), wallets)).toMatch(/point to/)
    expect(checkTransaction(tx('expense', 100, 'cash', { person: 'Mia' }), wallets)).toMatch(/person/)
    expect(checkTransaction(borrow, wallets)).toBeNull()
    expect(checkTransaction(repay, wallets)).toBeNull()
  })
})
