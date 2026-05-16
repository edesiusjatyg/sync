import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveOnboardingProfile, getMyProfile } from '@/app/actions/profile.actions';
import { resetDb, db } from '@/tests/helpers/db';
import { createUser, createSkill } from '@/tests/helpers/fixtures';
import { GoalType, WorkStyleDriven, WorkStyleRole, WorkStyleSync } from '@prisma/client';
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

describe('profile.actions', () => {
  describe('saveOnboardingProfile', () => {
    it('creates Profile + UserSkills, populates matchingVector as non-empty float array', async () => {
      const user = await createUser();
      const skill = await createSkill();

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: false },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await saveOnboardingProfile({
        bio: 'Hello world',
        productiveHours: [9, 10, 11],
        workStyleSync: WorkStyleSync.async,
        workStyleDriven: WorkStyleDriven.milestone,
        workStyleRole: WorkStyleRole.flexible,
        goalTypes: [GoalType.tugas],
        skills: [{ skillId: skill.id, rating: 8 }],
      });

      expect(result.success).toBe(true);

      const profile = await db.profile.findUnique({
        where: { userId: user.id },
      });

      expect(profile).toBeDefined();
      expect(profile?.bio).toBe('Hello world');
      expect(profile?.matchingVector.length).toBeGreaterThan(0);

      const userSkills = await db.userSkill.findMany({
        where: { userId: user.id },
      });

      expect(userSkills).toHaveLength(1);
      expect(userSkills[0].rating).toBe(8);
    });

    it('upserts correctly when called twice, does not duplicate UserSkills', async () => {
      const user = await createUser();
      const skill = await createSkill();

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: false },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      // First call
      await saveOnboardingProfile({
        productiveHours: [9],
        workStyleSync: WorkStyleSync.async,
        workStyleDriven: WorkStyleDriven.milestone,
        workStyleRole: WorkStyleRole.flexible,
        goalTypes: [GoalType.tugas],
        skills: [{ skillId: skill.id, rating: 5 }],
      });

      // Second call (update)
      const result = await saveOnboardingProfile({
        productiveHours: [10],
        workStyleSync: WorkStyleSync.sync,
        workStyleDriven: WorkStyleDriven.deadline,
        workStyleRole: WorkStyleRole.leader,
        goalTypes: [GoalType.kompetisi],
        skills: [{ skillId: skill.id, rating: 9 }],
      });

      expect(result.success).toBe(true);

      const userSkills = await db.userSkill.findMany({
        where: { userId: user.id },
      });
      expect(userSkills).toHaveLength(1);
      expect(userSkills[0].rating).toBe(9);

      const profile = await db.profile.findUnique({
        where: { userId: user.id },
      });
      expect(profile?.productiveHours).toEqual([10]);
    });
  });

  describe('getMyProfile', () => {
    it('returns profile with skills for authenticated user', async () => {
      const user = await createUser();
      const skill = await createSkill();

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: false },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      await saveOnboardingProfile({
        productiveHours: [9],
        workStyleSync: WorkStyleSync.async,
        workStyleDriven: WorkStyleDriven.milestone,
        workStyleRole: WorkStyleRole.flexible,
        goalTypes: [GoalType.tugas],
        skills: [{ skillId: skill.id, rating: 5 }],
      });

      const result = await getMyProfile();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(user.id);
      }
    });

    it('returns success: false when no profile exists yet', async () => {
      const user = await createUser();

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: false },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await getMyProfile();

      expect(result.success).toBe(false);
    });
  });
});
