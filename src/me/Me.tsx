/*
 * Me.tsx — Your account, money settings and data (design p11 phone, p22 desktop).
 *   Header: avatar (pen button: change / remove / Google photo), name, streak / school level / "My phone mode" chips, Sign out.
 *   Tabs: Profile (name, school, Senior high / College) · Security (device mode) ·
 *         Backup (export / restore, backup/BackupPanel.tsx) · Preferences (theme, install).
 *   Side cards: "Your baon" (allowance, Edit) and Wallets (add, rename, remove, Move money).
 * Phones show the side cards first, then the tabs; theme and sign out live here on phones.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import flame from '../assets/streak-flame.png'
import { classDaysText, FREQUENCY_TEXT } from '../budget/allowance.ts'
import { weekday } from '../budget/days.ts'
import { promptInstall, useCanInstall } from '../install.ts'
import { balances, type Wallet } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { ThemePicker } from '../shell/ThemePicker.tsx'
import { formatBytes, isStorageLow, keepStorage, useStorage } from '../storage.ts'
import { BackupPanel } from '../backup/BackupPanel.tsx'
import { useStreak } from '../streak/useStreak.ts'
import { BigMoney, Card, Icon, Page, PageHeader, Segmented } from '../ui/kit.tsx'
import { Avatar } from './Avatar.tsx'
import { AllowanceDialog, WalletDialog } from './MeDialogs.tsx'
import { imageToDataUrl } from './photo.ts'
import { checkName, LEVELS, type Profile } from './profile.ts'

type Tab = 'profile' | 'security' | 'backup' | 'prefs'
const TABS = [['profile', 'Profile'], ['security', 'Security'], ['backup', 'Backup'], ['prefs', 'Preferences']] as const
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const nextDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

const field = 'mt-1.5 block min-h-12 w-full rounded-2xl bg-page px-4 text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-blue/40 placeholder:text-muted/60'
const label = 'block font-extrabold text-muted'

/** Small rounded chip in the header (streak, level, device mode). */
function Chip({ children, blue = false }: { children: ReactNode; blue?: boolean }) {
  return <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-black ${blue ? 'bg-blue-tint text-blue' : 'bg-page'}`}>{children}</span>
}

/**
 * The header avatar with a small pen button at its bottom-right. The button opens a small
 * menu: Upload / Change photo, Remove photo, Use Google photo. Saves right away, with Undo.
 */
function PhotoAvatar() {
  const { profile, saveProfile, showToast } = useSession()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const item = 'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left font-bold hover:bg-page'

  // Close when clicking anywhere else or pressing Esc.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** Saves a photo change and offers Undo. */
  async function change(next: Profile, message: string) {
    const before = profile
    setOpen(false)
    try {
      await saveProfile(next)
      showToast({ message, undo: () => saveProfile(before) })
    } catch {
      showToast({ message: 'Couldn’t save. Try again.' })
    }
  }

  /** Reads the chosen picture, shrinks it to 256×256 and saves it. */
  async function upload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 15_000_000) return showToast({ message: 'Pick a photo (JPG or PNG, under 15 MB).' })
    try {
      await change({ ...profile, photo: await imageToDataUrl(file), photoFrom: 'custom' }, 'Photo updated')
    } catch {
      showToast({ message: 'Couldn’t read that picture. Try a JPG or PNG.' })
    }
  }

  return (
    <div ref={box} className="relative shrink-0">
      <Avatar className="size-16 text-3xl md:size-20" />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="photo-menu"
        aria-label="Change profile photo"
        title="Change profile photo"
        className="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full bg-blue text-white ring-[3px] ring-card hover:bg-[#1a52e0] md:size-7"
      >
        <Icon name="pencil" className="size-3 md:size-3.5" />
      </button>
      {open && (
        <div id="photo-menu" className="absolute top-full left-0 z-30 mt-3 w-60 animate-rise rounded-2xl border border-pebble bg-card p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
          <label className={`${item} focus-within:ring-2 focus-within:ring-blue/40`}>
            <Icon name="pencil" className="size-5" /> {profile.photo ? 'Change photo' : 'Upload a photo'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {profile.photoFrom === 'custom' && (
            <button type="button" className={item} onClick={() => change({ ...profile, photoFrom: undefined, googlePhotoUrl: undefined }, 'Using your Google photo when you’re online')}>
              <Icon name="user" className="size-5" /> Use Google photo
            </button>
          )}
          {profile.photo && (
            <button type="button" className={item} onClick={() => change({ ...profile, photo: undefined, photoFrom: 'custom' }, 'Photo removed')}>
              <Icon name="trash" className="size-5" /> Remove photo
            </button>
          )}
          <p className="px-3 pt-1 pb-1.5 text-sm font-semibold text-muted">
            {profile.photoFrom === 'google' ? 'From your Google account.' : 'Saved encrypted on this device.'}
          </p>
        </div>
      )}
    </div>
  )
}

/** Profile tab: display name, school, Senior high / College. */
function ProfileTab() {
  const { name, profile, rename, saveProfile, showToast } = useSession()
  const [draftName, setDraftName] = useState(name)
  const [school, setSchool] = useState(profile.school ?? '')
  const [level, setLevel] = useState<Profile['level']>(profile.level)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const changed = draftName !== name || school.trim() !== (profile.school ?? '') || level !== profile.level

  /** Saves name + profile, with Undo. */
  async function save(e: FormEvent) {
    e.preventDefault()
    const checked = checkName(draftName)
    if ('problem' in checked) return setError(checked.problem)
    const before = { name, profile }
    const next: Profile = { ...profile, school: school.trim() || undefined, level } // keeps the photo
    setBusy(true)
    try {
      if (checked.name !== name) await rename(checked.name)
      await saveProfile(next)
      setDraftName(checked.name)
      showToast({ message: 'Profile saved', undo: async () => { await rename(before.name); await saveProfile(before.profile) } })
    } catch {
      setError('Couldn’t save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <h2 className="text-xl font-black">Profile</h2>
      <p className="font-semibold text-muted">Only your name and email are kept with your account.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Display name
          <input value={draftName} maxLength={40} onChange={(e) => { setDraftName(e.target.value); setError('') }} className={field} />
        </label>
        <label className={label}>
          School <span className="font-semibold">(optional)</span>
          <input value={school} maxLength={60} onChange={(e) => setSchool(e.target.value)} placeholder="Your school" className={field} />
        </label>
      </div>
      <p className={`${label} mt-4`}>I’m in</p>
      <div className="mt-1.5 grid max-w-md grid-cols-2 gap-1 rounded-full bg-page p-1" role="radiogroup" aria-label="I’m in">
        {LEVELS.map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={level === id}
            onClick={() => setLevel(level === id ? undefined : id)}
            className={`min-h-11 rounded-full font-extrabold ${level === id ? 'bg-card shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {text}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-pebble p-3 font-bold">{error}</p>}
      <button type="submit" disabled={!changed || busy} className="mt-5 min-h-12 rounded-full bg-blue px-6 font-black text-white disabled:opacity-40">
        Save profile
      </button>
      <div className="mt-6 border-t border-page pt-4">
        <p className="font-black">Sign-in account</p>
        <p className="text-sm font-semibold text-muted">Google or email code — used to sign in only. It never unlocks your records by itself.</p>
      </div>
    </form>
  )
}

