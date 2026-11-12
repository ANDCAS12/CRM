// Sign-in, role navigation and field restrictions through the real UI (§3, §9).
import { api, expect, signIn, test } from './fixtures.js';

test('rejects a wrong password with a generic message', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('russell@insightkitchen.com');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('That email and password don’t match.');
});

test('Finance sees contract values and cannot edit', async ({ page }) => {
  await signIn(page, 'finance');
  await expect(page.getByRole('link', { name: 'Calls' })).toHaveCount(0); // no Fireflies inbox
  await page.goto('/#contracts');
  await expect(page.getByRole('cell', { name: '$310,000' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create contract' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create deal' })).toBeHidden();
});

test('GTM cannot read contract values in the UI or the data layer', async ({ page }) => {
  await signIn(page, 'gtm');
  await page.goto('/#contracts');
  await expect(page.getByText('values are restricted for your role')).toBeVisible();
  await expect(page.getByText('$310,000')).toHaveCount(0);
  const leaked = await api(page, () => window.__ikcrm.ctx.api.all('contract').some((k) => 'totalValue' in k));
  expect(leaked).toBe(false);
});

test('Delivery only sees deals in contracting or won', async ({ page }) => {
  await signIn(page, 'delivery');
  const stages = await api(page, () => [...new Set(window.__ikcrm.ctx.api.all('deal').map((d) => d.stage))].sort());
  expect(stages).toEqual(['Closed won', 'Negotiation and contracting']);
  await page.goto('/#deal-d_cascade');
  await expect(page.getByText('isn’t visible to your role')).toBeVisible();
});

test('non-admins cannot open the admin page by URL', async ({ page }) => {
  await signIn(page, 'gtm');
  await page.goto('/#admin');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good');
});

test('admin invites a user who accepts with an invite code', async ({ page }) => {
  await signIn(page, 'admin');
  await page.goto('/#admin');
  await page.getByRole('button', { name: 'Invite user' }).click();
  await page.locator('#iN').fill('Pat Lee');
  await page.locator('#iE').fill('pat@insightkitchen.com');
  await page.getByRole('button', { name: 'Send invite' }).click();
  const code = await page.locator('#invCode').textContent();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Pending invite', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('link', { name: 'Accept an invite' }).click();
  await page.locator('#iEm').fill('pat@insightkitchen.com');
  await page.locator('#iCode').fill(code);
  await page.locator('#iPw').fill('long enough pw');
  await page.getByRole('button', { name: 'Set password and sign in' }).click();
  await expect(page.locator('.who .n')).toHaveText('Pat Lee');
  const stored = await api(page, () => window.__ikcrm.ctx.store.state.users.find((u) => u.email === 'pat@insightkitchen.com'));
  expect(stored.passwordHash).toMatch(/^[0-9a-f]{64}$/); // salted SHA-256, never plain text
});
