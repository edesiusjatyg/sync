import { describe, it, expect, beforeEach } from 'vitest';
import { logSession, submitEffectivenessScore } from '@/app/actions/session.actions';
import { createUserWithProfile, createGroup, createSession } from '../helpers/fixtures';
import { mockSession, clearSession } from '../helpers/auth';
import { testDb } from '../helpers/db';

describe('Session Server Actions', () => {
  beforeEach(() => {
    clearSession();
  });

  describe('logSession', () => {
    it('creates session successfully', async () => {
      const admin = await createUserWithProfile();
      const group = await createGroup(admin.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000);

      const result = await logSession({
        groupId: group.id,
        startedAt: now,
        endedAt: later,
        notes: 'Good session',
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        const session = await testDb.studySession.findUnique({ where: { id: result.data.sessionId } });
        expect(session).toBeDefined();
        expect(session!.notes).toBe('Good session');
      }
    });

    it('endedAt before startedAt returns error', async () => {
      const admin = await createUserWithProfile();
      const group = await createGroup(admin.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const now = new Date();
      const earlier = new Date(now.getTime() - 60 * 60 * 1000);

      const result = await logSession({
        groupId: group.id,
        startedAt: now,
        endedAt: earlier,
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('The session end time must be after the start time.');
      }
    });

    it('non-member cannot log session', async () => {
      const admin = await createUserWithProfile();
      const nonMember = await createUserWithProfile();
      const group = await createGroup(admin.id);

      mockSession({ id: nonMember.id, email: nonMember.email, name: nonMember.name, role: nonMember.role, hasCompletedOnboarding: true });

      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60 * 1000);

      const result = await logSession({
        groupId: group.id,
        startedAt: now,
        endedAt: later,
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });

  describe('submitEffectivenessScore', () => {
    it('session logger can submit score', async () => {
      const admin = await createUserWithProfile();
      const group = await createGroup(admin.id);
      const session = await createSession(group.id, admin.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const result = await submitEffectivenessScore({ sessionId: session.id, score: 4 });
      expect(result.success).toBe(true);
      
      const updatedSession = await testDb.studySession.findUnique({ where: { id: session.id } });
      expect(updatedSession!.effectivenessScore).toBe(4);
    });

    it('another user cannot submit score', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      const group = await createGroup(admin.id, [member.id]);
      const session = await createSession(group.id, admin.id); 

      mockSession({ id: member.id, email: member.email, name: member.name, role: member.role, hasCompletedOnboarding: true });

      const result = await submitEffectivenessScore({ sessionId: session.id, score: 4 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });

    it('score outside 1-5 returns error', async () => {
      const admin = await createUserWithProfile();
      const group = await createGroup(admin.id);
      const session = await createSession(group.id, admin.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const result = await submitEffectivenessScore({ sessionId: session.id, score: 6 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input.');
      }
    });
  });
});
