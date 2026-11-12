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
import { DOCS, type DocId } from '../legal/docs.ts'
import { PolicyDialog } from '../legal/Legal.tsx'
import { Card, Icon, Page, PageHeader, type IconName } from '../ui/kit.tsx'
import { tr } from '../i18n/i18n.ts'

const PRIVACY: { icon: IconName; title: string; text: ReactNode }[] = [
  {
    icon: 'shield',
    title: tr('Your records are scrambled'),
    text: tr('Your records are scrambled (encrypted) on this phone. A scrambled copy stays online with your account, so they follow you to every device you sign in on.'),
  },
  {
    icon: 'user',
    title: tr('What we receive'),
    text: tr('Your email, name and Google photo so you can sign in, and the scrambled copy of your records. We don’t look at your records, and we never sell or share them.'),
  },
  {
    icon: 'cloud',
    title: tr('Backups are files you keep'),
    text: tr('A backup is an extra encrypted file you save yourself — on Google Drive, email or a computer. It opens only with your recovery code. Baon doesn’t upload it anywhere.'),
  },
  {
    icon: 'phone',
    title: tr('What it can’t protect'),
    text: tr('Anyone who can open Baon on your phone can see your records. Keep your screen lock on, or turn on shared phone mode (Me → Security) so Baon asks for a passphrase. Your Google or email account signs in to Baon, so keep it safe too.'),
  },
]

const FAQ: [string, ReactNode][] = [
  [tr('How is “Safe to spend today” counted?'), <>{tr('Your money left (minus what you set aside for school) divided by the days until your next baon.')}{' '}<Link to="/breakdown" className="font-extrabold text-blue hover:underline">{tr('See the breakdown')}</Link>.</>],
  [tr('I went over my budget. Is my streak gone?'), tr('No. A class day still counts as long as you logged it. Tomorrow’s budget just gets a little smaller.')],
  [tr('What is the free pass?'), tr('Once a week (Monday to Sunday), a class day you forgot to log is covered automatically, so your streak keeps going.')],
  [tr('No classes for a while?'), tr('On Plan → Class days, set a break (one day, or until a date). Your budget then counts every day and your streak is frozen until classes are back.')],
  [tr('Does Baon work without internet?'), tr('Yes. After the first sign-in, everything works offline. Changes sync to your other devices once you’re back online.')],
  [tr('Can I use Baon on more than one device?'), tr('Yes. Just sign in with the same account on your other device — your records sync by themselves.')],
  [tr('I share or borrow a phone. Is that okay?'), tr('Yes. Turn on shared phone mode in Me → Security so Baon asks for a passphrase. On a phone that isn’t yours, tap Remove from this phone when you’re done.')],
  [tr('What if my phone breaks or gets reset?'), tr('Sign in on the new phone with the same account and your records come back. Changes made while offline sync once you’re back online.')],
  [tr('I lost my recovery code.'), tr('On Backup, tap “Lost it? Make a new code”, then export a new backup. Backups made before still need the old code.')],
  [tr('How do I install Baon?'), tr('Android (Chrome): menu ⋮ → Install app. iPhone (Safari): Share → Add to Home Screen. On a computer: the install icon in the address bar.')],
]

/** Help & privacy page. */
export function Help() {
  const [policy, setPolicy] = useState<DocId | null>(null)
  return (
    <Page>
      <PageHeader title={tr('Help & privacy')} sub={tr('How Baon keeps your records private, and answers to common questions.')} />
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
              {tr('Baon is built around the Data Privacy Act of 2012 (RA 10173): it collects only what sign-in needs, and you can delete your data anytime. If you’re under 18, read this with a parent or guardian.')}</p>
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
