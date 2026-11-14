// @ts-check
/*
 * fake-neon.js — A pretend Neon for Playwright: a signed-in test student (no real account) and an
 * in-memory copy of the two sync tables. Every request that leaves localhost lands here; anything
 * this fake doesn't know is blocked and listed in `blocked`, so a test can never reach real Neon.
 */

/** A JWT-shaped pass that expires in an hour (the SDK only reads `exp` to cache it). */
function fakeJwt(sub) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.fake`;
}

/**
 * Starts the fake for one browser context. Returns what the "server" saw, for the tests to check.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ name?: string }} [options]
 */
export async function fakeNeon(context, { name = 'Ana Test' } = {}) {
  const user = { id: 'test-user-0001', email: 'ana.test@example.com', name, emailVerified: true, image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const jwt = fakeJwt(user.id);
  const state = {
    signedIn: true,
    keyChecked: false,
    /** @type {{ dek: string } | null} */ key: null,
    /** @type {Map<string, any>} */ records: new Map(),
    /** @type {string[]} */ blocked: [],
  };

  await context.route(
    (url) => url.hostname !== 'localhost',
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const origin = req.headers().origin ?? '*';
      const cors = {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': '*, authorization, content-type, prefer, x-force-fetch',
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'access-control-expose-headers': 'set-auth-jwt, content-range',
      };
      /** Answers with JSON (status 200 unless given). */
      const json = (body, status = 200, extra = {}) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });

      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

      // Neon Auth (Better Auth)
      if (url.pathname.endsWith('/get-session')) {
        if (!state.signedIn) return json(null);
        const session = { id: 'test-session', userId: user.id, token: jwt, expiresAt: new Date(Date.now() + 3600_000).toISOString(), createdAt: user.createdAt, updatedAt: user.updatedAt };
        return json({ session, user }, 200, { 'set-auth-jwt': jwt });
      }
      if (url.pathname.endsWith('/sign-out')) {
        state.signedIn = false;
        return json({ success: true });
      }

      // Neon Data API (PostgREST): sync_keys and sync_records from sql/sync.sql
      if (url.pathname.endsWith('/sync_keys')) {
        if (req.method() === 'GET') {
          state.keyChecked = true;
          return json(state.key ? [state.key] : []);
        }
        if (req.method() === 'POST') {
          const body = req.postDataJSON();
          const row = Array.isArray(body) ? body[0] : body;
          if (!state.key) state.key = { dek: row.dek }; // ignoreDuplicates: the first key stays
          return json([], 201);
        }
        if (req.method() === 'DELETE') {
          state.key = null;
          return json([], 200);
        }
      }
      if (url.pathname.endsWith('/sync_records')) {
        if (req.method() === 'POST') {
          const body = req.postDataJSON();
          for (const r of Array.isArray(body) ? body : [body]) state.records.set(r.id, { ...r, updated_at: new Date().toISOString() });
          return json([], 201);
        }
        // shortcut: pull always answers "nothing new"; enough for one device, add filtering for a two-device test.
        if (req.method() === 'GET') return json([]);
        if (req.method() === 'DELETE') {
          state.records.clear();
          return json([], 200);
        }
      }

      state.blocked.push(`${req.method()} ${url.origin}${url.pathname}`);
      return route.abort('blockedbyclient');
    },
  );
  return { user, state };
}
