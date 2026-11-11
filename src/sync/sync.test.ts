/*
 * sync.test.ts — Two devices (separate fake browsers) syncing through a fake cloud:
 * first upload, joining with the recovery code, adds/edits/deletes both ways, clashes,
 * a bad cloud row, a new recovery code, a different account key, and turning off everywhere.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { deviceDb } from '../db/db.ts'
import { newRecoveryCode, saveRecoveryCode } from '../backup/backup.ts'
import { createVault, listDeviceAccounts, openVault, type Vault } from '../vault/vault.ts'
import { joinSync, syncNow, syncState, turnOffSync, turnOnSync, type CloudKey, type CloudRecord, type Remote, type WireRecord } from './sync.ts'

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
  async putKey(key: CloudKey) {
    this.key = key
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

/** Device A with a few records and a Recovery Kit; returns its vault and code. */
async function phoneA(): Promise<{ vault: Vault; code: string }> {
  const vault = await createVault('u1', 'Jasmine')
  await vault.put('transaction', 't1', { note: 'Jeep', amountCentavos: 1500 })
  await vault.put('wallet', 'cash', { name: 'Cash' })
  const code = newRecoveryCode()
  await saveRecoveryCode('u1', code)
  return { vault, code }
}

describe('sync', () => {
  // The device account list is one shared fake database here (each device has its own records database).
  beforeEach(() => deviceDb.accounts.clear())

  it('needs a Recovery Kit, then uploads only scrambled records and the locked key', async () => {
    const useA = device()
    useA()
    const cloud = new FakeCloud()
    const vault = await createVault('u1', 'Jasmine')
    await vault.put('transaction', 't1', { note: 'Jeep' })
    expect(await turnOnSync(vault, cloud, 'Jas')).toBe('needs-kit')
    await saveRecoveryCode('u1', newRecoveryCode())
    expect(await turnOnSync(vault, cloud, 'Jas')).toBe('on')
    expect([...cloud.rows.keys()].sort()).toEqual(['account-name', 't1'])
    expect(JSON.stringify([...cloud.rows.values()])).not.toMatch(/Jeep|Jas/)
    expect(cloud.key).not.toBeNull()
    expect((await syncState('u1')).on).toBe(true)
    vault.lock()
  })

  it('a new device joins with the code and both stay in step (add, edit, delete)', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const { vault: a, code } = await phoneA()
    await turnOnSync(a, cloud, 'Jas')

    useB()
    await expect(joinSync('u1', 'Fallback', newRecoveryCode(), cloud)).rejects.toThrow('doesn’t match')
    expect(await joinSync('u1', 'Fallback', code, cloud)).toBe('Jas')
    let b = await openVault('u1')
    expect(await b.get('t1')).toEqual({ note: 'Jeep', amountCentavos: 1500 })
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

  it('a clash keeps the version of the device that syncs last, and ends the same everywhere', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const { vault: a, code } = await phoneA()
    await turnOnSync(a, cloud, 'Jas')
    useB()
    await joinSync('u1', 'x', code, cloud)
    const b = await openVault('u1')

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
    const { vault: a, code } = await phoneA()
    await turnOnSync(a, cloud, 'Jas')
    const t1 = cloud.rows.get('t1')!
    cloud.rows.set('evil', { ...t1, id: 'evil', updated_at: '2030-01-01T00:00:00.000Z' }) // copied row under another id
    useB()
    await joinSync('u1', 'x', code, cloud)
    const b = await openVault('u1')
    expect(await b.get('evil')).toBeUndefined()
    expect(await b.get('t1')).toEqual({ note: 'Jeep', amountCentavos: 1500 })
    b.lock()
    useA()
    a.lock()
  })

  it('a new recovery code made on one device is used everywhere; the old one stops working', async () => {
    const [useA, useB, useC] = [device(), device(), device()]
    const cloud = new FakeCloud()
    useA()
    const { vault: a, code: oldCode } = await phoneA()
    await turnOnSync(a, cloud, 'Jas')
    useB()
    await joinSync('u1', 'x', oldCode, cloud)

    useA()
    const newCode = newRecoveryCode()
    await saveRecoveryCode('u1', newCode)
    await syncNow(a, cloud) // uploads the newly locked key
    useB()
    const b = await openVault('u1')
    await syncNow(b, cloud) // adopts it
    useC()
    await expect(joinSync('u1', 'x', oldCode, cloud)).rejects.toThrow('doesn’t match')
    await expect(joinSync('u1', 'x', newCode, cloud)).resolves.toBe('Jas')
    b.lock()
    useA()
    a.lock()
  })

  it('a device with its own separate records is told to switch instead of mixing keys', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const { vault: a } = await phoneA()
    await turnOnSync(a, cloud, 'Jas')
    useB()
    await deviceDb.accounts.clear() // B's own account list (shared in this test)
    const other = await createVault('u1', 'Jas')
    expect(await turnOnSync(other, cloud, 'Jas')).toBe('other-key') // before any Recovery Kit: no new code to confuse with
    await saveRecoveryCode('u1', newRecoveryCode())
    expect(await turnOnSync(other, cloud, 'Jas')).toBe('other-key')
    expect((await syncState('u1')).on).toBe(false)
    other.lock()
    useA()
    a.lock()
  })

  it('turning off everywhere deletes the cloud copies and stops the other devices', async () => {
    const [useA, useB] = [device(), device()]
    const cloud = new FakeCloud()
    useA()
    const { vault: a, code } = await phoneA()
    await turnOnSync(a, cloud, 'Jas')
    useB()
    await joinSync('u1', 'x', code, cloud)
    const b = await openVault('u1')

    useA()
    await turnOffSync('u1', cloud)
    expect(cloud.rows.size).toBe(0)
    expect(cloud.key).toBeNull()
    expect((await syncState('u1')).on).toBe(false)
    useB()
    expect(await syncNow(b, cloud)).toEqual({ changed: 0, stopped: true })
    expect((await syncState('u1')).on).toBe(false)
    expect(await b.get('t1')).toEqual({ note: 'Jeep', amountCentavos: 1500 }) // records stay on the device
    b.lock()
    useA()
    a.lock()
  })
})