/** "Kept on this device" — whether the browser may clear baon when space runs low, with a button to ask it not to. */
function StorageItem() {
  const { showToast } = useSession()
  const [storage, refresh] = useStorage()
  if (!storage || storage.persisted === null) return null // browser can't tell: say nothing rather than guess

  /** Asks the browser (needs a tap in some browsers) and reports what it answered. */
  async function keep() {
    const kept = await keepStorage()
    refresh()
    showToast({ message: kept ? 'Your records will be kept on this device' : 'Browser said no — keep a backup' })
  }

  const used = storage.usage ? ` Using ${formatBytes(storage.usage)}.` : ''
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-page p-4">
      <Icon name="drive" className={`mt-0.5 size-5 shrink-0 ${storage.persisted ? 'text-blue' : 'text-muted'}`} />
      <span>
        <span className="block font-black">{storage.persisted ? 'Kept on this device · on' : 'Records could be cleared'}</span>
        <span className="block font-semibold text-muted">
          {storage.persisted
            ? `The browser won’t delete baon’s records to free up space.${used}`
            : `If your phone runs low on space, the browser may delete baon’s data. Installing baon on your home screen helps.${used}`}
          {isStorageLow(storage) && ' Your phone is almost full.'}
        </span>
        {!storage.persisted && (
          <button type="button" onClick={keep} className="mt-3 min-h-11 rounded-full bg-blue px-5 font-black text-white">Keep my records</button>
        )}
      </span>
    </li>
  )
}

