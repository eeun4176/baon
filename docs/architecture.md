# Architecture

How Baon is put together. For the tools themselves, see [Technologies](technologies.md).

## The big picture

Baon is a web app that installs like a phone app (a PWA). Everything a student does happens on their own device first. The internet is needed only to sign in and to sync.

```
 Student's phone or laptop (the browser)                 Online
+------------------------------------------------+     +---------------------------+
|  Screens (React)                               |     |  Vercel                   |
|     |                                          |     |   - serves the app files  |
|  Session: records decrypted once, in memory    |     |   - /api/auth forwards    |
|     |                                          |     |     sign-in to Neon       |
|  Vault: encrypts and decrypts every record     |     +-------------+-------------+
|     |                                          |                   |
|  IndexedDB: only scrambled records on disk     |     +-------------v-------------+
|     |                                          |     |  Neon                     |
|  Sync: uploads and downloads scrambled records +---->|   - Auth (Google, email)  |
|                                                |     |   - Postgres + Data API   |
|  Service worker: keeps the app files offline   |     |     (row level security)  |
+------------------------------------------------+     +---------------------------+
```

There is no Baon server that holds business logic. The only server code is one small function that forwards sign-in requests (`api/auth.ts`).

## Main ideas

**Offline first.** After the first sign-in, every screen works without internet. A service worker keeps the app's own files on the device, and all records are read from the device's storage.

