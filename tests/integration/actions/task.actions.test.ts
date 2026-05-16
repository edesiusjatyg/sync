import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTask, updateTask, deleteTask } from '@/app/actions/task.actions';
import { resetDb, db } from '@/tests/helpers/db';
import { createUser } from '@/tests/helpers/fixtures';
import { GoalType, GroupMemberRole, TaskStatus } from '@prisma/client';
import { auth } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe('task.actions', () => {
  describe('createTask', () => {
    it('happy path: task is created with status todo', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await createTask({ groupId: group.id, title: 'Test Task' });
      
      expect(result.success).toBe(true);
      if (result.success) {
        const task = await db.task.findUnique({ where: { id: result.taskId } });
        expect(task?.status).toBe(TaskStatus.todo);
      }
    });

    it('non-member cannot create task for a group', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: 'someone', goalTypes: [GoalType.tugas] },
      });
      // User is not in group

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await createTask({ groupId: group.id, title: 'Test Task' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateTask', () => {
    it('any member can change status', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: 'someone', goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });
      
      const task = await db.task.create({
        data: { groupId: group.id, title: 'T', createdById: 'someone' }
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await updateTask({ taskId: task.id, status: TaskStatus.in_progress });
      expect(result.success).toBe(true);
      
      const updatedTask = await db.task.findUnique({ where: { id: task.id } });
      expect(updatedTask?.status).toBe(TaskStatus.in_progress);
    });
  });

  describe('deleteTask', () => {
    it('creator can delete their own task', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });
      
      const task = await db.task.create({
        data: { groupId: group.id, title: 'T', createdById: user.id }
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await deleteTask({ taskId: task.id });
      expect(result.success).toBe(true);
    });

    it('group admin can delete any task', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.admin },
      });
      
      const task = await db.task.create({
        data: { groupId: group.id, title: 'T', createdById: 'someone' }
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await deleteTask({ taskId: task.id });
      expect(result.success).toBe(true);
    });

    it('regular non-creator member cannot delete', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: 'someone', goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });
      
      const task = await db.task.create({
        data: { groupId: group.id, title: 'T', createdById: 'someone' }
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await deleteTask({ taskId: task.id });
      expect(result.success).toBe(false);
    });
  });
});
