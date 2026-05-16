import { test, expect } from '@playwright/test';
import { resetDb, db } from '../tests/helpers/db';
import { createUser, createProfile } from '../tests/helpers/fixtures';
import { SwipeDirection } from '@prisma/client';

test.beforeEach(async () => {
  await resetDb();
});

test.describe('Flow 2 — Discover & Match', () => {
  test('Swipe right and create mutual match', async ({ page }) => {
    // 1. Seed: User A (logged in) and User B with compatible profiles
    const userA = await createUser({ email: 'usera@test.com', name: 'User A' });
    await createProfile(userA.id, { matchingVector: [0.5, 0.5] });

    const userB = await createUser({ email: 'userb@test.com', name: 'User B' });
    await createProfile(userB.id, { matchingVector: [0.5, 0.5] });

    // 2. Seed: User B has already swiped like on User A
    await db.swipe.create({
      data: { swiperId: userB.id, targetId: userA.id, direction: SwipeDirection.like },
    });

    // 3. Log in as User A, navigate to /discover
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(userA.email);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.goto('/discover');

    // 4. Assert User B's card is visible
    await expect(page.getByText('User B')).toBeVisible();

    // 5. Click Like on User B's card
    // Assuming shadcn/ui button with "Like" or check icon
    await page.getByRole('button', { name: /like|match/i }).click();

    // 6. Assert match notification dialog appears
    // Dialog should have text "It's a match!"
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/it's a match/i)).toBeVisible();

    // 7. Navigate to /matches
    await page.goto('/matches');

    // 8. Assert User B appears in the match list
    await expect(page.getByText('User B')).toBeVisible();
  });
});
