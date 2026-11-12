/**
 * @file The only read/write path for views. Applies visibility, field restrictions,
 * validation hooks, stage history and audit logging on every call — the same contract
 * the production server must enforce on every API response (§3, §9).
 */
import { COLLECTIONS, LABELS, RESTRICTED_FIELDS, STAGE_PROBABILITY } from '../config/constants.js';
import { canEdit, canSeeRecord, canSeeRestricted, fieldEditable, scrub } from './permissions.js';
import { NotFoundError, PermissionError } from './errors.js';
import { sameValue, uid } from '../utils/object.js';

/** Max audit entries kept client-side; production keeps all rows in Postgres. */
const AUDIT_CAP = 20_000;

/** Fields whose values must never be written to the audit log. */
const SECRET_FIELDS = new Set(['passwordHash', 'salt', 'inviteToken']);

/** Converts any value to the string form stored in the audit log. */
const auditValue = (v) => {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

/**
 * Creates an API bound to a store and the current session.
 * @param {{ store: {state: object, save: () => boolean}, getUser: () => object|null, now?: () => Date }} deps
 */
export function createApi({ store, getUser, now = () => new Date() }) {
  const state = () => store.state; // always read the live dataset
  const nowISO = () => now().toISOString();
  const actorId = () => getUser()?.id || 'system'; // integrations act as "system"

  /** Appends one audit row: who changed what, old value, new value, when (§3). */
  function audit(action, type, id, field = '', oldValue = '', newValue = '') {
    const log = state().audit;
    const secret = SECRET_FIELDS.has(field); // record that a secret changed, never its value
    log.unshift({
      id: uid('au_'),
      at: nowISO(),
      userId: actorId(),
      action,
      entity: type,
      entityId: id,
      field,
      old: secret ? '[redacted]' : auditValue(oldValue),
      new: secret ? '[redacted]' : auditValue(newValue),
    });
    if (log.length > AUDIT_CAP) log.length = AUDIT_CAP; // bound browser storage
  }

  /** Adds a dashboard/timeline activity row (A-02). */
  function logActivity(kind, { dealId = '', companyId = '', contactId = '', text = '' } = {}) {
    state().activities.unshift({ id: uid('a_'), kind, text, dealId, companyId, contactId, by: actorId(), at: nowISO() });
  }

  /** Raw stored record, bypassing visibility. Internal and lookup use only. */
  function raw(type, id) {
    return (state()[COLLECTIONS[type]] || []).find((r) => r.id === id) || null;
  }

  /** Throws unless the current user may write this record. */
  function assertCanEdit(type, record) {
    if (!canEdit(getUser(), type, record)) {
      throw new PermissionError(`Your role can’t ${record ? 'edit this' : 'create'} ${LABELS[type].toLowerCase()}${record ? '' : 's'}.`);
    }
  }

  return {
    audit,
    logActivity,
    raw,

    /**
     * All visible records of a type, with restricted fields removed.
     * @param {string} type
     * @param {{includeArchived?: boolean}} [opts]
     */
    all(type, { includeArchived = false } = {}) {
      const user = getUser();
      return (state()[COLLECTIONS[type]] || [])
        .filter((r) => (includeArchived || !r.archived) && canSeeRecord(user, type, r)) // hide archived and out-of-scope rows
        .map((r) => scrub(user, type, r)); // strip restricted fields per role
    },

    /** One visible record, scrubbed, or null when missing or not visible. */
    get(type, id) {
      const r = raw(type, id);
      return r && canSeeRecord(getUser(), type, r) ? scrub(getUser(), type, r) : null;
    },

    /**
     * Creates a record and writes an audit entry.
     * @param {string} type
     * @param {object} data
     * @param {{system?: boolean, persist?: boolean}} [opts] system: integration/import write that skips role checks
     */
    create(type, data, { system = false, persist = true } = {}) {
      if (!system) assertCanEdit(type, null);
      const user = getUser();
      const record = { id: uid(`${type.slice(0, 2)}_`), createdAt: nowISO(), createdBy: actorId(), ...data };
      if (!system && user && !canSeeRestricted(user.role)) {
        for (const f of RESTRICTED_FIELDS[type] || []) delete record[f]; // cannot write hidden fields
      }
      if (type === 'deal') {
        record.stageHistory = record.stageHistory || [{ stage: record.stage, at: record.createdAt, by: record.createdBy }]; // B-06 starts at creation
        if (record.probability === undefined || record.probability === '') record.probability = STAGE_PROBABILITY[record.stage];
        record.collaborators = record.collaborators || [];
        record.archived = false;
      }
      state()[COLLECTIONS[type]].push(record);
      audit('create', type, record.id, '', '', record.name || record.title || '');
      if (type === 'deal') logActivity('created', { dealId: record.id, companyId: record.companyId, text: 'created the deal' });
      if (persist) store.save(); // bulk imports pass persist:false and save once at the end
      return record;
    },

    /**
     * Updates fields, skipping no-ops and fields the user may not edit. Each changed field is audited.
     * @returns {object} the stored record
     */
    update(type, id, patch, { system = false, persist = true } = {}) {
      const record = raw(type, id);
      if (!record) throw new NotFoundError();
      if (!system) assertCanEdit(type, record);
      const user = getUser();
      for (const [field, next] of Object.entries(patch)) {
        if (!system && !fieldEditable(user, type, field)) continue; // silently drop forbidden fields (server does the same)
        const prev = record[field];
        if (sameValue(prev, next)) continue; // no-op: no audit noise
        if (type === 'deal' && field === 'stage') {
          record.stageHistory = record.stageHistory || [];
          record.stageHistory.push({ stage: next, at: nowISO(), by: actorId() }); // B-06 stage history
          if (!('probability' in patch)) record.probability = STAGE_PROBABILITY[next]; // reset to stage default
          logActivity('stage', { dealId: record.id, companyId: record.companyId, text: `moved to ${next}` });
        }
        record[field] = next;
        audit('update', type, id, field, prev, next);
      }
      if (persist) store.save();
      return record;
    },

    /** Deletes a record and audits it. */
    remove(type, id) {
      const record = raw(type, id);
      if (!record) return;
      assertCanEdit(type, record);
      const key = COLLECTIONS[type];
      state()[key] = state()[key].filter((r) => r.id !== id);
      audit('delete', type, id, '', record.name || record.title || '', '');
      store.save();
    },
  };
}
