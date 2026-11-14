// @ts-check
/*
 * playwright.config.js — End-to-end tests in tests/ against the real app in a browser.
 * Starts the Vite dev server itself (HTTPS with a self-made certificate, hence ignoreHTTPSErrors).
 * Phone sizes only: Baon is a phone app, and desktop skips the Welcome screen.
 * Run: npm run e2e   (report: npx playwright show-report)
 */
import { defineConfig, devices } from '@playwright/test';

const URL = 'https://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: URL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } }, // WebKit: where the iPad sign-in bugs showed up
  ],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: URL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
  },
});
