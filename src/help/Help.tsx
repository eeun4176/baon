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

const PRIVACY: { icon: IconName; title: string; text: ReactNode }[] = [
  {
    icon: 'shield',
    title: 'Your records stay on this phone, encrypted',
    text: 'Amounts, notes, wallets, plans and your streak are scrambled (encrypted) so only baon on this phone can read them. baon works without internet and only sends them online if you turn on sync — as scrambled copies we can’t read.',
  },
  {
    icon: 'user',
    title: 'What we receive',
    text: 'Your email, name and Google photo so you can sign in. If you turn on sync, also scrambled copies of your records — we can’t read them, and signing in never unlocks them by itself.',
  },
  {
    icon: 'cloud',
    title: 'Backups are files you keep',
    text: 'A backup is an encrypted file you save yourself — on Google Drive, email or a computer. It opens only with your recovery code. baon doesn’t upload it anywhere.',
  },
  {
    icon: 'phone',
    title: 'What it can’t protect',
    text: 'Anyone who can unlock your phone and open baon can see your records, so keep your screen lock on. Someone who digs into your phone’s browser data could see how many entries you have, but not what’s in them. If you lose your phone and your recovery code, nobody can bring your records back — not even us.',
  },
]

const FAQ: [string, ReactNode][] = [
  ['How is “Safe to spend today” counted?', <>Your money left (minus what you set aside for school) divided by the days until your next baon. <Link to="/breakdown" className="font-extrabold text-blue hover:underline">See the breakdown</Link>.</>],
  ['I went over my budget. Is my streak gone?', 'No. A class day still counts as long as you logged it. Tomorrow’s budget just gets a little smaller.'],
  ['What is the free pass?', 'Once a week (Monday to Sunday), a class day you forgot to log is covered automatically, so your streak keeps going.'],
  ['No classes for a while?', 'On Plan → Class days, set a break (one day, or until a date). Your budget then counts every day and your streak is frozen until classes are back.'],
  ['Does baon work without internet?', 'Yes. After the first sign-in, everything works offline. Only signing in and syncing your Google photo need internet.'],
  ['Can I use baon on more than one device?', 'Yes. Turn on Sync across devices on Me → Backup. On your other device, sign in and enter your recovery code.'],
  ['What if my phone breaks or gets reset?', <>Restore from your latest backup on the new phone: sign in, then tap “Restore a backup”. Keep backups fresh from <Link to="/backup" className="font-extrabold text-blue hover:underline">Backup</Link>.</>],
  ['I lost my recovery code.', 'On Backup, tap “Lost it? Make a new code”, then export a new backup. Backups made before still need the old code.'],
  ['How do I install baon?', 'Android (Chrome): menu ⋮ → Install app. iPhone (Safari): Share → Add to Home Screen. On a computer: the install icon in the address bar.'],
]

/** Help & privacy page. */
export function Help() {
  const [policy, setPolicy] = useState<DocId | null>(null)
  return (
    <Page>
      <PageHeader title="Help & privacy" sub="How baon keeps your records private, and answers to common questions." />
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="space-y-4 lg:col-span-7 lg:space-y-5">
          <Card className="animate-rise">
            <h2 className="text-xl font-black">Your privacy, in plain words</h2>
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
              baon is built around the Data Privacy Act of 2012 (RA 10173): it collects only what sign-in needs, and you can delete your data anytime.
              If you’re under 18, read this with a parent or guardian.
            </p>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-5 lg:space-y-5">
          <Card className="animate-rise">
            <h2 className="text-xl font-black">Policies</h2>
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
            <h2 className="text-xl font-black">Common questions</h2>
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
