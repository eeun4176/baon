/*
 * profile.test.ts — Display-name rules and the encrypted profile record.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createVault, listDeviceAccounts, renameAccount } from '../vault/vault.ts'
import { checkName, loadProfile, saveProfile } from './profile.ts'

describe('checkName', () => {
  it('trims and squeezes spaces', () => expect(checkName('  Jasmine   Cruz ')).toEqual({ name: 'Jasmine Cruz' }))
  it('rejects empty and too-long names', () => {
    expect(checkName('   ')).toHaveProperty('problem')
    expect(checkName('x'.repeat(41))).toHaveProperty('problem')
  })
})

describe('profile storage', () => {
  it('starts empty, then keeps school and level', async () => {
    const vault = await createVault('profile-user', 'Jasmine')
    expect(await loadProfile(vault)).toEqual({})
    await saveProfile(vault, { school: 'PUP Manila', level: 'college' })
    expect(await loadProfile(vault)).toEqual({ school: 'PUP Manila', level: 'college' })
  })

  it('renaming changes the name shown on this device', async () => {
    await createVault('rename-user', 'Old Name')
    await renameAccount('rename-user', 'New Name')
    expect((await listDeviceAccounts()).find((a) => a.userId === 'rename-user')?.label).toBe('New Name')
  })
})
