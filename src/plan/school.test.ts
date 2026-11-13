/*
 * school.test.ts — School-expense rules: only unpaid "Set aside" items are reserved,
 * paying releases the reservation exactly once, and the design's ₱330 example holds.
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../ledger/ledger.ts'
import { setAsideTotal, sortForList, statusOf, type SchoolExpense } from './school.ts'

/** A school expense with sensible defaults. */
const item = (id: string, pesos: number, status: SchoolExpense['status'], dueDate: string): SchoolExpense =>
  ({ id, title: id, template: 'other', estimatedCentavos: pesos * 100, dueDate, status })

/** The expense that pays item `id`. */
const pay = (id: string, pesos: number, day = '2026-11-06'): Transaction =>
  ({ id: `tx-${id}`, kind: 'expense', amountCentavos: pesos * 100, walletId: 'cash', categoryId: 'school', occurredAt: `${day}T12:00:00+08:00`, linkedId: id })

// Sample plan: Org fee ₱180 + Thesis printing ₱150 set aside, PE uniform planned, field trip paid.
const items = [
  item('org', 180, 'setAside', '2026-11-12'),
  item('thesis', 150, 'setAside', '2026-11-13'),
  item('pe', 450, 'planned', '2026-11-28'),
  item('trip', 250, 'setAside', '2026-11-06'),
]
const txs = [pay('trip', 250)]

describe('school expenses', () => {
  it('reserves only unpaid "Set aside" items (design: ₱330)', () => {
    expect(setAsideTotal(items, txs)).toBe(33000)
  })

  it('paying releases the reservation; deleting the payment restores it', () => {
    const paid = [...txs, pay('org', 175)]
    expect(statusOf(items[0], paid)).toBe('paid')
    expect(setAsideTotal(items, paid)).toBe(15000)
    expect(setAsideTotal(items, txs)).toBe(33000)
  })

  it('ignores non-expense entries that happen to link the item', () => {
    const refund: Transaction = { ...pay('org', 180), kind: 'refund' }
    expect(statusOf(items[0], [refund])).toBe('setAside')
  })

  it('lists unpaid by due date, then paid', () => {
    expect(sortForList(items, txs).map((i) => i.id)).toEqual(['org', 'thesis', 'pe', 'trip'])
  })
})
