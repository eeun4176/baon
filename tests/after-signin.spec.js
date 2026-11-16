// @ts-check
/*
 * after-signin.spec.js — The app after sign-in, with a fake Neon (tests/fake-neon.js): no real
 * account, and nothing reaches the real database.
 * Functional: setup → Home, add an expense, it shows in History, it stays after reopening, every tab opens.
 * Non-functional: records sync scrambled (no amounts or notes readable on the server), no requests
 * to unknown servers, no sideways scrolling on a phone, adding works with no internet.
 */
import { test, expect } from '@playwright/test';
import { addExpense, setUp } from './steps.js';

test.describe('functional', () => {
  test('setup leads to Home with the right money left', async ({ page, context }) => {
    await setUp(page, context);
    await expect(page.getByText('₱1,000', { exact: true }).first()).toBeVisible();
  });

  test('an expense lowers the money left and shows in History', async ({ page, context }) => {
    await setUp(page, context);
    await addExpense(page, 50, 'Food', 'Lunch test');
    await expect(page.getByText(/Saved ₱50 · Lunch test/)).toBeVisible();
    await expect(page.getByText('₱950', { exact: true }).first()).toBeVisible();

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click();
    await expect(page.getByRole('button', { name: /^Lunch test, −₱50, Food/ })).toBeVisible();
  });

  test('records stay after closing and reopening the app', async ({ page, context }) => {
    await setUp(page, context);
    await addExpense(page, 75, 'Fare', 'Jeep test');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByText('₱925', { exact: true }).first()).toBeVisible();
  });

  test('every tab opens with its title', async ({ page, context }) => {
    await setUp(page, context);
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [tab, title] of [['History', 'History'], ['Plan', 'Plan'], ['Me', 'Me'], ['Home', 'Baon']]) {
      await nav.getByRole('link', { name: tab, exact: true }).click();
      await expect(page).toHaveTitle(new RegExp(`^${title} \\|`));
    }
  });
});

test.describe('non-functional', () => {
  test('security: synced records are scrambled and nothing goes to unknown servers', async ({ page, context }) => {
    const neon = await setUp(page, context);
    await addExpense(page, 120, 'Food', 'Secret note 7391');
    await expect.poll(() => neon.state.records.size, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => [...neon.state.records.values()].some((r) => r.type === 'transaction'), { timeout: 15_000 }).toBe(true);

    for (const r of neon.state.records.values()) {
      const raw = JSON.stringify(r) + Buffer.from(r.ciphertext, 'base64').toString('latin1');
      expect(raw).not.toContain('Secret note 7391');
      expect(raw).not.toContain('12000'); // ₱120 in centavos
    }
    expect(neon.state.key?.dek).toBeTruthy(); // the account key went to the (fake) server, as designed
    expect(neon.state.blocked).toEqual([]);
  });

  test('phone layout: no sideways scrolling on any tab', async ({ page, context }) => {
    await setUp(page, context);
    // A long wallet row once widened the whole Home page (it must scroll inside its card instead).
    await page.goto('/me');
    for (const name of ['GCash', 'Maya', 'BPI', 'SeaBank', 'GoTyme']) {
      await page.getByRole('button', { name: 'Add a wallet' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByRole('button', { name: 'Add wallet' }).click();
      await expect(dialog).toBeHidden();
    }
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const tab of ['Home', 'History', 'Plan', 'Me']) {
      await nav.getByRole('link', { name: tab, exact: true }).click();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${tab} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test('offline: adding an expense works with no internet', async ({ page, context }) => {
    await setUp(page, context);
    await context.setOffline(true);
    await addExpense(page, 30, 'Fare', 'Offline test');
    await expect(page.getByText('₱970', { exact: true }).first()).toBeVisible();
    await context.setOffline(false);
  });
  // Speed and "reopen with no internet": offline-speed.spec.js.
});
