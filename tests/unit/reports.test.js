import { describe, expect, it } from 'vitest';
import { contractAlerts, forecastByMonth, forecastByQuarter, groupPipeline, pipelineSummary } from '../../src/core/reports.js';
import { NOW, setup } from './helpers.js';

describe('reports', () => {
  const { state } = setup();
  it('summary bar totals open deals only', () => {
    const s = pipelineSummary(state.deals, NOW);
    const open = state.deals.filter((d) => !d.stage.startsWith('Closed'));
    expect(s.openCount).toBe(open.length);
    expect(s.open).toBe(open.reduce((a, d) => a + d.amount, 0));
    expect(s.closing[30].count).toBeLessThanOrEqual(s.closing[60].count);
    expect(s.byStage).toHaveLength(9);
  });
  it('groups by owner, sorted by value', () => {
    const g = groupPipeline(state.deals, (d) => d.ownerId);
    expect(g[0].value).toBeGreaterThanOrEqual(g.at(-1).value);
    expect(g.reduce((a, x) => a + x.count, 0)).toBe(state.deals.filter((d) => !d.stage.startsWith('Closed')).length);
  });
  it('groups missing keys under "Not set"', () => expect(groupPipeline([{ stage: 'Lead', amount: 1, probability: 10 }], () => '')[0].label).toBe('Not set'));
  it('forecasts six months starting this month', () => {
    const f = forecastByMonth(state.deals, NOW);
    expect(f).toHaveLength(6);
    expect(f[0].key).toBe('2026-11');
    expect(f[0].weighted).toBeLessThanOrEqual(f[0].value);
  });
  it('forecasts by quarter in order', () => {
    const q = forecastByQuarter(state.deals);
    expect(q.map((x) => x.key)).toEqual([...q.map((x) => x.key)].sort());
  });
  it('contract alerts use 30/60/90 bands', () => {
    const a = contractAlerts(state.contracts, NOW);
    expect(a.map((x) => [x.contract.id, x.band])).toEqual([
      ['k_bri_sow', 30],
      ['k_harbor_nda', 60],
      ['k_nw_msa', 90],
    ]);
  });
});
