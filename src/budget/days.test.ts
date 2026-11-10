/*
 * days.test.ts — Tests for Manila-day helpers and allowance dates. Run: npm test
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createVault } from '../vault/vault.ts'
import { loadAllowance, nextAllowanceDate, saveAllowance, type Allowance } from './allowance.ts'
import { addDays, addMonth, daysBetween, manilaDate, weekday } from './days.ts'

describe('days', () => {
  it('cuts days at Manila midnight', () => {
    expect(manilaDate('2026-11-09T15:59:59Z')).toBe('2026-11-09') // 11:59:59 PM Manila
    expect(manilaDate('2026-11-09T16:00:00Z')).toBe('2026-11-10') // 12:00 AM Manila
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-11-15', -7)).toBe('2026-11-08')
  })

  it('counts days between', () => {
    expect(daysBetween('2026-11-10', '2026-11-15')).toBe(5)
    expect(daysBetween('2026-11-15', '2026-11-10')).toBe(-5)
  })

  it('knows the weekday (Nov 9, 2026 is a Monday)', () => {
    expect(weekday('2026-11-09')).toBe(1)
    expect(weekday('2026-11-15')).toBe(0)
  })

  it('adds a month, clamping to the month end (incl. leap years)', () => {
    expect(addMonth('2026-11-15')).toBe('2026-12-15')
    expect(addMonth('2026-12-15')).toBe('2027-01-15')
    expect(addMonth('2027-01-31')).toBe('2027-02-28')
    expect(addMonth('2028-01-31')).toBe('2028-02-29')
  })
})

describe('allowance', () => {
  it.each([
    ['daily', '2026-11-16'],
    ['weekly', '2026-11-22'],
    ['biweekly', '2026-11-29'],
    ['monthly', '2026-12-15'],
    ['irregular', null],
  ] as const)('next %s allowance after Sun Nov 15 → %s', (frequency, expected) => {
    expect(nextAllowanceDate('2026-11-15', frequency)).toBe(expected)
  })

  it('saves and loads the setup through the encrypted vault', async () => {
    for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
    const vault = await createVault('user-a', 'Jasmine')
    expect(await loadAllowance(vault)).toBeUndefined()

    const setup: Allowance = { amountCentavos: 150000, frequency: 'weekly', nextDate: '2026-11-15', countClassDays: true, classWeekdays: [1, 2, 3, 4, 5, 6] }
    await saveAllowance(vault, setup)
    expect(await loadAllowance(vault)).toEqual(setup)
    await expect(saveAllowance(vault, { ...setup, nextDate: 'next sunday' })).rejects.toThrow()
  })
})
