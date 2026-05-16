'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CacheKey, TTL, cached, invalidate } from "@/lib/cache";
import {
  assertGroupMember,
  AuthorizationError,
  getActionErrorMessage,
  getSessionUser,
  logActionError,
  serializeDate,
  type DataActionResult,
  type VoidActionResult,
} from "@/lib/utils";

const logSessionSchema = z.object({
  groupId: z.string().uuid(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
});

const submitEffectivenessScoreSchema = z.object({
  sessionId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
});

const getGroupSessionsSchema = z.object({
  groupId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20).optional(),
});

interface SessionWithLogger {
  sessionId: string;
  groupId: string;
  startedAt: string;
  endedAt: string;
  notes: string | null;
  effectivenessScore: number | null;
  durationMinutes: number;
  logger: {
    userId: string;
    name: string;
    avatarUrl: string | null;
  };
}

async function getAuthenticatedUser() {
  const user = getSessionUser(await auth());

  if (!user) {
    throw new AuthorizationError();
  }

  return user;
}

export async function logSession(
  input: z.infer<typeof logSessionSchema>,
): Promise<DataActionResult<{ sessionId: string }>> {
  try {
    const user = await getAuthenticatedUser();
    const parsed = logSessionSchema.parse(input);

    await assertGroupMember(user.id, parsed.groupId);

    if (parsed.endedAt <= parsed.startedAt) {
      return { success: false, error: "The session end time must be after the start time." };
    }

    const session = await db.studySession.create({
      data: {
        groupId: parsed.groupId,
        loggedById: user.id,
        startedAt: parsed.startedAt,
        endedAt: parsed.endedAt,
        notes: parsed.notes?.trim() || null,
      },
      select: {
        id: true,
      },
    });

    revalidatePath(`/groups/${parsed.groupId}`);
    revalidatePath(`/groups/${parsed.groupId}/sessions`);

    await invalidate(CacheKey.groupSessions(parsed.groupId), CacheKey.groupDetail(parsed.groupId));

    return {
      success: true,
      data: {
        sessionId: session.id,
      },
    };
  } catch (error) {
    logActionError("logSession", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to log the session."),
    };
  }
}

export async function submitEffectivenessScore(
  input: z.infer<typeof submitEffectivenessScoreSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const { sessionId, score } = submitEffectivenessScoreSchema.parse(input);

    const session = await db.studySession.findUnique({
      where: { id: sessionId },
      select: {
        groupId: true,
        loggedById: true,
      },
    });

    if (!session || session.loggedById !== user.id) {
      throw new AuthorizationError();
    }

    await db.studySession.update({
      where: { id: sessionId },
      data: {
        effectivenessScore: score,
      },
    });

    revalidatePath(`/groups/${session.groupId}`);
    revalidatePath(`/groups/${session.groupId}/sessions`);

    await invalidate(CacheKey.groupSessions(session.groupId), CacheKey.groupDetail(session.groupId));

    return { success: true };
  } catch (error) {
    logActionError("submitEffectivenessScore", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to submit the effectiveness score."),
    };
  }
}

export async function getGroupSessions(
  input: z.infer<typeof getGroupSessionsSchema>,
): Promise<DataActionResult<SessionWithLogger[]>> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId, limit = 20 } = getGroupSessionsSchema.parse(input);

    await assertGroupMember(user.id, groupId);

    const data = await cached(
      CacheKey.groupSessions(groupId),
      async () => {
        const sessions = await db.studySession.findMany({
          where: { groupId },
          orderBy: {
            startedAt: "desc",
          },
          take: limit,
          include: {
            loggedBy: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        });

        return sessions.map((session) => ({
          sessionId: session.id,
          groupId: session.groupId,
          startedAt: serializeDate(session.startedAt),
          endedAt: serializeDate(session.endedAt),
          notes: session.notes,
          effectivenessScore: session.effectivenessScore,
          durationMinutes: Math.max(
            0,
            Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000),
          ),
          logger: {
            userId: session.loggedBy.id,
            name: session.loggedBy.name,
            avatarUrl: session.loggedBy.avatarUrl,
          },
        }));
      },
      TTL.groupSessions
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    logActionError("getGroupSessions", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load the sessions."),
    };
  }
}
