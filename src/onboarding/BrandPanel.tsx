/*
 * BrandPanel.tsx — The onboarding picture (design "Get started"): Baon's buddy (the wallet mascot)
 * on a dark panel with floating coins and sample chips. The motion classes (bn-*) are in index.css.
 *   BrandPanel  — desktop (≥ 1024px): the left half, with a caption that follows the step.
 *   BuddyArt    — phones: the big picture on the Welcome screen (the steps after it have no picture).
 */
import logoIcon from '../assets/logo-icon.png'
import flame from '../assets/streak-flame.png'
import { tr } from '../i18n/i18n.ts'

export type StepNo = 1 | 2 | 3 | 4

// Desktop caption per step
const CAPTIONS = [
  [tr('Know what you can spend today.'), tr('Log your baon in seconds, even offline.')],
  [tr('Your device, your rules.'), tr('Sharing it? Each person’s records stay locked.')],
  [tr('Every peso gets a plan.'), tr('Set it once. Baon does the daily math.')],
  [tr('Almost there!'), tr('Add what you have, then see today’s number.')],
]

const GLOW = 'bn-pulse absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(30,94,255,0.45)_0%,rgba(30,94,255,0.12)_55%,rgba(30,94,255,0)_72%)]'
const CHIP = 'absolute bg-white text-[#1d1f1e] shadow-[0_18px_32px_-18px_rgba(0,0,0,0.6)]' // stays white in dark theme too

/** The wallet mascot: a smiling blue wallet with a bill and a coin tucked in. */
function Buddy({ className }: { className: string }) {
  return (
    <svg viewBox="10 10 104 100" className={className} aria-hidden="true">
      <g transform="rotate(-12 56 40)"><rect x="32" y="22" width="50" height="34" rx="7" fill="#E8EFFF" /><circle cx="57" cy="37" r="7.5" fill="none" stroke="#1E5EFF" strokeWidth="3.5" /></g>
      <circle cx="84" cy="34" r="12" fill="#FFC94D" /><circle cx="84" cy="34" r="6.5" fill="none" stroke="#E0A526" strokeWidth="3" />
      <rect x="18" y="46" width="80" height="56" rx="18" fill="#1E5EFF" />
      <path d="M32 53h44" stroke="#6E98FF" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="76" y="63" width="30" height="24" rx="10" fill="#6E98FF" />
      <circle cx="88" cy="75" r="4.5" fill="#FFFFFF" />
      <ellipse cx="30" cy="83" rx="4.5" ry="3" fill="#6E98FF" /><ellipse cx="66" cy="83" rx="4.5" ry="3" fill="#6E98FF" />
      <path d="M33 75q5-6.5 10 0M53 75q5-6.5 10 0M42 84q6 6.5 12 0" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

/** A gold coin that floats up and fades. */
function Coin({ className, delay = '0s' }: { className: string; delay?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`bn-coin absolute ${className}`} style={{ animationDelay: delay }} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#FFC94D" /><circle cx="12" cy="12" r="6.5" fill="none" stroke="#E0A526" strokeWidth="2.4" />
    </svg>
  )
}

/** A small twinkling star. */
function Spark({ className, fill, delay = '0s' }: { className: string; fill: string; delay?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`bn-spark absolute ${className}`} style={{ animationDelay: delay }} aria-hidden="true">
      <path d="M12 2c.6 4.8 2.6 7.4 8 8-5.4.6-7.4 3.2-8 8-.6-4.8-2.6-7.4-8-8 5.4-.6 7.4-3.2 8-8z" fill={fill} />
    </svg>
  )
}

/** Logo + name, top-left of the dark panels. */
function Logo() {
  return (
    <div className="relative z-10 flex items-center gap-2.5 text-2xl font-black tracking-tight lg:text-[1.75rem]">
      <img src={logoIcon} alt="" className="size-9 rounded-xl ring-1 ring-white/20 lg:size-10" />
      {tr('Baon')}</div>
  )
}

