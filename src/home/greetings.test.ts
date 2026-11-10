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
})
