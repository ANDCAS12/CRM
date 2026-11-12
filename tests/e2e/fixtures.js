// Shared e2e helpers: block the external Excel CDN (tests must not depend on the network) and sign in.
import { test as base, expect } from '@playwright/test';

export const USERS = {
  admin: 'russell@insightkitchen.com',
  gtm: 'cristina@insightkitchen.com',
  delivery: 'rod@insightkitchen.com',
  finance: 'alejandro@insightkitchen.com',
};

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/xlsx.full.min.js', (r) => r.fulfill({ body: '', contentType: 'text/javascript' })); // offline-safe
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message)); // any uncaught error fails the test
    await use(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});

/** Signs in through the real form. */
export async function signIn(page, role = 'admin') {
  await page.goto('/');
  await page.getByLabel('Email').fill(USERS[role]);
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#app')).toBeVisible();
}

/** Signs out; on phone-sized screens the button lives in the side menu, so open it first. */
export async function signOut(page) {
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sign out' }).click();
}

/** Evaluates against the in-browser data layer (same API the UI uses). */
export const api = (page, fn, arg) => page.evaluate(fn, arg);

export { expect };
