'use server';

import { revalidatePath } from "next/cache";
import { TaskStatus } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CacheKey, TTL, cached, invalidate } from "@/lib/cache";
import {
  assertGroupAdmin,
  assertGroupMember,
  AuthorizationError,
  getActionErrorMessage,
  getSessionUser,
  logActionError,
  serializeDate,
  serializeNullableDate,
  type DataActionResult,
  type VoidActionResult,
} from "@/lib/utils";

const createTaskSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  assignedToId: z.string().uuid().optional(),
  deadline: z.coerce.date().optional(),
});

const updateTaskSchema = z
  .object({
    taskId: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    deadline: z.coerce.date().nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.status !== undefined ||
      value.assignedToId !== undefined ||
      value.deadline !== undefined,
    "At least one field is required.",
  );

const taskIdSchema = z.object({
  taskId: z.string().uuid(),
});

const groupIdSchema = z.object({
  groupId: z.string().uuid(),
});

interface TaskWithAssignee {
  taskId: string;
  groupId: string;
  title: string;
  status: TaskStatus;
  deadline: string | null;
  createdAt: string;
  createdById: string;
  assignedTo: {
    userId: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

const taskStatusOrder: Record<TaskStatus, number> = {
  [TaskStatus.todo]: 0,
  [TaskStatus.in_progress]: 1,
  [TaskStatus.done]: 2,
};

async function getAuthenticatedUser() {
  const user = getSessionUser(await auth());

  if (!user) {
    throw new AuthorizationError();
  }

  return user;
}

async function assertAssigneeIsGroupMember(groupId: string, assignedToId: string) {
  const membership = await db.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: assignedToId,
      },
    },
    select: {
      userId: true,
    },
  });

  if (!membership) {
    throw new AuthorizationError("Assigned user is not a group member.");
  }
}

export async function createTask(
  input: z.infer<typeof createTaskSchema>,
): Promise<DataActionResult<{ taskId: string }>> {
  try {
    const user = await getAuthenticatedUser();
    const parsed = createTaskSchema.parse(input);

    await assertGroupMember(user.id, parsed.groupId);

    if (parsed.assignedToId) {
      await assertAssigneeIsGroupMember(parsed.groupId, parsed.assignedToId);
    }

    const task = await db.task.create({
      data: {
        groupId: parsed.groupId,
        createdById: user.id,
        assignedToId: parsed.assignedToId,
        title: parsed.title,
        deadline: parsed.deadline,
      },
      select: {
        id: true,
      },
    });

    revalidatePath(`/groups/${parsed.groupId}`);
    revalidatePath(`/groups/${parsed.groupId}/tasks`);

    await invalidate(CacheKey.groupTasks(parsed.groupId), CacheKey.groupDetail(parsed.groupId));

    return {
      success: true,
      data: {
        taskId: task.id,
      },
    };
  } catch (error) {
    logActionError("createTask", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to create the task."),
    };
  }
}

export async function updateTask(
  input: z.infer<typeof updateTaskSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const parsed = updateTaskSchema.parse(input);

    const task = await db.task.findUnique({
      where: { id: parsed.taskId },
      select: {
        id: true,
        groupId: true,
        status: true,
      },
    });

    if (!task) {
      return { success: false, error: "Task not found." };
    }

    await assertGroupMember(user.id, task.groupId);

    if (parsed.assignedToId) {
      await assertAssigneeIsGroupMember(task.groupId, parsed.assignedToId);
    }

    if (parsed.status && parsed.status !== task.status) {
      const currentStatusIndex = taskStatusOrder[task.status];
      const nextStatusIndex = taskStatusOrder[parsed.status];

      if (nextStatusIndex !== currentStatusIndex + 1) {
        return { success: false, error: "Invalid task status transition." };
      }
    }

    await db.task.update({
      where: { id: parsed.taskId },
      data: {
        title: parsed.title,
        status: parsed.status,
        assignedToId: parsed.assignedToId === undefined ? undefined : parsed.assignedToId,
        deadline: parsed.deadline === undefined ? undefined : parsed.deadline,
      },
    });

    revalidatePath(`/groups/${task.groupId}`);
    revalidatePath(`/groups/${task.groupId}/tasks`);

    await invalidate(CacheKey.groupTasks(task.groupId), CacheKey.groupDetail(task.groupId));

    return { success: true };
  } catch (error) {
    logActionError("updateTask", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to update the task."),
    };
  }
}

export async function deleteTask(
  input: z.infer<typeof taskIdSchema>,
): Promise<VoidActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const { taskId } = taskIdSchema.parse(input);

    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        groupId: true,
        createdById: true,
      },
    });

    if (!task) {
      return { success: false, error: "Task not found." };
    }

    await assertGroupMember(user.id, task.groupId);

    if (task.createdById !== user.id) {
      await assertGroupAdmin(user.id, task.groupId);
    }

    await db.task.delete({
      where: { id: taskId },
    });

    revalidatePath(`/groups/${task.groupId}`);
    revalidatePath(`/groups/${task.groupId}/tasks`);

    await invalidate(CacheKey.groupTasks(task.groupId), CacheKey.groupDetail(task.groupId));

    return { success: true };
  } catch (error) {
    logActionError("deleteTask", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to delete the task."),
    };
  }
}

export async function getGroupTasks(
  input: z.infer<typeof groupIdSchema>,
): Promise<DataActionResult<TaskWithAssignee[]>> {
  try {
    const user = await getAuthenticatedUser();
    const { groupId } = groupIdSchema.parse(input);

    await assertGroupMember(user.id, groupId);

    const data = await cached(
      CacheKey.groupTasks(groupId),
      async () => {
        const tasks = await db.task.findMany({
          where: { groupId },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        });

        return tasks.map((task) => ({
          taskId: task.id,
          groupId: task.groupId,
          title: task.title,
          status: task.status,
          deadline: serializeNullableDate(task.deadline),
          createdAt: serializeDate(task.createdAt),
          createdById: task.createdById,
          assignedTo: task.assignedTo
            ? {
                userId: task.assignedTo.id,
                name: task.assignedTo.name,
                avatarUrl: task.assignedTo.avatarUrl,
              }
            : null,
        }));
      },
      TTL.groupTasks
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    logActionError("getGroupTasks", error);
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load the tasks."),
    };
  }
}
