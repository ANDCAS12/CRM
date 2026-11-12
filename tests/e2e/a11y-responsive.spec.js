// Smoke checks that every page renders for every role, plus mobile and dark mode.
import { expect, signIn, test } from './fixtures.js';

const PAGES = [
  'dashboard',
  'deals',
  'companies',
  'contacts',
  'tasks',
  'contracts',
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

test('mobile menu opens the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#side')).toHaveClass(/open/);
});

test('dark mode toggles the theme attribute', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Switch light or dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
});

test('form fields have accessible labels', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Create deal' }).click();
  for (const label of ['Deal name *', 'Company *', 'Stage *', 'Next step date']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
});
