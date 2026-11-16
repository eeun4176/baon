/*
 * split.test.ts — "Split the bill": names from the text box, equal shares, leftover centavos. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { parseNames, splitBill } from './split.ts'

describe('split the bill', () => {
  it('reads names: trims, drops empties and repeats in any case', () => {
    expect(parseNames(' Mia,  Carlo ,, mia , Jo  Ann')).toEqual(['Mia', 'Carlo', 'Jo Ann'])
    expect(parseNames('  ,  ')).toEqual([])
  })

  it('₱600 with 2 friends → ₱200 each, ₱200 for the student', () => {
    expect(splitBill(60000, 2)).toEqual({ own: 20000, each: 20000 })
  })

  it('leftover centavos go to the student, so the parts add up to the bill', () => {
    const s = splitBill(10000, 2)! // ₱100 / 3
    expect(s).toEqual({ own: 3334, each: 3333 })
    expect(s.own + s.each * 2).toBe(10000)
  })

  it('nothing to split: no friends, or less than a centavo each', () => {
    expect(splitBill(10000, 0)).toBeNull()
    expect(splitBill(2, 2)).toBeNull()
  })
})
