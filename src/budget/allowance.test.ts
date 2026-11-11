/*
 * allowance.test.ts — The "Class days" label on the Plan tab.
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { advanceNextDate, afterAllowanceLogged, classDaysText, type Allowance } from './allowance.ts'

/** Allowance with the given class days. */
const with_ = (classWeekdays: number[], countClassDays = true): Allowance =>
  ({ amountCentavos: 0, frequency: 'weekly', nextDate: '2026-11-15', countClassDays, classWeekdays })

describe('classDaysText', () => {
  it('names a run of days as a range', () => expect(classDaysText(with_([6, 1, 2, 3, 4, 5]))).toBe('Mon–Sat'))
  it('lists days that are not in a row', () => expect(classDaysText(with_([1, 3, 5]))).toBe('Mon, Wed, Fri'))
  it('lists two days instead of a range', () => expect(classDaysText(with_([1, 2]))).toBe('Mon, Tue'))
  it('says every day when all days or the switch is off', () => {
    expect(classDaysText(with_([0, 1, 2, 3, 4, 5, 6]))).toBe('Every day')
    expect(classDaysText(with_([1], false))).toBe('Every day')
  })
  it('says none when no day is picked', () => expect(classDaysText(with_([]))).toBe('None'))
})

describe('advanceNextDate', () => {
  const weekly = { ...with_([1, 2, 3, 4, 5, 6]), nextDate: '2026-11-15' }
  it('moves to the next cycle after "Yes, it arrived"', () => {
    expect(advanceNextDate(weekly, '2026-11-15')).toBe('2026-11-22')
    expect(advanceNextDate({ ...weekly, frequency: 'monthly' }, '2026-11-15')).toBe('2026-12-15')
  })
  it('skips whole cycles when answered late', () => {
    expect(advanceNextDate(weekly, '2026-11-24')).toBe('2026-11-29')
  })
  it('a late baon ("Not yet", came Wed) keeps the usual Sunday', () => {
    expect(advanceNextDate({ ...weekly, nextDate: '2026-11-18', lateFrom: '2026-11-15' }, '2026-11-18')).toBe('2026-11-22')
  })
  it('asks for a date when the allowance is irregular', () => {
    expect(advanceNextDate({ ...weekly, frequency: 'irregular' }, '2026-11-15')).toBeNull()
  })
})

describe('afterAllowanceLogged (Add → Allowance)', () => {
  const weekly = { ...with_([1, 2, 3, 4, 5, 6]), nextDate: '2026-11-15' }
  it('on or after allowance day it answers the check-in: next date moves a cycle', () => {
    expect(afterAllowanceLogged(weekly, '2026-11-15')?.nextDate).toBe('2026-11-22')
  })
  it('while waiting after "Not yet" it keeps the usual day and stops waiting', () => {
    const waiting = { ...weekly, nextDate: '2026-11-18', lateFrom: '2026-11-15' }
    expect(afterAllowanceLogged(waiting, '2026-11-16')).toMatchObject({ nextDate: '2026-11-22', lateFrom: undefined })
  })
  it('extra money mid-cycle, or an irregular schedule, leaves the date alone', () => {
    expect(afterAllowanceLogged(weekly, '2026-11-12')).toBeNull()
    expect(afterAllowanceLogged({ ...weekly, frequency: 'irregular' }, '2026-11-15')).toBeNull()
  })
})
