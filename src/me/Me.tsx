/*
 * Me.tsx — Your account, money settings and data (Me v2 design).
 *   Profile card: avatar (pen button: change / remove / Google photo), name, streak chip, level · school,
 *     device mode. Sign out (Lock in Shared phone mode): a small pill by the title on phones, in this card wider.
 *   "Your baon" (dark): amount, how often, next allowance and class days, Edit.
 *   Wallets: total, Move money, Add wallet; phones a sideways row, desktop tiles. Each opens the wallet.
 *   Tabs: Profile (name, school, Senior high / College) · Security (device mode, lock/DeviceModeItems.tsx) ·
 *         Backup (export / restore, backup/BackupPanel.tsx) · Preferences (theme, language, install).
 * Desktop: profile across the top, "Your baon" and Wallets (side by side from 1280px wide), then the tabs. Phones stack them and end
 * with a Help & privacy link (no sidebar there).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { streakFlame } from '../streak/flame.ts'
import { classDaysText, FREQUENCY_TEXT } from '../budget/allowance.ts'
import { weekday } from '../budget/days.ts'
import { promptInstall, useCanInstall } from '../install.ts'
import { balances, byBalance, type Wallet } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { useSession } from '../session.ts'
import { ThemePicker } from '../shell/ThemePicker.tsx'
import { formatBytes, isStorageLow, keepStorage, useStorage } from '../storage.ts'
import { BackupPanel } from '../backup/BackupPanel.tsx'
import { DeviceModeItems } from '../lock/DeviceModeItems.tsx'
import { RemoveFromPhone } from '../lock/RemoveFromPhone.tsx'
import { SyncSection } from '../sync/SyncSection.tsx'
import { useStreak } from '../streak/useStreak.ts'
import { BigMoney, Card, Icon, Page, Segmented } from '../ui/kit.tsx'
import { WalletChip, WalletTile } from '../ui/WalletTile.tsx'
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
      <Avatar className="size-16 text-[1.375rem]" />
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
        <div id="photo-menu" className="absolute top-full left-0 z-30 mt-3 w-60 animate-rise rounded-2xl border border-pebble bg-card p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
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

/** Profile tab: display name, sign-in email (read-only), school, Senior high / College. */
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
        {/* The sign-in email, so students use the same one on every device. Read-only: it comes from the sign-in. */}
        <label className={label}>
          {tr('Email')}
          <input type="email" readOnly value={profile.email ?? ''} placeholder={tr('Shows when you’re online')} className={`${field} cursor-default text-muted`} />
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
        <span className="block font-black">{storage.persisted ? tr('Kept on this device · On') : tr('Records could be cleared')}</span>
        <span className="block font-semibold text-muted">
          {storage.persisted
            ? tr('The browser won’t delete Baon’s records to free up space.{0}', used)
            : tr('If your device runs low on space, the browser may clear Baon’s data. Installing Baon helps.{0}', used)}
          {isStorageLow(storage) && tr(' Your device is almost full.')}
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
        <p className="mt-1 font-semibold text-muted">{tr('Deletes your account and your records, online and on this device. This can’t be undone.')}</p>
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
      {canInstall && (
        <button type="button" onClick={() => promptInstall()} className="mt-4 flex min-h-12 items-center gap-2 rounded-full bg-pebble px-5 font-black hover:bg-pebble-2">
          <Icon name="download" className="size-5" /> {tr('Install Baon on this device')}</button>
      )}
    </div>
  )
}

/** Sign out (My phone mode) or Lock Baon (Shared phone mode). `compact`: the phone header's small pill. */
function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { signOut, vault } = useSession()
  const shared = vault.shared()
  return (
    <button type="button" onClick={signOut}
      className={compact
        ? 'flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 text-[0.8125rem] font-extrabold md:hidden'
        : 'hidden h-11 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-pebble-2 px-[1.125rem] text-sm font-extrabold hover:bg-page md:flex'}>
      <Icon name={shared ? 'lock' : 'logout'} className="size-[1.125rem]" />
      {compact ? (shared ? tr('Lock') : tr('Sign out')) : shared ? tr('Lock Baon') : tr('Sign out')}</button>
  )
}

