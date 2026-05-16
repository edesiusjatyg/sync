import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCandidates, recordSwipe } from '@/app/actions/swipe.actions';
import { resetDb, db } from '@/tests/helpers/db';
import { createUser, createProfile } from '@/tests/helpers/fixtures';
import { SwipeDirection } from '@prisma/client';
import { auth } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe('swipe.actions', () => {
  describe('getCandidates', () => {
    it('excludes users already swiped by current user and self', async () => {
      const user = await createUser();
      await createProfile(user.id);
      
      const candidate = await createUser();
      await createProfile(candidate.id);
      
      const swipedUser = await createUser();
      await createProfile(swipedUser.id);

      await db.swipe.create({
        data: { swiperId: user.id, targetId: swipedUser.id, direction: SwipeDirection.like },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await getCandidates({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].userId).toBe(candidate.id);
      }
    });

    it('returns candidates sorted by score descending', async () => {
      const user = await createUser();
      await createProfile(user.id, { matchingVector: [0.5, 0.5] });
      
      const candidate1 = await createUser();
      // Candidate 1 very different vector
      await createProfile(candidate1.id, { matchingVector: [1.0, 1.0] }); 
      
      const candidate2 = await createUser();
      // Candidate 2 identical vector
      await createProfile(candidate2.id, { matchingVector: [0.5, 0.5] });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await getCandidates({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        // We do not test exact mathematical output of matching here, 
        // just that it's sorted by compatibilityScore descending
        expect(result.data[0].compatibilityScore).toBeGreaterThanOrEqual(result.data[1].compatibilityScore);
      }
    });
  });

  describe('recordSwipe', () => {
    it('happy path: inserts Swipe record, returns matched: false when no reciprocal like', async () => {
      const user = await createUser();
      const target = await createUser();

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await recordSwipe({ targetId: target.id, direction: SwipeDirection.like });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matched).toBe(false);
      }

      const swipe = await db.swipe.findFirst({ where: { swiperId: user.id, targetId: target.id } });
      expect(swipe).toBeDefined();
    });

    it('mutual like: creates Match record, returns matched: true, matchId', async () => {
      const user = await createUser();
      const target = await createUser();
      await createProfile(user.id);
      await createProfile(target.id);

      // Target already swiped on User
      await db.swipe.create({
        data: { swiperId: target.id, targetId: user.id, direction: SwipeDirection.like },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await recordSwipe({ targetId: target.id, direction: SwipeDirection.like });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.matched).toBe(true);
        expect(result.matchId).toBeDefined();
      }

      const match = await db.match.findFirst({
        where: { userAId: user.id < target.id ? user.id : target.id },
      });
      expect(match).toBeDefined();
    });

    it('duplicate swipe on same target: returns success: false', async () => {
      const user = await createUser();
      const target = await createUser();

      await db.swipe.create({
        data: { swiperId: user.id, targetId: target.id, direction: SwipeDirection.pass },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await recordSwipe({ targetId: target.id, direction: SwipeDirection.like });

      expect(result.success).toBe(false);
    });
  });
});
