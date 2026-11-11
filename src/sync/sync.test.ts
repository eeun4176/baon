/*
 * sync.test.ts — Devices (separate fake browsers) syncing through a fake cloud, always on:
 * the first device uploads, a new device just joins (no code), adds/edits/deletes both ways,
 * clashes, a bad cloud row, a device set up on its own merging in, and nothing to join.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { deviceDb } from '../db/db.ts'
import { backupStatus, newRecoveryCode, saveRecoveryCode } from '../backup/backup.ts'
import { saveAllowance } from '../budget/allowance.ts'
import { createVault, listDeviceAccounts, openVault, type Vault } from '../vault/vault.ts'
import { joinSync, lastSyncedAt, syncNow, type CloudKey, type CloudRecord, type Remote, type WireRecord } from './sync.ts'

/** In-memory cloud for one signed-in user; the clock only moves forward, like the server's. */
class FakeCloud implements Remote {
  rows = new Map<string, CloudRecord>()
  key: CloudKey | null = null
  private tick = 0
  private stamp() {
    return new Date(Date.UTC(2026, 10, 11) + ++this.tick * 1000).toISOString()
  }
  async push(rows: WireRecord[]) {
    for (const r of rows) this.rows.set(r.id, { ...r, updated_at: this.stamp() })
  }
  async pull(after: { at: string; id: string } | null, limit: number) {
    return [...this.rows.values()]
      .filter((r) => !after || r.updated_at > after.at || (r.updated_at === after.at && r.id > after.id))
      .sort((a, b) => (a.updated_at === b.updated_at ? (a.id < b.id ? -1 : 1) : a.updated_at < b.updated_at ? -1 : 1))
      .slice(0, limit)
  }
  async getKey() {
    return this.key
  }
  async claimKey(key: CloudKey) {
    this.key ??= key
    return this.key
  }
  async deleteAll() {
    this.rows.clear()
    this.key = null
  }
}

/** A separate browser: switches Dexie to its own fake storage. */
function device() {
  const factory = new IDBFactory()
  return () => {
    Dexie.dependencies.indexedDB = factory
    Dexie.dependencies.IDBKeyRange = IDBKeyRange
  }
}

const ALLOWANCE = { amountCentavos: 150000, frequency: 'weekly', nextDate: '2026-11-16', countClassDays: true, classWeekdays: [1, 2, 3, 4, 5] } as const

/** A set-up account with a few records (what onboarding leaves behind). */
async function phone(name: string, records: Record<string, unknown>): Promise<Vault> {
  const vault = await createVault('u1', name)
  await saveAllowance(vault, { ...ALLOWANCE, classWeekdays: [...ALLOWANCE.classWeekdays] })
  await vault.put('settings', 'account-name', { name })
  for (const [id, data] of Object.entries(records)) await vault.put(id.startsWith('t') ? 'transaction' : 'wallet', id, data)
  return vault
}