/** Me screen. */
export function Me() {
  const { name, profile, allowance, wallets, transactions, vault } = useSession()
  const streak = useStreak()
  const [tab, setTab] = useState<Tab>('profile')
  const [dialog, setDialog] = useState<{ kind: 'allowance' } | { kind: 'wallet'; wallet?: Wallet } | null>(null)
  const all = balances(wallets, transactions)
  const active = byBalance(wallets.filter((w) => !w.archived), all)
  const ready = active.filter((w) => w.type === 'spending').reduce((s, w) => s + all.get(w.id)!, 0)
  const level = LEVELS.find(([id]) => id === profile.level)?.[1]
  const about = [level, profile.school].filter(Boolean).join(' · ')
  const device = vault.shared() ? tr('Shared device mode') : tr('My device mode')
  const close = () => setDialog(null)
  const openWallet = (wallet?: Wallet) => setDialog({ kind: 'wallet', wallet })
  const tile = 'flex min-w-0 flex-col rounded-[14px] bg-white/[0.08] px-3 py-2 lg:gap-0.5 lg:rounded-2xl lg:py-2.5'

  return (
    <Page>
      {/* Phone: "Me" + a small Sign out / Lock pill. Wider: title + subtitle (the button sits in the profile card). */}
      <header className="mb-3.5 flex items-center justify-between gap-3 px-1 md:mb-5 md:px-0">
        <div>
          <h1 className="text-[1.875rem] leading-tight font-black tracking-[-0.03em] md:text-[2.125rem]">{tr('Me')}</h1>
          <p className="mt-1 hidden font-bold text-muted md:block">{tr('Your account, money settings and data.')}</p>
        </div>
        <SignOutButton compact />
      </header>

      <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-5">
        {/* Profile: above the cards below (z-20), so the photo menu isn't covered */}
        <section aria-label={tr('Profile')} className="relative z-20 flex animate-rise flex-wrap items-center gap-x-[1.125rem] gap-y-3.5 rounded-[26px] bg-card p-[1.125rem] md:rounded-[28px] md:px-5 md:py-4 lg:col-span-3">
          <PhotoAvatar />
          <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1.5">
            <p className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-xl leading-tight font-black md:text-2xl md:tracking-[-0.02em]">{name}</span>
              <span role="img" title={device} aria-label={device} className="hidden size-7 shrink-0 place-items-center rounded-full bg-blue-tint text-blue md:grid">
                <Icon name={vault.shared() ? 'users' : 'phone'} className="size-4" />
              </span>
            </p>
            {about && <p className="truncate text-[0.8125rem] font-bold text-muted md:hidden">{about}</p>}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:gap-2">
              <span className="inline-flex h-[1.625rem] shrink-0 items-center gap-1 rounded-full bg-amber-tint pr-2.5 pl-1.5 text-xs font-black text-amber md:text-[0.8125rem]">
                <img src={streakFlame(streak.current, streak.pending)} alt="" className="size-4" />
                {streak.current} {streak.current === 1 ? tr('day') : tr('days')}<span className="sr-only">{tr('-day streak')}</span>
              </span>
              <span className="inline-flex h-[1.625rem] shrink-0 items-center rounded-full bg-blue-tint px-2.5 text-xs font-extrabold text-blue md:hidden">{device}</span>
              {about && <span className="hidden min-w-0 truncate text-[0.8125rem] font-extrabold text-ink/80 md:inline">{about}</span>}
            </div>
          </div>
          <SignOutButton />
        </section>

        {/* Your baon */}
        <section aria-labelledby="your-baon" className="flex animate-rise flex-col gap-3 rounded-[26px] bg-hero p-[1.125rem] text-white lg:col-span-3 lg:gap-3.5 lg:rounded-[32px] xl:col-span-1 lg:px-[1.625rem] lg:py-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="your-baon" className="text-sm font-black text-white/75 lg:text-[0.9375rem]">{tr('Your baon')}</h2>
            <button type="button" onClick={() => setDialog({ kind: 'allowance' })} className="flex h-[2.125rem] items-center rounded-full bg-blue px-3.5 text-[0.8125rem] font-extrabold text-white lg:hidden">{tr('Edit')}</button>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-2 tracking-[-0.04em]">
            {allowance.amountCentavos
              ? <BigMoney centavos={allowance.amountCentavos} className="text-[clamp(2.5rem,12vw,2.875rem)] lg:text-6xl" />
              : <span className="text-4xl font-black">{tr('It varies')}</span>}
            <span className="text-[0.9375rem] font-black tracking-normal text-white/75 lg:text-[1.0625rem]">{FREQUENCY_TEXT[allowance.frequency]}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <p className={tile}>
              <span className="text-[11px] font-extrabold text-white/75 lg:text-xs">{allowance.frequency === 'irregular' ? tr('Make it last until') : tr('Next allowance')}</span>
              <span className="text-sm leading-snug font-black lg:text-[0.9375rem]">{DAY_NAMES[weekday(allowance.nextDate)]}, {nextDay.format(new Date(`${allowance.nextDate}T00:00:00Z`))}</span>
            </p>
            <p className={tile}>
              <span className="text-[11px] font-extrabold text-white/75 lg:text-xs">{tr('Class days')}</span>
              <span className="text-sm leading-snug font-black lg:text-[0.9375rem]">{classDaysText(allowance)}</span>
            </p>
          </div>
          <button type="button" onClick={() => setDialog({ kind: 'allowance' })} className="mt-auto hidden h-[2.875rem] items-center gap-2 self-start rounded-full bg-blue px-[1.375rem] font-extrabold text-white lg:flex">
            <Icon name="pencil" className="size-[1.125rem]" />{tr('Edit allowance')}</button>
        </section>

        {/* Wallets: phone = sideways row of chips; desktop = tiles. Both open the wallet. */}
        <section aria-labelledby="wallets-title" className="flex min-w-0 animate-rise flex-col gap-2.5 rounded-[26px] bg-card py-4 pl-4 lg:col-span-3 lg:gap-4 xl:col-span-2 lg:rounded-[32px] lg:px-[1.625rem] lg:py-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-4 lg:items-start lg:gap-3 lg:pr-0">
            <div className="flex flex-col lg:gap-0.5">
              <h2 id="wallets-title" className="text-sm font-black text-muted lg:text-[0.9375rem]">{tr('Wallets')}</h2>
              <p key={ready} className="animate-pop text-2xl font-black tracking-[-0.02em] lg:text-[2.125rem] lg:leading-tight lg:tracking-[-0.03em]">{formatPeso(ready)}</p>
              <p className="hidden text-[0.8125rem] font-bold text-muted lg:block">{tr('Ready to spend · Savings kept apart')}</p>
            </div>
            <div className="flex gap-1.5 lg:gap-2">
              <Link to="?add=1&mode=transfer" state={{ modal: true }} className="flex h-[2.125rem] items-center gap-1.5 rounded-full bg-blue-tint px-3 text-[0.8125rem] font-extrabold text-blue hover:brightness-95 lg:h-[2.625rem] lg:px-4 lg:text-sm">
                <Icon name="arrow" className="hidden size-4 lg:block" />
                <span className="lg:hidden">{tr('Move')}</span><span className="hidden lg:inline">{tr('Move money')}</span></Link>
              <button type="button" onClick={() => openWallet()} aria-label={tr('Add a wallet')} className="grid size-[2.125rem] place-items-center rounded-full bg-page hover:bg-pebble lg:flex lg:h-[2.625rem] lg:w-auto lg:gap-1.5 lg:px-4 lg:text-sm lg:font-extrabold">
                <Icon name="plus" className="size-4" /><span className="hidden lg:inline">{tr('Add wallet')}</span></button>
            </div>
          </div>
          <ul className="flex gap-2 overflow-x-auto pr-4 [scrollbar-width:none] lg:hidden">
            {active.map((w) => <li key={w.id} className="shrink-0"><WalletChip wallet={w} amount={all.get(w.id)!} onClick={() => openWallet(w)} /></li>)}
          </ul>
          <ul className="mt-auto hidden grid-cols-[repeat(auto-fit,minmax(min(11rem,100%),1fr))] gap-2.5 lg:grid">
            {active.map((w) => <li key={w.id} className="min-w-0"><WalletTile wallet={w} amount={all.get(w.id)!} showKind onClick={() => openWallet(w)} /></li>)}
          </ul>
        </section>

        {/* Settings tabs */}
        <div className="min-w-0 lg:col-span-3">
          <Segmented options={TABS} value={tab} onChange={setTab} label={tr('Me sections')} />
          <Card key={tab} className="mt-3 animate-rise lg:rounded-[28px] lg:px-[1.625rem] lg:py-6">
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

        {/* Phones have no sidebar, so Help & privacy is linked here */}
        <Link to="/help" className="flex min-h-[3.75rem] animate-rise items-center gap-3 rounded-[22px] bg-card px-4 font-black hover:bg-pebble md:hidden">
          <Icon name="help" className="size-5 shrink-0 text-blue" />
          <span className="flex-1 text-[0.9375rem]">{tr('Help & privacy')}</span>
          <Icon name="chevron-right" className="size-5 text-muted" />
        </Link>
      </div>

      {dialog?.kind === 'allowance' && <AllowanceDialog onClose={close} />}
      {dialog?.kind === 'wallet' && <WalletDialog wallet={dialog.wallet} onClose={close} />}
    </Page>
  )
}
