// Fireflies matching (H-01, H-02).
import { describe, expect, it } from 'vitest';
import { matchCall } from '../../src/core/matching.js';
import { setup } from './helpers.js';

describe('matchCall', () => {
  const { state } = setup();
  it('matches by domain and title among several open deals', () => {
    const r = matchCall(state, { title: 'Northwind FP&A: procurement check-in', attendees: ['cristina@insightkitchen.com', 'lortiz@northwindfoods.com'] });
    expect(r).toMatchObject({ companyId: 'c_northwind', dealId: 'd_nw_fpa', matched: true, contactIds: ['p_lena'] });
  });
  it('matches the only open deal of a company', () => {
    const r = matchCall(state, { title: 'Weekly', attendees: ['x@velapharma.com'] });
    expect(r).toMatchObject({ dealId: 'd_vela', matched: true });
  });
  it('sends ambiguous company calls to the inbox with the company pre-filled', () => {
    const r = matchCall(state, { title: 'Portfolio review', attendees: ['tbecker@harborridgecap.com'] });
    expect(r).toMatchObject({ companyId: 'c_harbor', matched: false });
  });
  it('leaves unknown domains unmatched', () => {
    const r = matchCall(state, { title: 'Catch-up', attendees: ['jen@gmail.com'] });
    expect(r).toEqual({ companyId: '', dealId: '', contactIds: [], matched: false });
  });
  it('ignores IK attendees', () => {
    const r = matchCall(state, { title: 'Internal', attendees: ['rod@insightkitchen.com'] });
    expect(r.matched).toBe(false);
  });
});
