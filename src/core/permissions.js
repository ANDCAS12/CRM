/**
 * @file Role-based access rules from build prompt §3.
 * Every rule lives here so the API (not the UI) is what enforces access.
 */
import { DELIVERY_VISIBLE_STAGES, RESTRICTED_FIELDS } from '../config/constants.js';
import { clone } from '../utils/object.js';

/** Roles allowed to read contract values, bill rates, cost rates and margins (F-04). */
export const canSeeRestricted = (role) => role === 'admin' || role === 'finance';

/** Only admins read the audit log and manage users (§3). */
export const isAdmin = (user) => user?.role === 'admin';

/** Record types each role may create or edit (besides per-record checks below). */
const EDITABLE_TYPES = Object.freeze({
  gtm: ['deal', 'company', 'contact', 'task', 'note', 'call', 'dealContact', 'savedView', 'aiOutput'],
  delivery: ['contract', 'placement', 'note', 'task', 'savedView', 'aiOutput'],
  finance: [], // Finance is read-only
});

/** Contract fields Delivery may change ("contract dates", §3). */
const DELIVERY_CONTRACT_FIELDS = Object.freeze(['effectiveDate', 'endDate', 'noticeDays', 'autoRenew', 'status']);

/**
 * Whether a user may see a record at all.
 * @param {{role:string}|null} user
 * @param {string} type record type
 * @param {object} record
 */
export function canSeeRecord(user, type, record) {
  if (!user) return false; // signed-out users see nothing
  if (type === 'deal' && user.role === 'delivery') return DELIVERY_VISIBLE_STAGES.includes(record.stage); // contracting and won only
  return true;
}

/**
 * Whether a user may create (record = null) or edit a record of this type.
 * @param {{id:string, role:string}|null} user
 * @param {string} type
 * @param {object|null} record
 */
export function canEdit(user, type, record) {
  if (!user) return false;
  if (user.role === 'admin') return true; // admins edit everything
  if (user.role === 'finance') return false; // finance edits nothing
  if (user.role === 'gtm' && type === 'deal') {
    if (!record) return true; // GTM can create deals
    return record.ownerId === user.id || (record.collaborators || []).includes(user.id); // own and shared deals only
  }
  if (user.role === 'delivery' && type === 'contract') return Boolean(record); // edit existing contracts, never create
  return (EDITABLE_TYPES[user.role] || []).includes(type);
}

/**
 * Field-level edit rule, applied on top of canEdit.
 * @param {{role:string}} user
 * @param {string} type
 * @param {string} field
 */
export function fieldEditable(user, type, field) {
  if (user.role === 'admin') return true;
  if ((RESTRICTED_FIELDS[type] || []).includes(field) && !canSeeRestricted(user.role)) return false; // cannot write what you cannot read
  if (user.role === 'delivery' && type === 'contract') return DELIVERY_CONTRACT_FIELDS.includes(field);
  return true;
}

/**
 * Returns a copy of the record with restricted fields removed for this user.
 * Mirrors the production rule: API responses must not include hidden fields.
 * @returns {object} copy; `__hidden` lists stripped field names so the UI can say "Restricted"
 */
export function scrub(user, type, record) {
  const copy = clone(record); // never hand views the stored object
  if (type === 'user') {
    delete copy.passwordHash; // credentials never leave the data layer
    delete copy.salt;
    if (user.role !== 'admin') delete copy.inviteToken; // only admins can see and share invite links
  }
  if (!canSeeRestricted(user.role)) {
    for (const field of RESTRICTED_FIELDS[type] || []) {
      if (field in copy) {
        delete copy[field]; // remove the value entirely, not just blank it
        copy.__hidden = [...(copy.__hidden || []), field];
      }
    }
  }
  return copy;
}
