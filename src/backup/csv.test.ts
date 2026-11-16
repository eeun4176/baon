/*
 * csv.test.ts — The spreadsheet download: columns, quoting, and formula-safe notes. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import { cell, toCsv } from './csv.ts'

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'spending', openingCentavos: 0, archived: false },
  { id: 'gcash', name: 'GCash', type: 'spending', openingCentavos: 0, archived: false },
]

describe('csv export', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(cell('Lunch, rice')).toBe('"Lunch, rice"')
    expect(cell('He said "hi"')).toBe('"He said ""hi"""')
    expect(cell('two\nlines')).toBe('"two\nlines"')
    expect(cell('plain')).toBe('plain')
  })

  it('a note that looks like a formula is shown as text', () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(cell('+639171234567')).toBe("'+639171234567")
    expect(cell('-5 for the jeep')).toBe("'-5 for the jeep")
    expect(cell('@me')).toBe("'@me")
  })

  it('one row per entry in Manila time, amounts in pesos', () => {
    const txs: Transaction[] = [
      { id: '1', kind: 'expense', amountCentavos: 1500, walletId: 'cash', categoryId: 'fare', occurredAt: '2026-11-15T23:30:00.000Z', note: 'Jeep, morning' },
      { id: '2', kind: 'transfer', amountCentavos: 10000, walletId: 'cash', toWalletId: 'gcash', occurredAt: '2026-11-16T02:00:00.000Z' },
    ]
    const lines = toCsv(txs, wallets).split('\r\n')
    expect(lines[0]).toBe('﻿Date,Time,Type,Category,Wallet,To wallet,Amount (₱),Person,Note')
    expect(lines[1]).toBe('2026-11-16,07:30,Expense,Fare,Cash,,15.00,,"Jeep, morning"') // 23:30 UTC = next day 07:30 Manila
    expect(lines[2]).toBe('2026-11-16,10:00,Move,,Cash,GCash,100.00,,')
    expect(lines).toHaveLength(4) // header, 2 rows, trailing line break
  })
})
