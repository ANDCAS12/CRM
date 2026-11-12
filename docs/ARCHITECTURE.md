# Architecture

## Layers

```
ui/ (DOM)  ──►  core/api.js  ──►  core/store.js  ──►  localStorage (prototype) / Postgres (production)
                    │
                    ├─ core/permissions.js   who may see and change what
                    ├─ core/deals.js, query.js, reports.js, matching.js, importer.js   pure business rules
                    └─ audit log on every write
```

1. **Views never touch the dataset directly.** They read through `api.all/get` and write through `api.create/update/remove`. This mirrors the production rule that the server enforces access on every API response.
2. **Restricted fields are removed, not hidden.** `permissions.scrub()` deletes contract values, rates and margins for roles without access before a record reaches any view. Password hashes never leave the data layer.
3. **Business rules are pure functions** in `src/core` with no DOM, so they run in Node tests and can move to server routes unchanged.
4. **Every write is audited** with user, field, old value and new value. Secret fields are recorded as `[redacted]`.
5. **One definition per field** (`config/fields.js`) drives forms, the properties panel, list columns and filters.

## Moving to production

| Prototype module | Production equivalent |
| --- | --- |
| `core/store.js` | Prisma client over PostgreSQL |
| `core/api.js` | Next.js route handlers calling the same permission and validation functions |
| `core/auth.js` | Auth.js (credentials now, Microsoft Entra later) |
| `platform/capabilities.js` sample | Anthropic API, model `claude-sonnet-5-5`, server-side |
| `ui/views/calls.js` sync | Background job polling the Fireflies GraphQL API plus webhook |
| `ui/components/filesCard.js` | Microsoft Graph, read-only |

`core/permissions.js`, `core/deals.js`, `core/query.js`, `core/reports.js`, `core/matching.js` and `core/importer.js` can be reused as-is on the server.

## Data migrations

`store.migrate()` upgrades saved data on every load and is idempotent. Bump `SCHEMA_VERSION` in `config/constants.js` when the shape changes and add a step to `migrate()` with a unit test.

## Security notes

- All interpolated text goes through `esc()`; user-facing messages use `textContent`.
- Rich-text notes are sanitised with an allow-list (`ui/dom.js#sanitizeHtml`) before storage.
- Invite codes are never put in URLs (they would leak through history and shared links).
- The build inlines everything; the only external script is SheetJS from cdnjs, pinned to 0.18.5.
