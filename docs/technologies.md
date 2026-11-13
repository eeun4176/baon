# Technologies

Every tool Baon uses and what it is for. Versions are in `package.json`.

## The app

| Technology | What it is | What Baon uses it for |
|---|---|---|
| **React 19** | Library for building screens from components | Every screen and component |
| **TypeScript** | JavaScript with types | All code; catches mistakes before the app runs |
| **Vite** | Build tool and local dev server | Runs the app locally and builds the files that go live |
| **React Router** | Page navigation inside a web app | Moving between Home, History, Plan, Streak, Me and Help without reloading |
| **Tailwind CSS v4** | Styling with small utility classes | All styling; the design tokens in `src/index.css` become classes like `bg-card` |
| **Nunito** (`@fontsource/nunito`) | The typeface, as files inside the app | Text looks the same offline, with no request to a font service |
| **Lucide** (`lucide-react`) | Icon set | The icons; only the ones Baon lists are included |

## Data on the device

| Technology | What it is | What Baon uses it for |
|---|---|---|
| **IndexedDB** | The browser's built-in database | Where records are kept on the device |
| **Dexie** | A simpler way to use IndexedDB | One database per account, plus the list of accounts on the device |
| **Web Crypto API** | The browser's built-in encryption | Scrambling every record (AES-256-GCM) and making a key from the passphrase (PBKDF2). No extra encryption library |
| **Zod** (`zod/mini`) | Checks that data has the right shape | Validating records when they are saved and when they are opened |

## Offline and install

| Technology | What it is | What Baon uses it for |
|---|---|---|
| **PWA** (`vite-plugin-pwa`, Workbox) | Lets a website install and work offline | The install button, the app icon, and a service worker that keeps the app's files on the device |

## Online

| Technology | What it is | What Baon uses it for |
|---|---|---|
| **Neon Auth** (`@neon/auth`) | Sign-in service | Continue with Google, and the 6-digit email code |
| **Neon Postgres + Data API** (`@neon/neon-js`) | Hosted database the browser can talk to safely | The online copy of each account's scrambled records, for sync |
| **Row level security** (`sql/sync.sql`) | Database rule | Each signed-in user can reach only their own rows |
| **Vercel** | Hosting | Serves the app at baon-ph.vercel.app and sets the security headers (`vercel.json`) |
| **Vercel function** (`api/auth.ts`) | A small piece of server code | Forwards sign-in to Neon so the sign-in cookie belongs to Baon's own address; phones drop cookies from other addresses |

## Quality checks

| Technology | What it is | What Baon uses it for |
|---|---|---|
| **Vitest** | Test runner | Unit tests for money, budget, streak, encryption, sync and translations. A big-data timing test (1,000 to 10,000 expenses) runs only when asked: `$env:BIG=1; npx vitest run src/ledger/bigdata.test.ts` |
| **Lighthouse** (in Chrome DevTools) | Page quality report | Performance, accessibility, best practices and SEO of the live site. Set DevTools → Network back to "No throttling" first, or it can't load the page |
| **fake-indexeddb** | A pretend IndexedDB | Lets the storage and sync tests run without a browser |
| **ESLint** (with typescript-eslint and React plugins) | Code checker | Catches common mistakes and unused code |
| **GitHub Actions** (`.github/workflows/ci.yml`) | Runs checks on every push | Lint, tests and build must pass |
| **Basic SSL plugin** (`@vitejs/plugin-basic-ssl`) | Local https | Encryption and install only work on secure pages, so local testing on a phone needs https. Used by `npm run dev` only: `npm run preview` runs on plain `http://localhost` (already secure), because browsers won't install the offline service worker from the self-made certificate |

## What Baon does not use, on purpose

- **No ads, analytics or tracking scripts.**
- **No state library.** The unlocked records live in one React context (`src/session.ts`).
- **No translation library.** `tr()` and one dictionary file are enough for two languages.
- **No server of its own.** Besides the sign-in forwarder, everything runs in the browser.
