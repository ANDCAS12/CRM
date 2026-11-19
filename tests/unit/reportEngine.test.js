import { describe, expect, it } from 'vitest';
import { DEFAULT_DASHBOARDS, REPORT_TEMPLATES, exportDashboardRows, filterRecords, groupValues, labelFor, runReport } from '../../src/core/reportEngine.js';
import { NOW, setup } from './helpers.js';

const t = setup();
const deals = t.state.deals;
const run = (report, dash) => runReport(t.state, deals, { thenBy: '', filters: [], ...report }, dash, NOW);

describe('report engine (L-13)', () => {
  it('sums amount by stage in pipeline order', () => {
    const r = run({ object: 'deal', measure: 'sum:amount', groupBy: 'stage', filters: [{ field: 'status', value: 'Open' }] });
    const order = ['On Hold', 'Partners', 'Suspect', 'Prospect', 'Proposal sent', 'Verbal Approval', 'Contract Sent'];
    expect(r.rows.map((x) => x.key)).toEqual(order.filter((s) => r.rows.some((x) => x.key === s)));
    expect(r.total).toBe(deals.filter((d) => !/^Closed/.test(d.stage)).reduce((a, d) => a + d.amount, 0));
    expect(r.money).toBe(true);
  });
  it('counts, averages and weighted sums', () => {
    expect(run({ object: 'deal', measure: 'count', groupBy: 'status' }).total).toBe(deals.length);
    const won = run({ object: 'deal', measure: 'avg:amount', groupBy: 'status', filters: [{ field: 'status', value: 'Won' }] });
    expect(won.rows).toEqual([expect.objectContaining({ key: 'Won', value: 480000 })]);
    const w = run({ object: 'deal', measure: 'sum:weighted', groupBy: 'pipeline' });
    expect(w.total).toBeCloseTo(deals.reduce((a, d) => a + (d.amount * d.probability) / 100, 0));
  });
  it('splits a deal across each service category it carries, with a second grouping as series', () => {
    const r = run({ object: 'deal', measure: 'count', groupBy: 'serviceCategory', thenBy: 'pipeline' });
    const cats = r.rows.map((x) => x.key);
    expect(cats).toEqual(expect.arrayContaining(['Business Consulting', 'Operational AI', 'AI Realization']));
    expect(r.series.map((s) => s.key).sort()).toEqual(['Consulting projects', 'Data Science as a Service']);
    const opAi = r.rows.find((x) => x.key === 'Operational AI');
    expect(opAi.series['Data Science as a Service']).toBe(3);
  });
  it('time groupings are chronological and labelled', () => {
    const r = run({ object: 'deal', measure: 'count', groupBy: 'closeQuarter' });
    const keys = r.rows.map((x) => x.key);
    expect([...keys].sort()).toEqual(keys);
    expect(labelFor(t.state, 'closeQuarter', '2026-Q4')).toBe('Q4 2026');
    expect(labelFor(t.state, 'closeMonth', '2026-11')).toBe('Nov 2026');
    expect(labelFor(t.state, 'ownerId', 'u_cristina')).toBe('Cristina Frieri');
  });
  it('funnel counts every stage a deal reached', () => {
    expect(
      groupValues(
        t.state,
        'deal',
        deals.find((d) => d.id === 'd_nw_fpa'),
        'reachedStage',
      ),
    ).toEqual(['Suspect', 'Prospect', 'Proposal sent']);
    const r = run({ object: 'deal', measure: 'count', groupBy: 'reachedStage' });
    const suspect = r.rows.find((x) => x.key === 'Suspect').value;
    const prospect = r.rows.find((x) => x.key === 'Prospect').value;
    expect(suspect).toBeGreaterThanOrEqual(prospect);
  });
  it('tasks by status and type', () => {
    const r = runReport(t.state, t.state.tasks, { object: 'task', measure: 'count', groupBy: 'status', thenBy: 'type', filters: [] }, {}, NOW);
    expect(r.total).toBe(t.state.tasks.length);
    expect(r.rows.map((x) => x.key)).toEqual(expect.arrayContaining(['Overdue', 'Open']));
  });
  it('dashboard filters: date range, owner, pipeline, source (L-14)', () => {
    const base = { object: 'deal', measure: 'count', groupBy: 'status', filters: [] };
    expect(filterRecords(t.state, 'deal', deals, base, { ownerId: 'u_russell' }, NOW).every((d) => d.ownerId === 'u_russell')).toBe(true);
    expect(
      filterRecords(t.state, 'deal', deals, base, { pipeline: 'Data Science as a Service' }, NOW).every((d) => d.pipeline === 'Data Science as a Service'),
    ).toBe(true);
    expect(filterRecords(t.state, 'deal', deals, base, { source: 'Internal' }, NOW).map((d) => d.id)).toEqual(['d_bright_aug']);
    const next = filterRecords(t.state, 'deal', deals, base, { range: 'next_12' }, NOW);
    expect(next.every((d) => d.expectedClose >= '2026-11-11')).toBe(true);
    expect(filterRecords(t.state, 'deal', deals, base, { range: 'last_year' }, NOW)).toEqual([]);
  });
  it('restricted values stay restricted: scrubbed contracts sum to zero', () => {
    const scrubbed = t.state.contracts.map((k) => Object.fromEntries(Object.entries(k).filter(([f]) => f !== 'totalValue'))); // what GTM receives from the API
    const r = runReport(t.state, scrubbed, { object: 'contract', measure: 'sum:totalValue', groupBy: 'type', thenBy: '', filters: [] }, {}, NOW);
    expect(r.total).toBe(0);
  });
  it('templates and default dashboards are valid reports', () => {
    for (const rep of [...REPORT_TEMPLATES, ...DEFAULT_DASHBOARDS.flatMap((d) => d.reports)]) {
      const records = rep.object === 'task' ? t.state.tasks : deals;
      expect(() => runReport(t.state, records, rep, {}, NOW)).not.toThrow();
    }
    expect(DEFAULT_DASHBOARDS.map((d) => d.name)).toEqual(['Pipeline', 'Funnel and sources', 'Revenue', 'Marketing return']);
  });
  it('exports one row per report, group and series', () => {
    const reps = [
      { name: 'KPI', object: 'deal', measure: 'count', groupBy: 'status', thenBy: '', filters: [], chart: 'kpi' },
      { name: 'By pipeline', object: 'deal', measure: 'count', groupBy: 'pipeline', thenBy: '', filters: [], chart: 'bar' },
    ];
    const rows = exportDashboardRows(t.state, () => deals, reps, {}, NOW);
    expect(rows[0]).toEqual({ Report: 'KPI', Group: 'Total', 'Then by': '', Value: deals.length });
    expect(rows.filter((r) => r.Report === 'By pipeline')).toHaveLength(2);
  });
});
