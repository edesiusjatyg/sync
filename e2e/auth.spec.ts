import { test, expect } from '@playwright/test';

test.describe('Authentication and Routing', () => {
  test('unauthenticated users are redirected to login', async ({ page }) => {
    await page.goto('/discover');
    await expect(page).toHaveURL(/.*\/login/);

    await page.goto('/groups');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('registration page renders', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText(/Create an account/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText(/Sign In/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
