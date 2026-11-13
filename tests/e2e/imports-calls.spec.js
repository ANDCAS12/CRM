// Imports (D-03, M-01), the calls inbox (H-01..H-04) and exports (L-04).
import { api, expect, signIn, test } from './fixtures.js';

const CSV =
  'First Name,Last Name,Email,Job Title,Company Name,Company Domain Name,Shoe size\nMia,Lopez,mia@apex.com,CMO,Apex Media,apex.com,9\nLeo,Park,leo@apex.com,CFO,Apex Media,apex.com,10\n';

test('imports contacts with companies, reports unmapped columns and opens imported records', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contacts');
  await page.getByRole('button', { name: 'Import CSV' }).click();
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
  await page.getByRole('button', { name: 'Import CSV' }).click();
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

test('Fireflies sync: auto-match, confirm a suggestion and assign inline', async ({ page }) => {
  await signIn(page);
  await page.goto('/#calls');
  await page.getByRole('button', { name: 'Sync Fireflies now' }).click();
  await expect(page.getByRole('tab', { name: 'Unmatched (2)' })).toBeVisible();
  await page.getByRole('tab', { name: 'Unmatched (2)' }).click();
  await page
    .locator('.callcard')
    .filter({ has: page.locator('.t', { hasText: 'Harbor Ridge' }) })
    .click(); // match the title, not the assign menu
  await page.getByRole('button', { name: 'Confirm' }).click(); // suggested by email domain
  await expect(page.getByRole('tab', { name: 'Unmatched (1)' })).toBeVisible();
  await page.locator('[data-assign]').first().selectOption('deal:d_atlas');
  await expect(page.getByRole('tab', { name: 'Unmatched (0)' })).toBeVisible();
  await page.goto('/#deal-d_nw_fpa');
  await expect(page.locator('.tl').first()).toContainText('procurement check-in');
});

test('an action item becomes a task after choosing owner and date', async ({ page }) => {
  await signIn(page);
  await page.goto('/#calls');
  await page
    .locator('.callcard')
    .filter({ has: page.locator('.t', { hasText: 'proposal walkthrough' }) })
    .click();
  await page.locator('[data-mktask]').first().click();
  await expect(page.locator('#f_title')).toHaveValue('Cristina to send a two-option pricing page');
  await expect(page.locator('#f_assigneeId')).toHaveValue('u_cristina'); // owner guessed from the action item
  await page.locator('#mSave').click();
  const task = await api(page, () => window.__ikcrm.ctx.store.state.tasks.at(-1));
  expect(task).toMatchObject({ title: 'Cristina to send a two-option pricing page', assigneeId: 'u_cristina', refId: 'd_nw_fpa' });
});

test('exports download as a normal file outside Claude (hosted website)', async ({ page }) => {
  await signIn(page);
  await page.goto('/#contacts');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^ik-contacts-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (await file.createReadStream()).toArray();
  expect(Buffer.concat(text).toString()).toContain('Dana Whitfield');
});
