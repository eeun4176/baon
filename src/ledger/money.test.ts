/*
 * money.test.ts — Tests for peso parsing/formatting (plan §11.3: "All money is
 * integer centavos; no floating-point totals"). Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { formatPeso, parsePeso } from './money.ts'

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
