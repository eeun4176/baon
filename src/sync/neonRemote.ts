/*
 * neonRemote.ts — The real cloud for sync.ts: Neon's Data API (tables in sql/sync.sql).
 * Loaded only when sync runs (with the sign-in code), so the offline app never downloads it.
 * Row Level Security on the server limits every request to the signed-in user's own rows;
 * the user_id filters here just help the database find them quickly.
 */
import { AuthRequiredError } from '@neon/neon-js'
import { neon } from '../auth/auth.ts'
import { SyncError, type CloudKey, type CloudRecord, type Remote } from './sync.ts'

const RECORD_COLUMNS = 'id,type,v,iv,ciphertext,deleted,updated_at'
const KEY_COLUMNS = 'dek'

/**
 * Turns a failed request into a SyncError the screens can explain. The client returns most
 * failures as `{ message, status }` instead of throwing: status 0 with "AuthRequiredError…"
 * means no sign-in, status 0 with "Failed to fetch" means no connection.
 */
function problem(error: unknown, status?: number): SyncError {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '')
  console.warn('baon sync request failed', status, message) // developer log; not shown in the app
  if (error instanceof AuthRequiredError || /AuthRequired/.test(message) || status === 401 || status === 403) return new SyncError('signin')
  if (!navigator.onLine || error instanceof TypeError || (status === 0 && /fetch|network/i.test(message))) return new SyncError('offline')
  return new SyncError('server', message)
}

/** Runs one Data API request; throws SyncError on failure. */
async function run<T>(request: PromiseLike<{ data: T; error: unknown; status: number }>): Promise<T> {
  let result: { data: T; error: unknown; status: number }
  try {
    result = await request
  } catch (e) {
    throw problem(e)
  }
  if (result.error) throw problem(result.error, result.status)
  return result.data
}

/** The cloud for one signed-in user. */
export function neonRemote(userId: string): Remote {
  /** The account key online, or null. */
  const getKey = async () => (await run(neon.from('sync_keys').select(KEY_COLUMNS).eq('user_id', userId).maybeSingle())) as CloudKey | null
  return {
    async signedInAs() {
      if (!navigator.onLine) throw new SyncError('offline')
      const { data, error } = await neon.auth.getSession().catch((e: unknown) => ({ data: null, error: e }))
      if (error) throw problem(error)
      return data?.user?.id ?? null
    },
    async push(rows) {
      if (!rows.length) return
      await run(neon.from('sync_records').upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,id' }))
    },
    async pull(after, limit) {
      let query = neon.from('sync_records').select(RECORD_COLUMNS).eq('user_id', userId)
      if (after) query = query.or(`updated_at.gt."${after.at}",and(updated_at.eq."${after.at}",id.gt."${after.id}")`)
      return (await run(query.order('updated_at').order('id').limit(limit))) as CloudRecord[]
    },
    getKey,
    async claimKey(key) {
      // Insert only if missing: two devices syncing for the first time at once end up with one key.
      await run(neon.from('sync_keys').upsert({ ...key, user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }))
      const now = await getKey()
      if (!now) throw new SyncError('server', 'account key missing right after saving it')
      return now
    },
    async deleteAll() {
      await run(neon.from('sync_records').delete().eq('user_id', userId))
      await run(neon.from('sync_keys').delete().eq('user_id', userId))
    },
  }
}
