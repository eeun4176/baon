/*
 * vault.test.ts — Tests for vault.ts against a fake in-memory IndexedDB
 * (fake-indexeddb), covering plan §11.3: data survives reopening, nothing is
 * stored as plain text, accounts are isolated, and lock really locks.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { openAccountDb } from '../db/db.ts'
import { createVault, listDeviceAccounts, openVault } from './vault.ts'

/** Wipes every IndexedDB database so each test starts from a fresh phone. */
async function freshDevice() {
  for (const name of await Dexie.getDatabaseNames()) await Dexie.delete(name)
}

/** Decodes raw stored bytes as text, to prove no readable data is inside. */
function asText(buffer: ArrayBuffer) {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
}

describe('vault', () => {
  beforeEach(freshDevice)

  it('saves records and reads them back after locking and reopening (offline restart)', async () => {
    const vault = await createVault('user-a', 'Jasmine')
    await vault.put('transaction', 't1', { amountCentavos: 1500, note: 'Jeep' })
    vault.lock()

    const reopened = await openVault('user-a')
    expect(await reopened.get('t1')).toEqual({ amountCentavos: 1500, note: 'Jeep' })
    expect(await reopened.list('transaction')).toHaveLength(1)
    reopened.lock()
  })

  it('never stores amounts or notes as readable text', async () => {
    const vault = await createVault('user-a', 'Jasmine')
    await vault.put('transaction', 't1', { amountCentavos: 9999, note: 'milk tea secret' })
    vault.lock()

    const db = openAccountDb('user-a')
    const row = (await db.records.get('t1'))!
    expect(Object.keys(row).sort()).toEqual(['ciphertext', 'id', 'iv', 'type', 'v'])
    expect(asText(row.ciphertext)).not.toContain('milk tea')
    expect(asText(row.ciphertext)).not.toContain('9999')
    db.close()
  })

  it('keeps accounts isolated: a record copied into another account cannot be read', async () => {
    const a = await createVault('user-a', 'Jasmine')
    await a.put('transaction', 't1', { amountCentavos: 1500 })
    a.lock()
    const b = await createVault('user-b', 'Paolo')
    b.lock()

    // Simulate someone copying A's row into B's database.
    const dbA = openAccountDb('user-a')
    const dbB = openAccountDb('user-b')
    await dbB.records.put((await dbA.records.get('t1'))!)
    dbA.close()
    dbB.close()

    const bAgain = await openVault('user-b')
    await expect(bAgain.get('t1')).rejects.toThrow()
    bAgain.lock()
  })

  it('lists enrolled accounts with no financial data', async () => {
    ;(await createVault('user-a', 'Jasmine')).lock()
    const accounts = await listDeviceAccounts()
    expect(accounts).toHaveLength(1)
    expect(Object.keys(accounts[0]).sort()).toEqual(['deviceMode', 'enrolledAt', 'label', 'userId'])
  })

  it('refuses to create a second vault for the same account (would orphan old records)', async () => {
    ;(await createVault('user-a', 'Jasmine')).lock()
    await expect(createVault('user-a', 'Jasmine')).rejects.toThrow('already has a vault')
  })

  it('cannot open an account that was never set up on this device', async () => {
    await expect(openVault('stranger')).rejects.toThrow('No vault')
  })

  it('rejects every operation after lock()', async () => {
    const vault = await createVault('user-a', 'Jasmine')
    await vault.put('transaction', 't1', { amountCentavos: 1500 })
    vault.lock()
    await expect(vault.get('t1')).rejects.toThrow('locked')
    await expect(vault.put('transaction', 't2', {})).rejects.toThrow('locked')
    await expect(vault.list('transaction')).rejects.toThrow('locked')
  })
})
