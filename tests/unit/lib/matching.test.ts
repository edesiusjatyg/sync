import { describe, it, expect } from 'vitest';
import { computeMatchingVector, computeCompatibilityScore, rankCandidates } from '@/lib/matching';
import { GoalType, WorkStyleDriven, WorkStyleRole, WorkStyleSync } from '@prisma/client';

describe('matching.ts', () => {
  describe('computeMatchingVector', () => {
    it('computes correct vector based on profile, skills, and full skill list', () => {
      const profile = {
        id: '1',
        userId: '1',
        bio: '',
        productiveHours: [6, 12],
        workStyleSync: WorkStyleSync.async,
        workStyleDriven: WorkStyleDriven.milestone,
        workStyleRole: WorkStyleRole.flexible,
        goalTypes: [GoalType.tugas, GoalType.riset],
        matchingVector: [],
        updatedAt: new Date(),
      };
      
      const userSkills = [
        { skillId: 's1', userId: '1', rating: 8 },
        { skillId: 's3', userId: '1', rating: 5 },
      ];
      
      const allSkillIds = ['s1', 's2', 's3'];

      const vector = computeMatchingVector(profile, userSkills, allSkillIds);

      // Skill block: s1 -> 0.8, s2 -> 0.0, s3 -> 0.5
      const skillBlock = [0.8, 0, 0.5];

      // Schedule block [0, 6, 12, 17, 20]
      // profile has 6, 12 -> [0, 1, 1, 0, 0]
      const scheduleBlock = [0, 1, 1, 0, 0];

      // Goal block [tugas, side_project, kompetisi, riset, lainnya]
      // profile has tugas, riset -> [1, 0, 0, 1, 0]
      const goalsBlock = [1, 0, 0, 1, 0];

      expect(vector).toEqual([...skillBlock, ...scheduleBlock, ...goalsBlock]);
    });

    it('handles empty arrays properly', () => {
      const profile = {
        id: '2',
        userId: '2',
        bio: null,
        productiveHours: [],
        workStyleSync: WorkStyleSync.sync,
        workStyleDriven: WorkStyleDriven.deadline,
        workStyleRole: WorkStyleRole.leader,
        goalTypes: [],
        matchingVector: [],
        updatedAt: new Date(),
      };
      
      const userSkills: any[] = [];
      const allSkillIds: string[] = [];

      const vector = computeMatchingVector(profile, userSkills, allSkillIds);
      
      // Empty skill block
      // Empty schedule (all 0)
      const scheduleBlock = [0, 0, 0, 0, 0];
      // Empty goals (all 0)
      const goalsBlock = [0, 0, 0, 0, 0];

      expect(vector).toEqual([...scheduleBlock, ...goalsBlock]);
    });
  });

  describe('computeCompatibilityScore', () => {
    it('computes correct weighted combination score', () => {
      // Structure: N skills, 5 schedule, 5 goals
      // Let's use 2 skills
      const userA = [
        0.5, 0.5,          // skills
        0, 1, 1, 0, 0,     // schedule
        1, 0, 0, 1, 0      // goals
      ];
      
      const userB = [
        1.0, 0.0,          // skills
        0, 1, 1, 0, 0,     // schedule
        0, 1, 0, 1, 0      // goals
      ];
      
      // Skill diff: abs(0.5-1.0) + abs(0.5-0.0) = 1.0. Avg (count 2) = 0.5
      // Schedule Jaccard: overlap 2, total 2 => 1.0
      // Goals Jaccard: overlap 1 (riset), total 3 (tugas, side_project, riset) => 0.3333
      
      // Math: 0.5 * 0.5 + 0.3 * 1.0 + 0.2 * (1/3) 
      // = 0.25 + 0.3 + 0.06666 = 0.61666...
      
      const score = computeCompatibilityScore(userA, userB);
      expect(score).toBeCloseTo(0.6167, 3);
    });

    it('returns 0 for schedules/goals if no overlap', () => {
      const userA = [
        0.0,               // 1 skill
        1, 0, 0, 0, 0,     // schedule
        1, 0, 0, 0, 0      // goals
      ];
      const userB = [
        0.0,
        0, 1, 0, 0, 0,
        0, 1, 0, 0, 0
      ];

      // Skill diff: 0 => skill score 0
      // Schedule overlap: 0 => schedule score 0
      // Goals overlap: 0 => goals score 0
      const score = computeCompatibilityScore(userA, userB);
      expect(score).toBe(0);
    });
  });

  describe('rankCandidates', () => {
    it('sorts candidates by descending compatibility score', () => {
      const currentUser = { vector: [0.5, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0] }; // 1 skill
      const candidate1 = { userId: 'c1', vector: [0.5, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0] }; // Identical (Score depends on logic, should be high or low but consistent)
      const candidate2 = { userId: 'c2', vector: [1.0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0] }; // Different

      // candidate1: skill score 0, schedule 1.0, goals 1.0 => 0.5(0) + 0.3(1) + 0.2(1) = 0.5
      // candidate2: skill score (abs(0.5-1.0)/1)=0.5, schedule overlap 0 => 0, goals overlap 0 => 0 => 0.5(0.5) + 0 + 0 = 0.25
      
      const ranked = rankCandidates(currentUser, [candidate2, candidate1]);
      
      expect(ranked[0].userId).toBe('c1');
      expect(ranked[1].userId).toBe('c2');
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });
  });
});
