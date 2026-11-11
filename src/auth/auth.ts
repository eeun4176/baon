/*
 * auth.ts — Online sign-in through Neon Auth (Google or a 6-digit email code).
 * Only onboarding imports this, and only with `await import(...)`, so the Neon SDK
 * is never part of the offline app bundle. Signing in proves WHO the student is;
 * it never unlocks or sends their records (plan §7.1).
 * The same client also reaches the database (Data API) for opt-in sync (sync/neonRemote.ts);
 * every database request carries the signed-in user's token automatically.
 */
import { createClient } from '@neon/neon-js'

/** Sign-in + database client (Neon). */
export const neon = createClient({
  auth: { url: import.meta.env.VITE_NEON_AUTH_URL },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
})
const client = neon.auth

/** Result shape every Better Auth call returns. */
type Result = Promise<{ error: { message?: string } | null }>

// shortcut: @neon/neon-js 0.10.2 includes the Email OTP plugin at runtime but its
// TypeScript types drop it, so we describe the two calls we use. Remove this cast
// when a newer SDK version types `emailOtp` itself.
const otp = client as unknown as {
  emailOtp: { sendVerificationOtp(a: { email: string; type: 'sign-in' }): Result }
  signIn: { emailOtp(a: { email: string; otp: string }): Result }
}

/** The signed-in person, as onboarding needs it. */
export interface SignedInUser {
  id: string // stable UUID — names this account's vault (sbt_<id>)
  name: string // shown in greetings; email users get the part before "@"
  email: string
  image?: string // Google profile photo URL (email-code users have none)
}

/** Returns the current signed-in user, or null (also null when offline). */
export async function currentUser(): Promise<SignedInUser | null> {
  try {
    const { data } = await client.getSession()
    const user = data?.user
    if (!user) return null
    return { id: user.id, email: user.email, name: user.name?.trim() || user.email.split('@')[0], ...(user.image ? { image: user.image } : {}) }
  } catch {
    return null // offline or Neon unreachable: treat as signed out
  }
}

/** Sends the browser to Google; it comes back to `returnTo` signed in. */
export async function signInWithGoogle(returnTo: string): Promise<void> {
  const { error } = await client.signIn.social({ provider: 'google', callbackURL: returnTo })
  if (error) throw new Error(error.message ?? 'Google sign-in failed')
}

/** Emails a 6-digit sign-in code. */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await otp.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
  if (error) throw new Error(error.message ?? 'Could not send the code')
}

/** Signs in with the emailed code. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await otp.signIn.emailOtp({ email, otp: code })
  if (error) throw new Error(error.message ?? 'That code didn’t work')
}

/**
 * Tries to delete the online sign-in account (email, name). Works only if Neon Auth allows
 * self-deletion and the sign-in is recent (Better Auth rules); returns false otherwise or offline.
 */
export async function deleteSignInAccount(): Promise<boolean> {
  try {
    const { error } = await client.deleteUser({})
    return !error
  } catch {
    return false
  }
}

/** Signs out of the online session (local vault is unaffected). */
export async function signOut(): Promise<void> {
  await client.signOut()
}
