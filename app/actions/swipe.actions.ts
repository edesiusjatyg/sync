'use server';

import { revalidatePath } from "next/cache";
import { MatchStatus, SwipeDirection } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { cached, invalidate, CacheKey, TTL } from "@/lib/cache";
import { db } from "@/lib/db";
import { rankCandidates, computeCompatibilityScore } from "@/lib/matching";
import {
  AuthorizationError,
  getActionErrorMessage,
  getSessionUser,
  logActionError,
  normalizeMatchPair,
  type DataActionResult,
} from "@/lib/utils";

const getCandidatesSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

const recordSwipeSchema = z.object({
  targetId: z.string().uuid(),
  direction: z.nativeEnum(SwipeDirection),
});

interface CandidateCard {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  skills: { name: string; category: string; rating: number }[];
  productiveHours: number[];
  goalTypes: string[];
  compatibilityScore: number;
}

async function getAuthenticatedUser() {
  const user = getSessionUser(await auth());

  if (!user) {
    throw new AuthorizationError();
  }

  return user;
}

export async function getCandidates(
  input?: Partial<z.infer<typeof getCandidatesSchema>>,
): Promise<DataActionResult<CandidateCard[]>> {
  try {
    const user = await getAuthenticatedUser();
    const { limit } = getCandidatesSchema.parse(input ?? {});

    if (!user.hasCompletedOnboarding) {
      return { success: true, data: [] };
    }

    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        swipesGiven: {
          select: {
            targetId: true,
          },
        },
        profile: {
          select: {
            matchingVector: true,
          },
        },
      },
    });

    if (!currentUser?.profile || currentUser.profile.matchingVector.length === 0) {
      return { success: true, data: [] };
    }

    const excludedUserIds = [user.id, ...currentUser.swipesGiven.map((swipe) => swipe.targetId)];

    const candidates = await db.user.findMany({
      where: {
        id: { notIn: excludedUserIds },
        isActive: true,
        profile: {
          isNot: null,
        },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        userSkills: {
          include: {
            skill: {
              select: {
                name: true,
                category: true,
              },
            },
          },
          orderBy: {
            rating: "desc",
          },
        },
        profile: {
          select: {
            bio: true,
            productiveHours: true,
            goalTypes: true,
            matchingVector: true,
          },
        },
      },
      take: 500,
    });

    const eligibleCandidates = candidates.filter(
      (candidate) =>
        candidate.profile &&
        candidate.profile.matchingVector.length > 0 &&
        candidate.profile.goalTypes.length > 0 &&
        candidate.userSkills.length > 0,
    );

    const data = await cached(
      CacheKey.candidates(user.id),
      async () => {
        const rankedCandidates = rankCandidates(
          { vector: currentUser.profile!.matchingVector },
          eligibleCandidates.map((candidate) => ({
            userId: candidate.id,
            vector: candidate.profile!.matchingVector,
          })),
        ).slice(0, limit);

        const scoreByUserId = new Map(rankedCandidates.map((candidate) => [candidate.userId, candidate.score]));
        const candidateById = new Map(eligibleCandidates.map((candidate) => [candidate.id, candidate]));

        return rankedCandidates.flatMap((candidate) => {
          const userRecord = candidateById.get(candidate.userId);

          if (!userRecord?.profile) {
            return [];
          }

          return [
            {
              userId: userRecord.id,
              name: userRecord.name,
              avatarUrl: userRecord.avatarUrl,
              bio: userRecord.profile.bio,
              skills: userRecord.userSkills.map((skill) => ({
                name: skill.skill.name,
                category: skill.skill.category,
                rating: skill.rating,
              })),
              productiveHours: [...userRecord.profile.productiveHours],
              goalTypes: userRecord.profile.goalTypes.map((goalType) => goalType.toString()),
              compatibilityScore: scoreByUserId.get(userRecord.id) ?? 0,
            } satisfies CandidateCard,
          ];
        });
      },
      TTL.candidates
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    logActionError("getCandidates", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load candidates."),
    };
  }
}

export async function recordSwipe(
  input: z.infer<typeof recordSwipeSchema>,
): Promise<DataActionResult<{ matched: boolean; matchId?: string }>> {
  try {
    const user = await getAuthenticatedUser();
    const { targetId, direction } = recordSwipeSchema.parse(input);

    if (targetId === user.id) {
      return { success: false, error: "You cannot swipe on yourself." };
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!targetUser?.isActive) {
      return { success: false, error: "User not found." };
    }

    const existingSwipe = await db.swipe.findUnique({
      where: {
        swiperId_targetId: {
          swiperId: user.id,
          targetId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingSwipe) {
      return { success: false, error: "You have already swiped this user." };
    }

    await db.swipe.create({
      data: {
        swiperId: user.id,
        targetId,
        direction,
      },
    });

    if (direction === SwipeDirection.pass) {
      // Invalidate swiper's candidates cache since they passed on someone
      await invalidate(CacheKey.candidates(user.id));
      
      revalidatePath("/discover");
      return {
        success: true,
        data: {
          matched: false,
        },
      };
    }

    const reciprocalSwipe = await db.swipe.findUnique({
      where: {
        swiperId_targetId: {
          swiperId: targetId,
          targetId: user.id,
        },
      },
      select: {
        direction: true,
      },
    });

    if (!reciprocalSwipe || reciprocalSwipe.direction !== SwipeDirection.like) {
      // Invalidate swiper's candidates cache since they liked someone
      await invalidate(CacheKey.candidates(user.id));
      
      revalidatePath("/discover");
      return {
        success: true,
        data: {
          matched: false,
        },
      };
    }

    const profiles = await db.user.findMany({
      where: {
        id: { in: [user.id, targetId] },
      },
      select: {
        id: true,
        profile: {
          select: {
            matchingVector: true,
          },
        },
      },
    });

    const profileByUserId = new Map(
      profiles.map((profile) => [profile.id, profile.profile?.matchingVector ?? []]),
    );
    const compatibilityScore = computeCompatibilityScore(
      profileByUserId.get(user.id) ?? [],
      profileByUserId.get(targetId) ?? [],
    );
    const pair = normalizeMatchPair(user.id, targetId);

    const match = await db.match.upsert({
      where: {
        userAId_userBId: pair,
      },
      update: {
        compatibilityScore,
        status: MatchStatus.accepted,
      },
      create: {
        ...pair,
        compatibilityScore,
        status: MatchStatus.accepted,
      },
      select: {
        id: true,
      },
    });

    // Invalidate caches due to new mutual match
    await invalidate(
      CacheKey.candidates(user.id),
      CacheKey.matches(user.id),
      CacheKey.matches(targetId)
    );

    revalidatePath("/discover");
    revalidatePath("/matches");

    return {
      success: true,
      data: {
        matched: true,
        matchId: match.id,
      },
    };
  } catch (error) {
    logActionError("recordSwipe", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to record your swipe."),
    };
  }
}
