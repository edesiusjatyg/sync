import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logSession, submitEffectivenessScore } from '@/app/actions/session.actions';
import { resetDb, db } from '@/tests/helpers/db';
import { createUser } from '@/tests/helpers/fixtures';
import { GoalType, GroupMemberRole } from '@prisma/client';
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

describe('session.actions', () => {
  describe('logSession', () => {
    it('happy path: creates StudySession record', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const startedAt = new Date();
      const endedAt = new Date(startedAt.getTime() + 60 * 60 * 1000); // 1 hour later

      const result = await logSession({ groupId: group.id, startedAt, endedAt });
      
      expect(result.success).toBe(true);
      if (result.success) {
        const session = await db.studySession.findUnique({ where: { id: result.sessionId } });
        expect(session).toBeDefined();
      }
    });

    it('endedAt before startedAt: returns success: false', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const startedAt = new Date();
      const endedAt = new Date(startedAt.getTime() - 60 * 60 * 1000); // 1 hour earlier

      const result = await logSession({ groupId: group.id, startedAt, endedAt });
      expect(result.success).toBe(false);
    });

    it('non-member cannot log session for a group', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: 'someone', goalTypes: [GoalType.tugas] },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const startedAt = new Date();
      const endedAt = new Date(startedAt.getTime() + 60 * 60 * 1000);

      const result = await logSession({ groupId: group.id, startedAt, endedAt });
      expect(result.success).toBe(false);
    });
  });

  describe('submitEffectivenessScore', () => {
    it('session logger can submit score', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });

      const session = await db.studySession.create({
        data: { groupId: group.id, loggedById: user.id, startedAt: new Date(), endedAt: new Date() },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await submitEffectivenessScore({ sessionId: session.id, score: 4 });
      expect(result.success).toBe(true);

      const updatedSession = await db.studySession.findUnique({ where: { id: session.id } });
      expect(updatedSession?.effectivenessScore).toBe(4);
    });

    it('another user cannot submit score for someone elses session', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      
      const session = await db.studySession.create({
        data: { groupId: group.id, loggedById: otherUser.id, startedAt: new Date(), endedAt: new Date() },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await submitEffectivenessScore({ sessionId: session.id, score: 4 });
      expect(result.success).toBe(false);
    });

    it('score outside 1–5 range: returns success: false', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      const session = await db.studySession.create({
        data: { groupId: group.id, loggedById: user.id, startedAt: new Date(), endedAt: new Date() },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await submitEffectivenessScore({ sessionId: session.id, score: 6 as any });
      expect(result.success).toBe(false);
    });
  });
});
