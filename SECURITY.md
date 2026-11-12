# Security

Report vulnerabilities privately to the repository admins (Russell, Rod). Do not open a public issue.

Scope notes for this prototype:
- Data is stored in the browser. Do not load real client data until the production backend is in place.
- Restricted fields are enforced in the data layer (`src/core/permissions.js`); the production server must apply the same functions.
