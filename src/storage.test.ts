/*
 * storage.test.ts — Low-storage rule and size labels (storage.ts).
 * Run: npm test
 */
import { describe, expect, it } from 'vitest'
import { formatBytes, isStorageLow } from './storage.ts'

describe('storage', () => {
  it('is low only when less than 50 MB is left, and never when the quota is unknown', () => {
    expect(isStorageLow({ usage: 400_000, quota: 2_000_000_000 })).toBe(false)
    expect(isStorageLow({ usage: 400_000, quota: 30_000_000 })).toBe(true)
    expect(isStorageLow({ usage: 400_000, quota: 50_400_000 })).toBe(false)
    expect(isStorageLow({ usage: 400_000, quota: 0 })).toBe(false)
  })

  it('formats sizes like the sidebar', () => {
    expect(formatBytes(355_000)).toBe('355 KB')
    expect(formatBytes(200)).toBe('1 KB')
    expect(formatBytes(1_234_567)).toBe('1.2 MB')
  })
})
