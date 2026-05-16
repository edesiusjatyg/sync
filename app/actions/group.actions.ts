'use server';

import { revalidatePath } from "next/cache";
import { GoalType } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assertGroupAdmin,
  assertGroupMember,
  AuthorizationError,
  getActionErrorMessage,
  getSessionUser,
  logActionError,
  serializeDate,
  serializeNullableDate,
  uniqueStrings,
  type DataActionResult,
  type VoidActionResult,
} from "@/lib/utils";

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  goalTypes: z.array(z.nativeEnum(GoalType)).min(1),
  maxMembers: z.number().int().min(2).max(10),
  invitedUserIds: z.array(z.string().uuid()).optional(),
});

const groupIdSchema = z.object({
  groupId: z.string().uuid(),
});

const updateGroupInfoSchema = z
  .object({
    groupId: z.string().uuid(),
    name: z.string().trim().min(1).max(100).optional(),
    goalTypes: z.array(z.nativeEnum(GoalType)).min(1).optional(),
    maxMembers: z.number().int().min(2).max(10).optional(),
    isOpen: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.goalTypes !== undefined ||
      value.maxMembers !== undefined ||
      value.isOpen !== undefined,
    "At least one field is required.",
  );

const manageMemberSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
});

const searchInvitableUsersSchema = z.object({
  groupId: z.string().uuid(),
  query: z.string().trim().min(1).max(100),
});

interface GroupSummary {
  groupId: string;
  name: string;
  goalTypes: GoalType[];
  maxMembers: number;
  isOpen: boolean;
  memberCount: number;
  currentUserRole: "admin" | "member";
  createdAt: string;
}

