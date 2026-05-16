'use server';

import { revalidatePath } from "next/cache";
import { MatchStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { cached, CacheKey, TTL } from "@/lib/cache";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  getActionErrorMessage,
  getSessionUser,
  logActionError,
  type DataActionResult,
  type VoidActionResult,
} from "@/lib/utils";

const updateMatchStatusSchema = z.object({
  matchId: z.string().uuid(),
  status: z.enum([MatchStatus.accepted, MatchStatus.declined]),
});

interface MatchWithPeer {
  matchId: string;
  compatibilityScore: number;
  status: MatchStatus;
  createdAt: string;
  peer: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    skills: {
      name: string;
      category: string;
      rating: number;
    }[];
  };
}

async function getAuthenticatedUserId() {
  const user = getSessionUser(await auth());

  if (!user) {
    throw new AuthorizationError();
  }

  return user.id;
}

export async function getMyMatches(): Promise<DataActionResult<MatchWithPeer[]>> {
  try {
    const userId = await getAuthenticatedUserId();

    const data = await cached(
      CacheKey.matches(userId),
      async () => {
        const matches = await db.match.findMany({
          where: {
            status: MatchStatus.accepted,
            OR: [{ userAId: userId }, { userBId: userId }],
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            userA: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                profile: {
                  select: {
                    bio: true,
                  },
                },
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
              },
            },
            userB: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                profile: {
                  select: {
                    bio: true,
                  },
                },
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
              },
            },
          },
        });

        return matches.map((match) => {
          const peer = match.userAId === userId ? match.userB : match.userA;

          return {
            matchId: match.id,
            compatibilityScore: match.compatibilityScore,
            status: match.status,
            createdAt: match.createdAt.toISOString(),
            peer: {
              userId: peer.id,
              name: peer.name,
              avatarUrl: peer.avatarUrl,
              bio: peer.profile?.bio ?? null,
              skills: peer.userSkills.map((skill) => ({
                name: skill.skill.name,
                category: skill.skill.category,
                rating: skill.rating,
              })),
            },
          };
        });
      },
      TTL.matches
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    logActionError("getMyMatches", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load your matches."),
    };
  }
}

export async function updateMatchStatus(
  input: z.infer<typeof updateMatchStatusSchema>,
): Promise<VoidActionResult> {
  try {
    const userId = await getAuthenticatedUserId();
    const { matchId, status } = updateMatchStatusSchema.parse(input);

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        userAId: true,
        userBId: true,
      },
    });

    if (!match || (match.userAId !== userId && match.userBId !== userId)) {
      throw new AuthorizationError();
    }

    await db.match.update({
      where: { id: matchId },
      data: { status },
    });

    revalidatePath("/matches");

    return { success: true };
  } catch (error) {
    logActionError("updateMatchStatus", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to update the match."),
    };
  }
}
