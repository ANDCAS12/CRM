/**
 * @file Persistence layer. The store owns the dataset and knows nothing about roles.
 * Storage is injected so tests use memory and the browser uses localStorage.
 */
import { SCHEMA_VERSION, USER_STATUS } from '../config/constants.js';

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
    'audit',
    'imports',
  ];
  for (const key of arrays) if (!Array.isArray(state[key])) state[key] = []; // missing collections become empty
  state.settings = state.settings || {};
  for (const u of state.users) {
    if (!u.status) u.status = u.active === false ? USER_STATUS.DEACTIVATED : USER_STATUS.ACTIVE; // v1 used a boolean
    delete u.active;
  }
  for (const v of state.savedViews) if (!v.objectType) v.objectType = 'deal'; // v1 views were deals-only
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
