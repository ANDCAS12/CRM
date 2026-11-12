// Playwright config: e2e tests run against the built single-file app served locally.
// CI runs Chromium, Firefox and WebKit plus a mobile viewport; locally only installed browsers run.
import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true, // each test gets a fresh browser context, so storage is isolated
  forbidOnly: ci, // a stray test.only fails CI
  retries: ci ? 2 : 0, // retry flaky network/CI hiccups, never locally
  workers: ci ? 4 : undefined,
  reporter: ci ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry', // full trace only when a retry happens
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/serve.mjs dist 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !ci,
  },
  projects: ci
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
