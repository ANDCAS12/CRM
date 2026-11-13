// Deal flows: validation, board, summary bar, close rules, audit (B-01..B-09, B-14, §9).
import { api, createFromMenu, expect, signIn, test } from './fixtures.js';

test('new deals start in Suspect, require a next step, then open on their page', async ({ page }) => {
  await signIn(page);
  await createFromMenu(page, 'Deal');
  await expect(page.locator('#f_stage')).toHaveValue('Suspect');
  await expect(page.locator('#stageHelp')).toContainText('don’t know we exist'); // Cristina's stage definition
  await page.locator('#f_name').fill('E2E deal');
  await page.locator('#f_companyId').selectOption('c_vela');
  await page.locator('#mSave').click();
  await expect(page.locator('#mErr')).toHaveText('Every open deal needs a next step and a date.');
  await page.locator('#f_nextStep').fill('Call Omar');
  await page.locator('#f_nextStepDate').fill('2030-01-15');
  await page.locator('#mSave').click();
  await expect(page.getByRole('heading', { name: 'E2E deal' })).toBeVisible();
});

test('pipelines are Consulting projects and Data Science as a Service', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  const options = await page.locator('#pipeSel option').allTextContents();
  expect(options).toEqual(['Consulting projects', 'Data Science as a Service', 'All pipelines']);
});

test('closing as lost requires a reason in words and a competitor', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_cascade');
  await page.getByRole('button', { name: 'Close lost' }).click();
  await page.locator('#mSave').click();
  await expect(page.locator('#mErr')).toContainText('reason');
  await page.locator('#f_winLossReason').fill('Our proposal was the most expensive');
  await page.locator('#mSave').click();
  await expect(page.locator('#mErr')).toContainText('competitor');
  await page.locator('#f_competitors').fill('Deloitte');
  await page.locator('#mSave').click();
  await expect(page.locator('.lp')).toContainText('Closed lost');
  const audit = await api(page, () => window.__ikcrm.ctx.store.state.audit.filter((a) => a.entityId === 'd_cascade').map((a) => a.field));
  expect(audit).toEqual(expect.arrayContaining(['stage', 'winLossReason', 'competitors']));
});

test('board drag and drop moves a deal and records stage history', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch browsers have no HTML drag and drop; the stage picker test covers phones');
  await signIn(page);
  await page.goto('/#deals');
  await page.locator('.dc[data-id="d_vela"]').dragTo(page.locator('.colm[data-stage="Prospect"]'), { targetPosition: { x: 60, y: 40 } }); // drop near the column header, which is always on screen
  await expect(page.locator('.colm[data-stage="Prospect"] .dc[data-id="d_vela"]')).toBeVisible();
  const last = await api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').stageHistory.at(-1).stage);
  expect(last).toBe('Prospect');
});

test('summary bar, column totals, collapsible columns and board search', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await expect(page.locator('.sumbar')).toContainText('Weighted open pipeline');
  await expect(page.locator('.colm[data-stage="Proposal sent"] .colfoot')).toContainText('Weighted amount');
  await page.getByRole('button', { name: 'Collapse Suspect' }).click();
  await expect(page.locator('.colm.collapsed[data-stage="Suspect"]')).toContainText('Suspect');
  await page.getByLabel('Search deals').fill('meridian');
  await expect(page.locator('.dc')).toHaveCount(1);
});

test('saved view tabs apply filters', async ({ page }) => {
  await signIn(page, 'gtm');
  await page.goto('/#deals');
  await page.getByRole('tab', { name: /My open deals/ }).click();
  const owners = await page.locator('.dc').evaluateAll((cards) => cards.length);
  expect(owners).toBeGreaterThan(0);
  await expect(page.getByRole('tab', { name: /My open deals/ })).toHaveClass(/on/);
});

test('table: click-to-edit amount and bulk change owner', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.getByRole('button', { name: 'Table' }).click();
  await page.locator('[data-edit="amount"][data-id="d_vela"]').click();
  await page.locator('td input.cellin').fill('130000');
  await page.locator('td input.cellin').press('Enter');
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').amount)).toBe(130000);
  await page.getByLabel('Select Vela commercial analytics assessment').check();
  await page.getByRole('button', { name: 'Change owner' }).click();
  await page.locator('#bv').selectOption('u_shadi');
  await page.locator('#mSave').click();
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').ownerId)).toBe('u_shadi');
});

test('GTM cannot drag a deal they do not own', async ({ page }) => {
  await signIn(page, 'gtm');
  await page.goto('/#deals');
  await expect(page.locator('.dc[data-id="d_meridian_ai"]')).toHaveAttribute('draggable', 'false');
});

test('stage picker on a card moves a deal without dragging (touch and keyboard)', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.getByLabel('Move Vela commercial analytics assessment to stage').selectOption({ index: 3 }); // Prospect
  await expect(page.locator('.colm[data-stage="Prospect"] .dc[data-id="d_vela"]')).toBeAttached();
  const last = await api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').stageHistory.at(-1).stage);
  expect(last).toBe('Prospect');
});

test('stage picker still requires a reason before closing', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.getByLabel('Move Vela commercial analytics assessment to stage').selectOption({ index: 8 }); // Closed lost
  await expect(page.getByRole('dialog', { name: 'Close as lost' })).toBeVisible();
});

test('a deal can be archived and restored from its page (B-02)', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_vela');
  await page.locator('#aBtn').click();
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').archived)).toBe(true);
  await page.locator('#aBtn').click();
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_vela').archived)).toBe(false);
});
