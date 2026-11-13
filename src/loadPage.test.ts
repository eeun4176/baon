/*
 * loadPage.test.ts — A page file that's gone after a deploy reloads Baon once, never in a loop. Run: npm test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPage } from './loadPage.ts'

/** A stand-in sessionStorage (tests run in Node, which has none). */
function fakeStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
}

describe('loadPage', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', fakeStorage()))

  it('a missing page file reloads once; a second failure shows the error instead of looping', async () => {
    const reload = vi.fn()
    void loadPage(Promise.reject(new Error('gone')), reload) // never settles: the reload replaces the page
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
    await expect(loadPage(Promise.reject(new Error('gone')), reload)).rejects.toThrow('gone')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a page that loads clears the mark, so the next deploy can reload again', async () => {
    const reload = vi.fn()
    void loadPage(Promise.reject(new Error('gone')), reload)
    await Promise.resolve()
    await expect(loadPage(Promise.resolve('page'), reload)).resolves.toBe('page')
    void loadPage(Promise.reject(new Error('gone again')), reload)
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
