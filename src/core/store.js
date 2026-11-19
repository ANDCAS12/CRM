/**
 * @file Persistence layer. The store owns the dataset and knows nothing about roles.
 * Storage is injected so tests use memory and the browser uses localStorage.
 */
import {
  INDUSTRIES,
  RETIRED_PRESET_VIEWS,
  SERVICE_OPTIONS,
  SERVICE_SEP,
  LEGACY_PIPELINE_MAP,
  LEGACY_STAGE_MAP,
  PIPELINES,
  SCHEMA_VERSION,
  STAGE_PROBABILITY,
  USER_STATUS,
} from '../config/constants.js';
import { mapIndustry } from './industries.js';

/** Default probabilities of the pre-Central-Kitchen stages, used to spot untouched probabilities. */
const LEGACY_PROBABILITY = { Lead: 10, Qualified: 20, Discovery: 30, 'Solution design': 40, 'Proposal sent': 60, 'Negotiation and contracting': 80 };

/** In-memory Storage-compatible adapter for tests and when localStorage is blocked. */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * Upgrades older saved data to the current schema without losing records.
 * Each step is idempotent so it is safe to run on every load.
 * @param {object} state
 * @returns {object} the same object, migrated in place
 */
export function migrate(state) {
  const arrays = [
    'users',
    'companies',
    'contacts',
    'deals',
    'dealContacts',
    'contracts',
    'placements',
    'calls',
    'notes',
    'tasks',
    'activities',
    'aiOutputs',
    'savedViews',
    'dashboards',
    'reports',
    'audit',
    'imports',
  ];
  for (const key of arrays) if (!Array.isArray(state[key])) state[key] = []; // missing collections become empty
  state.settings = state.settings || {};
  state.prefs = state.prefs || {}; // per-user preferences, e.g. default dashboard (L-14)
  for (const u of state.users) {
    if (!u.status) u.status = u.active === false ? USER_STATUS.DEACTIVATED : USER_STATUS.ACTIVE; // v1 used a boolean
    delete u.active;
  }
  for (const v of state.savedViews) if (!v.objectType) v.objectType = 'deal'; // v1 views were deals-only
  // v3 (Central Kitchen): HubSpot stage names and two pipelines.
  for (const d of state.deals) {
    const oldStage = d.stage;
    if (LEGACY_STAGE_MAP[oldStage]) d.stage = LEGACY_STAGE_MAP[oldStage]; // e.g. Lead -> Suspect
    if (d.probability === LEGACY_PROBABILITY[oldStage]) d.probability = STAGE_PROBABILITY[d.stage]; // keep hand-edited probabilities
    if (LEGACY_PIPELINE_MAP[d.pipeline]) d.pipeline = LEGACY_PIPELINE_MAP[d.pipeline]; // Staff augmentation -> Data Science as a Service
    if (!PIPELINES.includes(d.pipeline)) d.pipeline = 'Consulting projects'; // anything else joins the main pipeline
    for (const h of d.stageHistory || []) if (LEGACY_STAGE_MAP[h.stage]) h.stage = LEGACY_STAGE_MAP[h.stage];
    if (d.dealType === undefined) d.dealType = '';
    if (d.priority === undefined) d.priority = '';
  }
  for (const v of state.savedViews) {
    if (v.filters?.stage && LEGACY_STAGE_MAP[v.filters.stage]) v.filters.stage = LEGACY_STAGE_MAP[v.filters.stage];
    if (LEGACY_PIPELINE_MAP[v.pipeline]) v.pipeline = LEGACY_PIPELINE_MAP[v.pipeline];
    if (v.pipeline && v.pipeline !== 'All' && !PIPELINES.includes(v.pipeline)) v.pipeline = 'All';
  }
  // v4 (Nov 18 brief): service lines by category, the 11 IK industries, task types, no preset views.
  for (const d of state.deals) {
    if (!Array.isArray(d.serviceLines)) {
      const old = String(d.serviceLine || '').toLowerCase();
      const match = SERVICE_OPTIONS.find((v) => old && v.split(SERVICE_SEP)[1].toLowerCase() === old); // exact service names carry over
      d.serviceLines = match ? [match] : old.includes('science as a service') || old === 'dsaas' ? ['Operational AI › DSaaS'] : [];
      if (!match && d.serviceLine && !d.serviceLines.length) d.serviceLineLegacy = d.serviceLine; // kept, never lost
      delete d.serviceLine;
    }
  }
  for (const c of state.companies) {
    if (c.industry && !INDUSTRIES.includes(c.industry)) {
      const mapped = mapIndustry(c.industry);
      if (!mapped && !c.subIndustry) c.subIndustry = c.industry; // unmapped value moves to sub-industry
      c.industry = mapped;
    }
  }
  for (const t of state.tasks) if (!t.type) t.type = 'To-do';
  state.savedViews = state.savedViews.filter((v) => !RETIRED_PRESET_VIEWS.includes(v.id)); // L-03: All and My, plus custom
  if (state.settings) {
    delete state.settings.industries;
    delete state.settings.serviceLines;
  }
  state.version = SCHEMA_VERSION;
  return state;
}

/**
 * Creates the store.
 * @param {{storage: Storage, key: string, seed: () => object}} options
 */
export function createStore({ storage, key, seed }) {
  let state = null;
  const snapKey = `${key}.snap`; // snapshot lives beside the live data

  /** Writes the dataset; returns false when storage is full or unavailable. */
  function save() {
    try {
      storage.setItem(key, JSON.stringify(state));
      return true;
    } catch {
      return false; // quota exceeded or private mode: keep working in memory
    }
  }

  /** Loads saved data, or seeds a fresh dataset on first run or corrupt data. */
  function load() {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        state = migrate(JSON.parse(raw));
        return state;
      }
    } catch {
      /* corrupt JSON falls through to a fresh seed */
    }
    state = migrate(seed());
    save();
    return state;
  }

  return {
    load,
    save,
    /** Current dataset (mutable; only the API should write to it). */
    get state() {
      return state;
    },
    /** Replaces the whole dataset (restore, reset). */
    replace(next) {
      state = migrate(next);
      save();
    },
    /** Discards all data and reloads the seed. */
    reset() {
      state = migrate(seed());
      save();
    },
    /** Stores a full copy for manual restore (stands in for nightly backups, M-02). */
    snapshot() {
      storage.setItem(snapKey, JSON.stringify(state));
    },
    hasSnapshot: () => Boolean(storage.getItem(snapKey)),
    /** Restores the last snapshot; returns false when none exists. */
    restoreSnapshot() {
      const raw = storage.getItem(snapKey);
      if (!raw) return false;
      state = migrate(JSON.parse(raw));
      save();
      return true;
    },
  };
}
