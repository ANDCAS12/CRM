// Stress tests on a large synthetic dataset: core operations must stay fast at production scale.
import { describe, expect, it } from 'vitest';
import { createLargeSeed } from '../../src/core/seed.js';
import { filterDeals } from '../../src/core/deals.js';
import { runQuery } from '../../src/core/query.js';
import { forecastByMonth, groupPipeline, pipelineSummary } from '../../src/core/reports.js';
import { getPreset, guessMapping, runImport } from '../../src/core/importer.js';
import { NOW, setup } from './helpers.js';

/** Scale is configurable so CI can run a heavier nightly job (STRESS_SCALE=5). */
const SCALE = Number(process.env.STRESS_SCALE || 1);
/** 100x = 1M contacts and 500k deals, far beyond what the browser prototype can store. Above that the test only measures the machine. */
const MAX_SCALE = 100;
if (!Number.isFinite(SCALE) || SCALE < 1 || SCALE > MAX_SCALE) {
  throw new Error(`STRESS_SCALE must be a number from 1 to ${MAX_SCALE} (got "${process.env.STRESS_SCALE}").`); // clear message instead of an out-of-memory crash
}
const time = (fn) => {
  const t0 = performance.now();
  const out = fn();
  return [out, performance.now() - t0];
};

describe(`performance at scale x${SCALE}`, () => {
  const t = setup(() => createLargeSeed({ companies: 1000 * SCALE, contacts: 10000 * SCALE, deals: 5000 * SCALE }, NOW), { persist: false });
  it('filters thousands of deals quickly', () => {
    const deals = t.api.all('deal');
    const [out, ms] = time(() => filterDeals(t.state, deals, { openOnly: true, minAmt: 100000, q: 'load' }, 'All', NOW));
    expect(out.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500 * SCALE);
  });
  it('queries tens of thousands of contacts quickly', () => {
    const [out, ms] = time(() =>
      runQuery(
        t.state.contacts,
        { search: 'contact 99', filters: [{ field: 'function', op: 'is', value: 'Data' }], sort: { field: 'name', dir: 1 } },
        {},
        ['name', 'email'],
        NOW,
      ),
    );
    expect(out.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500 * SCALE);
  });
  it('computes reports quickly', () => {
    const [, ms] = time(() => {
      pipelineSummary(t.state.deals, NOW);
      groupPipeline(t.state.deals, (d) => d.ownerId);
      forecastByMonth(t.state.deals, NOW);
    });
    expect(ms).toBeLessThan(500 * SCALE);
  });
  it('imports 5,000 contact rows with indexes', () => {
    const headers = ['Email', 'Name', 'Company Name', 'Company Domain Name'];
    const rows = Array.from({ length: 5000 }, (_, i) => [`bulk${i}@bulk${i % 200}.io`, `Bulk ${i}`, `Bulk Co ${i % 200}`, `bulk${i % 200}.io`]);
    const preset = getPreset('contactsCompanies');
    const [r, ms] = time(() =>
      runImport({ api: t.api, store: t.store, user: t.user, presetKey: 'contactsCompanies', headers, rows, mapping: guessMapping(preset, headers), now: NOW }),
    );
    expect(r.created).toBe(5200); // 5000 contacts + 200 companies
    expect(ms).toBeLessThan(5000 * SCALE);
  });
});
