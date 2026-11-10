/*
 * answers.test.ts — Tests for onboarding input rules (screens 4–5). Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { defaultNextDate, initialBaon, initialMoney, moneyTotal, toAllowance, toBalances } from './answers.ts'

const TUE = '2026-11-10'

describe('defaultNextDate', () => {
  it('weekly/monthly/etc. default to the coming Sunday', () => {
    expect(defaultNextDate(TUE, 'weekly')).toBe('2026-11-15')
    expect(defaultNextDate('2026-11-15', 'weekly')).toBe('2026-11-22') // on a Sunday → next Sunday
  })
  it('daily defaults to tomorrow', () => {
    expect(defaultNextDate(TUE, 'daily')).toBe('2026-11-11')
  })
})

describe('toAllowance', () => {
  it('turns the design\'s answers into an allowance', () => {
    expect(toAllowance({ ...initialBaon(TUE), amountText: '1,500' }, TUE)).toEqual({
      amountCentavos: 150000, frequency: 'weekly', nextDate: '2026-11-15', countClassDays: true, classWeekdays: [1, 2, 3, 4, 5, 6],
    })
  })

  it.each([
    ['empty amount', { amountText: '' }, 'Enter how much'],
    ['zero amount', { amountText: '0' }, 'Enter how much'],
    ['letters', { amountText: 'abc' }, 'Enter how much'],
    ['date today', { amountText: '1500', nextDate: TUE }, 'after today'],
    ['date in the past', { amountText: '1500', nextDate: '2026-11-01' }, 'after today'],
    ['no class days', { amountText: '1500', classWeekdays: [] }, 'class day'],
  ])('rejects %s', (_, change, message) => {
    expect(toAllowance({ ...initialBaon(TUE), ...change }, TUE)).toContain(message)
  })

  it('irregular allowance may leave the amount empty', () => {
    expect(toAllowance({ ...initialBaon(TUE), frequency: 'irregular' }, TUE)).toMatchObject({ amountCentavos: 0 })
  })
})

describe('toBalances / moneyTotal', () => {
  const design = {
    cashText: '650',
    eWallets: initialMoney.eWallets.map((w) => (w.id === 'gcash' ? { ...w, on: true, text: '400' } : w)),
  }

  it('design answers: Cash ₱650 + GCash ₱400 = ₱1,050', () => {
    expect(toBalances(design)).toEqual({ cashCentavos: 65000, eWallets: [{ id: 'gcash', name: 'GCash', centavos: 40000 }] })
    expect(moneyTotal(design)).toBe(105000)
  })

  it('switched-off wallets are ignored even if they have text', () => {
    const m = { ...design, eWallets: design.eWallets.map((w) => (w.id === 'maya' ? { ...w, text: '999' } : w)) }
    expect(moneyTotal(m)).toBe(105000)
  })

  it('empty fields mean ₱0; bad text gets a friendly message', () => {
    expect(toBalances(initialMoney)).toEqual({ cashCentavos: 0, eWallets: [] })
    expect(toBalances({ ...design, cashText: '6.5.0' })).toBe('Check the cash amount.')
  })
})
