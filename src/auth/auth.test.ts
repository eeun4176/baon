/*
 * auth.test.ts — Checks the Response.json() stand-in from auth.ts, which older Safari (iPadOS 16)
 * needs for the Neon sign-in SDK. The SDK itself is replaced by a fake: only the stand-in is tested.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@neon/neon-js', () => ({ createClient: () => ({ auth: {} }) }))

const { ensureResponseJson } = await import('./auth.ts')
const real = Response.json

describe('ensureResponseJson', () => {
  afterEach(() => {
    Response.json = real
  })

  it('adds Response.json when the browser lacks it, like the real one', async () => {
    // @ts-expect-error simulating Safari 16, which has no Response.json
    Response.json = undefined
    ensureResponseJson()
    const response = Response.json({ user: { id: 'u1' } }, { status: 200 })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    await expect(response.json()).resolves.toEqual({ user: { id: 'u1' } })
  })

  it('leaves a browser’s own Response.json alone', () => {
    ensureResponseJson()
    expect(Response.json).toBe(real)
  })
})
