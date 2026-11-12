# Changelog

## 2.1.0

### Added
- Hosting on GitHub Pages at https://andcas12.github.io/CRM/, deployed automatically from `main` after unit tests pass.
- Exports and import templates download as normal browser files when the app runs outside Claude.

## 2.0.1

### Fixed
- Dialogs no longer grow wider than a phone screen; wide tables scroll inside them (the import dialog's "Finish import" button was unreachable on phones).
- Board cards have a "Move to" stage picker, so deals can be moved on touch screens and with a keyboard (drag-and-drop doesn't work on phones).
- Search boxes record typing immediately and no longer pull focus back after a pause, which could apply stale search text.
- E2E: sign-out helper opens the phone menu first; drag test runs on desktop only, with a new picker test for every device.

## 2.0.0

### Added
- HubSpot-style list views for contacts and companies: saved view tabs, search, filter builder, sorting, frozen first column, inline editing, paging.
- Record pages with key properties, quick actions, About and Activities tabs, associations sidebar.
- "View all properties" panel with search, groups and inline editing.
- Timeline filters by activity type, including property changes for admins.
- Import: create-and-update mode, "don't overwrite", contacts and companies in one file, import names, past imports, view imported records.
- Collapsible board columns and board search.
- User summary, pending invites with invite codes, revoke.
- Test suite: 113 unit tests, 30 end-to-end tests, performance tests, CI on four browsers, nightly stress run, CodeQL.

### Changed
- Split the single file into modules with a pure, tested core.
- Passwords stored as salted hashes; secrets redacted from the audit log and exports.

### Fixed
- Rich-text sanitiser now removes unsafe tags and attributes (found by the new XSS test).
- Dialogs and the sign-in screen no longer move focus after opening, which could send fast typing to the wrong field (found by the repeated e2e run).

## 1.0.0
- First MVP prototype covering build prompt stories A through M.
