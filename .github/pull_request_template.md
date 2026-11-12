## What changed

<!-- One or two sentences. -->

## Build prompt story

<!-- e.g. B-03, D-03. Changes outside the MVP list need a note on why. -->

## Checklist

- [ ] `npm run test:all` passes locally (lint, brand, unit with coverage, build, e2e)
- [ ] New business rules live in `src/core` with unit tests
- [ ] Role restrictions still hold (Finance and GTM cannot read restricted fields via UI or API)
- [ ] Every create, edit and delete still writes an audit entry
- [ ] Only the seven IK colour tokens are used
- [ ] User-facing text is escaped with `esc()` or set with `textContent`
