/*
 * backup-db.js — Saves a full copy of the Neon database to this laptop: npm run backup:db
 * Reads DATABASE_URL (Neon → Connect, pooling OFF) from .env.local. To copy a point-in-time
 * branch instead, use that branch's connection string. Then checks the file opens with pg_restore.
 * The file holds every account's email and the keys that open their records: keep it private.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is missing. Add it to .env.local (Neon → Connect, connection pooling off).')
  process.exit(1)
}
const bin = process.env.PG_BIN ?? 'C:\\Program Files\\PostgreSQL\\18\\bin' // pg_dump is not on PATH here
const dir = process.env.BACKUP_DIR ?? 'D:\\Backups\\baon' // outside the repo, so it can never be committed
mkdirSync(dir, { recursive: true })

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
const file = join(dir, `baon-${stamp}.dump`)

/** Runs a PostgreSQL tool and stops the backup if it fails. */
function run(tool, args) {
  const r = spawnSync(join(bin, tool), args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })
  if (r.error || r.status !== 0) {
    console.error(`${tool} failed${r.error ? `: ${r.error.message}` : ''}`)
    process.exit(1)
  }
  return r.stdout
}

run('pg_dump.exe', ['--format=custom', '--no-owner', '--no-privileges', '--file', file, url])
// A dump that pg_restore can list is a complete, readable file.
const items = run('pg_restore.exe', ['--list', file]).split('\n').filter((l) => l && !l.startsWith(';')).length
console.log(`Saved ${file} (${(statSync(file).size / 1024).toFixed(0)} KB, ${items} items)`)
