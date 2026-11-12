# Feature map

Each feature, the build prompt story it implements, and where it lives. "Tutorial" marks features whose design follows the two HubSpot setup tutorials supplied in v2. A tutorial feature was added **only** when the build prompt already includes it.

## Build prompt MVP stories

| ID | Feature | Code |
| --- | --- | --- |
| A-01..A-04 | Dashboard: pipeline bar, recent activity, my tasks, my deals / whole team | `ui/views/dashboard.js`, `core/reports.js` |
| B-01 | Kanban board with drag and drop | `ui/views/deals.js` |
| B-02 | Create, edit, clone, archive; inline editing on board, table and record | `ui/actions.js`, `ui/views/deals.js`, `ui/components/propertiesPanel.js` |
| B-03 | Table with sort and bulk edit | `ui/views/deals.js` |
| B-04 | Three pipelines | `config/constants.js` |
| B-05 | Deal page with AI summary, timeline, contacts, company, contracts, folder | `ui/views/dealRecord.js` |
| B-06 | Stage history and time in stage | `core/api.js`, `core/deals.js` |
| B-07 | Close requires reason and competitor | `core/deals.js#validateDeal` |
| B-08 | Source and referring partner | `config/fields.js` |
| B-09 | Every open deal has a dated next step | `core/deals.js#validateDeal`, `ui/actions.js#moveStage` |
| C-01..C-04 | Companies, company page, duplicate domain warning, PE sponsor | `ui/views/companies.js` |
| D-01..D-03 | Contacts, buying role per deal, CSV import with mapping | `ui/views/contacts.js`, `core/importer.js` |
| E-01..E-04 | Rich-text notes, tasks, reminders, logged meetings | `ui/components/composer.js` |
| F-01..F-04 | Contracts, matrix import, 30/60/90 alerts, restricted values | `ui/views/contracts.js`, `core/permissions.js` |
| H-01..H-04 | Fireflies matching, unmatched inbox, calls on timeline, always-on summary | `core/matching.js`, `ui/views/calls.js`, `ai/summary.js` |
| I-01 | AI output saved with sources | `ai/summary.js` |
| J-01 | SharePoint folder link and file list (stub) | `ui/components/filesCard.js` |
| L-01..L-06 | Search, filters, saved views, export, reports, forecast | `ui/shell.js`, `core/query.js`, `core/reports.js` |
| M-01, M-02 | HubSpot importer, backups and full export | `core/importer.js`, `ui/views/admin.js` |
| Access | Login, roles, field restrictions, audit log, user management | `core/auth.js`, `core/permissions.js`, `core/api.js` |

## Added from the HubSpot tutorials (in scope)

| Tutorial feature | Story it extends | Code |
| --- | --- | --- |
| List views as tabs, filters, sort, search, frozen first column | D, C, L-01..L-03 | `ui/components/listView.js`, `core/query.js` |
| Filter builder with conditions (is, contains, is known, in the last N days…) | L-02 | `core/query.js#OPERATORS` |
| Record layout: key properties, quick actions (note, task, log call), About and Activities tabs, associations on the right | B-05, C-02, D-01 | `ui/components/recordLayout.js` |
| Activity type filters on the timeline, including property changes | B-05, E | `ui/components/timeline.js` |
| “View all properties” panel with search, groups, inline edit; read-only auto fields | B-02, D-01 | `ui/components/propertiesPanel.js` |
| Contact owner can be left empty (“No owner”) | D-01 | `config/fields.js` |
| Contact linked to a company automatically by email domain | D-01 | `ui/actions.js#contactForm`, `core/importer.js` |
| Add existing contacts to a company; “View associated contacts” | C-02 | `ui/views/companies.js` |
| Inline editing of company and contact properties in the list | B-02 pattern, C, D | `ui/components/listView.js` |
| Import: example file, mapping check, create vs create-and-update, “don’t overwrite”, import name, contacts and companies in one file with associations, summary of created / updated, past imports, view imported records | D-03, M-01 | `core/importer.js`, `ui/components/importDialog.js` |
| Collapsible board columns that keep their count, board search | B-01 | `ui/views/deals.js` |
| Users summary, pending invites with an invite code, revoke | Access | `ui/views/admin.js`, `core/auth.js` |

## From the tutorials, deliberately left out

| Tutorial feature | Why |
| --- | --- |
| Marketing emails, templates, campaigns, sequences | Out of scope (handled by Mega Impacts) |
| Connect inbox, send one-to-one email, Gmail extension | Email logging is V2; sending is not in the prompt |
| Calendar connection, meeting scheduling links | Not in the prompt; E-04 covers manual logging only |
| Custom properties, editing pipeline stages | Config UI for stages and fields is V2 |
| Lifecycle stage, lead status, deal type | Not in the §4 data model |
| Tickets and help desk | Not in the prompt |
| Forms, landing pages, workflows, Breeze AI | Not in the prompt |
| Bookmarks in navigation | Not in the prompt |
| AI summary on contacts | Prompt specifies AI summaries for deals only |
