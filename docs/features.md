# Features

What each feature is for, how it works, and where its code lives. For how the app is put together (storage, encryption, sync), see [Architecture](architecture.md).

Each feature has:

- **Use case:** a student and what they want to do.
- **How it works:** the rules, with a worked example where numbers are involved.
- **Code:** the file that holds the rules.

Money is in whole centavos in the code. The examples use pesos.

---

## Getting started

### Onboarding

**Use case:** Ana installs Baon for the first time. She wants to set it up once and then use it without internet.

**How it works:**

1. Welcome (phones only) → **Sign in** with Google or a 6-digit email code. This is the only step that needs internet.
2. **Whose phone?** "Just me" (My phone mode) or "Shared with family or classmates" (Shared phone mode, which adds "Make a passphrase").
3. **Your baon:** how much, how often (Daily, Weekly, Every 2 weeks, Monthly or Irregular), when the next one comes, and which days are class days.
4. **Your money now:** what's in each wallet today.
5. Home opens.

If the account already has records online (from another device), Baon says "Welcome back" and downloads them instead of asking again. "Restore a backup" on "Whose phone?" fills Baon from a backup file.

**Code:** `src/onboarding/Onboarding.tsx`

### Several accounts on one phone, and the lock screen

**Use case:** Ben and his sister share one phone. Each wants their own records, and neither should see the other's.

**How it works:** each account has its own records and its own key. With more than one account, Baon opens on "Who's using Baon?". In Shared phone mode, Baon asks for the passphrase every time it opens, and again after a minute away. "Remove from this phone" (Me → Security) syncs every change first, then deletes the account from this phone only. If that upload fails, nothing is removed. Signing in on any phone brings the records back.

**Code:** `src/lock/`, `src/App.tsx`

---

## Home

### Safe to spend today

**Use case:** Carlo has ₱1,500 until his next baon on Saturday. He wants to know how much he can spend today without running out before then.

**How it works:**

```
Ready to spend   = money in spending wallets - money held back
Held back        = school set-asides + utang still owed + money kept for later
Budget days left = today up to the day before the next allowance
                   (class days only, if that option is on; at least 1)
Daily budget     = Ready to spend / Budget days left, rounded down to whole pesos
Left for today   = Daily budget - what was spent today
```

**Example:** ₱1,000 in wallets, ₱100 set aside for printing, 6 class days left → (₱1,000 − ₱100) / 6 = **₱150 a day**. After a ₱60 lunch, Home shows **₱90 left today**.

Going over never blocks anything. Home shows "₱30 over", and the next days' budget gets a little smaller. "How it's counted" opens the breakdown (on desktop it sits beside the number).

The "Today" card also shows: "Left until Saturday", "Class days left", and this week's spending against last week's (a green ↓ is less, a red ↑ is more). A split bar shows "left to spend" against "held back".

**Code:** `src/budget/safeToSpend.ts`, `src/home/Home.tsx`, `src/home/Breakdown.tsx`

### "Did your baon arrive?"

**Use case:** Saturday comes, but Dana's baon is late.

**How it works:** on the allowance day, Home asks before showing the number:

| Answer | What happens |
|---|---|
| **Yes, ₱1,500** | Logs the allowance as money in and moves the next date one cycle ahead |
| **Not yet** | "When do you think it'll come?" Tomorrow / In 3 days / In a week. What's left is spread over those days, and Baon asks again then. "My baon came" stays on Home meanwhile. The usual day is kept, so one late baon doesn't shift the schedule |
| **A different amount** | Pick the amount, wallet and next date |

Every answer can be undone.

**Code:** `src/home/AllowanceCheckIn.tsx`

### Streak (on Home and its own page)

**Use case:** Eli wants a reason to log every day, even on days he goes over.

**How it works:** the streak counts logged class days. Logging honestly is what counts, not staying under budget.

