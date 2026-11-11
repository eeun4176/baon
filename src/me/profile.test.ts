/*
 * profile.test.ts — Display-name rules and the encrypted profile record.
 * Run: npm test
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createVault, listDeviceAccounts, renameAccount } from '../vault/vault.ts'
import { googlePhotoAtSize } from './photo.ts'
import { checkName, loadProfile, ProfileSchema, saveProfile } from './profile.ts'

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

describe('profile photo', () => {
  it('asks Google for a 256 px photo', () => {
    expect(googlePhotoAtSize('https://lh3.googleusercontent.com/a/ACg8abc=s96-c')).toBe('https://lh3.googleusercontent.com/a/ACg8abc=s256-c')
    expect(googlePhotoAtSize('https://lh3.googleusercontent.com/a/ACg8abc')).toBe('https://lh3.googleusercontent.com/a/ACg8abc')
  })

  it('only stores small image data, never a web link', () => {
    expect(ProfileSchema.safeParse({ photo: 'data:image/jpeg;base64,AAAA', photoFrom: 'google' }).success).toBe(true)
    expect(ProfileSchema.safeParse({ photo: 'https://evil.example/x.png' }).success).toBe(false)
    expect(ProfileSchema.safeParse({ photo: `data:image/jpeg;base64,${'A'.repeat(400_001)}` }).success).toBe(false)
  })
})
