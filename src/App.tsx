/*
 * App.tsx — Root component of Baon.
 * For now it is a placeholder screen that proves the setup works:
 * Nunito loads, the §12.2 color tokens apply, and the ₱ sign renders.
 * Routing and real screens (Home, History, Plan, Me) replace this in Week 3+.
 */
import { Suspense, lazy } from 'react'

// TEMPORARY: /dev-auth sign-in test page. Lazy-loaded so the Neon SDK stays out of
// the main bundle (it's only needed online). Remove with src/dev/DevAuth.tsx.
const DevAuth = lazy(() => import('./dev/DevAuth.tsx'))

/** Placeholder home screen: wordmark + a sample "safe to spend" card. */
export default function App() {
  if (location.pathname === '/dev-auth') {
    return <Suspense><DevAuth /></Suspense>
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-8">
      <h1 className="text-3xl font-black tracking-tight">baon</h1>
      <p className="mt-1 text-sm font-extrabold tracking-widest text-muted uppercase">
        Setup check
      </p>

      <section className="mt-6 rounded-[28px] bg-card p-6">
        <p className="font-extrabold">Safe to spend today</p>
        <p className="text-7xl font-black">₱120</p>
        <p className="mt-1 font-semibold text-muted">₱720 left until Sunday · 6 class days</p>
        <button className="mt-5 min-h-11 rounded-full bg-blue px-6 font-extrabold text-white">
          + Add expense
        </button>
      </section>
    </main>
  )
}
