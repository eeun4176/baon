// @vitest-environment node
/*
 * auth.test.ts — The sign-in forwarder: right Neon address, safe paths only, cookies made baon's own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { forward } from './auth.ts'

const NEON = 'https://example.neonauth.test/neondb/auth'

/** Replaces fetch with a fake Neon that records the request and answers with one cookie. */
function fakeNeon() {
  const seen: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    seen.push({ url, init })
    const headers = new Headers({ 'content-type': 'application/json', 'set-auth-jwt': 'jwt-1' })
    headers.append('set-cookie', '__Secure-neon-auth.session_token=abc; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=None; Partitioned')
    return new Response('{"ok":true}', { status: 200, headers })
  })
  return seen
}

afterEach(() => vi.unstubAllGlobals())

describe('sign-in forwarder', () => {
  it('sends the path and query to Neon and keeps the database pass', async () => {
    const seen = fakeNeon()
    const res = await forward(new Request('https://baon.test/api/auth?path=sign-in/social&x=1', { method: 'POST', body: '{"provider":"google"}', headers: { origin: 'https://baon.test', cookie: '__Secure-neon-auth.session_challenge=c; other=1' } }), NEON)
    expect(seen[0].url).toBe(`${NEON}/sign-in/social?x=1`)
    expect(seen[0].init.body).toBe('{"provider":"google"}')
    const sent = new Headers(seen[0].init.headers)
    expect(sent.get('origin')).toBe('https://baon.test')
    expect(sent.get('cookie')).toContain('session_challenge=c')
    expect(sent.get('cookie')).not.toContain('other=1') // only Neon's own cookies leave baon
    expect(res.headers.get('set-auth-jwt')).toBe('jwt-1')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('turns Neon cookies into baon-owned, same-site cookies', async () => {
    fakeNeon()
    const cookie = (await forward(new Request('https://baon.test/api/auth?path=get-session'), NEON)).headers.getSetCookie()[0]
    expect(cookie).toContain('__Secure-neon-auth.session_token=abc')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).not.toContain('Partitioned')
    expect(cookie).not.toContain('Domain')
  })

  it('refuses paths that could reach somewhere else', async () => {
    const seen = fakeNeon()
    for (const path of ['', '../admin', 'a//b', 'https://evil.test', 'a/../b', '%2e%2e']) {
      expect((await forward(new Request(`https://baon.test/api/auth?path=${encodeURIComponent(path)}`), NEON)).status).toBe(404)
    }
    expect((await forward(new Request('https://baon.test/api/auth?path=get-session'), '')).status).toBe(404) // not set up
    expect(seen).toHaveLength(0)
  })
})
