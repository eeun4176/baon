# Design system

The look and feel of Baon, and the rules for adding to it. The tokens live in `src/index.css`; shared components live in `src/ui/`.

## Principles

- **One number first.** Home answers "how much can I spend today?" before anything else.
- **Plain words.** Short sentences a student understands at a glance. No technical terms.
- **Friendly, not childish.** Round shapes, one typeface, one accent color.
- **Phone first.** Every screen must work at 320px wide, in Filipino, before it is done.
- **Balanced cards.** Cards in one row share a height, so each stretchable card has one part that grows.

## Colors

Colors are tokens. Use the token (`bg-card`, `text-muted`), never a raw color, so dark theme works by itself.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `ink` | `#1d1f1e` | `#eef0ef` | Text, selected chips |
| `page` | `#f3f4f4` | `#111312` | App background |
| `card` | `#ffffff` | `#1c1e1d` | Cards, navigation pill |
| `pebble` | `#eeefef` | `#272a28` | Secondary buttons, chips |
| `pebble-2` | `#e6e7e7` | `#303331` | Keypad tray, empty progress bars |
| `muted` | `#5f6361` | `#a5aaa7` | Secondary text |
| `blue` | `#1e5eff` | `#1e5eff` | Main buttons, links, active items |
| `blue-tint` | `#e8efff` | `#1a2747` | Soft badges, active navigation item |
| `hero` | `#1d1f1e` | `#2a2d2c` | Dark hero cards and toasts (dark in both themes) |
| `coin` | `#ffc94d` | same | The logo's coin |
| `red` | `#dc2626` | same | Destructive actions only |
| `trend-up` | `#c81e1e` | `#f87171` | Text only: spending went up (with an up arrow and words) |
| `trend-down` | `#15803d` | `#4ade80` | Text only: spending went down (with a down arrow and words) |
| `amber`, `amber-tint` | `#8a4b0f` on `#fff4e5` | `#f5b969` on `#3a2a14` | Heads-up chips: "Limit reached", "Today", "2 days late", "Over today" |
| `bar` | `#cfd0d0` | `#3a3e3c` | Gray chart bars, switch "off" track |
| `map-0` to `map-3`, `map-over` | gray, light blue, mid blue, blue, ink | | Spending map shades |

Notes:
- Blue text on dark cards uses a lighter blue (`#7ea2ff`) so it stays readable.
- Theme choices: Light, Dark, or Device (follows the phone's setting).
- Onboarding is a white page with gray fields, so inside `.onboarding` the `page` and `card` colors trade places.

## Type

- **Typeface:** Nunito only, bundled with the app so it works offline.
- **Weights:** 600 body, 800 labels, 900 titles and money.
- **Base size:** 15px on phones and tablets, 14px on laptops (1024px and wider). Sizes are in `rem`, so the student's own browser text size still applies.
- **Money:** weight 900, with a smaller gray ₱ in front.

## Shape and spacing

- **Cards:** white, no border, corner radius 24px on phones and 28px on larger screens, padding 16px to 20px.
- **Buttons and chips:** fully round (pill). Main buttons are at least 56px tall.
- **Tap targets:** at least 44px.
- **Gaps:** 16px between cards on phones, 20px on desktop.
- **Layouts:** one column on phones; a 12-column grid on desktop (1024px and wider). Home and Plan (v2) use 3 columns on desktop: a wide card (2) beside a narrow one (1).
- **Home and Plan cards (v2):** corner radius 26px on phones and 32px on desktop; the main card on each page ("Today", "Kept out of your daily budget") is 30px on phones. Gray stat tiles inside cards use `page`.

## Motion

Short and soft, with one easing everywhere. Students who turn on "Reduce motion" get a still app.

| Class | Used for |
|---|---|
| `animate-rise` | Cards and pages appearing |
| `animate-pop` | A number that just changed |
| `animate-sheet` | Phone pop-ups sliding up from the bottom |
| `animate-dialog` | Desktop pop-ups scaling in |
| `animate-grow-x`, `animate-grow-y` | Chart bars |
| `bn-*` | The onboarding picture (buddy bobbing, coins floating) |

## Shared components

In `src/ui/kit.tsx` unless noted. Reuse these before making a new one.

| Component | What it is |
|---|---|
| `Page`, `PageHeader` | The page area and its title row inside the app |
| `Screen`, `Title` | A full-height screen outside the app (lock, account picker) |
| `Card` | The white rounded card |
| `Button` | Full-width pill button: `primary` (blue), `secondary` (gray), `dark` (ink) |
| `Chip` | A pill the student can select |
| `Pill` | A small status label: gray, `amber` (heads-up), `dark` ("Set aside"), `blue` ("Paid") |
| `SplitBar` | One rounded bar per part, sized by amount, with a gap between (Home: left vs held back; Plan: school vs utang vs later) |
| `Switch` | On/off switch |
| `MoneyField`, `BigMoney` | Typing and showing peso amounts |
| `Segmented` | Tabs inside a page |
| `Icon` | Lucide icons; only the ones listed in `kit.tsx` are bundled |
| `Modal` (`ui/Modal.tsx`) | Pop-up: a bottom sheet on phones, a centered dialog on desktop |
| `Step` (`onboarding/Step.tsx`) | The frame around each onboarding step |

Patterns:
- **Short info goes in a pop-up**, not a new page.
- **Destructive actions are red** and ask first.
- **After a save or delete, show a toast**, with Undo where it makes sense.

## The streak flame

| Streak | Flame |
|---|---|
| Today not logged yet (class day) | Gray |
| 0 to 29 days | Orange |
| 30 to 99 days | Blue |
| 100 days and up | Violet |

`streakFlame()` in `src/streak/flame.ts` picks the picture. The share picture always uses the colored flame.

## Writing

- All on-screen text goes through `tr()`, with a Filipino entry in `src/i18n/fil.ts`.
- Filipino is casual Taglish, the way students talk, not formal Tagalog.
- Helper text is one short sentence. If it isn't needed, remove it.
- Sentence case: only the first word starts with a capital ("Works offline", not "Works Offline"). Each part after a "·" starts with a capital too ("My phone · Works offline"). Text that continues a number stays lowercase ("12 days in a row", "₱50 spent").
- A test fails if a text has no Filipino entry, or if an entry is no longer used.
