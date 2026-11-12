/**
 * @file Name lookups by id. Pure functions over the dataset.
 */

/** Finds an item by id in a list (null-safe). */
const byId = (list, id) => (id ? (list || []).find((x) => x.id === id) : undefined);

/** User display name; integrations show as "Fireflies". */
export const userName = (state, id) => (id === 'system' ? 'Fireflies' : byId(state.users, id)?.name || '—');
export const firstName = (state, id) => userName(state, id).split(' ')[0];
export const companyName = (state, id) => byId(state.companies, id)?.name || '';
export const contactName = (state, id) => byId(state.contacts, id)?.name || '';
export const dealName = (state, id) => byId(state.deals, id)?.name || '';
export const contractName = (state, id) => byId(state.contracts, id)?.name || '';

/** Name resolver by record type, used by generic links. */
export function recordName(state, type, id) {
  const fn = { deal: dealName, company: companyName, contact: contactName, contract: contractName }[type];
  return fn ? fn(state, id) : '';
}

/** Finds a user by email or (case-insensitive) name or name prefix — used by importers. */
export function findUser(state, value) {
  const v = String(value || '')
    .toLowerCase()
    .trim();
  if (!v) return null;
  return state.users.find((u) => u.email === v || u.name.toLowerCase() === v || u.name.toLowerCase().startsWith(v)) || null;
}

/** Finds a company by exact name or domain (case-insensitive). */
export function findCompany(state, value) {
  const v = String(value || '')
    .toLowerCase()
    .trim();
  if (!v) return null;
  return state.companies.find((c) => c.name.toLowerCase() === v || (c.domain && c.domain === v)) || null;
}
