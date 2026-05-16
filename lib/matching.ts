import type { Profile, UserSkill } from "@prisma/client";
import { GoalType } from "@prisma/client";

const SCHEDULE_SLOTS = [0, 6, 12, 17, 20] as const;
const GOAL_ORDER = [
  GoalType.tugas,
  GoalType.side_project,
  GoalType.kompetisi,
  GoalType.riset,
  GoalType.lainnya,
] as const;

function jaccardBinaryBlock(left: number[], right: number[]) {
  let overlap = 0;
  let total = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    if (leftValue === 1 || rightValue === 1) {
      total += 1;
    }

    if (leftValue === 1 && rightValue === 1) {
      overlap += 1;
    }
  }

  return total === 0 ? 0 : overlap / total;
}

export function computeMatchingVector(
  profile: Profile,
  userSkills: UserSkill[],
  allSkillIds: string[],
) {
  const ratingBySkillId = new Map(userSkills.map((userSkill) => [userSkill.skillId, userSkill.rating / 10]));

  const skillBlock = allSkillIds.map((skillId) => ratingBySkillId.get(skillId) ?? 0);
  const scheduleBlock = SCHEDULE_SLOTS.map((slot) => (profile.productiveHours.includes(slot) ? 1 : 0));
  const goalsBlock = GOAL_ORDER.map((goalType) => (profile.goalTypes.includes(goalType) ? 1 : 0));

  return [...skillBlock, ...scheduleBlock, ...goalsBlock];
}

export function computeCompatibilityScore(userVector: number[], candidateVector: number[]) {
  const baseVectorLength = Math.max(userVector.length, candidateVector.length);
  const skillCount = Math.max(0, baseVectorLength - SCHEDULE_SLOTS.length - GOAL_ORDER.length);
  const scheduleOffset = skillCount;
  const goalsOffset = scheduleOffset + SCHEDULE_SLOTS.length;

  const userSkills = userVector.slice(0, skillCount);
  const candidateSkills = candidateVector.slice(0, skillCount);
  const userSchedule = userVector.slice(scheduleOffset, goalsOffset);
  const candidateSchedule = candidateVector.slice(scheduleOffset, goalsOffset);
  const userGoals = userVector.slice(goalsOffset);
  const candidateGoals = candidateVector.slice(goalsOffset);

  const skillScore =
    userSkills.reduce((sum, rating, index) => sum + Math.abs(rating - (candidateSkills[index] ?? 0)), 0) /
    Math.max(skillCount, 1);
  const scheduleScore = jaccardBinaryBlock(userSchedule, candidateSchedule);
  const goalsScore = jaccardBinaryBlock(userGoals, candidateGoals);

  return Number((0.5 * skillScore + 0.3 * scheduleScore + 0.2 * goalsScore).toFixed(4));
}

export function rankCandidates(
  currentUser: { vector: number[] },
  candidates: { userId: string; vector: number[] }[],
) {
  return candidates
    .map((candidate) => ({
      userId: candidate.userId,
      score: computeCompatibilityScore(currentUser.vector, candidate.vector),
    }))
    .sort((left, right) => right.score - left.score);
}
