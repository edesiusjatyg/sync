import { describe, it, expect, beforeEach } from 'vitest';
import { saveOnboardingProfile, getMyProfile } from '@/app/actions/profile.actions';
import { createUser, createUserWithProfile } from '../helpers/fixtures';
import { mockSession, clearSession } from '../helpers/auth';
import { testDb } from '../helpers/db';
import { WorkStyleSync, WorkStyleDriven, WorkStyleRole, GoalType } from '@prisma/client';

describe('Profile Server Actions', () => {
  beforeEach(() => {
    clearSession();
  });

  describe('saveOnboardingProfile', () => {
    it('creates profile and populates matching vector', async () => {
      const user = await createUser();
      mockSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasCompletedOnboarding: false,
      });

      const s1 = await testDb.skill.create({ data: { name: 'React', category: 'Frontend' } });

      const input = {
        productiveHours: [6, 12],
        workStyleSync: WorkStyleSync.async,
        workStyleDriven: WorkStyleDriven.milestone,
        workStyleRole: WorkStyleRole.flexible,
        goalTypes: [GoalType.tugas],
        skills: [{ skillId: s1.id, rating: 8 }],
      };

      const result = await saveOnboardingProfile(input);
      expect(result.success).toBe(true);

      const profileInDb = await testDb.profile.findUnique({ where: { userId: user.id } });
      expect(profileInDb).toBeDefined();
      expect(profileInDb!.matchingVector.length).toBeGreaterThan(0);
    });

    it('upserts correctly when called twice', async () => {
      const user = await createUser();
      mockSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasCompletedOnboarding: false,
      });

      const s1 = await testDb.skill.create({ data: { name: 'Node.js', category: 'Backend' } });

      const input = {
        productiveHours: [6],
        workStyleSync: WorkStyleSync.sync,
        workStyleDriven: WorkStyleDriven.deadline,
        workStyleRole: WorkStyleRole.leader,
        goalTypes: [GoalType.side_project],
        skills: [{ skillId: s1.id, rating: 5 }],
      };

      await saveOnboardingProfile(input);
      
      const input2 = {
        ...input,
        skills: [{ skillId: s1.id, rating: 9 }], 
      };

      const result = await saveOnboardingProfile(input2);
      expect(result.success).toBe(true);

      const userSkills = await testDb.userSkill.findMany({ where: { userId: user.id } });
      expect(userSkills).toHaveLength(1);
      expect(userSkills[0].rating).toBe(9);
    });

    it('returns error on empty skills', async () => {
      const user = await createUser();
      mockSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasCompletedOnboarding: false,
      });

      const result = await saveOnboardingProfile({
        productiveHours: [6, 12],
        workStyleSync: WorkStyleSync.async,
        workStyleDriven: WorkStyleDriven.milestone,
        workStyleRole: WorkStyleRole.flexible,
        goalTypes: [GoalType.tugas],
        skills: [],
      } as any);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input.');
      }
    });

    it('returns error when unauthenticated', async () => {
      const result = await saveOnboardingProfile({
        productiveHours: [6, 12],
        workStyleSync: WorkStyleSync.async,
        workStyleDriven: WorkStyleDriven.milestone,
        workStyleRole: WorkStyleRole.flexible,
        goalTypes: [GoalType.tugas],
        skills: [{ skillId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', rating: 5 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });

  describe('getMyProfile', () => {
    it('returns profile with skills for user with profile', async () => {
      await testDb.skill.create({ data: { name: 'TypeScript', category: 'Frontend' } });
      const user = await createUserWithProfile();
      
      mockSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasCompletedOnboarding: true,
      });

      const result = await getMyProfile();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toBeNull();
        expect(result.data?.skills).toBeDefined();
        expect(result.data?.skills.length).toBeGreaterThan(0);
      }
    });

    it('returns null data when no profile exists', async () => {
      const user = await createUser();
      mockSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasCompletedOnboarding: false,
      });

      const result = await getMyProfile();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('returns error when unauthenticated', async () => {
      const result = await getMyProfile();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });
});
