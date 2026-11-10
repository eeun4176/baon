/*
 * keypad.test.ts — Tests for the Quick Add keypad and category helpers. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../ledger/ledger.ts'
import { parsePeso } from '../ledger/money.ts'
import { byMostUsed, categoryLabel, lastUsedWalletId } from './categories.ts'
import { acceptTyped, centavosToText, displayAmount, pressKey, type Key } from './keypad.ts'

/** Presses keys in order from an empty amount. */
const type = (...keys: Key[]) => keys.reduce(pressKey, '')

describe('pressKey', () => {
  it('types a normal amount', () => expect(type('1', '5')).toBe('15'))
  it('types centavos', () => expect(type('1', '5', '.', '5', '0')).toBe('15.50'))
  it('allows at most 2 decimals', () => expect(type('1', '.', '2', '3', '4')).toBe('1.23'))
  it('allows only one dot', () => expect(type('1', '.', '.', '5')).toBe('1.5'))
  it('starts "." as "0."', () => expect(type('.', '5')).toBe('0.5'))
  it('drops leading zeros', () => expect(type('0', '0', '7')).toBe('7'))
  it('caps at 7 whole digits', () => expect(type('9', '9', '9', '9', '9', '9', '9', '9')).toBe('9999999'))
  it('backspace removes the last key, and is safe when empty', () => {
    expect(type('1', '5', 'back')).toBe('1')
    expect(type('back')).toBe('')
  })
  it('everything it produces is a valid amount for parsePeso', () => {
    for (const keys of [['1', '5'], ['0', '.', '5'], ['1', '.'], ['9', '9', '.', '9', '9']] as Key[][]) {
      expect(parsePeso(type(...keys))).not.toBeNull()
    }
  })
})

describe('acceptTyped / centavosToText', () => {
  it.each([['15', '15'], ['1,500', '1500'], ['15.50', '15.50'], ['007', '7'], ['0.5', '0.5'], ['', '']])('accepts %s → %s', (typed, text) => {
    expect(acceptTyped(typed)).toBe(text)
  })
  it.each(['abc', '1.234', '12345678', '1.2.3', '-5'])('ignores %s', (typed) => {
    expect(acceptTyped(typed)).toBeNull()
  })
  it.each([[1550, '15.50'], [1500, '15'], [5, '0.05'], [999999999, '9999999.99']])('%i → %s and back', (c, text) => {
    expect(centavosToText(c)).toBe(text)
    expect(parsePeso(centavosToText(c))).toBe(c)
  })
})

describe('displayAmount', () => {
  it.each([['', '0'], ['15', '15'], ['1500', '1,500'], ['15.5', '15.5'], ['1500.', '1,500.']])('%s → %s', (text, shown) => {
    expect(displayAmount(text)).toBe(shown)
  })
})

describe('categories', () => {
  const tx = (categoryId: string, walletId = 'cash'): Transaction => ({
    id: Math.random().toString(), kind: 'expense', amountCentavos: 100, walletId, categoryId, occurredAt: '2026-11-10T08:00:00+08:00',
  })

  it('keeps the design order when nothing is logged yet', () => {
    expect(byMostUsed([]).slice(0, 5).map((c) => c.label)).toEqual(['Fare', 'Food', 'Load', 'School', 'Snacks'])
  })

  it('moves the most-used categories to the front', () => {
    expect(byMostUsed([tx('health'), tx('health'), tx('food')]).slice(0, 3).map((c) => c.id)).toEqual(['health', 'food', 'fare'])
  })

  it('labels unknown categories as Other', () => expect(categoryLabel('nope')).toBe('Other'))

  it('defaults to the wallet of the latest expense', () => {
    expect(lastUsedWalletId([tx('food', 'cash'), tx('food', 'gcash')], 'cash')).toBe('gcash')
    expect(lastUsedWalletId([], 'cash')).toBe('cash')
  })
})
