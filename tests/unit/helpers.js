// Shared test fixtures: a seeded store + API bound to a switchable user, with a frozen clock.
import { createApi } from '../../src/core/api.js';
import { createMemoryStorage, createStore } from '../../src/core/store.js';
import { createSeed } from '../../src/core/seed.js';

/** Fixed "now" so date-based assertions never flake. */
export const NOW = new Date('2026-11-11T15:00:00');

/** Builds an isolated dataset and API. `as(userId)` switches the session. */
export function setup(seedFn = () => createSeed(NOW), { persist = true } = {}) {
  // Stress tests pass persist:false: serialising millions of records to a string on every save would double memory use.
  const storage = persist ? createMemoryStorage() : { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const store = createStore({ storage, key: 'test', seed: seedFn });
  store.load();
  let user = store.state.users.find((u) => u.role === 'admin');
  const api = createApi({ store, getUser: () => user, now: () => NOW });
  return {
    store,
    api,
    get state() {
      return store.state;
    },
    as(id) {
      user = store.state.users.find((u) => u.id === id);
      return user;
    },
    get user() {
      return user;
    },
  };
}