/** The buddy in the middle with coins, sparks and four sample chips drifting around it. */
function Scene() {
  return (
    <div aria-hidden="true" className="relative min-h-72 flex-1 lg:min-h-96">
      <span className={`${GLOW} left-1/2 size-80 lg:size-[26rem]`} />
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Buddy className="bn-bob size-32 min-[360px]:size-40 lg:size-60" /></span>

      <Coin className="bottom-[6%] left-[30%] size-7 lg:size-8" />
      <Coin className="bottom-[2%] left-[58%] size-5 lg:size-6" delay="1.8s" />
      <Coin className="bottom-[10%] left-[72%] size-6 lg:size-7" delay="3.4s" />

      <span className={`${CHIP} bn-drift-a top-[3%] left-0 flex flex-col rounded-[20px] px-3.5 py-2.5 lg:top-[6%] lg:left-[4%] lg:rounded-3xl lg:px-4.5 lg:py-3.5`}>
        <span className="text-xs font-extrabold text-[#5f6361]">{tr('Safe to spend today')}</span>
        <span className="text-2xl leading-tight font-black lg:text-3xl">₱180</span>
      </span>
      <span className="bn-drift-b absolute top-[19%] right-0 hidden min-h-10 items-center min-[360px]:flex rounded-full bg-blue px-4 text-sm font-black text-white shadow-[0_14px_28px_-14px_rgba(30,94,255,0.9)] lg:right-[4%] lg:min-h-12 lg:text-base">
        {tr('+ Jeep ₱15')}</span>
      <span className={`${CHIP} bn-drift-c bottom-[9%] left-0 flex min-h-10 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-black lg:bottom-[14%] lg:left-[8%] lg:min-h-12 lg:text-base`}>
        <img src={flame} alt="" className="size-5 lg:size-6" /> 12{tr('-day streak')}</span>
      <span className="bn-drift-b absolute right-0 bottom-[21%] hidden flex-col rounded-2xl min-[360px]:flex bg-white/12 px-3 py-2 lg:right-[8%] lg:px-4 lg:py-3" style={{ animationDelay: '1.2s' }}>
        <span className="text-xs font-black lg:text-sm">{tr('Printing set aside')}</span>
        <span className="text-xs font-bold text-white/75">{tr('₱150 · Due Fri')}</span>
      </span>

      {/* The two right-hand chips need room: phones narrower than 360px show only the left ones */}
      <Spark className="top-[38%] left-[14%] size-3.5 lg:left-[24%] lg:size-4.5" fill="#8FB0FF" />
      <Spark className="top-[8%] right-[26%] size-3 lg:size-3.5" fill="#FFC94D" delay=".8s" />
      <Spark className="right-[30%] bottom-[8%] hidden size-4 lg:block" fill="#FFFFFF" delay="1.6s" />
    </div>
  )
}

/** Desktop: the left half of onboarding. The caption and dots follow the step. */
export function BrandPanel({ step }: { step: StepNo }) {
  const [title, sub] = CAPTIONS[step - 1]
  return (
    <aside className="sticky top-0 hidden h-dvh p-4 lg:block">
      <div className="flex h-full flex-col gap-6 overflow-hidden rounded-[36px] bg-hero px-10 py-9 text-white">
        <Logo />
        <Scene />
        <div className="relative z-10 max-w-md">
          <p aria-live="polite" className="text-[2.125rem] leading-[1.15] font-black text-balance">{title}</p>
          <p className="mt-2.5 text-[1.0625rem] font-semibold text-white/75">{sub}</p>
          <div aria-hidden="true" className="mt-4 flex gap-1.5">
            {[1, 2, 3, 4].map((i) => <span key={i} className={`h-2 rounded-full ${i === step ? 'w-7 bg-blue' : 'w-2 bg-white/20'}`} />)}
          </div>
        </div>
      </div>
    </aside>
  )
}

/** Phones: the big picture on the Welcome screen. */
export function BuddyArt() {
  return (
    <section aria-hidden="true" className="flex min-h-80 flex-1 flex-col overflow-hidden rounded-[32px] bg-hero p-5 text-white lg:hidden">
      <Logo />
      <Scene />
    </section>
  )
}
