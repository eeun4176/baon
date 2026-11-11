/*
 * greetings.test.ts — Home greeting uses the first name only. Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { firstName, randomGreeting } from './greetings.ts'

describe('firstName', () => {
  it.each([
    ['John Ian Cabalquinto', 'John'],
    ['Jasmine', 'Jasmine'],
    ['  Paolo   Reyes ', 'Paolo'],
    ['cabalquintojohnian', 'cabalquintojohnian'], // email-code users: part before "@"
  ])('%s → %s', (full, first) => {
    expect(firstName(full)).toBe(first)
  })
})

describe('randomGreeting', () => {
  it('greets by first name, never the full name', () => {
    for (let i = 0; i < 50; i++) {
      const g = randomGreeting('John Ian Cabalquinto')
      expect(g).toContain('John')
      expect(g).not.toContain('Cabalquinto')
    }
  })

  it('every greeting fits one phone line with a usual first name', () => {
    for (let i = 0; i < 8; i++) expect(randomGreeting('Jasmine', (i + 0.5) / 8).length).toBeLessThanOrEqual(22)
  })

  it('keeps the same greeting for the same pick, with the current name', () => {
    expect(randomGreeting('John', 0.3).replace('John', 'Ana')).toBe(randomGreeting('Ana', 0.3))
  })
})
