/*
 * neonRemote.test.ts — Checks the one retry in neonRemote.ts: a request refused for the sign-in
 * (right after signing in on a new device) gets a fresh session and is sent once more;
 * other failures are not retried. The Neon client is replaced by a small fake.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const answers: { data: unknown; error: unknown; status: number }[] = []
const getSession = vi.fn<(options?: unknown) => Promise<unknown>>(async () => ({ data: null, error: null }))

/** Fake query: every chained call returns itself; awaiting it gives the next queued answer. */
function fakeQuery() {
  const query: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'maybeSingle']) query[name] = () => query
  query.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise.resolve(answers.shift()).then(resolve, reject)
  return query
}

vi.mock('../auth/auth.ts', () => ({ neon: { from: () => fakeQuery(), auth: { getSession } } }))

const { neonRemote } = await import('./neonRemote.ts')

describe('neonRemote', () => {
  beforeEach(() => {
    answers.length = 0
    getSession.mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('navigator', { onLine: true }) // the test runner has no real connection status
  })

  it('refreshes the sign-in once and retries when the database refuses the pass', async () => {
    answers.push({ data: null, error: { message: 'JWT invalid' }, status: 401 }, { data: { dek: 'key' }, error: null, status: 200 })
    await expect(neonRemote('u1').getKey()).resolves.toEqual({ dek: 'key' })
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(getSession.mock.calls[0][0]).toEqual({ fetchOptions: { headers: { 'X-Force-Fetch': '1' } } })
  })

  it('does not retry other failures', async () => {
    answers.push({ data: null, error: { message: 'boom' }, status: 500 })
    await expect(neonRemote('u1').getKey()).rejects.toMatchObject({ problem: 'server' })
    expect(getSession).not.toHaveBeenCalled()
  })
})
