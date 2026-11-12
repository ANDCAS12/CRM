import { describe, expect, it, vi } from 'vitest';
import { buildPrompt, buildSources, generateSummary, latestSummary, localSummary } from '../../src/ai/summary.js';
import { acceptInvite, hashPassword, randomToken, signIn } from '../../src/core/auth.js';
import { relationship } from '../../src/core/contacts.js';
import { NOW, setup } from './helpers.js';

describe('AI deal summary (H-04, I-01)', () => {
  it('builds numbered sources from calls, notes and documents', () => {
    const { state } = setup();
    const s = buildSources(state, 'd_nw_fpa');
    expect(s.map((x) => x.type)).toEqual(['call', 'note', 'note', 'document']);
    expect(s[0].ref).toBe('S1');
  });
  it('prompt lists every source and asks for JSON', () => {
    const { state } = setup();
    const deal = state.deals[0];
    const p = buildPrompt(state, deal, buildSources(state, deal.id));
    expect(p).toContain('S1:');
    expect(p).toContain('Return ONLY a JSON object');
  });
  it('saves Claude output with only the cited sources', async () => {
    const t = setup();
    const sample = {
      json: vi.fn().mockResolvedValue({ situation: 'S', stakeholders: '', needs: '', objections: '', next_steps: '', risks: '', source_ids: ['S2'] }),
    };
    const out = await generateSummary({ api: t.api, state: t.state, dealId: 'd_nw_fpa', sample, now: NOW });
    expect(sample.json).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-sonnet-5-5' }));
    expect(out.sources).toHaveLength(1);
    expect(out.model).toBe('claude-sonnet-5-5');
    expect(latestSummary(t.state, 'd_nw_fpa').id).toBe(out.id);
  });
  it('falls back to a local draft when Claude fails', async () => {
    const t = setup();
    const onError = vi.fn();
    const out = await generateSummary({
      api: t.api,
      state: t.state,
      dealId: 'd_nw_fpa',
      sample: { json: () => Promise.reject({ code: 'not_granted' }) },
      onError,
      now: NOW,
    });
    expect(onError).toHaveBeenCalled();
    expect(out.model).toBe('local');
    expect(out.sections.situation).toMatch(/Dana and Marco/);
  });
  it('returns null for unknown deals and builds a local summary', async () => {
    const t = setup();
    expect(await generateSummary({ api: t.api, state: t.state, dealId: 'none', sample: null })).toBeNull();
    const deal = t.state.deals.find((d) => d.id === 'd_atlas');
    expect(localSummary(t.state, deal, buildSources(t.state, 'd_atlas'), NOW).risks).toBe('Next step is overdue.');
  });
});

describe('auth', () => {
  it('demo accounts sign in with the demo password only', async () => {
    const { state } = setup();
    expect((await signIn(state, 'russell@insightkitchen.com', 'demo')).ok).toBe(true);
    expect((await signIn(state, 'russell@insightkitchen.com', 'nope')).ok).toBe(false);
    expect((await signIn(state, 'ghost@x.com', 'demo')).error).toMatch(/don’t match/);
  });
  it('invites must be accepted, then use a hashed password', async () => {
    const t = setup();
    const token = randomToken();
    t.api.create('user', { name: 'New', email: 'new@insightkitchen.com', role: 'gtm', status: 'invited', inviteToken: token });
    expect((await signIn(t.state, 'new@insightkitchen.com', 'whatever')).error).toMatch(/Accept your invite/);
    await expect(acceptInvite(t.api, t.state, token, 'short')).rejects.toThrow(/8 characters/);
    await acceptInvite(t.api, t.state, token, 'correct horse');
    const u = t.state.users.find((x) => x.email === 'new@insightkitchen.com');
    expect(u.passwordHash).not.toContain('correct');
    expect(u.inviteToken).toBe('');
    expect((await signIn(t.state, 'new@insightkitchen.com', 'correct horse')).ok).toBe(true);
    await expect(acceptInvite(t.api, t.state, token, 'correct horse')).rejects.toThrow(/invalid/);
  });
  it('deactivated users are blocked', async () => {
    const t = setup();
    t.api.update('user', 'u_cristina', { status: 'deactivated' });
    expect((await signIn(t.state, 'cristina@insightkitchen.com', 'demo')).error).toMatch(/deactivated/);
  });
  it('hashing is salted', async () => expect(await hashPassword('a', 's1')).not.toBe(await hashPassword('a', 's2')));
});

describe('contact relationship', () => {
  it('scores strength from recent touches', () => {
    const { state } = setup();
    expect(relationship(state, 'p_dana', NOW)).toMatchObject({ strength: 'Warm', recent: 2 });
    expect(relationship(state, 'p_omar', NOW).strength).toBe('Cold');
  });
});
