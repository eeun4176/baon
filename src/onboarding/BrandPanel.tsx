/*
 * BrandPanel.tsx — Left half of onboarding on desktop (≥ 1024px): a dark ink panel
 * (design's hero-card style) with the logo, tagline and the three promises.
 * Hidden on phones and tablets, where each step uses the full screen.
 */
import logoIcon from '../assets/logo-icon.png'
import { Icon } from '../ui/kit.tsx'

const PROMISES = [
  'Know exactly what you can spend today',
  'Log a ₱15 fare in two taps — even without load or Wi‑Fi',
  'Your records stay encrypted on your device',
]

/** Desktop-only brand side of the onboarding split screen. */
export function BrandPanel() {
  return (
    <aside className="sticky top-0 hidden h-dvh p-4 lg:block">
      <div className="flex h-full flex-col justify-between rounded-[32px] bg-hero p-12 text-white">
        <div className="flex items-center gap-3 text-[2.125rem] font-black tracking-tight">
          <img src={logoIcon} alt="" className="size-12 rounded-xl ring-1 ring-white/20" />
          baon
        </div>

        <div>
          <p className="max-w-md text-5xl leading-[1.05] font-black">Your daily sakto baon.</p>
          <ul className="mt-10 space-y-4">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-center gap-3 text-lg font-bold text-white/80">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue">
                  <Icon name="check" className="size-5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-semibold text-white/50">Free for students. No ads that use your financial data.</p>
      </div>
    </aside>
  )
}