interface InvitableUserOption {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface GroupDetail {
  groupId: string;
  name: string;
  goalTypes: GoalType[];
  maxMembers: number;
  isOpen: boolean;
  createdAt: string;
  createdById: string;
  currentUserRole: "admin" | "member";
  members: {
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "admin" | "member";
    joinedAt: string;
    skills: {
      name: string;
      category: string;
      rating: number;
    }[];
  }[];
  tasks: {
    taskId: string;
    title: string;
    status: string;
    deadline: string | null;
    createdAt: string;
    assignedTo: {
      userId: string;
      name: string;
      avatarUrl: string | null;
    } | null;
  }[];
  recentSessions: {
    sessionId: string;
    startedAt: string;
    endedAt: string;
    notes: string | null;
    effectivenessScore: number | null;
    logger: {
      userId: string;
      name: string;
      avatarUrl: string | null;
    };
  }[];
}

async function getAuthenticatedUser() {
  const user = getSessionUser(await auth());

  if (!user) {
    throw new AuthorizationError();
  }

  return user;
}

export async function createGroup(
  input: z.infer<typeof createGroupSchema>,
): Promise<DataActionResult<{ groupId: string }>> {
  try {
    const user = await getAuthenticatedUser();
    const parsed = createGroupSchema.parse(input);
    const invitedUserIds = uniqueStrings((parsed.invitedUserIds ?? []).filter((id) => id !== user.id));

    if (invitedUserIds.length + 1 > parsed.maxMembers) {
      return { success: false, error: "The invited members exceed the group capacity." };
    }

    if (invitedUserIds.length > 0) {
      const users = await db.user.findMany({
        where: {
          id: { in: invitedUserIds },
          isActive: true,
        },
        select: { id: true },
      });

      if (users.length !== invitedUserIds.length) {
        return { success: false, error: "One or more invited users could not be found." };
      }
    }

    const group = await db.$transaction(async (tx) => {
      const createdGroup = await tx.group.create({
        data: {
          name: parsed.name,
          goalTypes: [...parsed.goalTypes],
          maxMembers: parsed.maxMembers,
          createdById: user.id,
          members: {
            create: [
              {
                userId: user.id,
                role: "admin",
              },
              ...invitedUserIds.map((invitedUserId) => ({
                userId: invitedUserId,
                role: "member" as const,
              })),
            ],
          },
        },
        select: {
          id: true,
        },
      });

      return createdGroup;
    });

    revalidatePath("/groups");
    revalidatePath("/matches");

    return {
      success: true,
      data: {
        groupId: group.id,
      },
    };
  } catch (error) {
    logActionError("createGroup", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to create the group."),
    };
  }
}

export async function getMyGroups(): Promise<DataActionResult<GroupSummary[]>> {
  try {
    const user = await getAuthenticatedUser();

    const memberships = await db.groupMember.findMany({
      where: {
        userId: user.id,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            goalTypes: true,
            maxMembers: true,
            isOpen: true,
            createdAt: true,
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    return {
      success: true,
      data: memberships.map((membership) => ({
        groupId: membership.group.id,
        name: membership.group.name,
        goalTypes: [...membership.group.goalTypes],
        maxMembers: membership.group.maxMembers,
        isOpen: membership.group.isOpen,
        memberCount: membership.group._count.members,
        currentUserRole: membership.role,
        createdAt: serializeDate(membership.group.createdAt),
      })),
    };
  } catch (error) {
    logActionError("getMyGroups", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load your groups."),
    };
  }
}

export async function getGroupDetail(
  input: z.infer<typeof groupIdSchema>,
): Promise<DataActionResult<GroupDetail>> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId } = groupIdSchema.parse(input);

    await assertGroupMember(user.id, groupId);

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          orderBy: {
            joinedAt: "asc",
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
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
              },
            },
          },
        },
        tasks: {
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        sessions: {
          take: 5,
          orderBy: {
            startedAt: "desc",
          },
          include: {
            loggedBy: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return { success: false, error: "Group not found." };
    }

    const currentMembership = group.members.find((membership) => membership.userId === user.id);

    return {
      success: true,
      data: {
        groupId: group.id,
        name: group.name,
        goalTypes: [...group.goalTypes],
        maxMembers: group.maxMembers,
        isOpen: group.isOpen,
        createdAt: serializeDate(group.createdAt),
        createdById: group.createdById,
        currentUserRole: currentMembership?.role ?? "member",
        members: group.members.map((member) => ({
          userId: member.user.id,
          name: member.user.name,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
          joinedAt: serializeDate(member.joinedAt),
          skills: member.user.userSkills.map((skill) => ({
            name: skill.skill.name,
            category: skill.skill.category,
            rating: skill.rating,
          })),
        })),
        tasks: group.tasks.map((task) => ({
          taskId: task.id,
          title: task.title,
          status: task.status,
          deadline: serializeNullableDate(task.deadline),
          createdAt: serializeDate(task.createdAt),
          assignedTo: task.assignedTo
            ? {
                userId: task.assignedTo.id,
                name: task.assignedTo.name,
                avatarUrl: task.assignedTo.avatarUrl,
              }
            : null,
        })),
        recentSessions: group.sessions.map((session) => ({
          sessionId: session.id,
          startedAt: serializeDate(session.startedAt),
          endedAt: serializeDate(session.endedAt),
          notes: session.notes,
          effectivenessScore: session.effectivenessScore,
          logger: {
            userId: session.loggedBy.id,
            name: session.loggedBy.name,
            avatarUrl: session.loggedBy.avatarUrl,
          },
        })),
      },
    };
  } catch (error) {
    logActionError("getGroupDetail", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load the group."),
    };
  }
}

export async function updateGroupInfo(
  input: z.infer<typeof updateGroupInfoSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const parsed = updateGroupInfoSchema.parse(input);

    await assertGroupAdmin(user.id, parsed.groupId);

    if (parsed.maxMembers !== undefined) {
      const memberCount = await db.groupMember.count({
        where: { groupId: parsed.groupId },
      });

      if (parsed.maxMembers < memberCount) {
        return { success: false, error: "The group already has more members than that limit." };
      }
    }

    await db.group.update({
      where: { id: parsed.groupId },
      data: {
        name: parsed.name,
        goalTypes: parsed.goalTypes ? [...parsed.goalTypes] : undefined,
        maxMembers: parsed.maxMembers,
        isOpen: parsed.isOpen,
      },
    });

    revalidatePath("/groups");
    revalidatePath(`/groups/${parsed.groupId}`);

    return { success: true };
  } catch (error) {
    logActionError("updateGroupInfo", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to update the group."),
    };
  }
}

