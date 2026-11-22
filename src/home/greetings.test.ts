/*
 * greetings.test.ts — Home greeting uses the first name only. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { firstName, philippineGreetingTime, randomGreeting } from './greetings.ts'

describe('firstName', () => {
  it.each([
    ['Juan Miguel Dela Cruz', 'Juan'],
    ['Jasmine', 'Jasmine'],
    ['  Paolo   Reyes ', 'Paolo'],
    ['juandelacruz', 'juandelacruz'], // email-code users: part before "@"
  ])('%s → %s', (full, first) => {
    expect(firstName(full)).toBe(first)
  })
})

describe('randomGreeting', () => {
  it('greets by first name, never the full name', () => {
    for (let i = 0; i < 50; i++) {
      const g = randomGreeting('Juan Miguel Dela Cruz')
      expect(g).toContain('Juan')
      expect(g).not.toContain('Dela Cruz')
    }
  })

  it('every greeting stays on one line with a usual first name', () => {
    const afternoon = new Date('2026-01-01T06:00:00Z')
    for (let i = 0; i < 9; i++) {
      const greeting = randomGreeting('Jasmine', (i + 0.5) / 9, afternoon)
      expect(greeting).not.toContain('\n')
      expect(greeting).not.toContain('\r')
    }
  })

  it('keeps the same greeting for the same pick, with the current name', () => {
    const afternoon = new Date('2026-01-01T06:00:00Z')
    expect(randomGreeting('Juan', 0.3, afternoon).replace('Juan', 'Ana')).toBe(randomGreeting('Ana', 0.3, afternoon))
  })

  it('uses each time greeting only in its Philippines time period', () => {
    expect(philippineGreetingTime(new Date('2026-01-01T21:00:00Z'))).toBe('morning')
    expect(philippineGreetingTime(new Date('2026-01-01T01:00:00Z'))).toBe('morning')
    expect(philippineGreetingTime(new Date('2026-01-01T03:30:00Z'))).toBe('morning')
    expect(philippineGreetingTime(new Date('2026-01-01T04:00:00Z'))).toBe('afternoon')
    expect(philippineGreetingTime(new Date('2026-01-01T06:00:00Z'))).toBe('afternoon')
    expect(philippineGreetingTime(new Date('2026-01-01T10:00:00Z'))).toBe('evening')
    expect(philippineGreetingTime(new Date('2026-01-01T12:00:00Z'))).toBe('evening')
    expect(philippineGreetingTime(new Date('2026-01-01T16:00:00Z'))).toBe('night')
  })

  it('does not include time-specific greetings outside their period', () => {
    const periods = [
      ['2026-01-01T01:00:00Z', /^(Good afternoon|Good evening)/],
      ['2026-01-01T06:00:00Z', /^(Good morning|Good evening|Night owl|Gising pa)/],
      ['2026-01-01T12:00:00Z', /^(Good morning|Good afternoon|Night owl|Gising pa)/],
      ['2026-01-01T16:00:00Z', /^(Good morning|Good afternoon|Good evening)/],
    ] as const

    for (const [iso, excluded] of periods) {
      for (let i = 0; i < 50; i++) {
        const greeting = randomGreeting('Jasmine', i / 50, new Date(iso))
        expect(greeting).not.toMatch(excluded)
      }
    }
  })

  it('includes both night greetings between 12 AM and 5 AM', () => {
    const night = new Date('2026-01-01T16:00:00Z')
    const greetings = [
      randomGreeting('Jasmine', 0, night),
      randomGreeting('Jasmine', 0.125, night),
    ]

    expect(greetings).toContain('Night owl, Jasmine?')
    expect(greetings).toContain('Gising pa, Jasmine?')
  })
})
