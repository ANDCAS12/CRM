// HubSpot-style record pages and list views (B-05, C-02, C-03, D-01, E-01, L-01..L-03).
import { api, expect, signIn, test } from './fixtures.js';

test('properties panel searches and edits inline, and the change shows in the timeline', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contact-p_dana');
  await page.getByRole('button', { name: 'View all properties' }).click();
  await page.getByLabel('Search properties').fill('phone');
  await expect(page.locator('.drawer .prop')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Phone number' }).click();
  await page.locator('.drawer input').last().fill('+1 312 555 0100');
  await page.locator('.drawer input').last().press('Enter');
  await expect(page.locator('.drawer .pv')).toContainText('+1 312 555 0100');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Property changes/ }).click();
  await expect(page.locator('.tl li[data-kind="change"]').first()).toContainText('Phone number');
});

test('restricted contract value shows as restricted in the properties panel for GTM', async ({ page }) => {
  await signIn(page, 'gtm');
  await page.goto('/#contracts');
  await expect(page.getByText('Restricted').first()).toBeVisible();
});

test('rich-text notes are sanitised before saving', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_vela');
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

test('contact list: search, add a filter, save a shared view', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contacts');
  await page.getByLabel('Search contacts').fill('northwind');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByLabel('Search contacts').fill('');
  await page.getByRole('button', { name: '+ Add filter' }).click();
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

test('company page adds existing contacts and opens the associated contact list', async ({ page }) => {
  await signIn(page);
  await page.goto('/#company-c_vela');
  await page.getByRole('button', { name: 'Add' }).first().click();
  await page.locator('#acQ').fill('Nina');
  await page.locator('[data-ac]').first().check();
  await page.locator('#mSave').click();
  await expect(page.locator('.right')).toContainText('Nina Cole');
  await page.getByRole('link', { name: 'View associated contacts' }).click();
  await expect(page.locator('.chip').first()).toContainText('Company is Vela Pharma');
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
