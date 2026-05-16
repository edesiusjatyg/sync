import { test, expect } from '@playwright/test';
import { db, resetDb } from '../tests/helpers/db';
import { createUser } from '../tests/helpers/fixtures';
import { UserRole } from '@prisma/client';

test.beforeEach(async () => {
  await resetDb();
});

test.describe('Flow 1 — Registration & Onboarding', () => {
  test('Complete registration and onboarding flow', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;

    // 1. Navigate to /register
    await page.goto('/register');

    // 2. Fill in name, email, password -> submit
    // Note: Assuming standard shadcn/ui and react-hook-form input names
    await page.getByLabel(/name/i).fill('New User');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('securepassword123');
    await page.getByRole('button', { name: /register|sign up/i }).click();

    // 3. Expect redirect to /onboarding
    await expect(page).toHaveURL(/\/onboarding/);

    // 4. Complete Step 1 (select 2+ skills, assign ratings)
    // Assume there is a way to select skills. Using broad selectors.
    await page.getByRole('button', { name: /add skill/i }).first().click();
    await page.getByRole('button', { name: /add skill/i }).nth(1).click();
    await page.getByRole('button', { name: /next/i }).click();

    // 5. Complete Step 2 (select productive hours)
    await page.getByRole('button', { name: /pagi|morning/i }).click();
    await page.getByRole('button', { name: /next/i }).click();

    // 6. Complete Step 3 (select work style)
    await page.getByRole('button', { name: /async/i }).click();
    await page.getByRole('button', { name: /milestone/i }).click();
    await page.getByRole('button', { name: /flexible/i }).click();
    await page.getByRole('button', { name: /next/i }).click();

    // 7. Complete Step 4 (select goal types) -> submit
    await page.getByText(/tugas/i).click();
    await page.getByRole('button', { name: /finish|submit/i }).click();

    // 8. Expect redirect to /discover
    await expect(page).toHaveURL(/\/discover/);

    // 9. Assert profile card is not shown for the current user themselves
    // Assuming the user's name is rendered on a card
    await expect(page.getByText('New User', { exact: true })).not.toBeVisible();
  });
});

test.describe('Flow 5 — Authorization Guard (negative path)', () => {
  test('Redirect to login when unauthenticated', async ({ page }) => {
    // 1. Attempt to navigate to /discover without a session
    await page.goto('/discover');
    // 2. Assert redirect to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('Redirect to onboarding when profile is incomplete', async ({ page }) => {
    const user = await createUser({ email: `noprofile-${Date.now()}@test.com` });

    // 3. Log in as a user with no completed profile
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // 4. Assert redirect to /onboarding
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test('Redirect admin to admin dashboard', async ({ page }) => {
    const admin = await createUser({ email: `admin-${Date.now()}@test.com`, role: UserRole.admin });

    // Log in
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(admin.email);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // 5. Log in as a user with admin role landing on discover
    await page.goto('/discover');

    // 6. Assert redirect to /admin, not /discover
    await expect(page).toHaveURL(/\/admin/);
  });
});
