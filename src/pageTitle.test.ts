/*
 * pageTitle.test.ts — Tab titles per page.
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { HOME_TITLE, pageTitle } from './pageTitle.ts'

describe('pageTitle', () => {
  it('Home is "Baon | Student Budget Tracker"', () => expect(pageTitle('/')).toBe(HOME_TITLE))
  it('other pages put their name first', () => {
    expect(pageTitle('/plan')).toBe('Plan | Baon Student Budget Tracker')
    expect(pageTitle('/me/')).toBe('Me | Baon Student Budget Tracker')
  })
})
