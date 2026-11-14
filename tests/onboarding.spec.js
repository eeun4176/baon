// @ts-check
/*
 * onboarding.spec.js — Smoke test of a brand-new visitor's first screens (no sign-in needed):
 * Welcome loads with the right title, "Get started" opens Sign in, and email sign-in only
 * enables "Send code" once the email looks real. Stops before anything that calls Neon.
 */
import { test, expect } from '@playwright/test';

test('a new visitor sees Welcome', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Baon | Student Budget Tracker');
  await expect(page.getByRole('heading', { name: 'Know what you can spend today.' })).toBeVisible();
});

test('Get started opens Sign in, and email needs an @ before Send code', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to get started' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

  await page.getByRole('button', { name: 'Use email instead' }).click();
  const send = page.getByRole('button', { name: 'Send code' });
  await expect(send).toBeDisabled();
  await page.getByLabel('Your email').fill('student@example.com');
  await expect(send).toBeEnabled();
});
