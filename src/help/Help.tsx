/*
 * Help.tsx — Help & privacy (design "Help & privacy v2"): a plain-language privacy notice
 * (what stays on the device, what backup sends; RA 10173), policies, contact, and common questions.
 *   Phone: back to Me, privacy (numbered), questions (topic chips + one open at a time),
 *     policies, "Still stuck?" card.
 *   Desktop: privacy cards 2×2 beside policies + contact; questions below
 *     in two columns with topic tags.
 * Policies open as pop-ups (legal/Legal.tsx). Delete account lives on Me → Security.
 * Wording rule: never claim "only you can ever see your data"; say what is protected and what isn't.
 */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CONTACT_EMAIL, DOCS, type DocId } from '../legal/docs.ts'
import { PolicyDialog } from '../legal/Legal.tsx'
import { Icon, Page, type IconName } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

const PRIVACY: { icon: IconName; title: string; text: string; warn?: boolean }[] = [
  {
    icon: 'shield',
    title: tr('Your records are scrambled'),
    text: tr('Your records are scrambled (encrypted) on this phone. A scrambled copy online follows you to every device you sign in on.'),
  },
  {
    icon: 'user',
    title: tr('What we receive'),
    text: tr('Your email, name and Google photo for sign-in, plus the scrambled copy of your records. We never look at, sell or share them.'),
  },
  {
    icon: 'cloud',
    title: tr('Backups are files you keep'),
    text: tr('An extra encrypted file you save yourself. Only your recovery code opens it. Baon doesn’t upload it.'),
  },
  {
    icon: 'phone',
    title: tr('What it can’t protect'),
    text: tr('Anyone who can open Baon on your phone can see your records. Keep your screen lock on, or turn on shared phone mode (Me → Security). Keep your Google or email account safe too.'),
    warn: true,
  },
]

type Topic = 'budget' | 'streak' | 'money' | 'phone'
const TOPICS: [Topic | 'all', string][] = [['all', tr('All')], ['budget', tr('Budget')], ['streak', tr('Streak')], ['money', tr('Money')], ['phone', tr('Phone & backup')]]
const TOPIC_LABEL = Object.fromEntries(TOPICS) as Record<Topic, string>
const TAG_CLASS: Record<Topic, string> = {
  budget: 'bg-blue-tint text-blue',
  streak: 'bg-amber-tint text-amber',
  money: 'bg-trend-down/10 text-trend-down',
  phone: 'bg-page text-ink/80',
}

/** `more` is shown after the answer (a link). */
const FAQ: { topic: Topic; q: string; a: string; more?: ReactNode }[] = [
  { topic: 'budget', q: tr('How is “Safe to spend today” counted?'), a: tr('Your money left, minus what’s held back, divided by the days until your next baon.'), more: <> <Link to="/breakdown" className="font-extrabold text-blue hover:underline">{tr('See the breakdown')}</Link>.</> },
  { topic: 'streak', q: tr('I went over my budget. Is my streak gone?'), a: tr('No. A logged class day still counts. Tomorrow’s budget just gets smaller.') },
  { topic: 'streak', q: tr('What is the free pass?'), a: tr('It covers a class day you forgot to log. You get 1 every Monday, and can save up to 3 (10+ day streak) or 5 (100+).') },
  { topic: 'budget', q: tr('How does Ipon outlook work?'), a: tr('It looks at what was left of each day’s budget on your logged class days in the last 4 weeks. That average, times your budget days in the next 30 days, is about what you could save in a month if you keep it up. It shows after 5 logged class days. It’s only an estimate: nothing moves to Savings by itself.') },
  { topic: 'money', q: tr('I borrowed or lent money.'), a: tr('Add it on Plan → Utang. What you owe is held back until paid; what you lent isn’t spending.') },
  { topic: 'money', q: tr('I have a scholarship or a job.'), a: tr('Use Add → Money in and pick where it came from. “Make it last until” spreads a big amount over weeks.') },
  { topic: 'budget', q: tr('No classes for a while?'), a: tr('Set a break on Plan → Class days. Every day counts and your streak is frozen.') },
  { topic: 'phone', q: tr('Does Baon work without internet?'), a: tr('Yes. After the first sign-in, everything works offline and syncs when you’re back online.') },
  { topic: 'phone', q: tr('Can I use Baon on more than one device?'), a: tr('Yes. Sign in with the same account and your records sync by themselves.') },
  { topic: 'phone', q: tr('I share or borrow a phone. Is that okay?'), a: tr('Yes. Turn on shared phone mode in Me → Security. On a phone that isn’t yours, tap Remove from this phone when you’re done.') },
  { topic: 'phone', q: tr('What if my phone breaks or gets reset?'), a: tr('Sign in on the new phone with the same account and your records come back.') },
  { topic: 'phone', q: tr('I lost my recovery code.'), a: tr('On Backup, tap “Lost it? Make a new code”, then export a new backup. Backups made before still need the old code.') },
  { topic: 'phone', q: tr('How do I install Baon?'), a: tr('Android (Chrome): menu ⋮ → Install app. iPhone (Safari): Share → Add to Home Screen. On a computer: the install icon in the address bar.') },
]