| Day | Effect |
|---|---|
| Class day, something logged (or "No spending today"), under budget | +1 |
| Class day, logged, **over** budget | +1 too (dark on the spending map) |
| Class day, nothing logged | Breaks the streak, unless a free pass covers it |
| Not a class day | Nothing |
| Inside a "No classes" break | Frozen: nothing |
| Today, nothing logged yet | Nothing yet; the day isn't over |

**Free pass:** +1 every Monday. A saved pass covers a forgotten class day by itself. You can save up to 1, up to 3 with a 10+ day streak, and up to 5 at 100+.

Home's phone header shows the flame and the number. The streak card shows this week's ✓ row, the best streak and the passes. The Streak page adds a spending map (one square per day: darker blue = more of that day's budget used, dark = over) and "Share", which makes a story-size picture with no amounts and no name.

**Code:** `src/streak/streak.ts`, `src/streak/Streak.tsx`, `src/streak/share.ts`

### Ipon outlook

**Use case:** Faye wonders: "If I keep spending like this, how much could I save by the end of the semester?"

**How it works:**

1. Look at the **last 28 days**. Keep only **logged class days** (the streak's ✓ days, over-budget days included). Breaks, days off and days with nothing logged are skipped.
2. For each kept day: **left over = that day's budget − what was spent** (negative when over).
3. **Average** those amounts, cut to whole pesos.
4. **Per month** = average × the budget days in the next 30 days (class days only if that option is on, otherwise all 30). **6 months** = per month × 6.

**Example:** daily budget ₱150. Over 10 logged class days, Faye spent ₱120 a day on average, so ₱30 was left per day. With 22 class days in the next 30 days:

- ₱30 × 22 = **₱660 a month**
- ₱660 × 6 = **₱3,960 in 6 months**

What the card shows:

| Situation | Card says |
|---|---|
| Fewer than 5 logged class days in the last 4 weeks | "Log 3 more class days to see this." (so one lucky day doesn't promise too much) |
| Average left over is above ₱0 | "You could save ₱660/mo" and "₱3,960 in 6 months" |
| Average left over is ₱0 or below | "Over budget lately. ₱20 less a day saves about ₱440 a month." (₱20 × 22 days) |

The last line always shows **"In Savings now"**: the real balance of all Savings wallets.

Each day's budget is the one Baon saved when it was opened that day, so editing an old expense compares it with that day's budget, not today's. A logged day with no saved budget is skipped.

**Code:** `iponOutlook` in `src/home/savings.ts`, card in `src/home/SavingsCard.tsx`

### Tipid tips

**Use case:** Gio spends most of his money on food and wants simple ideas to spend less.

**How it works:** tips are **not random**. They follow a fixed order that changes once a day.

1. **Pick the list.** Find the category with the most spending in the **last 7 days**:

   | Top category | Tips in its list |
   |---|---|
   | Food | 3 |
   | Fare, Load, Snacks, School | 2 each |
   | Shopping, Fun | 1 each |
   | Anything else, or nothing logged | the 4 general tips |

2. **Pick today's tip.** Count the days since Jan 1, 2026 and divide by the list's length. The remainder is the tip's position in the list, so the tip moves to the next one each day and loops back after the last one.
3. **"Another tip"** shows the next tip in the same list, looping back to the first after the last. Reloading Home goes back to today's tip.

**Example:** Gio's top category this week is Food (3 tips). Today he sees Food tip 2. "Another tip" shows tip 3, then tip 1, then tip 2 again. Tomorrow starts on tip 3. If next week Fare is his top category, he gets the Fare tips instead.

Everyone with the same top category sees the same tip on the same day. With only 1 tip (Shopping, Fun), "Another tip" shows the same tip again.

On phones the tip sits under the streak and Ipon cards; on desktop it's inside the Ipon card.

**Code:** `TIPS` and `pickTip` in `src/home/savings.ts`, `TipBox` in `src/home/SavingsCard.tsx`

### One-tap add

**Use case:** Hana takes the same ₱15 jeep every morning and wants to log it in one tap.

**How it works:** each button ("Jeep ₱15", "Lunch ₱80", "Print ₱5", "Load ₱50" to start) logs the expense right away, using the button's wallet (or the last-used one), then shows Undo for 5 seconds. "Edit" adds (up to 8), edits, reorders or deletes buttons. After the same expense (same name, amount and category) is logged 3 times, Home offers to make it a button. "No thanks" is remembered.

**Code:** `src/home/OneTapAdd.tsx`, `src/add/presets.ts`

### Your money (bottom of Home)

- **Today's entries**, newest first.
- **Spent per day:** the last 7 days as bars.
- **Wallets:** the total and each wallet.
- **Set aside for school:** what's reserved and what's next.
- **Category limits:** the first two limits with their bars.

**Code:** `src/home/MoneyCards.tsx`, `src/home/LimitsCard.tsx`

### Reminders

| Card | Shows when | Goes away |
|---|---|---|
| Backup reminder | No backup yet and 3+ entries, **or** the last backup is 7+ days old and there are newer entries | After a backup, or "Later" (hidden 3 days on this browser) |
| Storage warning | The phone is almost out of space | When there's space again (it points to a backup meanwhile) |

**Code:** `src/backup/BackupReminder.tsx` (`backupDue` in `src/backup/backup.ts`), `src/home/StorageWarning.tsx`

---

## Adding entries

### Add (expense, money in, move, save)

**Use case:** Ivy buys a ₱45 notebook and wants to log it in a few seconds.

**How it works:** on phones, a full-screen sheet with a big keypad and category chips; on desktop, a dialog where you type the amount ("Enter to save · Esc to close"). Categories: Fare, Food, Load, School, Snacks, Shopping, Health, Gifts, Fun and Other, plus the student's own (for example "Milk tea"). Every entry can be edited or deleted later.

**Money in has a source:** Allowance, Scholarship, Salary / sideline, Gift or Other. Only the allowance answers "Did your baon arrive?" and starts a new category-limits cycle.

**Make it last until** (any money in except the allowance): spreads a big amount to a date. **Example:** ₱3,000 scholarship on Nov 10, lasting until Dec 14 (35 days), next allowance Nov 15. Nov 15 to Dec 14 is 30 of those days, so ₱2,571 is held back now and released a share at a time.

**Taking out more than a wallet holds** offers two choices:

- **"Add the missing ₱100 as money in, then save"**: logs both, so the wallet ends at exactly ₱0. One Undo removes both.
- **"Save anyway"**: the wallet goes below ₱0, and Home says how much more was spent than there was.

**Code:** `src/add/QuickAdd.tsx`, `src/ledger/ledger.ts`

---

## History

**Use case:** Jay wants to know where his money went this week, and find that ₱250 he can't remember.

**How it works:**

- **Search** the entries' text: note, category and wallet (Home's search box on desktop opens History with the results).
- **Show:** All · Today · Yesterday · This week · This month, plus a category dropdown. The total and "By category" follow the filter.
- **List or Charts:** day cards, or spent per day and spending by category.
- Tap any entry to **edit or delete** it.
- **Share:** a story-size "receipt" of today's, this week's or this month's spending: the total, then what was bought, grouped ("Jeep ×5"), biggest first. It shows notes and amounts, so Baon says so before sharing.

**Code:** `src/history/History.tsx`, `src/history/history.ts`, `src/history/shareSpending.ts`

---

## Plan

The top of Plan shows what's **kept out of the daily budget**: school set-asides and utang owed, as a split bar. "Owed to you" is shown separately, because it isn't counted until it comes back.

### School expenses

**Use case:** Kim's org fee of ₱300 is due in two weeks. She wants that money kept aside so she doesn't spend it on snacks.

**How it works:** Planned → **Set aside** → Paid.

- Only **Set aside** items are subtracted from "Safe to spend". The money stays in the wallet.
- **Mark paid** creates the expense and releases the set-aside in one step, so it's never counted twice. Deleting that expense in History puts the item back to "Set aside".
- Quick-add chips: Printing, Project materials, Org / class fee, Uniform / PE, Field trip, Thesis / research, Other.

**Code:** `src/plan/school.ts`, `src/plan/Plan.tsx`

### Utang

**Use case:** Leo borrows ₱200 from a classmate and lends ₱100 to another.

**How it works:** worked out from entries only.

| Entry | Wallet | Budget |
|---|---|---|
| Borrowed | + | What's still owed is held back until it's paid back |
| Paid back | − | Releases that much of the hold; not spending |
| Lent | − | Not spending; not counted until it comes back |
| Got paid back | + | Counted again |

Part payments add up. A due date shows as a chip ("Today", "2 days late"). An utang with payments can't be deleted until its payments are deleted.

**Example:** Leo borrows ₱200 → his wallet goes up ₱200, but ₱200 is held back, so his daily budget doesn't change. He pays back ₱50 → the hold drops to ₱150.

**Code:** `src/ledger/utang.ts`, `src/plan/UtangCard.tsx`

### Class days and breaks

**Use case:** Mia has no classes on Wednesdays, and sembreak is coming.

**How it works:** Su–Sa toggles pick the class days. "Count only class days" makes the daily budget count only those days. A **"No classes" break** (suspension, holiday, sembreak) counts every day in the budget and freezes the streak.

**Code:** `src/plan/Plan.tsx`, `src/budget/allowance.ts`

### Category limits

**Use case:** Noel wants to keep milk tea under ₱200 until his next baon.

**How it works:** a cap per category for one allowance cycle. The cycle starts on the day the latest allowance came in, so a late baon starts the cycle late too. Before the first allowance entry, everything logged so far counts.

| Spent of the limit | Chip |
|---|---|
| Under 80% | none |
| 80% or more | "Almost there" |
| 100% | "Limit reached" (the bar turns dark) |
| More than 100% | "Over limit" |

A limit is a reminder, never a block: "Just a reminder. You can still log anything." Students can add their own categories here.

**Code:** `src/plan/limits.ts`, `src/plan/LimitsDialog.tsx`, `src/home/LimitsCard.tsx`

---

## Me, backup and sync

### Me

**Use case:** Olive changed schools and wants to update her profile and allowance.

**How it works:** profile (name, school, Senior high / College, photo), Security (device mode), Backup, Preferences (theme, language, install), plus "Your baon" (allowance) and Wallets (add, rename, remove, move money). Delete account is here too, in red.

**Code:** `src/me/Me.tsx`

### Sync

**Use case:** Paolo logs on his phone and checks on his laptop.

**How it works:** automatic for every signed-in account, with no switch and no code. It runs when Baon opens, when the student comes back to it, when the internet returns, 2 seconds after any change, and every 5 minutes while Baon is on screen. Records are scrambled before they leave the device. Details are in [Architecture](architecture.md#main-ideas).

**Code:** `src/sync/`

### Backup

**Use case:** Queenie wants a copy of her records she controls herself.

**How it works:** a backup is an encrypted file the student saves. Only their recovery code opens it, and Baon never uploads it. "Lost it? Make a new code" makes a new code; older backups still need the old one.

**Code:** `src/backup/`

### Offline and install

**Use case:** Rico has no load on the way to school but still wants to log his fare.

**How it works:** after the first sign-in, every screen works offline. The service worker saves all the app's files on the first visit, including pages that download only when first opened. Entries made offline sync when the internet is back. Install: Android (Chrome) menu ⋮ → Install app; iPhone (Safari) Share → Add to Home Screen; on a computer, the install icon in the address bar.

To test offline locally, use `npm run build` then `npm run preview` (`http://localhost:4173`). The dev server (`npm run dev`) has the service worker turned off.

**Code:** `vite.config.ts` (VitePWA), `src/install.ts`
