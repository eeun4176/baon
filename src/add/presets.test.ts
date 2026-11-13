/*
 * presets.test.ts — "Make it a button?" suggestion (after 3 same expenses)
 * and the encrypted save/load of the one-tap buttons.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Transaction } from '../ledger/ledger.ts'
import { createVault } from '../vault/vault.ts'
import { DEFAULT_PRESETS, loadPresets, savePresets, suggestPreset, type Presets } from './presets.ts'

let n = 0
/** An expense of `pesos` with a note. */
const spend = (note: string | undefined, pesos: number, categoryId = 'fare', extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${n++}`, kind: 'expense', amountCentavos: pesos * 100, walletId: 'cash', categoryId, note, occurredAt: '2026-11-10T08:00:00+08:00', ...extra })

const trike = [spend('Tricycle', 20), spend('tricycle ', 20), spend('Tricycle', 20)]

describe('suggestPreset', () => {
  it('suggests an expense logged 3 times (name match ignores case/spaces)', () => {
    expect(suggestPreset(trike, DEFAULT_PRESETS)).toMatchObject({ label: 'Tricycle', amountCentavos: 2000, categoryId: 'fare', times: 3 })
  })

  it('needs 3 of the same name, amount and category', () => {
    expect(suggestPreset([...trike.slice(0, 2), spend('Tricycle', 25)], DEFAULT_PRESETS)).toBeNull()
    expect(suggestPreset([...trike.slice(0, 2), spend('Tricycle', 20, 'food')], DEFAULT_PRESETS)).toBeNull()
  })

  it('skips existing buttons, dismissed ones and school payments', () => {
    expect(suggestPreset([spend('Jeep', 15), spend('Jeep', 15), spend('Jeep', 15)], DEFAULT_PRESETS)).toBeNull()
    expect(suggestPreset(trike, { ...DEFAULT_PRESETS, dismissed: ['tricycle|2000|fare'] })).toBeNull()
    expect(suggestPreset(trike.map((t) => ({ ...t, linkedId: 'org' })), DEFAULT_PRESETS)).toBeNull()
  })

  it('uses the category name when there is no note', () => {
    expect(suggestPreset([spend(undefined, 30, 'snacks'), spend(undefined, 30, 'snacks'), spend('', 30, 'snacks')], DEFAULT_PRESETS)?.label).toBe('Snacks')
  })

  it('stops suggesting when all 8 buttons are used', () => {
    const full: Presets = { items: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, label: `P${i}`, amountCentavos: 100, categoryId: 'food' })), dismissed: [] }
    expect(suggestPreset(trike, full)).toBeNull()
  })
})

describe('presets storage', () => {
  it('starts with the four starters, then keeps the student’s own list', async () => {
    const vault = await createVault('presets-user', 'Test')
    expect(await loadPresets(vault)).toEqual(DEFAULT_PRESETS)
    const mine: Presets = { items: [{ id: 'x', label: 'Tricycle', amountCentavos: 2000, categoryId: 'fare', walletId: 'gcash' }], dismissed: ['a'] }
    await savePresets(vault, mine)
    expect(await loadPresets(vault)).toEqual(mine)
  })

  it('rejects more than 8 buttons', async () => {
    const vault = await createVault('presets-user-2', 'Test')
    const items = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, label: `P${i}`, amountCentavos: 100, categoryId: 'food' }))
    await expect(savePresets(vault, { items, dismissed: [] })).rejects.toThrow()
  })
})
