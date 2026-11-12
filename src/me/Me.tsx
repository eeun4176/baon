/*
 * Me.tsx — Your account, money settings and data (design p11 phone, p22 desktop).
 *   Header: avatar (pen button: change / remove / Google photo), name, streak / school level / device mode chips,
 *           Sign out (Lock in Shared phone mode). Phones: centered stack; wider screens: one row.
 *   Tabs: Profile (name, school, Senior high / College) · Security (device mode, lock/DeviceModeItems.tsx) ·
 *         Backup (export / restore, backup/BackupPanel.tsx) · Preferences (theme, install, Help & privacy link — phones have no sidebar).
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
import { DeviceModeItems } from '../lock/DeviceModeItems.tsx'
import { RemoveFromPhone } from '../lock/RemoveFromPhone.tsx'
import { SyncSection } from '../sync/SyncSection.tsx'
import { useStreak } from '../streak/useStreak.ts'
import { BigMoney, Card, Icon, Page, PageHeader, Segmented } from '../ui/kit.tsx'
import { Avatar } from './Avatar.tsx'
import { DeleteAccountDialog } from './DeleteAccount.tsx'
import { AllowanceDialog, WalletDialog } from './MeDialogs.tsx'
import { imageToDataUrl } from './photo.ts'
import { checkName, LEVELS, type Profile } from './profile.ts'
import { language, LOCALE, setLanguage, tr } from '../i18n/i18n.ts'

type Tab = 'profile' | 'security' | 'backup' | 'prefs'
const TABS = [['profile', tr('Profile')], ['security', tr('Security')], ['backup', tr('Backup')], ['prefs', tr('Preferences')]] as const
const DAY_NAMES = [tr('Sun'), tr('Mon'), tr('Tue'), tr('Wed'), tr('Thu'), tr('Fri'), tr('Sat')]
const nextDay = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'short', day: 'numeric' })

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
      showToast({ message: tr('Couldn’t save. Try again.') })
    }
  }

  /** Reads the chosen picture, shrinks it to 256×256 and saves it. */
  async function upload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 15_000_000) return showToast({ message: tr('Pick a photo (JPG or PNG, under 15 MB).') })
    try {
      await change({ ...profile, photo: await imageToDataUrl(file), photoFrom: 'custom' }, tr('Photo updated'))
    } catch {
      showToast({ message: tr('Couldn’t read that picture. Try a JPG or PNG.') })
    }
  }

  return (
    <div ref={box} className="relative shrink-0">
      <Avatar className="size-20 text-3xl" />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="photo-menu"
        aria-label={tr('Change profile photo')}
        title={tr('Change profile photo')}
        className="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full bg-blue text-white ring-[3px] ring-card after:absolute after:-inset-2.5 hover:bg-[#1a52e0] md:size-7"
      >
        <Icon name="pencil" className="size-3 md:size-3.5" />
      </button>
      {open && (
        <div id="photo-menu" className="absolute top-full left-1/2 z-30 mt-3 -ml-30 w-60 animate-rise sm:left-0 sm:ml-0 rounded-2xl border border-pebble bg-card p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
          <label className={`${item} focus-within:ring-2 focus-within:ring-blue/40`}>
            <Icon name="pencil" className="size-5" /> {profile.photo ? tr('Change photo') : tr('Upload a photo')}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {profile.photoFrom === 'custom' && (
            <button type="button" className={item} onClick={() => change({ ...profile, photoFrom: undefined, googlePhotoUrl: undefined }, tr('Using your Google photo when you’re online'))}>
              <Icon name="user" className="size-5" /> {tr('Use Google photo')}</button>
          )}
          {profile.photo && (
            <button type="button" className={item} onClick={() => change({ ...profile, photo: undefined, photoFrom: 'custom' }, tr('Photo removed'))}>
              <Icon name="trash" className="size-5" /> {tr('Remove photo')}</button>
          )}
          <p className="px-3 pt-1 pb-1.5 text-sm font-semibold text-muted">
            {profile.photoFrom === 'google' ? tr('From your Google account.') : tr('Saved encrypted on this device.')}
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
      showToast({ message: tr('Profile saved'), undo: async () => { await rename(before.name); await saveProfile(before.profile) } })
    } catch {
      setError(tr('Couldn’t save. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <h2 className="text-xl font-black">{tr('Profile')}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {tr('Display name')}<input value={draftName} maxLength={40} onChange={(e) => { setDraftName(e.target.value); setError('') }} className={field} />
        </label>
        <label className={label}>
          {tr('School')}{' '}<span className="font-semibold">{tr('(optional)')}</span>
          <input value={school} maxLength={60} onChange={(e) => setSchool(e.target.value)} placeholder={tr('Your school')} className={field} />
        </label>
      </div>
      <p className={`${label} mt-4`}>{tr('I’m in')}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-full bg-page p-1" role="radiogroup" aria-label={tr('I’m in')}>
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
      <button type="submit" disabled={!changed || busy} className="mt-5 min-h-12 w-full rounded-full bg-blue px-6 font-black text-white disabled:opacity-40 sm:w-auto">
        {tr('Save profile')}</button>
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
    showToast({ message: kept ? tr('Your records will be kept on this device') : tr('Browser said no — keep a backup') })
  }

  const used = storage.usage ? tr(' Using {0}.', formatBytes(storage.usage)) : ''
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-page p-3 sm:p-4">
      <Icon name="drive" className={`mt-0.5 size-5 shrink-0 ${storage.persisted ? 'text-blue' : 'text-muted'}`} />
      <span>
        <span className="block font-black">{storage.persisted ? tr('Kept on this device · on') : tr('Records could be cleared')}</span>
        <span className="block font-semibold text-muted">
          {storage.persisted
            ? tr('The browser won’t delete Baon’s records to free up space.{0}', used)
            : tr('If your phone runs low on space, the browser may clear Baon’s data. Installing Baon helps.{0}', used)}
          {isStorageLow(storage) && tr(' Your phone is almost full.')}
        </span>
        {!storage.persisted && (
          <button type="button" onClick={keep} className="mt-3 min-h-11 rounded-full bg-blue px-5 font-black text-white">{tr('Keep my records')}</button>
        )}
      </span>
    </li>
  )
}

/** Security tab: how this device protects the records (My phone / Shared phone mode), storage, remove from this phone, delete. */
function SecurityTab() {
  const [deleting, setDeleting] = useState(false)
  return (
    <div>
      <h2 className="text-xl font-black">{tr('Security')}</h2>
      <ul className="mt-4 space-y-3">
        <DeviceModeItems />
        <StorageItem />
      </ul>

      <RemoveFromPhone />
      <div className="mt-6 border-t border-pebble pt-5">
        <h3 className="font-black">{tr('Delete account')}</h3>
        <p className="mt-1 font-semibold text-muted">{tr('Deletes your account and your records, online and on this phone. This can’t be undone.')}</p>
        <button type="button" onClick={() => setDeleting(true)} className="mt-3 flex min-h-12 items-center gap-2 rounded-full bg-red px-5 font-black text-white hover:brightness-110">
          <Icon name="trash" className="size-5" /> {tr('Delete account')}</button>
      </div>
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </div>
  )
}

const LANGUAGES = [['en', 'English'], ['fil', 'Filipino']] as const // each in its own language, so anyone can find theirs

/** Preferences tab: theme, install, language. */
function PrefsTab() {
  const canInstall = useCanInstall()
  return (
    <div>
      <h2 className="text-xl font-black">{tr('Preferences')}</h2>
      <p className={`${label} mt-4 mb-1.5`}>{tr('Theme')}</p>
      <div className="max-w-md"><ThemePicker large /></div>
      <p className={`${label} mt-5 mb-1.5`}>{tr('Language')}</p>
      {/* Choosing reloads Baon in that language (every screen, dates included). */}
      <Segmented options={LANGUAGES} value={language} onChange={setLanguage} label={tr('Language')} className="max-w-md" />
      <Link to="/help" className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-page px-4 font-black hover:bg-pebble">
        <Icon name="help" className="size-5 shrink-0" />
        <span className="flex-1">{tr('Help & privacy')}</span>
        <Icon name="chevron-right" className="size-5 text-muted" />
      </Link>
      {canInstall && (
        <button type="button" onClick={() => promptInstall()} className="mt-4 flex min-h-12 items-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
          <Icon name="download" className="size-5" /> {tr('Install Baon on this device')}</button>
      )}
    </div>
  )
}

/** Wallet icon by kind. */
const walletIcon = (w: Wallet) => (w.type === 'savings' ? 'piggy' : w.id === 'cash' ? 'wallet' : 'phone')

/** Me screen. */
export function Me() {
  const { name, profile, allowance, wallets, transactions, signOut, vault } = useSession()
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
      <PageHeader title={tr('Me')} sub={tr('Your account, money settings and data.')} />

      {/* Header card */}
      <Card className="relative z-20 flex animate-rise flex-col items-center gap-3 text-center sm:flex-row sm:gap-5 sm:text-left">{/* above the cards below, so the photo menu isn’t covered */}
        <PhotoAvatar />
        <div className="w-full min-w-0 sm:flex-1">
          <p className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="min-w-0 truncate text-2xl font-black md:text-3xl">{name}</span>
            {/* Phone mode: icon only, its name shows on hover and to screen readers */}
            <span role="img" title={vault.shared() ? tr('Shared phone mode') : tr('My phone mode')} aria-label={vault.shared() ? tr('Shared phone mode') : tr('My phone mode')} className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-tint text-blue">
              <Icon name={vault.shared() ? 'users' : 'phone'} className="size-4" />
            </span>
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Chip><img src={flame} alt="" className="size-4" /> {streak.current}<span className="sr-only">{tr('-day streak')}</span></Chip>
            {(level || profile.school) && <Chip>{[level, profile.school].filter(Boolean).join(' · ')}</Chip>}
          </div>
        </div>
        <button type="button" onClick={signOut} className="mt-1 flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full border-2 border-pebble px-5 font-black hover:bg-page sm:mt-0 sm:w-auto">
          <Icon name={vault.shared() ? 'lock' : 'logout'} className="size-5" /> {vault.shared() ? tr('Lock Baon') : tr('Sign out')}</button>
      </Card>

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-12 lg:gap-5">
        {/* Tabs */}
        <div className="min-w-0 lg:col-span-7">
          <Segmented options={TABS} value={tab} onChange={setTab} label={tr('Me sections')} />
          <Card key={tab} className="mt-4 animate-rise">
            {tab === 'profile' && <ProfileTab key={name} />}{/* a name synced from another device refreshes the form */}
            {tab === 'security' && <SecurityTab />}
            {tab === 'backup' && (
              <>
                <BackupPanel />
                <div className="mt-6 border-t border-pebble pt-5"><SyncSection /></div>
              </>
            )}
            {tab === 'prefs' && <PrefsTab />}
          </Card>
        </div>

        {/* Side cards (first on phones) */}
        <div className="order-first min-w-0 space-y-4 lg:order-none lg:col-span-5 lg:space-y-5">
          <section className="animate-rise rounded-3xl bg-hero p-4 sm:rounded-[28px] sm:p-6 text-white" aria-labelledby="your-baon">
            <h2 id="your-baon" className="font-extrabold text-white/80">{tr('Your baon')}</h2>
            <p className="mt-1">
              {allowance.amountCentavos ? <BigMoney centavos={allowance.amountCentavos} className="text-[2.5rem] sm:text-5xl" /> : <span className="text-4xl font-black">{tr('It varies')}</span>}
            </p>
            <p className="mt-3 font-semibold text-white/80">
              {FREQUENCY_TEXT[allowance.frequency]} · {allowance.frequency === 'irregular' ? tr('make it last until') : tr('next on')} {DAY_NAMES[weekday(allowance.nextDate)]}, {nextDay.format(new Date(`${allowance.nextDate}T00:00:00Z`))}
            </p>
            <p className="font-semibold text-white/80">{allowance.countClassDays ? tr('Counts class days: {0}', classDaysText(allowance)) : tr('Counts every day')}</p>
            <button type="button" onClick={() => setDialog({ kind: 'allowance' })} className="mt-5 min-h-12 rounded-full bg-blue px-6 font-black text-white">
              {tr('Edit allowance')}</button>
          </section>

          <Card className="animate-rise">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">{tr('Wallets')}</h2>
              <button type="button" onClick={() => setDialog({ kind: 'wallet' })} aria-label={tr('Add a wallet')} className="grid size-11 place-items-center rounded-full bg-blue-tint text-blue hover:bg-blue hover:text-white">
                <Icon name="plus" className="size-5" />
              </button>
            </div>
            <p key={ready} className="mt-1 animate-pop text-[2rem] font-black sm:text-4xl">{formatPeso(ready)}</p>
            <p className="text-sm font-semibold text-muted">{tr('ready to spend · savings kept apart')}</p>
            <ul className="mt-3 divide-y divide-page border-t border-page">
              {active.map((w) => (
                <li key={w.id}>
                  <button type="button" onClick={() => setDialog({ kind: 'wallet', wallet: w })} className="flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-page/60" aria-label={tr('Edit {0}, {1}', w.name, formatPeso(all.get(w.id)!))}>
                    <Icon name={walletIcon(w)} className="size-5 shrink-0 text-blue" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">{w.name}</span>
                      {w.type === 'savings' && <span className="block text-sm font-semibold text-muted">{tr('Not counted as spendable')}</span>}
                    </span>
                    <span className="font-black">{formatPeso(all.get(w.id)!)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Link to="?add=1&mode=transfer" state={{ modal: true }} className="mt-2 flex min-h-12 items-center justify-center rounded-full bg-pebble font-black hover:bg-pebble-2">
              {tr('Move money')}</Link>
          </Card>
        </div>
      </div>

      {dialog?.kind === 'allowance' && <AllowanceDialog onClose={close} />}
      {dialog?.kind === 'wallet' && <WalletDialog wallet={dialog.wallet} onClose={close} />}
    </Page>
  )
}
