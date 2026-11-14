// @ts-check
/*
 * offline-speed.spec.js — Reopening with no internet (the offline service worker) and loading
 * speed, on the production build that playwright.config.js starts. Uses the fake Neon.
 */
import { test, expect } from '@playwright/test';
import { addExpense, setUp } from './steps.js';

// Budgets with room for a slow test machine; a real phone on the deployed site should beat them.
const FIRST_VISIT_MS = 3000;
const REOPEN_MS = 2000;

test('speed: a first visit shows Welcome quickly', async ({ page }) => {
  const start = Date.now();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Know what you can spend today.' })).toBeVisible();
  const ms = Date.now() - start;
  test.info().annotations.push({ type: 'first visit', description: `${ms} ms` });
  expect(ms).toBeLessThan(FIRST_VISIT_MS);
});

test('speed: reopening the app shows Home quickly', async ({ page, context }) => {
  await setUp(page, context);
  const start = Date.now();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  const ms = Date.now() - start;
  test.info().annotations.push({ type: 'reopen', description: `${ms} ms` });
  expect(ms).toBeLessThan(REOPEN_MS);
});

test('offline: the app reopens with no internet and still saves expenses', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright runs offline service workers in Chromium only (real iPhones do support them)');
  await setUp(page, context);
  // Wait until the offline copy is installed and in charge of this page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByText('₱1,000', { exact: true }).first()).toBeVisible();

  await addExpense(page, 40, 'Food', 'Offline lunch');
  await page.reload(); // still offline
  await expect(page.getByText('₱960', { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
});
