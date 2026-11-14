// @ts-check
/*
 * playwright.config.js — End-to-end tests in tests/ against the real production build
 * (`npm run build` + `vite preview` on :4173), so they test what students get, offline service
 * worker included. Not the dev server: it sends ~110 separate files and Safari timed out on it.
 * Phone sizes only: Baon is a phone app, and desktop skips the Welcome screen.
 * Run: npm run e2e   (report: npx playwright show-report)
 */
import { defineConfig, devices } from '@playwright/test';

const URL = 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    // WebKit: where the iPad sign-in bugs showed up. Service worker off: in WebKit, Playwright can't
    // fake requests from a page the worker controls, so the fake Neon went unseen (offline is tested in Chrome).
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'], serviceWorkers: 'block' } },
  ],
  webServer: {
    // Always rebuilt, never reused, so the tests can't pass on an old build.
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: URL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
