'use server';

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getActionErrorMessage,
  getSessionUser,
  isProfileComplete,
  logActionError,
  requireAdmin,
  serializeDate,
  type DataActionResult,
  type VoidActionResult,
} from "@/lib/utils";

const userIdSchema = z.object({
  userId: z.string().uuid(),
});

const groupIdSchema = z.object({
  groupId: z.string().uuid(),
});

const changeUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(UserRole),
});

interface AdminUserRow {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  hasCompletedOnboarding: boolean;
  createdAt: string;
}

interface AdminGroupRow {
  groupId: string;
  name: string;
  memberCount: number;
  creatorName: string;
  createdAt: string;
  isOpen: boolean;
}

async function getAdminUser() {
  const user = getSessionUser(await auth());
  requireAdmin(user);
  return user;
}

// TODO: PRD defines admin dashboard tables but not the fetch action names — chose
// the smallest explicit readers needed by the UI.
export async function getAdminUsers(): Promise<DataActionResult<AdminUserRow[]>> {
  try {
    await getAdminUser();

    const users = await db.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: {
          select: {
            goalTypes: true,
          },
        },
        userSkills: {
          select: {
            skillId: true,
          },
          take: 1,
        },
      },
    });

    return {
      success: true,
      data: users.map((user) => ({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        hasCompletedOnboarding: isProfileComplete(user.profile, user.userSkills.length),
        createdAt: serializeDate(user.createdAt),
      })),
    };
  } catch (error) {
    logActionError("getAdminUsers", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load the users."),
    };
  }
}

export async function getAdminGroups(): Promise<DataActionResult<AdminGroupRow[]>> {
  try {
    await getAdminUser();

    const groups = await db.group.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        isOpen: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return {
      success: true,
      data: groups.map((group) => ({
        groupId: group.id,
        name: group.name,
        memberCount: group._count.members,
        creatorName: group.createdBy.name,
        createdAt: serializeDate(group.createdAt),
        isOpen: group.isOpen,
      })),
    };
  } catch (error) {
    logActionError("getAdminGroups", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load the groups."),
    };
  }
}

export async function deactivateUser(
  input: z.infer<typeof userIdSchema>,
): Promise<VoidActionResult> {
  try {
    const adminUser = await getAdminUser();
    const { userId } = userIdSchema.parse(input);

    if (adminUser.id === userId) {
      return { success: false, error: "You cannot deactivate your own account." };
    }

    await db.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    logActionError("deactivateUser", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to deactivate the user."),
    };
  }
}

export async function activateUser(
  input: z.infer<typeof userIdSchema>,
): Promise<VoidActionResult> {
  try {
    await getAdminUser();
    const { userId } = userIdSchema.parse(input);

    await db.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    logActionError("activateUser", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to activate the user."),
    };
  }
}

export async function changeUserRole(
  input: z.infer<typeof changeUserRoleSchema>,
): Promise<VoidActionResult> {
  try {
    const adminUser = await getAdminUser();
    const { userId, role } = changeUserRoleSchema.parse(input);

    if (adminUser.id === userId) {
      return { success: false, error: "You cannot change your own role." };
    }

    await db.user.update({
      where: { id: userId },
      data: { role },
    });

    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    logActionError("changeUserRole", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to change the user role."),
    };
  }
}

export async function deleteGroup(
  input: z.infer<typeof groupIdSchema>,
): Promise<VoidActionResult> {
  try {
    const { groupId } = groupIdSchema.parse(input);

    await getAdminUser();

    await db.group.delete({
      where: { id: groupId },
    });

    revalidatePath("/admin");
    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);

    return { success: true };
  } catch (error) {
    logActionError("deleteGroup", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to delete the group."),
    };
  }
}
