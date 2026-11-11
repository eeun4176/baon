/*
 * profile.ts — Optional profile details from Me → Profile (design p22): school and
 * "I'm in Senior high / College". Stored encrypted as one settings record.
 * The display name itself lives in the device's account list (vault.renameAccount)
 * because the sign-in and lock screens need it before anything is decrypted.
 */
import * as z from 'zod/mini'
import type { Vault } from '../vault/vault.ts'

export const ProfileSchema = z.object({
  school: z.optional(z.string().check(z.trim(), z.maxLength(60))),
  level: z.optional(z.enum(['shs', 'college'])),
})
export type Profile = z.infer<typeof ProfileSchema>

export const LEVELS = [['shs', 'Senior high'], ['college', 'College']] as const

/** Checks a display name; returns the cleaned name or a friendly problem. */
export function checkName(raw: string): { name: string } | { problem: string } {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return { problem: 'Enter the name you want baon to call you.' }
  if (name.length > 40) return { problem: 'Keep it under 40 letters.' }
  return { name }
}

const RECORD_ID = 'profile'

/** Validates and saves the profile. */
export async function saveProfile(vault: Vault, profile: Profile): Promise<void> {
  await vault.put('settings', RECORD_ID, ProfileSchema.parse(profile))
}

/** Loads the profile (empty until the student fills it in). */
export async function loadProfile(vault: Vault): Promise<Profile> {
  const raw = await vault.get(RECORD_ID)
  return raw === undefined ? {} : ProfileSchema.parse(raw)
}