export async function inviteMember(
  input: z.infer<typeof manageMemberSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId, userId } = manageMemberSchema.parse(input);

    await assertGroupAdmin(user.id, groupId);

    const [group, existingMember, invitedUser] = await Promise.all([
      db.group.findUnique({
        where: { id: groupId },
        select: {
          maxMembers: true,
        },
      }),
      db.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
        select: {
          userId: true,
        },
      }),
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isActive: true,
        },
      }),
    ]);

    if (!group) {
      return { success: false, error: "Group not found." };
    }

    if (!invitedUser?.isActive) {
      return { success: false, error: "User not found." };
    }

    if (existingMember) {
      return { success: false, error: "That user is already in the group." };
    }

    const memberCount = await db.groupMember.count({
      where: { groupId },
    });

    if (memberCount >= group.maxMembers) {
      return { success: false, error: "The group is already at full capacity." };
    }

    await db.groupMember.create({
      data: {
        groupId,
        userId,
        role: "member",
      },
    });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath("/groups");

    return { success: true };
  } catch (error) {
    logActionError("inviteMember", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to invite the member."),
    };
  }
}

export async function searchUsersForGroupInvite(
  input: z.infer<typeof searchInvitableUsersSchema>,
): Promise<DataActionResult<InvitableUserOption[]>> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId, query } = searchInvitableUsersSchema.parse(input);

    await assertGroupAdmin(user.id, groupId);

    const members = await db.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    const excludedUserIds = new Set(members.map((member) => member.userId));
    excludedUserIds.add(user.id);

    const users = await db.user.findMany({
      where: {
        id: { notIn: [...excludedUserIds] },
        isActive: true,
        OR: [
          {
            email: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: [{ name: "asc" }],
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    return {
      success: true,
      data: users.map((candidate) => ({
        userId: candidate.id,
        name: candidate.name,
        email: candidate.email,
        avatarUrl: candidate.avatarUrl,
      })),
    };
  } catch (error) {
    logActionError("searchUsersForGroupInvite", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to search users."),
    };
  }
}

export async function kickMember(
  input: z.infer<typeof manageMemberSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId, userId } = manageMemberSchema.parse(input);

    if (user.id === userId) {
      return { success: false, error: "You cannot remove yourself from the group with this action." };
    }

    await assertGroupAdmin(user.id, groupId);

    const membership = await db.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (!membership) {
      return { success: false, error: "That user is not a member of this group." };
    }

    await db.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    revalidatePath(`/groups/${groupId}`);
    revalidatePath("/groups");

    return { success: true };
  } catch (error) {
    logActionError("kickMember", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to remove the member."),
    };
  }
}

export async function transferAdmin(
  input: z.infer<typeof manageMemberSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId, userId } = manageMemberSchema.parse(input);

    await assertGroupAdmin(user.id, groupId);

    const targetMembership = await db.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (!targetMembership) {
      return { success: false, error: "That user is not a member of this group." };
    }

    await db.$transaction([
      db.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
        data: {
          role: "admin",
        },
      }),
      db.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId: user.id,
          },
        },
        data: {
          role: "member",
        },
      }),
    ]);

    revalidatePath(`/groups/${groupId}`);

    return { success: true };
  } catch (error) {
    logActionError("transferAdmin", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to transfer admin access."),
    };
  }
}

export async function leaveGroup(
  input: z.infer<typeof groupIdSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId } = groupIdSchema.parse(input);

    await assertGroupMember(user.id, groupId);

    const [membership, memberCount] = await Promise.all([
      db.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: user.id,
          },
        },
        select: {
          role: true,
        },
      }),
      db.groupMember.count({
        where: { groupId },
      }),
    ]);

    if (!membership) {
      return { success: false, error: "Group membership not found." };
    }

    if (membership.role === "admin" && memberCount > 1) {
      return { success: false, error: "Transfer admin before leaving the group." };
    }

    if (memberCount === 1) {
      await db.group.delete({
        where: { id: groupId },
      });
    } else {
      await db.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId: user.id,
          },
        },
      });
    }

    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);

    return { success: true };
  } catch (error) {
    logActionError("leaveGroup", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to leave the group."),
    };
  }
}