**Records are scrambled on the device.** Each account has one random key (AES-256-GCM, through the browser's built-in Web Crypto). Every record is encrypted with it before it is saved. Storage only ever holds scrambled data, plus the record's id, type and version.

**The account key is itself locked.** How depends on the device mode:

| Mode | How the key is locked | What the student sees |
|---|---|---|
| My phone | By a device key stored beside it | Baon opens right away |
| Shared phone | By a key made from the student's passphrase (PBKDF2-SHA256, 600,000 rounds). The passphrase is never stored | Baon asks for the passphrase every time it opens, and again after a minute away |

**One database per account.** A phone can hold several accounts. Each one has its own database (`sbt_<userId>`) and its own key, so one account cannot read another's records. A separate small database (`sbt_device`) holds only the list of accounts on the phone.

**Balances are never stored.** A wallet's balance is its opening amount plus the effect of every transaction. Editing or deleting a transaction can't leave a wrong total behind. Money is kept in whole centavos.

**Sync is automatic.** Every signed-in account syncs, with no switch and no code:

1. Check the online sign-in belongs to this account. If not, nothing is sent or read.
2. Upload the changes waiting in the outbox. Every save or delete is added to the outbox in the same step as the save itself.
3. Download what changed since the last sync. A record is saved only if it opens with the account's key.

Sync runs when Baon opens, when the student comes back to it, when the internet returns, 2 seconds after any change, and every 5 minutes while it is on screen. The regular check is every 5 minutes, not every minute, so many open apps don't keep the free database busy.

Online, each record is stored exactly as the phone stores it (scrambled), and the account key is stored with the account so any device the student signs in on can open them. Row level security in the database lets each user reach only their own rows (`sql/sync.sql`).

**Storage cap.** The database refuses an upload that would take one account past 30,000 records or 10 MB (about 15 years of normal use), so one account can't fill the database for everyone. Editing and deleting still work at the cap. A refused upload changes nothing online; the phone keeps its records and shows "Couldn't sync".

**What this protects, and what it doesn't.** Records are unreadable in the device's storage and to other accounts. The sign-in is the lock for the online copy, so whoever can sign in to the student's Google or email account can get their records, and whoever runs the database could open them. This was a deliberate choice (2026-11-11) so Baon works on every device with no codes.

**Backups are separate.** A backup is a file the student saves themselves. It is locked with a recovery code, not with the sign-in.

## How the app starts

1. `App.tsx` reads the list of accounts on this device. An address Baon doesn't have (for example `/asdas`) shows "Page not found" before any other screen; its "Go to Home" button still goes through the steps below.
2. No account: onboarding (sign in, device mode, allowance, money now).
3. One account in My phone mode: it opens straight away. Shared phone mode: the lock screen.
4. More than one account: the account picker ("Who's using Baon?").
5. Once open, `SessionProvider` decrypts the records once and shares them with every screen. Saving a record updates every screen at once.

## The number on Home

```
Ready to spend   = money in spending wallets - money held back
Held back        = school set-asides + utang still owed + money kept for later
Budget days left = today up to the day before the next allowance
                   (class days only, if that option is on; at least 1)
Daily budget     = Ready to spend / Budget days left, rounded down to whole pesos
Left for today   = Daily budget - what was spent today
```

The full rules are in `src/budget/safeToSpend.ts`. Streak rules are in `src/streak/streak.ts`.

**Overspending.** Baon never blocks an entry. Going over today's budget makes the next days' budget smaller. Taking out more than a wallet holds offers two choices, because the usual cause is money in that was never logged:

- **"Add the missing ₱100 as money in, then save"** logs ₱100 money in (source Other, note "Not logged before") and the entry together, so the wallet ends at exactly ₱0. One Undo removes both.
- **"Save anyway"** saves the entry, and the wallet goes below ₱0. Home then says how much more was spent than there was.

## Home extras

Use cases and worked examples for every feature are in [Features](features.md).

**This week's trend.** Under the daily budget: what was spent this week so far (Sunday to today), against the same days last week. A green down arrow means less, a red up arrow means more, and the words say it too ("₱80 less than last week"). It's in pesos, not percent: a percent rise has no ceiling, so a small last week made a normal week read "2,019% more". No arrow when last week had nothing to compare with (`weekTrend` in `src/history/history.ts`).

**Ipon outlook** (`src/home/savings.ts`). On each logged class day of the last 4 weeks, what was left of that day's budget (budget − spent). The average, times the budget days in the next 30 days, is shown as "If you keep this up: ₱600 a month · ₱3,600 in 6 months". It needs 5 such days first. If the average is below zero, it shows how much ₱20 less a day would save instead.

**Tipid tips.** One tip for the category spent on most in the last 7 days (general tips otherwise). Not random: it moves to the next tip in that list once a day, and "Another tip" shows the next one, looping back to the first after the last.

## Money that isn't the allowance

**Money in has a source:** Allowance, Scholarship, Salary / sideline, Gift or Other. Only the allowance answers "Did your baon arrive?" and starts a new category-limits cycle. Entries made before sources existed count as the allowance.

**Make it last until.** Any money in except the allowance can be spread to a date. The part meant for days after the current budget period is held back, spread evenly over every day from when it came in, and each new period releases its share. Example: ₱3,000 on Nov 10 lasting until Dec 14 (35 days), next allowance Nov 15: Nov 15 to Dec 14 is 30 of those days, so ₱2,571 is held back now.

**Utang** (Plan → Utang) is worked out from entries only (`src/ledger/utang.ts`):

| Entry | Wallet | Budget |
|---|---|---|
| Borrowed | + | What's still owed is held back until it's paid back |
| Paid back | − | Releases that much of the hold; not spending |
| Lent | − | Not spending; not counted until it comes back |
| Got paid back | + | Counted again |

Part payments add up. An utang with payments can't be deleted until its payments are deleted, so no payment points at nothing.

**Record versions.** Each saved record carries the version of Baon that wrote it (`SCHEMA_VERSION` in `src/vault/vault.ts`, now 2). An older Baon skips records from a newer one while syncing, instead of failing on entries it can't read. After it updates, its next sync downloads everything again to pick them up.

## Folders

| Folder | What it holds |
|---|---|
| `api/` | The sign-in forwarder that runs on Vercel |
| `sql/` | Database setup for sync and the privacy check, run in Neon's SQL Editor |
| `public/` | App icons and `robots.txt` |
| `src/crypto/` | The only encryption code |
| `src/db/` | The on-device database layout |
| `src/vault/` | The encrypted record store every screen saves through |
| `src/sync/` | Sync logic, the Neon connection, and the sync status UI |
| `src/backup/` | Backup files and recovery codes |
| `src/auth/` | Sign-in (loaded only when needed, so the offline app never downloads it) |
| `src/ledger/` | Wallets, transactions, balances and peso parsing |
| `src/budget/` | Allowance, Manila dates, and the safe-to-spend number |
| `src/streak/` | Streak rules, the flame, and the share picture |
| `src/onboarding/` | First-time setup screens |
| `src/lock/` | Lock screen, passphrase, account picker, remove from phone |
| `src/home/`, `src/add/`, `src/history/`, `src/plan/`, `src/me/`, `src/help/`, `src/legal/` | The app's pages |
| `src/shell/` | The frame around the pages: navigation, session, toasts, theme |
| `src/ui/` | Shared components (`kit.tsx`, `Modal.tsx`) |
| `src/i18n/` | English and Filipino texts |

## Security rules the code follows

- No secrets in the browser. Only the two public Neon addresses are in the build.
- A strict Content Security Policy in `vercel.json`: scripts, styles and fonts only from Baon itself.
- Sync never sends or reads anything unless the online sign-in matches the open account.
- Destructive actions (delete account, remove from phone) ask first and are red.
