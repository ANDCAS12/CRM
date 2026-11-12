import { describe, expect, it } from 'vitest';
import { dealExportRows, filterDeals, isOpen, lastActivity, nextStepOverdue, timeInStage, validateDeal, weighted } from '../../src/core/deals.js';
import { NOW, setup } from './helpers.js';

const base = { name: 'X', companyId: 'c', stage: 'Lead', nextStep: 'Call', nextStepDate: '2026-12-01' };

describe('validateDeal (B-07, B-09)', () => {
  it('accepts a complete open deal', () => expect(() => validateDeal(base)).not.toThrow());
  it.each([
    [{ name: '' }, /name/],
    [{ companyId: '' }, /company/],
    [{ nextStep: '' }, /next step/],
    [{ nextStepDate: '' }, /next step/],
    [{ stage: 'Closed won' }, /reason/],
    [{ stage: 'Closed lost', winLossReason: 'Price' }, /competitor/],
  ])('rejects %o', (patch, msg) => expect(() => validateDeal({ ...base, ...patch })).toThrow(msg));
  it('closed deals do not need a next step', () =>
    expect(() => validateDeal({ ...base, stage: 'Closed won', winLossReason: 'Price', nextStep: '' })).not.toThrow());
});

describe('deal math', () => {
  it('weights by probability', () => expect(weighted({ amount: 100000, probability: 60 })).toBe(60000));
  it('treats On hold as open', () => expect(isOpen({ stage: 'On hold' })).toBe(true));
  it('flags overdue next steps', () => {
    expect(nextStepOverdue({ stage: 'Lead', nextStepDate: '2026-11-01' }, NOW)).toBe(true);
    expect(nextStepOverdue({ stage: 'Closed won', nextStepDate: '' }, NOW)).toBe(false);
  });
  it('time in stage and last activity', () => {
    const t = setup();
    const d = t.state.deals.find((x) => x.id === 'd_nw_fpa');
    expect(timeInStage(d, NOW)).toBe(9);
    expect(lastActivity(t.state, d) >= d.createdAt).toBe(true);
  });
});

describe('filterDeals (L-02)', () => {
  const t = setup();
  const all = t.api.all('deal');
  const run = (f, p = 'All') => filterDeals(t.state, all, f, p, NOW).map((d) => d.id);
  it('by pipeline', () => expect(run({}, 'Staff augmentation').every((id) => all.find((d) => d.id === id).pipeline === 'Staff augmentation')).toBe(true));
  it('by search text across deal and company', () => expect(run({ q: 'northwind' })).toEqual(['d_nw_fpa', 'd_nw_aug']));
  it('by value range', () => expect(run({ minAmt: 400000, maxAmt: 500000 }).sort()).toEqual(['d_meridian_bi', 'd_nw_fpa']));
  it('by industry via company', () => expect(run({ industry: 'Insurance' }).sort()).toEqual(['d_bright', 'd_bright_aug']));
  it('by partner', () => expect(run({ partnerId: 'c_summit' })).toEqual(['d_summit_sub']));
  it('open only + close window', () => expect(run({ openOnly: true, closeTo: '2026-11-30' }).sort()).toEqual(['d_bright', 'd_nw_aug']));
  it('stale activity', () => expect(run({ activity: 'stale' })).not.toContain('d_nw_fpa'));
  it('export rows have the expected columns', () => {
    const [row] = dealExportRows(t.state, all.slice(0, 1), NOW);
    expect(Object.keys(row)).toContain('Weighted (USD)');
    expect(row.Company).toBeTruthy();
  });
});
