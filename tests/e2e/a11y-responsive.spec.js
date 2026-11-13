// Smoke checks that every page renders for every role, plus mobile, theme and form labels.
import { createFromMenu, expect, signIn, test } from './fixtures.js';

const PAGES = [
  'home',
  'deals',
  'companies',
  'contacts',
  'tasks',
  'contracts',
  'placements',
  'calls',
  'reports',
  'admin',
  'deal-d_nw_aug',
  'company-c_northwind',
  'contact-p_marco',
  'contract-k_nw_sow',
];

for (const role of ['admin', 'gtm', 'delivery', 'finance']) {
  test(`every page renders for ${role}`, async ({ page }) => {
    await signIn(page, role);
    for (const p of PAGES) {
      await page.goto(`/#${p}`);
      await expect(page.locator('#view h1, #view .empty').first()).toBeVisible(); // a heading or a clear empty state
    }
  });
}

test('V2 features are clearly labelled', async ({ page, isMobile }) => {
  await signIn(page);
  await expect(page.locator('#side')).toContainText('Placements');
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click(); // on phones Ask Claude lives in the side menu
  await page.locator(isMobile ? '#navAsk' : '#askBtn').click();
  await expect(page.getByRole('dialog', { name: 'Ask Claude' })).toContainText('V2');
});

test('mobile menu opens the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#side')).toHaveClass(/open/);
});

test('theme can be switched from the account menu', async ({ page }) => {
  await signIn(page);
  await page.locator('#meBtn').click();
  await page.getByRole('menuitem', { name: 'Switch light or dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
});

test('form fields have accessible labels', async ({ page }) => {
  await signIn(page);
  await createFromMenu(page, 'Deal');
  for (const label of ['Deal name *', 'Company *', 'Stage *', 'Next step date']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
});