/** One question: tap to open (one open at a time). Desktop shows its topic tag. */
function Question({ f, open, onToggle }: { f: (typeof FAQ)[number]; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-t border-pebble">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-14 w-full items-center gap-2.5 py-2.5 text-left text-sm font-black lg:min-h-[3.75rem] lg:gap-3 lg:text-[0.9375rem]">
        <span className={`hidden h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-black lg:inline-flex ${TAG_CLASS[f.topic]}`}>{TOPIC_LABEL[f.topic]}</span>
        <span className="flex-1">{f.q}</span>
        <span className={`grid size-[1.875rem] shrink-0 place-items-center rounded-full text-muted transition-transform lg:size-8 ${open ? 'rotate-180 bg-page' : ''}`}>
          <Icon name="chevron-down" className="size-4" />
        </span>
      </button>
      {open && <p className="mb-3 animate-fade rounded-[14px] bg-page p-3 text-[0.8125rem] leading-[1.55] font-bold text-ink/80 lg:mb-4 lg:rounded-2xl lg:px-3.5 lg:text-sm">{f.a}{f.more}</p>}
    </div>
  )
}

/** Help & privacy page. */
export function Help() {
  const [policy, setPolicy] = useState<DocId | null>(null)
  const [topic, setTopic] = useState<Topic | 'all'>('all')
  const [open, setOpen] = useState<string | null>(FAQ[0].q)

  const list = FAQ.filter((f) => topic === 'all' || f.topic === topic)
  const half = Math.ceil(list.length / 2)
  const question = (f: (typeof FAQ)[number]) => <Question key={f.q} f={f} open={open === f.q} onToggle={() => setOpen(open === f.q ? null : f.q)} />

  return (
    <Page>
      <header className="mb-3.5 flex items-center gap-0.5 md:mb-5">
        <Link to="/me" aria-label={tr('Back to Me')} className="-ml-2 grid size-11 shrink-0 place-items-center md:hidden"><Icon name="chevron-left" /></Link>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-black tracking-[-0.03em] md:text-[2.125rem]">{tr('Help & privacy')}</h1>
          <p className="mt-1 hidden font-bold text-muted md:block">{tr('How Baon keeps your records private, plus common questions.')}</p>
        </div>
      </header>

      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-5">
        {/* Privacy: numbered list on phones, 2×2 cards on desktop */}
        <section aria-labelledby="privacy-title" className="flex animate-rise flex-col gap-1 rounded-[26px] bg-card p-[1.125rem] lg:col-span-2 lg:row-span-2 lg:row-start-1 lg:gap-[1.125rem] lg:rounded-[32px] lg:px-7 lg:py-[1.625rem]">
          <div className="pb-1.5 lg:pb-0">
            <h2 id="privacy-title" className="text-[1.0625rem] font-black lg:text-xl">{tr('Your privacy, in plain words')}</h2>
            <p className="hidden text-sm font-bold text-muted lg:block">{tr('No fine print. Here’s exactly what happens to your records.')}</p>
          </div>
          <ul className="grid lg:grid-cols-2 lg:gap-3">
            {PRIVACY.map((p, i) => (
              <li key={p.title} className={`flex items-start gap-3 border-t border-pebble py-3 lg:flex-col lg:gap-2 lg:rounded-[22px] lg:border-0 lg:p-[1.125rem] ${p.warn ? 'lg:bg-amber-tint/50' : 'lg:bg-page'}`}>
                <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-[11px] text-sm font-black lg:size-10 lg:rounded-[14px] ${p.warn ? 'bg-amber-tint text-amber' : 'bg-blue-tint text-blue'}`}>
                  <span className="lg:hidden">{i + 1}</span><Icon name={p.icon} className="hidden size-5 lg:block" />
                </span>
                <span className="flex flex-col gap-0.5 lg:gap-2">
                  <span className="text-[0.9375rem] font-black lg:text-base">{p.title}</span>
                  <span className="text-[0.8125rem] leading-normal font-bold text-muted lg:text-sm">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex gap-2.5 rounded-2xl bg-page px-3 py-2.5 text-xs leading-normal font-bold text-muted lg:mt-auto lg:rounded-none lg:border-t lg:border-pebble lg:bg-transparent lg:px-0 lg:pt-3.5 lg:pb-0 lg:text-[0.8125rem]">
            <Icon name="info" className="hidden size-[1.125rem] shrink-0 lg:block" />
            {tr('Baon follows the Data Privacy Act of 2012 (RA 10173): it collects only what sign-in needs, and you can delete your data anytime. Under 18? Read this with a parent or guardian.')}</p>
        </section>

        {/* Common questions: topic chips; two columns on desktop */}
        <section aria-labelledby="faq-title" className="flex min-w-0 animate-rise flex-col gap-2.5 rounded-[26px] bg-card p-[1.125rem] lg:col-span-3 lg:row-start-3 lg:gap-4 lg:rounded-[32px] lg:px-7 lg:py-[1.625rem]">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
            <div className="flex flex-1 items-baseline justify-between gap-2 lg:flex-none lg:flex-col lg:items-start lg:gap-0">
              <h2 id="faq-title" className="text-[1.0625rem] font-black lg:text-xl">{tr('Common questions')}</h2>
              <p className="text-xs font-extrabold text-muted lg:text-sm lg:font-bold" aria-live="polite">{tr('{0} of {1} questions', list.length, FAQ.length)}</p>
            </div>
            <div role="tablist" aria-label={tr('Topics')} className="-mx-[1.125rem] flex w-[calc(100%+2.25rem)] gap-1.5 overflow-x-auto px-[1.125rem] pb-0.5 [scrollbar-width:none] lg:mx-0 lg:w-auto lg:flex-wrap lg:overflow-visible lg:p-0">
              {TOPICS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={topic === id} onClick={() => setTopic(id)}
                  className={`h-[2.125rem] shrink-0 rounded-full px-3.5 text-[0.8125rem] font-extrabold whitespace-nowrap lg:h-9 ${topic === id ? 'bg-ink text-card' : 'bg-page text-ink/80 hover:bg-pebble'}`}>
                  {label}</button>
              ))}
            </div>
          </div>
          <div className="grid items-start gap-x-7 lg:grid-cols-2">
            <div className="flex flex-col">{list.slice(0, half).map(question)}</div>
            <div className="flex flex-col">{list.slice(half).map(question)}</div>
          </div>
        </section>

        {/* Policies */}
        <section aria-labelledby="policies-title" className="flex animate-rise flex-col rounded-[26px] bg-card px-[1.125rem] py-2 lg:col-start-3 lg:row-start-1 lg:gap-1.5 lg:rounded-[32px] lg:p-6">
          <h2 id="policies-title" className="pt-2.5 pb-2 text-[1.0625rem] font-black lg:pt-0 lg:text-lg">{tr('Policies')}</h2>
          {(['privacy', 'terms', 'storage'] as DocId[]).map((id) => (
            <button key={id} type="button" onClick={() => setPolicy(id)} className="flex min-h-[3.25rem] w-full items-center gap-2.5 border-t border-pebble text-left text-[0.9375rem] font-extrabold lg:min-h-14 lg:gap-3 lg:rounded-[18px] lg:border-0 lg:bg-page lg:pr-3 lg:pl-3.5 lg:font-black lg:hover:bg-pebble">
              <Icon name="file" className="hidden size-5 shrink-0 text-blue lg:block" />
              <span className="flex-1">{DOCS[id].title}</span>
              <Icon name="chevron-right" className="size-[1.125rem] shrink-0 text-muted" />
            </button>
          ))}
        </section>

        {/* Contact */}
        <section aria-labelledby="contact-title" className="flex animate-rise flex-col gap-2 rounded-[26px] bg-hero p-5 text-white lg:col-start-3 lg:row-start-2 lg:gap-2.5 lg:rounded-[32px] lg:p-6">
          <span aria-hidden="true" className="hidden size-11 place-items-center rounded-2xl bg-white/10 lg:grid"><Icon name="mail" className="size-[1.375rem]" /></span>
          <h2 id="contact-title" className="text-[1.0625rem] font-black lg:text-lg">{tr('Still stuck?')}</h2>
          <p className="text-[0.8125rem] leading-normal font-bold text-white/75 lg:text-sm">{tr('Questions or problems? Send us an email and we’ll help you out.')}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="mt-1 grid h-12 place-items-center rounded-full bg-blue font-extrabold text-white lg:mt-auto">{tr('Email us')}</a>
          <span className="hidden text-center text-xs font-bold break-all text-white/75 lg:block">{CONTACT_EMAIL}</span>
        </section>
      </div>

      {policy && <PolicyDialog id={policy} onClose={() => setPolicy(null)} />}
    </Page>
  )
}
