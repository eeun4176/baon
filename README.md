<p align="center">
  <img src="public/pwa-192x192.png" alt="Baon logo" width="96" height="96">
</p>

<h1 align="center">Baon</h1>

An offline-first budget app for students. Baon tells you how much is safe to spend today, based on your allowance (baon), the money you have now, and the days left until your next allowance.

**Live app:** https://baon-ph.vercel.app

## What it does

- **Safe to spend today.** One number on Home, worked out from your wallets, what you set aside for school, and the days left.
- **Quick logging.** One-tap buttons for the things you buy most, like a jeep fare or lunch.
- **Wallets.** Cash, e-wallets, banks and savings, with moves between them.
- **Plan.** Set money aside for school expenses, set category limits, and mark class days and breaks.
- **History.** Search and filter your entries by day and category, with spending charts you can share.
- **Streak.** Log every class day to keep your streak going; the flame changes as it grows.
- **Works offline.** After the first sign-in, everything works without internet and installs like an app.
- **Syncs across devices.** Sign in with Google or an email code and your records follow you.
- **Private.** Records are encrypted on your device. Shared phone mode adds a passphrase, and several students can use one phone without seeing each other's records.
- **English and Filipino**, with light and dark themes.

## Built with

React, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), the Web Crypto API, Neon (sign-in and database) and Vercel. See [docs/technologies.md](docs/technologies.md) for what each one is for.

## Run it locally

You need Node.js 22 or newer.

```
npm install
npm run dev
```

The app opens on `https://localhost:5173`. Your browser will warn about the local certificate the first time; that is expected.

Sign-in and sync need two values in a `.env.local` file (never committed). Copy `.env.example` to `.env.local` and fill in:

```
VITE_NEON_AUTH_URL=
VITE_NEON_DATA_API_URL=
```

Other commands:

```
npm test         # unit tests
npm run lint     # code checks
npm run build    # type-check and production build
```

## Docs

| Doc | What it covers |
|---|---|
| [Architecture](docs/architecture.md) | Where data lives, how it is locked, how sync works, and what each folder is for |
| [Design system](docs/design-system.md) | Colors, type, shapes, motion, shared components and writing rules |
| [Technologies](docs/technologies.md) | Every tool Baon uses and why |

## Contact

Questions or problems: cabalquintojohnian@gmail.com
