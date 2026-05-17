import { describe, it, expect, beforeEach } from 'vitest';
import { getCandidates, recordSwipe } from '@/app/actions/swipe.actions';
import { createUserWithProfile } from '../helpers/fixtures';
import { mockSession, clearSession } from '../helpers/auth';
import { testDb } from '../helpers/db';
import { SwipeDirection } from '@prisma/client';

describe('Swipe Server Actions', () => {
  beforeEach(async () => {
    clearSession();
    await testDb.skill.createMany({
      data: [
        { name: 'Python', category: 'Backend' },
        { name: 'Java', category: 'Backend' },
        { name: 'Go', category: 'Backend' },
      ],
      skipDuplicates: true,
    });
  });

  describe('getCandidates', () => {
    it('excludes swiped users and self', async () => {
      const userA = await createUserWithProfile({ email: 'a@test.com' });
      const userB = await createUserWithProfile({ email: 'b@test.com' }); 
      const userC = await createUserWithProfile({ email: 'c@test.com' }); 
      
      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      await testDb.swipe.create({
        data: {
          swiperId: userA.id,
          targetId: userB.id,
          direction: SwipeDirection.pass,
        }
      });

      const result = await getCandidates();
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        const candidateIds = result.data.map(c => c.userId);
        expect(candidateIds).not.toContain(userA.id);
        expect(candidateIds).not.toContain(userB.id);
        expect(candidateIds).toContain(userC.id);
      }
    });

    it('returns empty array when no candidates exist', async () => {
      const userA = await createUserWithProfile();
      
      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await getCandidates();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns error when unauthenticated', async () => {
      const result = await getCandidates();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });

  describe('recordSwipe', () => {
    it('like without reciprocal creates swipe and returns matched: false', async () => {
      const userA = await createUserWithProfile({ email: 'swiper@test.com' });
      const userB = await createUserWithProfile({ email: 'target@test.com' });
      
      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await recordSwipe({ targetId: userB.id, direction: SwipeDirection.like });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matched).toBe(false);
      }

      const swipe = await testDb.swipe.findUnique({
        where: { swiperId_targetId: { swiperId: userA.id, targetId: userB.id } }
      });
      expect(swipe).toBeDefined();
      expect(swipe!.direction).toBe(SwipeDirection.like);
    });

    it('like with reciprocal creates match and returns matched: true', async () => {
      const userA = await createUserWithProfile({ email: 'a1@test.com' });
      const userB = await createUserWithProfile({ email: 'b1@test.com' });
      
      await testDb.swipe.create({
        data: {
          swiperId: userB.id,
          targetId: userA.id,
          direction: SwipeDirection.like,
        }
      });

      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await recordSwipe({ targetId: userB.id, direction: SwipeDirection.like });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matched).toBe(true);
        expect(result.data.matchId).toBeDefined();
      }

      const match = await testDb.match.findFirst({
        where: {
          OR: [
            { userAId: userA.id, userBId: userB.id },
            { userAId: userB.id, userBId: userA.id },
          ]
        }
      });
      expect(match).toBeDefined();
    });

    it('pass creates swipe and returns matched: false', async () => {
      const userA = await createUserWithProfile({ email: 'a2@test.com' });
      const userB = await createUserWithProfile({ email: 'b2@test.com' });
      
      await testDb.swipe.create({
        data: {
          swiperId: userB.id,
          targetId: userA.id,
          direction: SwipeDirection.like,
        }
      });

      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await recordSwipe({ targetId: userB.id, direction: SwipeDirection.pass });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matched).toBe(false);
      }
      
      const match = await testDb.match.findFirst({
        where: {
          OR: [
            { userAId: userA.id, userBId: userB.id },
            { userAId: userB.id, userBId: userA.id },
          ]
        }
      });
      expect(match).toBeNull();
    });

    it('returns user-friendly error on duplicate swipe', async () => {
      const userA = await createUserWithProfile({ email: 'a3@test.com' });
      const userB = await createUserWithProfile({ email: 'b3@test.com' });
      
      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      await recordSwipe({ targetId: userB.id, direction: SwipeDirection.like });
      const result = await recordSwipe({ targetId: userB.id, direction: SwipeDirection.like });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('You have already swiped this user.');
      }
    });

    it('returns error when unauthenticated', async () => {
      const result = await recordSwipe({ targetId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', direction: SwipeDirection.like });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });
});
