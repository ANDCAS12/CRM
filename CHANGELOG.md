# Changelog

## 3.2.0 — Nov 18 review

The ten changes from the Nov 18 review, against the Nov 18 Feature List and Build Brief.

### Added
- **Tasks page (E-08)** in the navigation: All and My tasks plus saved views; quick views all, due today, overdue and upcoming; filters for assigned to, task type, due date and linked record. Tasks have a type (call, email, to-do) and can link to a deal, company, contact or contract (E-02).
- **Dashboards (L-12 to L-14)** replace Reports: default dashboards (Pipeline; Funnel and sources, V2; Revenue; Marketing return, V3), custom dashboards from scratch or a template, a report builder (object, measure, grouping, second grouping, filters, chart type: KPI, bar, line, table, funnel) with live preview, a reports library, dashboard filters (date range, owner, pipeline, source), a default dashboard per person, private or team sharing, and CSV export. Reports respect role rules and restricted fields.
- Company fields: city, state, postal code, description and LinkedIn page, also read from HubSpot. "Fill with Claude" appears in the New company dialog, labelled V2 (C-08).
- "Internal" deal source (B-08); sort deals by owner (B-03).
- HubSpot task types; HubSpot industries mapped onto the 11 IK industries.

### Changed
- **Service lines** are a multi-select of category › service: Business Consulting, Operational AI (incl. DSaaS) and AI Realization.
- **Industries** are the 11 IK industries.
- **Every deal needs a company and a primary contact** (B-02). The HubSpot import skips deals missing either and says why, so owners link them first (M-01); an unknown contact email is created and flagged.
- **Close years** start at 2025, with future years as deals are created and an All option (A-04, L-02).
- **Saved views:** every list (deals, companies, contacts, contracts, tasks) opens on All and My, plus custom views. Preset views, including "Data leaders", are removed (L-03).
- Saved data migrates automatically (schema v4): service lines and industries are mapped, unmatched values kept, tasks get a type, preset views removed.

### Removed
- The old Reports page and its chart helpers, replaced by Dashboards.

## 3.1.0 — Review against the build brief and walkthrough

### Added
- Referring contact on deals (B-08: "referring partner or contact").
- Billing schedule on contracts (slide 19), also read by the contract matrix import.
- HubSpot "emails, calls and meetings" import: calls and meetings join the record timeline, emails become notes (slide 21, M-01).
- Emails tab on contacts and Placements tab on contracts, labelled V2 (slides 11 and 12).

### Fixed
- Archive and restore are back on the deal page (B-02).
- The service line filter matches free text ("contains") now that service line is typed, not picked.
- Ask Claude's example question says DSaaS instead of staff augmentation.
- Moving a deal from Partners to Suspect reminds that partner deals usually go to Prospect.

## 3.0.0 — Central Kitchen

Built from Cristina Frieri's Central Kitchen Build Brief (Nov 13, 2026) and her walkthrough the same day.

### Changed
- Renamed the app to **Central Kitchen**.
- Deal stages now match IK's HubSpot pipeline one to one: On Hold (1%), Partners (1%), Suspect (10%), Prospect (20%), Proposal sent (40%), Verbal Approval (80%), Contract Sent (90%), Closed won, Closed lost. Each stage shows Cristina's definition as help.
- Two pipelines: **Consulting projects** and **Data Science as a Service** (renamed from staff augmentation). Partner deals use the Partners stage.
- Service line and win/loss reason are free text; service line suggests common values.
- "Average deal age" is the mean number of days from creation to close for closed deals in view.
- Redesigned every MVP screen to the brief's mockups: app shell with "+ Create" and "Ask Claude", Home, Deals board and table, deal, company, contact and contract records, calls inbox.
- Admin became **Settings**, with an account section for every role.
- Older saved data migrates automatically to the new stages and pipelines.

### Added
- Deal type (New business, Existing business) and priority (Low, Medium, High).
- Deals summary bar (B-14), saved views as tabs (e.g. "2026 Pipeline"), quick filters, close-year filter (A-04), column totals and weighted amounts.
- Deal page: stage progress with days in stage, Close won / Close lost buttons, summary written automatically on first visit.
- Company relationship snapshot: working together since, deals won, open deals, contracts.
- Calls inbox: suggested match with Confirm, inline assignment, and "Create task" for each action item.
- HubSpot importer: parses "Company_Opp NNN_Description", skips the Test Pipeline, maps deal type, priority and won/lost reasons, turns the description into the first note, maps company lifecycle, ICP tier and revenue, and moves contact buying roles onto each deal.
- Demo users are the real team: Russell Halper, Cristina Frieri, Rod, Alejandro Samudio, Shadi Fares, plus Andrés Castiblanco.
- Placeholders labelled V2/V3: Placements, Ask Claude actions, weekly brief, invoices, MGI research.

## 2.1.0

### Added
- Hosting on GitHub Pages at https://andcas12.github.io/CRM/, deployed automatically from `main` after unit tests pass.
- Exports and import templates download as normal browser files when the app runs outside Claude.

### Fixed
- Nightly stress run crashed with "JavaScript heap out of memory" when started with a very large scale (around 300×). Scale and repeat are now dropdowns, the test rejects values above 100 with a clear message, stress tests no longer keep a serialised copy of the dataset, and the job allows 6 GB of memory.

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
