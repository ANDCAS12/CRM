// Record pages and list views (B-05, C-02, C-03, D-01, E-01, L-01..L-03) in the Central Kitchen layout.
import { api, expect, signIn, test } from './fixtures.js';

test('deal page shows stage progress, auto summary with sources, and edits in place', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_nw_fpa');
  await expect(page.locator('.progress .lab.cur')).toHaveText('Proposal sent');
  await expect(page.locator('.ai .srcs')).toContainText('call'); // written automatically on first visit (H-04, I-01)
  await page.getByRole('button', { name: 'Edit Next step', exact: true }).click();
  await page.locator('.about input').fill('Send revised pricing');
  await page.locator('.about input').press('Enter');
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_nw_fpa').nextStep)).toBe('Send revised pricing');
});

test('service line is free text with suggestions', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_nw_fpa');
  await page.getByRole('button', { name: 'Edit Service line' }).click();
  await expect(page.locator('.about input[list]')).toBeVisible();
  await page.locator('.about input[list]').fill('AI roadmap for finance');
  await page.locator('.about input[list]').press('Enter');
  await expect.poll(() => api(page, () => window.__ikcrm.ctx.store.state.deals.find((d) => d.id === 'd_nw_fpa').serviceLine)).toBe('AI roadmap for finance');
});

test('properties panel searches and edits, and the change shows under property changes', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contact-p_dana');
  await page.getByRole('button', { name: 'View all properties' }).click();
  await page.getByLabel('Search properties').fill('phone');
  await expect(page.locator('.drawer .prop')).toHaveCount(1);
  await page.locator('.drawer').getByRole('button', { name: 'Edit Phone number' }).click(); // the panel, not the About list
  await page.locator('.drawer input').last().fill('+1 312 555 0100');
  await page.locator('.drawer input').last().press('Enter');
  await expect(page.locator('.drawer .pv')).toContainText('+1 312 555 0100');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Activities' }).click();
  await page.getByRole('button', { name: /Property changes/ }).click();
  await expect(page.locator('.tl li[data-kind="change"]').first()).toContainText('Phone number');
});

test('rich-text notes are sanitised before saving', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_vela');
  await page.getByRole('tab', { name: 'Activities' }).click();
  await page.locator('#rte').evaluate((el) => (el.innerHTML = '<b>Bold</b><img src=x onerror="window.__xss=1">'));
  await page.waitForTimeout(100); // the raw injection may fire in the editor itself; that is the test setup, not the app
  await page.evaluate(() => (window.__xss = undefined));
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.waitForTimeout(200); // let the timeline re-render the saved note
  const body = await api(page, () => window.__ikcrm.ctx.store.state.notes.at(-1).body);
  expect(body).toContain('<b>Bold</b>');
  expect(body).not.toContain('onerror');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('contact list: search, quick filter, more filters and a shared view', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contacts');
  await page.getByLabel('Search contacts').fill('northwind');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByLabel('Search contacts').fill('');
  await page.getByLabel('Seniority').selectOption('Director');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByLabel('Seniority').selectOption('');
  await page.getByRole('button', { name: 'More filters' }).click();
  await page.locator('#ffField').selectOption('function');
  await page.locator('#ffOp').selectOption('is');
  await page.locator('#ffVal').fill('Data');
  await page.getByRole('button', { name: 'Apply filter' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Save view' }).click();
  await page.locator('#svName').fill('Data people');
  await page.locator('#mSave').click();
  await expect(page.getByRole('tab', { name: /Data people/ })).toHaveClass(/on/);
});

test('company page: snapshot, add existing contacts, associated contacts list', async ({ page }) => {
  await signIn(page);
  await page.goto('/#company-c_northwind');
  await expect(page.getByText('Relationship snapshot')).toBeVisible();
  await expect(page.getByText('Working together since')).toBeVisible();
  await page.goto('/#company-c_vela');
  await page.locator('#assocP').click();
  await page.locator('#acQ').fill('Nina');
  await page.locator('[data-ac]').first().check();
  await page.locator('#mSave').click();
  await expect(page.locator('.rp')).toContainText('Nina Cole');
  await page.getByRole('link', { name: 'View associated contacts' }).click();
  await expect(page.getByLabel('Company', { exact: true })).toHaveValue('c_vela');
  await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('duplicate company domain warns before saving', async ({ page }) => {
  await signIn(page);
  await page.goto('/#companies');
  await page.getByRole('button', { name: 'Create company' }).click();
  await page.locator('#f_name').fill('Northwind Copy');
  await page.locator('#f_domain').fill('northwindfoods.com');
  await expect(page.locator('#dupWarn')).toContainText('Possible duplicate');
  await page.locator('#mSave').click();
  await expect(page.locator('#mErr')).toContainText('Save again');
});

test('global search finds note text and opens the record', async ({ page }) => {
  await signIn(page);
  await page.getByLabel('Search', { exact: true }).fill('board approval');
  await page.locator('#sres a').first().click();
  await expect(page.getByRole('heading', { name: 'Northwind FP&A modernization' })).toBeVisible();
});
