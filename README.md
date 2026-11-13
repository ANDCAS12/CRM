# IK CRM

Pipeline and relationship CRM for Insight Kitchen, replacing HubSpot. This repository is the MVP prototype: a single-page app with an access-controlled data layer, built so the business rules can move unchanged to the production stack (Next.js, PostgreSQL, Auth.js) in the build prompt.

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

## Live demo

**https://andcas12.github.io/CRM/**, rebuilt automatically after every merge into `main` (see `.github/workflows/pages.yml`). Demo data only: anyone with the address can open it, and each visitor's changes stay in their own browser.

Outside Claude, exports download as normal files and deal summaries use the local draft (Claude summaries need the production backend).

## Quick start

Requires Node 20 or 22.

```bash
npm ci            # install exact dependency versions
npm run build     # writes dist/index.html (one self-contained file)
npm run serve     # http://localhost:4173
```

Sign in with a demo account (password `demo`): Russell (Admin), Cristina (GTM), Rod (Delivery and talent) or Alejandro (Finance). Switching between them is the fastest way to check role restrictions.

Add `?seed=large` to the URL to load 1,000 companies, 10,000 contacts and 5,000 deals in memory for manual load testing.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Rebuilds on save and serves `dist/` |
| `npm run build` | Bundles `src/` into `dist/index.html` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run check:brand` | Fails if any colour outside the seven IK tokens is used |
| `npm test` | Unit tests (Vitest, Node) |
| `npm run test:coverage` | Unit tests with coverage thresholds |
| `npm run test:stress` | Performance tests at 5x data volume |
| `npm run test:e2e` | Browser tests (Playwright) against `dist/` |
| `npm run test:all` | Everything CI runs, in order |

First e2e run: `npx playwright install chromium` (CI installs Chromium, Firefox and WebKit).

## What's in the MVP

Every feature maps to a story ID in the build prompt. See [docs/FEATURE_MAP.md](docs/FEATURE_MAP.md) for the full list, including which HubSpot tutorial features were added and which were left out (and why).

## Project layout

```
src/
  config/      constants and field definitions (one source of truth per field)
  utils/       pure helpers: dates, formatting, CSV
  core/        business rules: permissions, API, deals, imports, reports, matching, auth
  ai/          deal summary prompt, sources and fallback
  platform/    bridges to the hosting runtime (Claude sampling, downloads)
  ui/          views and components (the only code that touches the DOM)
tests/
  unit/        Vitest, Node only, covers src/core, src/utils, src/ai
  e2e/         Playwright, real browser against the built app
scripts/       build, static server, brand check
docs/          architecture, feature map, testing
```

More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/TESTING.md](docs/TESTING.md).

## What is stubbed

| Area | Prototype | Needed for production |
| --- | --- | --- |
| Data storage | Browser localStorage, per person | PostgreSQL with Prisma, nightly backups |
| Sign-in | Salted SHA-256 hashes, demo accounts | Auth.js, Microsoft Entra SSO later |
| Fireflies | Replays sample calls | Fireflies API key, GraphQL + webhook |
| SharePoint files | Sample file list | Microsoft Graph app credentials |
| Email reminders | In-app bell only | Microsoft 365 or transactional email |
| Claude summaries | Viewer’s Claude account | Anthropic API key, server-side |

## License

Proprietary. Internal to Insight Kitchen.
