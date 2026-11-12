# Testing

## Layers

| Layer | Tool | Runs | What it proves |
| --- | --- | --- | --- |
| Unit | Vitest (Node) | every push | Business rules: permissions, audit, validation, filters, imports, matching, reports, auth, AI fallback |
| Performance | Vitest | every push at 1x, nightly at 5x | Filters, queries, reports and imports stay fast with 50k contacts and 25k deals |
| End-to-end | Playwright | every push on Chromium, Firefox, WebKit and mobile | Real user flows and role restrictions through the UI and the in-browser data layer |
| Flake hunt | Playwright `--repeat-each=5` | nightly | Tests that pass only sometimes |
| Static security | CodeQL | every push, weekly | XSS and injection patterns |

Coverage thresholds (CI fails below): 85% lines, functions and statements; 75% branches, on `src/core`, `src/utils`, `src/ai` and `src/config`.

## Running

```bash
npm test                          # unit
npm run test:coverage             # unit + coverage report in coverage/
STRESS_SCALE=10 npm run test:stress
npm run build && npm run test:e2e
npx playwright test --ui          # interactive debugging
npx playwright test --repeat-each=10 --project=chromium   # local flake hunt
```

## Role restriction tests (§9 definition of done)

- `tests/unit/permissions.test.js`: Finance reads contract values; GTM and Delivery cannot, through the API; forbidden writes are dropped or rejected.
- `tests/e2e/auth-roles.spec.js`: the same checks through the browser, plus admin-only pages.

## Writing tests

- Put new rules in `src/core` and test them in `tests/unit`. Use `setup()` from `tests/unit/helpers.js` for a seeded store with a fixed clock (`NOW`).
- E2E tests import `test` from `tests/e2e/fixtures.js`, which fails any test that throws an uncaught page error and blocks the external CDN.
- Prefer role and label locators (`getByRole`, `getByLabel`) over CSS selectors.
