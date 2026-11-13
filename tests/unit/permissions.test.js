// Role restrictions (§3, §9 "role restrictions are tested"): verified at the data layer, not the UI.
import { describe, expect, it } from 'vitest';
import { canEdit, canSeeRecord, fieldEditable, scrub } from '../../src/core/permissions.js';
import { setup } from './helpers.js';

describe('restricted fields are removed from API responses', () => {
  it('Finance can read contract values', () => {
    const t = setup();
    t.as('u_alejandro');
    expect(t.api.all('contract').every((k) => 'totalValue' in k)).toBe(true);
  });
  it.each(['u_cristina', 'u_rod'])('%s cannot read contract values or placement rates', (id) => {
    const t = setup();
    t.as(id);
    expect(t.api.all('contract').some((k) => 'totalValue' in k)).toBe(false);
    expect(t.api.get('contract', 'k_nw_sow').__hidden).toContain('totalValue');
    const pl = t.api.get('placement', 'pl_1');
    expect(pl.billRate).toBeUndefined();
    expect(pl.margin).toBeUndefined();
  });
  it('never exposes password hashes; only admins see invite tokens', () => {
    const user = { id: 'x', name: 'X', passwordHash: 'h', salt: 's', inviteToken: 't' };
    expect(scrub({ role: 'admin' }, 'user', user)).toMatchObject({ inviteToken: 't' });
    expect(scrub({ role: 'admin' }, 'user', user).passwordHash).toBeUndefined();
    expect(scrub({ role: 'gtm' }, 'user', user).inviteToken).toBeUndefined();
  });
});

describe('record visibility', () => {
  it('Delivery only sees deals in contracting or won', () => {
    const t = setup();
    t.as('u_rod');
    const stages = new Set(t.api.all('deal').map((d) => d.stage));
    expect([...stages].sort()).toEqual(['Closed won', 'Contract Sent', 'Verbal Approval']);
    expect(t.api.get('deal', 'd_cascade')).toBeNull();
  });
  it('signed-out users see nothing', () => expect(canSeeRecord(null, 'deal', {})).toBe(false));
});

describe('edit rights', () => {
  const t = setup();
  const deal = (ownerId, collaborators = []) => ({ ownerId, collaborators });
  it('GTM edits own and shared deals only', () => {
    const gtm = { id: 'u_cristina', role: 'gtm' };
    expect(canEdit(gtm, 'deal', deal('u_cristina'))).toBe(true);
    expect(canEdit(gtm, 'deal', deal('u_russell', ['u_cristina']))).toBe(true);
    expect(canEdit(gtm, 'deal', deal('u_russell'))).toBe(false);
    expect(canEdit(gtm, 'contract', {})).toBe(false);
  });
  it('Finance edits nothing', () => {
    for (const type of ['deal', 'contact', 'contract', 'note', 'task']) expect(canEdit({ role: 'finance' }, type, null)).toBe(false);
  });
  it('Delivery edits contract dates but not values, and cannot create contracts', () => {
    const d = { id: 'u_rod', role: 'delivery' };
    expect(canEdit(d, 'contract', null)).toBe(false);
    expect(canEdit(d, 'contract', {})).toBe(true);
    expect(fieldEditable(d, 'contract', 'endDate')).toBe(true);
    expect(fieldEditable(d, 'contract', 'totalValue')).toBe(false);
    expect(fieldEditable(d, 'contract', 'name')).toBe(false);
  });
  it('API ignores writes to forbidden fields', () => {
    t.as('u_rod');
    t.api.update('contract', 'k_nw_sow', { totalValue: 1, endDate: '2027-12-31' });
    expect(t.api.raw('contract', 'k_nw_sow').totalValue).toBe(310000);
    expect(t.api.raw('contract', 'k_nw_sow').endDate).toBe('2027-12-31');
  });
  it('API throws PermissionError for forbidden records', () => {
    t.as('u_alejandro');
    expect(() => t.api.update('deal', 'd_nw_fpa', { amount: 1 })).toThrow(/can’t edit/);
    t.as('u_cristina');
    expect(() => t.api.update('deal', 'd_bright', { amount: 1 })).toThrow(/can’t edit/);
    expect(() => t.api.create('contract', { name: 'x' })).toThrow(/can’t create/);
  });
});
