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
    expect(store.load().users.length).toBe(6); // Russell, Cristina, Rod, Alejandro, Shadi, Andrés
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

describe('migrate to Central Kitchen (v3)', () => {
  it('maps old stages, probabilities and pipelines forward', () => {
    const out = migrate({
      deals: [
        { id: 'a', stage: 'Lead', probability: 10, pipeline: 'Partner-sourced', stageHistory: [{ stage: 'Lead' }] },
        { id: 'b', stage: 'Negotiation and contracting', probability: 55, pipeline: 'Staff augmentation', stageHistory: [] }, // renamed pipeline
        { id: 'c', stage: 'Proposal sent', probability: 60, pipeline: 'Consulting projects' },
      ],
      savedViews: [{ id: 'v', filters: { stage: 'Discovery' }, pipeline: 'Partner-sourced' }],
    });
    expect(out.deals[0]).toMatchObject({ stage: 'Suspect', probability: 10, pipeline: 'Consulting projects', dealType: '', priority: '' });
    expect(out.deals[0].stageHistory[0].stage).toBe('Suspect');
    expect(out.deals[1]).toMatchObject({ stage: 'Contract Sent', probability: 55, pipeline: 'Data Science as a Service' }); // hand-edited probability kept
    expect(out.deals[2].probability).toBe(40); // old default 60% becomes the new Proposal sent default
    expect(out.savedViews[0]).toMatchObject({ filters: { stage: 'Prospect' }, pipeline: 'Consulting projects' });
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
    expect(out.version).toBe(3);
  });
});
