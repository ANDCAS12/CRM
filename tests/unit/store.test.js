import { describe, expect, it } from 'vitest';
import { createMemoryStorage, createStore, migrate } from '../../src/core/store.js';
import { createSeed } from '../../src/core/seed.js';
import { NOW } from './helpers.js';

describe('store', () => {
  it('seeds on first load and persists', () => {
    const storage = createMemoryStorage();
    const store = createStore({ storage, key: 'k', seed: () => createSeed(NOW) });
    store.load();
    expect(store.state.deals.length).toBeGreaterThan(5);
    expect(JSON.parse(storage.getItem('k')).deals.length).toBe(store.state.deals.length);
  });
  it('recovers from corrupt data by reseeding', () => {
    const storage = createMemoryStorage();
    storage.setItem('k', '{not json');
    const store = createStore({ storage, key: 'k', seed: () => createSeed(NOW) });
    expect(store.load().users.length).toBe(4);
  });
  it('snapshots and restores', () => {
    const store = createStore({ storage: createMemoryStorage(), key: 'k', seed: () => createSeed(NOW) });
    store.load();
    expect(store.restoreSnapshot()).toBe(false);
    store.snapshot();
    store.state.deals.length = 0;
    expect(store.restoreSnapshot()).toBe(true);
    expect(store.state.deals.length).toBeGreaterThan(0);
  });
  it('keeps working when storage is full', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {},
    };
    const store = createStore({ storage, key: 'k', seed: () => createSeed(NOW) });
    expect(() => store.load()).not.toThrow();
    expect(store.save()).toBe(false);
  });
});

describe('migrate', () => {
  it('upgrades v1 data', () => {
    const v1 = {
      users: [
        { id: 'a', active: true },
        { id: 'b', active: false },
      ],
      savedViews: [{ id: 'v' }],
    };
    const out = migrate(v1);
    expect(out.users.map((u) => u.status)).toEqual(['active', 'deactivated']);
    expect(out.savedViews[0].objectType).toBe('deal');
    expect(Array.isArray(out.imports)).toBe(true);
    expect(out.version).toBe(2);
  });
});
