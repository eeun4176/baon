/*
 * money.test.ts — Tests for peso parsing/formatting (all money is
 * integer centavos; no floating-point totals). Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { formatPeso, formatPesoShort, parsePeso } from './money.ts'

describe('parsePeso', () => {
  it.each([
    ['15', 1500],
    ['15.5', 1550],
    ['15.50', 1550],
    ['15.05', 1505],
    ['15.', 1500],
    ['0.10', 10],
    ['1,500', 150000],
    ['₱ 1,050', 105000],
    ['0.1', 10], // the classic float trap: stays exact
  ])('"%s" → %i centavos', (input, expected) => {
    expect(parsePeso(input)).toBe(expected)
  })

  it.each(['', '.', '.5', 'abc', '15.555', '-15', '1e3', '10000000'])('rejects "%s"', (input) => {
    expect(parsePeso(input)).toBeNull()
  })

  it('always returns whole numbers', () => {
    for (const s of ['0.07', '19.99', '1234567.89']) expect(Number.isInteger(parsePeso(s))).toBe(true)
  })
})

describe('formatPeso', () => {
  it.each([
    [105000, '₱1,050'],
    [1500, '₱15'],
    [1550, '₱15.50'],
    [5, '₱0.05'],
    [0, '₱0'],
    [-33000, '−₱330'],
    [-1550, '−₱15.50'],
  ])('%i → %s', (centavos, expected) => {
    expect(formatPeso(centavos)).toBe(expected)
  })
})

describe('formatPesoShort (tight spots like the donut middle)', () => {
  it.each([
    [869750, '₱8,697.50'], // under ₱10,000: exact
    [999999, '₱9,999.99'],
    [1000000, '₱10,000'], // under ₱100,000: whole pesos
    [9999999, '₱100,000'], // ₱99,999.99 rounds up; still 8 characters
    [12345678, '₱123.5K'],
    [123456789, '₱1.2M'],
    [999999999, '₱10M'], // the largest single entry
    [-1234567800, '−₱12.3M'],
  ])('%i → %s', (centavos, expected) => {
    expect(formatPesoShort(centavos)).toBe(expected)
  })
})
