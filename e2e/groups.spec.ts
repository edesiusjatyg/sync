import { test, expect } from '@playwright/test';

test.describe('Groups Page', () => {
  test('requires authentication', async ({ page }) => {
    await page.goto('/groups');
    await expect(page).toHaveURL(/.*\/login/);
  });
});
