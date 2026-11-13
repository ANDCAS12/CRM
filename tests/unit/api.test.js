// Audit log and stage history (§3 audit log, §9 "every create, edit and delete writes an audit entry", B-06).
import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

describe('audit log', () => {
  it('records create, update (with old and new values) and delete', () => {
    const t = setup();
    const c = t.api.create('company', { name: 'Acme', relationship: 'Prospect' });
    t.api.update('company', c.id, { industry: 'Retail' });
    t.api.remove('company', c.id);
    const rows = t.state.audit.filter((a) => a.entityId === c.id);
    expect(rows.map((r) => r.action)).toEqual(['delete', 'update', 'create']);
    expect(rows[1]).toMatchObject({ field: 'industry', old: '', new: 'Retail', userId: 'u_russell' });
  });
  it('skips no-op updates', () => {
    const t = setup();
    const before = t.state.audit.length;
    t.api.update('deal', 'd_nw_fpa', { amount: 420000 });
    expect(t.state.audit.length).toBe(before);
  });
  it('redacts secret fields', () => {
    const t = setup();
    t.api.update('user', 'u_cristina', { passwordHash: 'abc', salt: 'xyz' });
    const rows = t.state.audit.filter((a) => a.entityId === 'u_cristina');
    expect(rows.every((r) => r.old === '[redacted]' && r.new === '[redacted]')).toBe(true);
  });
});

describe('deal stage changes', () => {
  it('append stage history, reset probability and log activity', () => {
    const t = setup();
    const before = t.api.raw('deal', 'd_cascade').stageHistory.length;
    t.api.update('deal', 'd_cascade', { stage: 'Verbal Approval' });
    const d = t.api.raw('deal', 'd_cascade');
    expect(d.stageHistory).toHaveLength(before + 1);
    expect(d.stageHistory.at(-1)).toMatchObject({ stage: 'Verbal Approval', by: 'u_russell' });
    expect(d.probability).toBe(80);
    expect(t.state.activities[0]).toMatchObject({ kind: 'stage', dealId: 'd_cascade' });
  });
  it('keep an explicit probability when given', () => {
    const t = setup();
    t.api.update('deal', 'd_cascade', { stage: 'Verbal Approval', probability: 45 });
    expect(t.api.raw('deal', 'd_cascade').probability).toBe(45);
  });
  it('new deals start their history at creation', () => {
    const t = setup();
    const d = t.api.create('deal', { name: 'X', companyId: 'c_vela', stage: 'Prospect', pipeline: 'Consulting projects' });
    expect(d.stageHistory).toHaveLength(1);
    expect(d.probability).toBe(20);
  });
});

describe('archive', () => {
  it('archived records are hidden unless requested', () => {
    const t = setup();
    t.api.update('deal', 'd_vela', { archived: true });
    expect(t.api.all('deal').some((d) => d.id === 'd_vela')).toBe(false);
    expect(t.api.all('deal', { includeArchived: true }).some((d) => d.id === 'd_vela')).toBe(true);
  });
});
