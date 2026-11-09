/*
 * DevAuth.tsx — TEMPORARY setup test page (open https://localhost:5173/dev-auth).
 * Proves both sign-in methods work against Neon Auth before real onboarding is built:
 *   1. Continue with Google (redirects to Google, then back here)
 *   2. Email code (6-digit OTP sent by Neon's shared email sender)
 * Shows the signed-in user's ID. Delete this file (and its route in main.tsx)
 * once Week 5 sign-in is built.
 */
import { useEffect, useState } from 'react'
import { createAuthClient } from '@neon/neon-js/auth'

/** Neon Auth client — talks to the Base URL saved in .env.local */
const auth = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL)

/** Result shape every Better Auth call returns. */
type Result = Promise<{ error: { message?: string } | null }>

// shortcut: @neon/neon-js 0.10.2 includes the Email OTP plugin at runtime but its
// TypeScript types drop it, so we describe the two calls we use. Remove this cast
// when a newer SDK version types `emailOtp` itself.
const otp = auth as unknown as {
  emailOtp: { sendVerificationOtp(a: { email: string; type: 'sign-in' }): Result }
  signIn: { emailOtp(a: { email: string; otp: string }): Result }
}

/** Test page with Google + email-code sign-in and a session readout. */
export default function DevAuth() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [status, setStatus] = useState('Checking session…')

  /** Reads the current session from Neon and shows who is signed in. */
  function refreshSession() {
    return auth.getSession().then(({ data, error }) => {
      if (error) return setStatus(`Session error: ${error.message}`)
      setUser(data?.user ?? null)
      setStatus(data?.user ? 'Signed in ✓' : 'Not signed in')
    })
  }

  // Check once on load — this also picks up the session after the Google redirect.
  useEffect(() => {
    auth.getSession().then(({ data, error }) => {
      if (error) return setStatus(`Session error: ${error.message}`)
      setUser(data?.user ?? null)
      setStatus(data?.user ? 'Signed in ✓' : 'Not signed in')
    })
  }, [])

  /** Starts Google sign-in; the browser leaves and comes back to this page. */
  async function signInWithGoogle() {
    setStatus('Opening Google…')
    const { error } = await auth.signIn.social({
      provider: 'google',
      callbackURL: `${location.origin}/dev-auth`,
    })
    if (error) setStatus(`Google error: ${error.message}`)
  }

  /** Asks Neon to email a 6-digit sign-in code. */
  async function sendCode() {
    setStatus('Sending code…')
    const { error } = await otp.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
    if (error) return setStatus(`Send error: ${error.message}`)
    setCodeSent(true)
    setStatus(`Code sent to ${email} — check inbox and spam`)
  }

  /** Signs in with the emailed code, then reloads the session. */
  async function verifyCode() {
    setStatus('Checking code…')
    const { error } = await otp.signIn.emailOtp({ email, otp: code })
    if (error) return setStatus(`Code error: ${error.message}`)
    await refreshSession()
  }

  /** Signs out of Neon (server session) so the other method can be tested. */
  async function signOut() {
    await auth.signOut()
    await refreshSession()
  }

  const pill = 'min-h-11 rounded-full px-5 font-extrabold disabled:opacity-40'
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 px-5 py-8">
      <h1 className="text-3xl font-black">Sign-in test</h1>
      <p className="rounded-2xl bg-card p-4 font-bold" role="status">{status}</p>

      {user ? (
        <section className="space-y-2 rounded-[28px] bg-card p-6">
          <p className="font-extrabold">User ID</p>
          <code className="block break-all text-sm">{user.id}</code>
          <p className="text-muted">{user.email}</p>
          <button className={`${pill} bg-pebble`} onClick={signOut}>Sign out</button>
        </section>
      ) : (
        <>
          <button className={`${pill} w-full bg-ink text-white`} onClick={signInWithGoogle}>
            Continue with Google
          </button>

          <section className="space-y-3 rounded-[28px] bg-card p-6">
            <label className="block font-extrabold">
              Email
              <input
                className="mt-1 block w-full rounded-full bg-pebble px-4 py-3"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className={`${pill} bg-pebble`} disabled={!email} onClick={sendCode}>
              Send email code
            </button>
            {codeSent && (
              <>
                <label className="block font-extrabold">
                  6-digit code
                  <input
                    className="mt-1 block w-full rounded-full bg-pebble px-4 py-3 tracking-widest"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <button className={`${pill} bg-blue text-white`} disabled={code.length !== 6} onClick={verifyCode}>
                  Verify code
                </button>
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}
