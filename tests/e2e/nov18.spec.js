// The ten changes from the Nov 18 review (feature list and build brief dated Nov 18, 2026).
import { api, createFromMenu, expect, signIn, test } from './fixtures.js';

test('1. Tasks in the navigation: views, quick views, filters, type and linked record (E-02, E-08)', async ({ page, isMobile }) => {
  await signIn(page, 'gtm');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click(); // the menu slides in on phones
  await page.locator('#side').getByRole('link', { name: 'Tasks' }).click();
  await expect(page.getByRole('tab', { name: 'My tasks' })).toHaveClass(/on/);
  await page.getByRole('tab', { name: 'All tasks' }).click();
  await expect(page.locator('.tfoot')).toContainText('of 7 tasks, open and past');
  await page.locator('[data-tq="overdue"]').click();
  for (const status of await page.locator('tbody td:last-child').allTextContents()) expect(status).toBe('Overdue');
  await page.locator('[data-tq="all"]').click();
  await page.getByLabel('Task type').selectOption('Call');
  for (const type of await page.locator('tbody .badge').allTextContents()) expect(type).toBe('Call');
  await page.getByLabel('Task type').selectOption('');
  await page.getByRole('button', { name: '+ Create task' }).click();
  await page.locator('#f_title').fill('Send case study');
  await page.locator('#f_type').selectOption('Email');
  await page.locator('#f_tlink').selectOption('company:c_vela');
  await page.locator('#mSave').click();
  const t = await api(page, () => window.__ikcrm.ctx.store.state.tasks.at(-1));
  expect(t).toMatchObject({ title: 'Send case study', type: 'Email', refType: 'company', refId: 'c_vela' });
  await page.locator(`[data-tdone="${t.id}"]`).check();
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.tasks.at(-1).done)).toBe(true);
});

test('2. Close years start at 2025, with All (A-04, L-02)', async ({ page }) => {
  await signIn(page);
  const home = await page.locator('#dashYear option').allTextContents();
  expect(home[0]).toBe('Close year: All');
  expect(home[1]).toBe('Close year: 2025');
  await page.goto('/#deals');
  const deals = await page.getByLabel('Close year').locator('option').allTextContents();
  expect(deals.slice(0, 3)).toEqual(['Close year: All', 'Close year: 2025', 'Close year: 2026']);
});

test('3 and 5. "Internal" is a source, and company and primary contact are required (B-02, B-08)', async ({ page }) => {
  await signIn(page);
  await createFromMenu(page, 'Deal');
  await expect(page.locator('#f_source option', { hasText: 'Internal' })).toHaveCount(1);
  await expect(page.getByLabel('Primary contact *', { exact: true })).toBeVisible();
});

test('4. Sort by deal owner on the board and the table (B-03)', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.getByLabel('Sort by').selectOption('owner');
  await page.getByRole('button', { name: 'Table' }).click();
  const owners = await page.locator('tbody td:nth-child(8) .av').evaluateAll((els) => els.map((e) => e.title));
  expect(owners).toEqual([...owners].sort());
});

test('6 and 7. Service line filter by category; the 11 industries (Nov 18 picklists)', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deals');
  await page.getByRole('button', { name: 'Advanced filters' }).click();
  await page.locator('#flt_serviceLine').selectOption('AI Realization');
  await expect(page.locator('.dc')).toHaveCount(3);
  await expect(page.locator('#flt_industry option')).toHaveCount(12); // "Any" + 11 industries
});

test('8. New company: five new fields now, Claude auto-fill shown as V2 (C-08)', async ({ page }) => {
  await signIn(page);
  await page.goto('/#companies');
  await page.getByRole('button', { name: 'Create company' }).click();
  await expect(page.locator('.claudefill')).toContainText('V2');
  await expect(page.getByRole('button', { name: 'Fill with Claude' })).toBeDisabled();
  await page.locator('#f_name').fill('Orion Distribution');
  await page.locator('#f_city').fill('Columbus');
  await page.locator('#f_state').fill('OH');
  await page.locator('#f_postalCode').fill('43215');
  await page.locator('#f_linkedinUrl').fill('https://linkedin.com/company/orion');
  await page.locator('#f_description').fill('Regional distributor');
  await page.locator('#mSave').click();
  await expect(page.locator('.about')).toContainText('Columbus');
  await expect(page.locator('.about')).toContainText('Regional distributor');
});

test('9. Lists open on All and My only; no preset views (L-03)', async ({ page }) => {
  await signIn(page);
  for (const [hash, tabs] of [
    ['contacts', ['All contacts', 'My contacts']],
    ['companies', ['All companies', 'My companies']],
    ['deals', ['All deals', 'My deals']],
    ['contracts', ['All contracts', 'My contracts']],
    ['tasks', ['All tasks', 'My tasks']],
  ]) {
    await page.goto(`/#${hash}`);
    expect((await page.locator('.viewtabs [role=tab]').allTextContents()).map((x) => x.trim())).toEqual(tabs);
  }
});

test('10. Dashboards: defaults, create from a template, build a report, default, share, export (L-12 to L-14)', async ({ page, isMobile }) => {
  await signIn(page, 'gtm');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#side').getByRole('link', { name: 'Dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'Open pipeline', exact: true })).toBeVisible();
  const names = await page.locator('#dashPick option').allTextContents();
  expect(names).toEqual(['Pipeline', 'Funnel and sources (V2)', 'Revenue', 'Marketing return (V3)']);
  await page.getByLabel('Pipeline').last().selectOption('Data Science as a Service'); // dashboard filter
  await page.getByRole('button', { name: 'Create dashboard' }).click();
  await page.locator('#dnName').fill('Cristina weekly');
  await page.locator('#dnFrom').selectOption('def_revenue');
  await page.locator('#dnVis').selectOption('private');
  await page.locator('#mSave').click();
  await expect(page.locator('.dgrid .card')).toHaveCount(4);
  await page.getByRole('button', { name: '+ Add report' }).click();
  await page.locator('#bObj').selectOption('task');
  await page.locator('#bGroup').selectOption('assigneeId');
  await page.locator('#bThen').selectOption('type');
  await page.locator('[data-ct="table"]').click();
  await page.locator('#bName').fill('Tasks by owner and type');
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.locator('.dgrid .card')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Tasks by owner and type' })).toBeVisible();
  await page.getByRole('button', { name: 'Set as default' }).click();
  await expect(page.locator('.pagehead')).toContainText('Default');
  await page.getByRole('button', { name: 'Share' }).click();
  await page.locator('input[name=vis][value=team]').check();
  await page.locator('#mSave').click();
  const dash = await api(page, () => window.__ikcrm.ctx.store.state.dashboards.at(-1));
  expect(dash).toMatchObject({ name: 'Cristina weekly', visibility: 'team', ownerId: 'u_cristina' });
  expect(dash.reportIds).toHaveLength(5);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  expect((await download).suggestedFilename()).toMatch(/^dashboard-cristina-weekly-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('Finance can open dashboards but not create them', async ({ page }) => {
  await signIn(page, 'finance');
  await page.goto('/#dashboards');
  await expect(page.getByRole('button', { name: 'Create dashboard' })).toHaveCount(0);
  await expect(page.locator('.dgrid .card').first()).toBeVisible();
});
