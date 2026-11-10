/*
 * auth.ts — Online sign-in through Neon Auth (Google or a 6-digit email code).
 * Only onboarding imports this, and only with `await import(...)`, so the Neon SDK
 * is never part of the offline app bundle. Signing in proves WHO the student is;
 * it never unlocks or sends their records (plan §7.1).
 */
import { createAuthClient } from '@neon/neon-js/auth'

const client = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL)

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
}

/** Returns the current signed-in user, or null (also null when offline). */
export async function currentUser(): Promise<SignedInUser | null> {
  try {
    const { data } = await client.getSession()
    const user = data?.user
    if (!user) return null
    return { id: user.id, email: user.email, name: user.name?.trim() || user.email.split('@')[0] }
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

/** Signs out of the online session (local vault is unaffected). */
export async function signOut(): Promise<void> {
  await client.signOut()
}
