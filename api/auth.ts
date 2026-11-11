/*
 * api/auth.ts — Vercel function: forwards sign-in requests from baon's own address to Neon's
 * sign-in service, so the sign-in cookie belongs to baon itself. A cookie from Neon's address
 * is "third-party" to the browser; phones block or drop those, so students had to sign in to
 * Google again whenever sync started. vercel.json sends /api/auth/<path> here as ?path=<path>.
 * Same idea as Neon's own Next.js forwarder (@neon/auth/server), minus its session cache,
 * whose answers leave out the pass sync needs for the database.
 */
import { handleAuthRequest, parseSetCookies, serializeSetCookie } from '@neon/auth/server'

const PASS_HEADERS = ['content-type', 'date', 'set-auth-jwt', 'set-auth-token', 'x-neon-ret-request-id']
const SAFE_PATH = /^[\w-]+(\/[\w-]+)*$/ // e.g. get-session, sign-in/social — never "..", "//" or another host

/** Forwards one request to Neon (the address in VITE_NEON_AUTH_URL) and returns its answer with baon-owned cookies. */
export async function forward(request: Request, upstream = process.env.VITE_NEON_AUTH_URL): Promise<Response> {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  if (!upstream || !SAFE_PATH.test(path)) return Response.json({ error: 'Not found' }, { status: 404 })
  url.searchParams.delete('path')
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
  const answer = await handleAuthRequest(upstream, new Request(url, { method: request.method, headers: request.headers, body }), path)

  const headers = new Headers({ 'Cache-Control': 'no-store' }) // sign-in answers are per person: never cache
  for (const name of PASS_HEADERS) {
    const value = answer.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Neon marks its cookies for use from other sites; here they're baon's own, so plain same-site cookies.
  for (const line of answer.headers.getSetCookie()) {
    for (const cookie of parseSetCookies(line)) headers.append('Set-Cookie', serializeSetCookie({ ...cookie, domain: undefined, partitioned: undefined, sameSite: 'lax', secure: true }))
  }
  return new Response(answer.body, { status: answer.status, statusText: answer.statusText, headers })
}

export const GET = (request: Request) => forward(request)
export const POST = (request: Request) => forward(request)
