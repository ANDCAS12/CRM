# Changelog

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

## 1.0.0
- First MVP prototype covering build prompt stories A through M.