/** Security tab: how this device protects the records (shared mode isn't built yet). */
function SecurityTab() {
  const { signOut } = useSession()
  return (
    <div>
      <h2 className="text-xl font-black">Security</h2>
      <ul className="mt-4 space-y-3">
        <li className="flex items-start gap-3 rounded-2xl bg-page p-4">
          <Icon name="phone" className="mt-0.5 size-5 shrink-0 text-blue" />
          <span>
            <span className="block font-black">My phone mode · on</span>
            <span className="block font-semibold text-muted">Your records are encrypted on this device, and the key is locked to this browser. Keep your phone’s screen lock on — it protects baon too.</span>
          </span>
        </li>
        <StorageItem />
        <li className="flex items-start gap-3 rounded-2xl bg-page p-4 opacity-70">
          <Icon name="users" className="mt-0.5 size-5 shrink-0 text-muted" />
          <span>
            <span className="block font-black">Shared device mode · coming soon</span>
            <span className="block font-semibold text-muted">For a phone shared with family: a passphrase and recovery kit for each account. Until then, use baon on your own phone only.</span>
          </span>
        </li>
      </ul>
      <button type="button" onClick={signOut} className="mt-5 flex min-h-12 items-center gap-2 rounded-full border-2 border-pebble px-5 font-black hover:bg-page">
        <Icon name="logout" className="size-5" /> Sign out
      </button>
      <p className="mt-2 text-sm font-semibold text-muted">Signing out keeps your records encrypted on this device.</p>
    </div>
  )
}

/** Preferences tab: theme, install, language. */
function PrefsTab() {
  const canInstall = useCanInstall()
  return (
    <div>
      <h2 className="text-xl font-black">Preferences</h2>
      <p className={`${label} mt-4 mb-1.5`}>Theme</p>
      <div className="max-w-md"><ThemePicker large /></div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-page p-4">
        <span>
          <span className="block font-black">Language</span>
          <span className="block text-sm font-semibold text-muted">Filipino coming soon</span>
        </span>
        <span className="font-extrabold text-muted">English</span>
      </div>
      {canInstall && (
        <button type="button" onClick={() => promptInstall()} className="mt-4 flex min-h-12 items-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
          <Icon name="download" className="size-5" /> Install baon on this device
        </button>
      )}
    </div>
  )
}

/** Wallet icon by kind. */
const walletIcon = (w: Wallet) => (w.type === 'savings' ? 'piggy' : w.id === 'cash' ? 'wallet' : 'phone')

