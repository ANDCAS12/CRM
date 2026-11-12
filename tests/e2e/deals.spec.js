// Deal flows: validation, board, close rules, audit (B-01, B-02, B-06, B-07, B-09, §9).
import { api, expect, signIn, test } from './fixtures.js';

test('new deals require a next step, then open on their page', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Create deal' }).click();
  await page.locator('#f_name').fill('E2E deal');
  await page.locator('#f_companyId').selectOption('c_vela');
  await page.locator('#mSave').click();
  await expect(page.locator('#mErr')).toHaveText('Every open deal needs a next step and a date.');
  await page.locator('#f_nextStep').fill('Call Omar');
  await page.locator('#f_nextStepDate').fill('2030-01-15');
  await page.locator('#mSave').click();
  await expect(page.getByRole('heading', { name: 'E2E deal' })).toBeVisible();
});

test('closing as lost requires a reason and competitor', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_cascade');
  await page.getByLabel('Move stage').selectOption('Closed lost');
  await page.locator('#mSave').click();
  await expect(page.locator('#mErr')).toContainText('reason');
  await page.locator('#f_winLossReason').selectOption('Price');
  await page.locator('#mSave').click();
  await expect(page.locator('#mErr')).toContainText('competitor');
  await page.locator('#f_competitors').fill('Deloitte');
  await page.locator('#mSave').click();
  await expect(page.locator('.pagehead .pill')).toHaveText('Closed lost');
  const audit = await api(page, () => window.__ikcrm.ctx.store.state.audit.filter((a) => a.entityId === 'd_cascade').map((a) => a.field));
  expect(audit).toEqual(expect.arrayContaining(['stage', 'winLossReason', 'competitors']));
});

test('board drag and drop moves a deal and records stage history', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.locator('.dc[data-id="d_vela"]').dragTo(page.locator('.colm[data-stage="Qualified"]'));
  await expect(page.locator('.colm[data-stage="Qualified"] .dc[data-id="d_vela"]')).toBeVisible();
  const last = await api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').stageHistory.at(-1).stage);
  expect(last).toBe('Qualified');
});

test('board columns collapse and board search filters cards', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.getByRole('button', { name: 'Collapse Lead' }).click();
  await expect(page.locator('.colm.collapsed[data-stage="Lead"]')).toContainText('Lead · 1');
  await page.getByLabel('Search deals').fill('meridian');
  await expect(page.locator('.dc')).toHaveCount(1);
});

test('table inline edit saves and bulk edit applies to selected deals', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.getByRole('button', { name: 'Table' }).click();
  const amount = page.locator('[data-ie="amount"][data-id="d_vela"]');
  await amount.fill('130000');
  await amount.press('Tab');
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').amount)).toBe(130000);
  await page.getByLabel('Select Vela commercial analytics assessment').check();
  await page.locator('#bSvc').selectOption('AI & automation');
  await page.locator('#bApply').click();
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').serviceLine)).toBe('AI & automation');
});

test('GTM cannot drag a deal they do not own', async ({ page }) => {
  await signIn(page, 'gtm');
  await page.goto('/#deals');
  await expect(page.locator('.dc[data-id="d_meridian_ai"]')).toHaveAttribute('draggable', 'false');
});
