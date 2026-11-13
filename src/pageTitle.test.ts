/*
 * pageTitle.test.ts — Tab titles per page, and which typed addresses are real pages.
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { HOME_TITLE, isKnownPath, pageTitle } from './pageTitle.ts'

describe('isKnownPath', () => {
  it('accepts Baon pages, with or without a trailing slash', () => {
    for (const path of ['/', '/history', '/me/', '/backup', '/add']) expect(isKnownPath(path)).toBe(true)
  })
  it('refuses made-up or edited addresses', () => {
    for (const path of ['/asdas', '/history/123', '/admin', '/me/../plan', '/index.html']) expect(isKnownPath(path)).toBe(false)
  })
})

describe('pageTitle', () => {
  it('Home is "Baon | Student Budget Tracker"', () => expect(pageTitle('/')).toBe(HOME_TITLE))
  it('other pages put their name first', () => {
    expect(pageTitle('/plan')).toBe('Plan | Baon Student Budget Tracker')
    expect(pageTitle('/me/')).toBe('Me | Baon Student Budget Tracker')
  })
})
