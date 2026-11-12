// Imports (D-03, M-01) and Fireflies inbox (H-01..H-04).
import { api, expect, signIn, test } from './fixtures.js';

const CSV =
  'First Name,Last Name,Email,Job Title,Company Name,Company Domain Name,Shoe size\nMia,Lopez,mia@apex.com,CMO,Apex Media,apex.com,9\nLeo,Park,leo@apex.com,CFO,Apex Media,apex.com,10\n';

test('imports contacts with companies, reports unmapped columns and opens imported records', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contacts');
  await page.getByRole('button', { name: 'Import' }).click();
  await page.locator('#impF').setInputFiles({ name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await expect(page.getByText('2 rows and 7 columns found')).toBeVisible();
  await page.getByRole('button', { name: 'Finish import' }).click();
  await expect(page.getByText('3 created')).toBeVisible(); // 2 contacts + 1 company
  await expect(page.getByText('Shoe size')).toBeVisible();
  await page.getByRole('button', { name: 'View imported records' }).click();
  await expect(page.locator('.chip.on')).toContainText('From import');
  await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('create-and-update with don’t-overwrite keeps the protected value', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contacts');
  await page.getByRole('button', { name: 'Import' }).click();
  await page
    .locator('#impF')
    .setInputFiles({ name: 'u.csv', mimeType: 'text/csv', buffer: Buffer.from('Email,Job Title,Phone\ndana.whitfield@northwindfoods.com,Intern,555-0100\n') });
  await page.getByLabel('Don’t overwrite Job title').check();
  await page.locator('input[name=impMode][value=upsert]').check();
  await page.getByRole('button', { name: 'Finish import' }).click();
  await expect(page.getByText('1 updated')).toBeVisible();
  const dana = await api(page, () => window.__ikcrm.ctx.store.state.contacts.find((p) => p.id === 'p_dana'));
  expect(dana.title).toBe('Chief Financial Officer');
  expect(dana.phone).toBe('555-0100');
});

test('Fireflies sync matches calls and assigns inbox calls', async ({ page }) => {
  await signIn(page);
  await page.goto('/#calls');
  await page.getByRole('button', { name: 'Sync Fireflies now' }).click();
  await expect(page.getByRole('tab', { name: 'Unmatched inbox (2)' })).toBeVisible();
  await page.getByRole('button', { name: 'Assign to deal or company' }).first().click();
  await page.locator('#f_ad').selectOption('d_atlas');
  await page.locator('#mSave').click();
  await expect(page.getByRole('tab', { name: 'Unmatched inbox (1)' })).toBeVisible();
  await page.goto('/#deal-d_nw_fpa');
  await expect(page.locator('.tl')).toContainText('procurement check-in');
});

test('deal summary shows sources (local draft when Claude is unavailable)', async ({ page }) => {
  await signIn(page);
  await page.goto('/#deal-d_nw_fpa');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.locator('.ai .srcs')).toContainText('Call: Northwind FP&A: proposal walkthrough');
  await expect(page.locator('.ai')).toContainText('Draft without Claude');
});