/** Me screen. */
export function Me() {
  const { name, profile, allowance, wallets, transactions, signOut } = useSession()
  const streak = useStreak()
  const [tab, setTab] = useState<Tab>('profile')
  const [dialog, setDialog] = useState<{ kind: 'allowance' } | { kind: 'wallet'; wallet?: Wallet } | null>(null)
  const all = balances(wallets, transactions)
  const active = wallets.filter((w) => !w.archived)
  const ready = active.filter((w) => w.type === 'spending').reduce((s, w) => s + all.get(w.id)!, 0)
  const level = LEVELS.find(([id]) => id === profile.level)?.[1]
  const close = () => setDialog(null)

  return (
    <Page>
      <PageHeader title="Me" sub="Your account, money settings and data." />

      {/* Header card */}
      <Card className="relative z-20 flex animate-rise flex-wrap items-center gap-4 md:gap-5">{/* above the cards below, so the photo menu isn’t covered */}
        <PhotoAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl font-black md:text-3xl">{name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip><img src={flame} alt="" className="size-4" /> {streak.current}-day streak</Chip>
            {(level || profile.school) && <Chip>{[level, profile.school].filter(Boolean).join(' · ')}</Chip>}
            <Chip blue>My phone mode</Chip>
          </div>
        </div>
        <button type="button" onClick={signOut} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-pebble px-5 font-black hover:bg-page sm:w-auto">
          <Icon name="logout" className="size-5" /> Sign out
        </button>
      </Card>

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-12 lg:gap-5">
        {/* Tabs */}
        <div className="lg:col-span-7">
          <Segmented options={TABS} value={tab} onChange={setTab} label="Me sections" />
          <Card key={tab} className="mt-4 animate-rise">
            {tab === 'profile' && <ProfileTab />}
            {tab === 'security' && <SecurityTab />}
            {tab === 'backup' && <BackupPanel />}
            {tab === 'prefs' && <PrefsTab />}
          </Card>
        </div>

        {/* Side cards (first on phones) */}
        <div className="order-first space-y-4 lg:order-none lg:col-span-5 lg:space-y-5">
          <section className="animate-rise rounded-[28px] bg-hero p-6 text-white" aria-labelledby="your-baon">
            <h2 id="your-baon" className="font-extrabold text-white/80">Your baon</h2>
            <p className="mt-1">
              {allowance.amountCentavos ? <BigMoney centavos={allowance.amountCentavos} className="text-5xl" /> : <span className="text-4xl font-black">It varies</span>}
            </p>
            <p className="mt-3 font-semibold text-white/80">
              {FREQUENCY_TEXT[allowance.frequency]} · {allowance.frequency === 'irregular' ? 'make it last until' : 'next on'} {DAY_NAMES[weekday(allowance.nextDate)]}, {nextDay.format(new Date(`${allowance.nextDate}T00:00:00Z`))}
            </p>
            <p className="font-semibold text-white/80">Counts {allowance.countClassDays ? `class days: ${classDaysText(allowance)}` : 'every day'}</p>
            <button type="button" onClick={() => setDialog({ kind: 'allowance' })} className="mt-5 min-h-12 rounded-full bg-blue px-6 font-black text-white">
              Edit allowance
            </button>
          </section>

          <Card className="animate-rise">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Wallets</h2>
              <button type="button" onClick={() => setDialog({ kind: 'wallet' })} aria-label="Add a wallet" className="grid size-10 place-items-center rounded-full bg-blue-tint text-blue hover:bg-blue hover:text-white">
                <Icon name="plus" className="size-5" />
              </button>
            </div>
            <p key={ready} className="mt-1 animate-pop text-4xl font-black">{formatPeso(ready)}</p>
            <p className="text-sm font-semibold text-muted">ready to spend · savings kept apart</p>
            <ul className="mt-3 divide-y divide-page border-t border-page">
              {active.map((w) => (
                <li key={w.id}>
                  <button type="button" onClick={() => setDialog({ kind: 'wallet', wallet: w })} className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-page/60" aria-label={`Edit ${w.name}, ${formatPeso(all.get(w.id)!)}`}>
                    <Icon name={walletIcon(w)} className="size-5 shrink-0 text-blue" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">{w.name}</span>
                      {w.type === 'savings' && <span className="block text-sm font-semibold text-muted">Not counted as spendable</span>}
                    </span>
                    <span className="font-black">{formatPeso(all.get(w.id)!)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Link to="?add=1&mode=transfer" state={{ modal: true }} className="mt-2 flex min-h-12 items-center justify-center rounded-full bg-pebble font-black hover:bg-pebble-2">
              Move money
            </Link>
          </Card>
        </div>
      </div>

      {dialog?.kind === 'allowance' && <AllowanceDialog onClose={close} />}
      {dialog?.kind === 'wallet' && <WalletDialog wallet={dialog.wallet} onClose={close} />}
    </Page>
  )
}
