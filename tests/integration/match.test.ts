import { describe, it, expect, beforeEach } from 'vitest';
import { getMyMatches, updateMatchStatus } from '@/app/actions/match.actions';
import { createUserWithProfile, createMatch } from '../helpers/fixtures';
import { mockSession, clearSession } from '../helpers/auth';
import { MatchStatus } from '@prisma/client';

describe('Match Server Actions', () => {
  beforeEach(() => {
    clearSession();
  });

  describe('getMyMatches', () => {
    it('returns matches where current user is userA or userB', async () => {
      const userA = await createUserWithProfile();
      const userB = await createUserWithProfile();
      const userC = await createUserWithProfile();

      await createMatch(userA.id, userB.id, MatchStatus.accepted);
      await createMatch(userC.id, userA.id, MatchStatus.accepted);

      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await getMyMatches();
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        const peers = result.data.map(m => m.peer.userId);
        expect(peers).toContain(userB.id);
        expect(peers).toContain(userC.id);
      }
    });

    it('does not return declined or pending matches', async () => {
      const userA = await createUserWithProfile();
      const userB = await createUserWithProfile();
      
      await createMatch(userA.id, userB.id, MatchStatus.declined);

      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await getMyMatches();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns empty array when no matches', async () => {
      const userA = await createUserWithProfile();
      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await getMyMatches();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe('updateMatchStatus', () => {
    it('user can accept a match', async () => {
      const userA = await createUserWithProfile();
      const userB = await createUserWithProfile();
      
      const match = await createMatch(userA.id, userB.id, MatchStatus.pending);

      mockSession({
        id: userA.id,
        email: userA.email,
        name: userA.name,
        role: userA.role,
        hasCompletedOnboarding: true,
      });

      const result = await updateMatchStatus({ matchId: match.id, status: MatchStatus.accepted });
      
      expect(result.success).toBe(true);
    });

    it('unrelated user cannot update match', async () => {
      const userA = await createUserWithProfile();
      const userB = await createUserWithProfile();
      const userC = await createUserWithProfile();
      
      const match = await createMatch(userA.id, userB.id, MatchStatus.pending);

      mockSession({
        id: userC.id,
        email: userC.email,
        name: userC.name,
        role: userC.role,
        hasCompletedOnboarding: true,
      });

      const result = await updateMatchStatus({ matchId: match.id, status: MatchStatus.accepted });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });
});
