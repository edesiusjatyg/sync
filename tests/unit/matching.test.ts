import { describe, it, expect } from 'vitest';
import { computeMatchingVector, computeCompatibilityScore, rankCandidates } from '@/lib/matching';
import { GoalType } from '@prisma/client';

describe('Matching Algorithm', () => {
  const mockSkills = ['frontend', 'backend', 'design'];
  
  describe('computeMatchingVector', () => {
    it('computes correct vector for full profile', () => {
      const profile = {
        productiveHours: [6, 12],
        goalTypes: [GoalType.tugas, GoalType.riset]
      } as any;
      const userSkills = [
        { skillId: 'frontend', rating: 8 },
        { skillId: 'backend', rating: 4 }
      ] as any;
      
      const vector = computeMatchingVector(profile, userSkills, mockSkills);
      
      // Skills: 0.8, 0.4, 0
      // Hours: 0 (0), 1 (6), 1 (12), 0 (17), 0 (20)
      // Goals: 1 (tugas), 0 (side_project), 0 (kompetisi), 1 (riset), 0 (lainnya)
      expect(vector).toEqual([0.8, 0.4, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0]);
    });
    
    it('handles empty skills and hours', () => {
      const profile = {
        productiveHours: [],
        goalTypes: []
      } as any;
      
      const vector = computeMatchingVector(profile, [], mockSkills);
      
      expect(vector).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });
  });
  
  describe('computeCompatibilityScore', () => {
    it('returns score according to formula for identical vectors', () => {
      const v1 = [0.8, 0.4, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0];
      const v2 = [0.8, 0.4, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0];
      const score = computeCompatibilityScore(v1, v2);
      expect(score).toBe(0.5); 
    });
    
    it('handles completely disjoint vectors', () => {
      const v1 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
      const v2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const score = computeCompatibilityScore(v1, v2);
      expect(score).toBe(0.5);
    });

    it('handles zero overlap gracefully', () => {
      const v1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const v2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const score = computeCompatibilityScore(v1, v2);
      expect(score).toBe(0);
    });
  });
  
  describe('rankCandidates', () => {
    it('sorts correctly descending', () => {
      const currentUser = { vector: [0.8, 0.4, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0] };
      const candidates = [
        { userId: '2', vector: [0.8, 0.4, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0] }, // score 0.5
        { userId: '1', vector: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } // score 0.1333
      ];
      
      const ranked = rankCandidates(currentUser, candidates);
      expect(ranked[0].userId).toBe('2');
      expect(ranked[1].userId).toBe('1');
    });

    it('returns empty array when no candidates', () => {
      expect(rankCandidates({ vector: [] }, [])).toEqual([]);
    });

    it('returns single candidate', () => {
      const ranked = rankCandidates({ vector: [] }, [{ userId: '1', vector: [] }]);
      expect(ranked).toHaveLength(1);
    });
  });
});
