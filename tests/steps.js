// @ts-check
/*
 * steps.js — Shared student actions for the Playwright tests: set up a new account with the fake
 * Neon sign-in, and add an expense with the phone keypad.
 */
import { expect } from '@playwright/test';
import { fakeNeon } from './fake-neon.js';

/** Signs in (fake) and answers the setup questions: ₱1,500 weekly, class days off, ₱1,000 cash. */
export async function setUp(page, context) {
  const neon = await fakeNeon(context);
  await page.goto('/');
  // Already signed in, so setup skips Welcome and Sign in.
  await expect(page.getByRole('heading', { name: 'Whose device is this?' })).toBeVisible();
  await expect.poll(() => neon.state.keyChecked).toBe(true); // the "records online?" check answered "no"
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Tell us about your baon' })).toBeVisible();
  await page.getByLabel('How much do you get?').fill('1500');
  await page.getByRole('switch', { name: 'Count only class days' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'How much do you have now?' })).toBeVisible();
  await page.getByLabel('Cash in your wallet').fill('1000');
  await page.getByRole('button', { name: 'See my budget' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  return neon;
}

/** Adds an expense with the phone keypad: amount in whole pesos, a category, and a note. */
export async function addExpense(page, pesos, category, note) {
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add' });
  for (const digit of String(pesos)) await dialog.getByRole('button', { name: digit, exact: true }).click();
  await dialog.getByRole('radio', { name: category }).click();
  await dialog.getByLabel('Note').fill(note);
  await dialog.getByRole('button', { name: 'Save expense' }).click();
  await expect(dialog).toBeHidden();
}