describe('sync', () => {
  // The device account list is one shared fake database here (each device has its own records database).
  beforeEach(() => deviceDb.accounts.clear())

  it('the first device uploads its key and only scrambled records; after the account is deleted it never re-uploads', async () => {
    device()()
    const cloud = new FakeCloud()
    const vault = await phone('Jasmine', { t1: { note: 'Jeep' }, cash: { name: 'Cash' } })
    await syncNow(vault, cloud)
    expect([...cloud.rows.keys()].sort()).toEqual(['account-name', 'allowance', 'cash', 't1'].sort())
    expect(JSON.stringify([...cloud.rows.values()])).not.toMatch(/Jeep|Jasmine|Cash/)
    expect(cloud.key?.dek).toMatch(/^[A-Za-z0-9+/]{43}=$/)
    expect(await lastSyncedAt('u1')).toBeTruthy()

    await cloud.deleteAll() // Delete account on another device
    await expect(syncNow(vault, cloud)).rejects.toMatchObject({ problem: 'deleted' })
    expect(cloud.rows.size).toBe(0)
    expect(cloud.key).toBeNull()
    expect(await vault.get('t1')).toEqual({ note: 'Jeep' }) // still on this device
    vault.lock()
  })

  it('a new device just signs in and gets everything; both stay in step (add, edit, delete)', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const a = await phone('Jas', { t1: { note: 'Jeep' }, cash: { name: 'Cash' } })
    await syncNow(a, cloud)

    useB()
    const joined = await joinSync('u1', 'Google Name', cloud)
    expect(joined?.name).toBe('Jas')
    let b = joined!.vault
    expect(await b.get('t1')).toEqual({ note: 'Jeep' })
    expect((await listDeviceAccounts()).find((x) => x.userId === 'u1')?.label).toBe('Jas')

    // B adds and deletes; A sees both.
    await b.put('transaction', 't2', { note: 'Lunch' })
    await b.remove('cash')
    await syncNow(b, cloud)
    useA()
    expect((await syncNow(a, cloud)).changed).toBe(2)
    expect(await a.get('t2')).toEqual({ note: 'Lunch' })
    expect(await a.get('cash')).toBeUndefined()

    // A edits; B gets the edit; nothing changes on a sync with nothing new.
    await a.put('transaction', 't1', { note: 'Jeep (edited)' })
    await syncNow(a, cloud)
    useB()
    b.lock()
    b = await openVault('u1')
    expect((await syncNow(b, cloud)).changed).toBe(1)
    expect(await b.get('t1')).toEqual({ note: 'Jeep (edited)' })
    expect((await syncNow(b, cloud)).changed).toBe(0)
    b.lock()
    useA()
    a.lock()
  })

  it('a name changed on one device shows on the other after it syncs', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const a = await phone('Jas', {})
    await syncNow(a, cloud)
    useB()
    const b = (await joinSync('u1', 'x', cloud))!.vault
    await b.put('settings', 'account-name', { name: 'Jasmine Cruz' })
    await syncNow(b, cloud)
    await deviceDb.accounts.update('u1', { label: 'Jas' }) // the account list is shared in this test: put A's label back
    useA()
    expect((await syncNow(a, cloud)).changed).toBeGreaterThan(0) // so the screens reload
    expect((await listDeviceAccounts()).find((x) => x.userId === 'u1')?.label).toBe('Jasmine Cruz')
    expect((await syncNow(a, cloud)).changed).toBe(0)
    a.lock()
    useB()
    b.lock()
  })

  it('a clash keeps the version of the device that syncs last, and ends the same everywhere', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const a = await phone('Jas', { t1: { note: 'Jeep' } })
    await syncNow(a, cloud)
    useB()
    const b = (await joinSync('u1', 'x', cloud))!.vault

    useA()
    await a.put('transaction', 't1', { note: 'from A' })
    useB()
    await b.put('transaction', 't1', { note: 'from B' })
    useA()
    await syncNow(a, cloud)
    useB()
    await syncNow(b, cloud) // B's own change wins here and is uploaded
    expect(await b.get('t1')).toEqual({ note: 'from B' })
    useA()
    await syncNow(a, cloud)
    expect(await a.get('t1')).toEqual({ note: 'from B' })
    a.lock()
    useB()
    b.lock()
  })

  it('never stores a cloud row that doesn’t open with the account key', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const a = await phone('Jas', { t1: { note: 'Jeep' } })
    await syncNow(a, cloud)
    const t1 = cloud.rows.get('t1')!
    cloud.rows.set('evil', { ...t1, id: 'evil', updated_at: '2030-01-01T00:00:00.000Z' }) // copied row under another id
    useB()
    const b = (await joinSync('u1', 'x', cloud))!.vault
    expect(await b.get('evil')).toBeUndefined()
    expect(await b.get('t1')).toEqual({ note: 'Jeep' })
    b.lock()
    useA()
    a.lock()
  })

  it('a device set up on its own merges in: same id takes the online version, the rest is added everywhere', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const a = await phone('Jas', { t1: { note: 'Jeep' }, cash: { name: 'Cash from A' } })
    await syncNow(a, cloud)

    useB()
    await deviceDb.accounts.clear() // B's own account list (shared in this test)
    const b = await phone('Jas B', { t9: { note: 'Snack' }, cash: { name: 'Cash from B' } })
    await saveRecoveryCode('u1', newRecoveryCode())
    await syncNow(b, cloud)
    expect(await b.get('cash')).toEqual({ name: 'Cash from A' })
    expect(await b.get('t1')).toEqual({ note: 'Jeep' })
    expect(await b.get('t9')).toEqual({ note: 'Snack' })
    await b.put('transaction', 't10', { note: 'Water' }) // still works with the account key
    await syncNow(b, cloud)
    expect((await backupStatus('u1')).hasCode).toBe(false) // its old Recovery Kit can't open new backups
    b.lock()
    const reopened = await openVault('u1')
    expect(await reopened.get('t9')).toEqual({ note: 'Snack' })
    reopened.lock()

    useA()
    await syncNow(a, cloud)
    expect(await a.get('t9')).toEqual({ note: 'Snack' })
    expect(await a.get('t10')).toEqual({ note: 'Water' })
    expect(await a.get('cash')).toEqual({ name: 'Cash from A' })
    a.lock()
  })

  it('nothing usable online: joinSync leaves nothing behind and setup runs as normal', async () => {
    device()()
    const cloud = new FakeCloud()
    expect(await joinSync('u1', 'x', cloud)).toBeNull()
    cloud.key = { dek: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))) } // a key but no records
    expect(await joinSync('u1', 'x', cloud)).toBeNull()
    expect(await listDeviceAccounts()).toEqual([])
    const v = await phone('Jas', {}) // the normal setup still works afterwards
    v.lock()
  })
})
