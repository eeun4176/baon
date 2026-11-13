/*
 * Help.tsx — Help & privacy (plan §7.6 privacy wording, §7.7 minors / RA 10173, §10
 * "plain-language privacy notice: what stays on the device, what backup sends, how to
 * delete everything").
 *   Left:  "Your privacy, in plain words".
 *   Right: Policies (open as pop-ups, legal/Legal.tsx) and common questions (tap to open).
 * Delete account lives on Me → Security.
 * Wording rule: never claim "only you can ever see your data"; say what is protected and what isn't.
 */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CONTACT_EMAIL, DOCS, type DocId } from '../legal/docs.ts'
import { PolicyDialog } from '../legal/Legal.tsx'
import { Card, Icon, Page, PageHeader, type IconName } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

const PRIVACY: { icon: IconName; title: string; text: ReactNode }[] = [
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
  },
]

const FAQ: [string, ReactNode][] = [
  [tr('How is “Safe to spend today” counted?'), <>{tr('Your money left (minus what you set aside for school) divided by the days until your next baon.')}{' '}<Link to="/breakdown" className="font-extrabold text-blue hover:underline">{tr('See the breakdown')}</Link>.</>],
  [tr('I went over my budget. Is my streak gone?'), tr('No. A logged class day still counts. Tomorrow’s budget just gets smaller.')],
  [tr('What is the free pass?'), tr('It covers a class day you forgot to log, so your streak keeps going. You get 1 every Monday and can save up to 3 at a 10-day streak, 5 at 100.')],
  [tr('No classes for a while?'), tr('On Plan → Class days, set a break. Your budget counts every day and your streak is frozen until classes are back.')],
  [tr('Does Baon work without internet?'), tr('Yes. After the first sign-in, everything works offline and syncs when you’re back online.')],
  [tr('Can I use Baon on more than one device?'), tr('Yes. Sign in with the same account and your records sync by themselves.')],
  [tr('I share or borrow a phone. Is that okay?'), tr('Yes. Turn on shared phone mode in Me → Security. On a phone that isn’t yours, tap Remove from this phone when you’re done.')],
  [tr('What if my phone breaks or gets reset?'), tr('Sign in on the new phone with the same account and your records come back.')],
  [tr('I lost my recovery code.'), tr('On Backup, tap “Lost it? Make a new code”, then export a new backup. Backups made before still need the old code.')],
  [tr('How do I install Baon?'), tr('Android (Chrome): menu ⋮ → Install app. iPhone (Safari): Share → Add to Home Screen. On a computer: the install icon in the address bar.')],
]

/** Help & privacy page. */
export function Help() {
  const [policy, setPolicy] = useState<DocId | null>(null)
  return (
    <Page>
      <PageHeader title={tr('Help & privacy')} sub={tr('How Baon keeps your records private, plus common questions.')} />
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="space-y-4 lg:col-span-7 lg:space-y-5">
          <Card className="animate-rise">
            <h2 className="text-xl font-black">{tr('Your privacy, in plain words')}</h2>
            <ul className="mt-4 space-y-3">
              {PRIVACY.map((p) => (
                <li key={p.title} className="flex items-start gap-3 rounded-2xl bg-page p-4">
                  <Icon name={p.icon} className="mt-0.5 size-5 shrink-0 text-blue" />
                  <span>
                    <span className="block font-black">{p.title}</span>
                    <span className="block font-semibold text-muted">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-semibold text-muted">
              {tr('Baon follows the Data Privacy Act of 2012 (RA 10173): it collects only what sign-in needs, and you can delete your data anytime. Under 18? Read this with a parent or guardian.')}</p>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-5 lg:space-y-5">
          <Card className="animate-rise">
            <h2 className="text-xl font-black">{tr('Policies')}</h2>
            <ul className="mt-3 space-y-2">
              {(['privacy', 'terms', 'storage'] as DocId[]).map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => setPolicy(id)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-page px-4 text-left font-black hover:bg-pebble">
                    <span className="flex-1">{DOCS[id].title}</span>
                    <Icon name="chevron-right" className="size-5 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-semibold text-muted">
              {tr('Questions or problems? Email us:')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-black break-all text-blue underline">{CONTACT_EMAIL}</a>
            </p>
          </Card>

          <Card className="animate-rise">
            <h2 className="text-xl font-black">{tr('Common questions')}</h2>
            <div className="mt-3 divide-y divide-page">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-black [&::-webkit-details-marker]:hidden">
                    {q}
                    <Icon name="chevron-down" className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pb-3 font-semibold text-muted">{a}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {policy && <PolicyDialog id={policy} onClose={() => setPolicy(null)} />}
    </Page>
  )
}
