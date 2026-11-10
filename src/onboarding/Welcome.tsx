/*
 * Welcome.tsx — Onboarding screen 1 (design artboard "1 Welcome"):
 * logo, a preview card of what Home looks like, the promise, and "Get started".
 */
import logoIcon from '../assets/logo-icon.png'
import { Button, Screen } from '../ui/kit.tsx'

/** First screen a new student sees. */
export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <Screen
      footer={
        <>
          <Button onClick={onStart}>Get started</Button>
          <p className="mt-3 text-center text-[0.9375rem] font-semibold text-muted">
            Connect once to set up. After that, it works offline.
          </p>
        </>
      }
    >
      <header className="flex items-center gap-2.5 text-[2.125rem] font-black tracking-tight lg:hidden">
        <img src={logoIcon} alt="" className="size-10" />
        baon
      </header>

      {/* Preview of the Home hero card — decorative, so hidden from screen readers. */}
      <div aria-hidden="true" className="mx-auto mt-10 w-full max-w-sm rounded-[30px] bg-card p-6 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)]">
        <div className="flex justify-between gap-1.5">
          {['done', 'done', 'done', 'today', '', '', ''].map((s, i) => (
            <span
              key={i}
              className={`aspect-square w-[12%] rounded-full ${s === 'done' ? 'bg-blue' : s === 'today' ? 'border-[3px] border-blue' : 'bg-pebble-2'}`}
            />
          ))}
        </div>
        <p className="mt-5 text-center font-extrabold text-muted">Safe to spend today</p>
        <p className="text-center text-[clamp(3.5rem,18vw,4.5rem)] leading-none font-black">
          <span className="text-[0.5em] text-muted">₱</span>180
        </p>
        <p className="mt-5 rounded-full bg-blue py-3.5 text-center font-black text-white">+ Jeep ₱15</p>
      </div>

      <h1 className="mt-10 text-[clamp(2rem,10vw,2.5rem)] leading-[1.05] font-black">Know what you can spend today.</h1>
      <p className="mt-3 text-lg font-semibold text-muted">Log your baon in seconds — even without load or Wi‑Fi.</p>
    </Screen>
  )
}
