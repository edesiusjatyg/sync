import { describe, it, expect, beforeEach } from 'vitest';
import { createTask, updateTask, deleteTask } from '@/app/actions/task.actions';
import { createUserWithProfile, createGroup, createTask as createFixtureTask } from '../helpers/fixtures';
import { mockSession, clearSession } from '../helpers/auth';
import { testDb } from '../helpers/db';
import { TaskStatus } from '@prisma/client';

describe('Task Server Actions', () => {
  beforeEach(() => {
    clearSession();
  });

  describe('createTask', () => {
    it('creates task with status todo', async () => {
      const admin = await createUserWithProfile();
      const group = await createGroup(admin.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const result = await createTask({ groupId: group.id, title: 'New Task' });
      
      expect(result.success).toBe(true);
      if (result.success) {
        const task = await testDb.task.findUnique({ where: { id: result.data.taskId } });
        expect(task).toBeDefined();
        expect(task!.status).toBe(TaskStatus.todo);
      }
    });

    it('non-member cannot create task', async () => {
      const admin = await createUserWithProfile();
      const nonMember = await createUserWithProfile();
      const group = await createGroup(admin.id);

      mockSession({ id: nonMember.id, email: nonMember.email, name: nonMember.name, role: nonMember.role, hasCompletedOnboarding: true });

      const result = await createTask({ groupId: group.id, title: 'New Task' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });

    it('returns error on missing title', async () => {
      const admin = await createUserWithProfile();
      const group = await createGroup(admin.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const result = await createTask({ groupId: group.id, title: '' });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input.');
      }
    });
  });

  describe('updateTask', () => {
    it('any member can change status', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      const group = await createGroup(admin.id, [member.id]);
      const task = await createFixtureTask(group.id, admin.id);

      mockSession({ id: member.id, email: member.email, name: member.name, role: member.role, hasCompletedOnboarding: true });

      const result = await updateTask({ taskId: task.id, status: TaskStatus.in_progress });
      expect(result.success).toBe(true);
      
      const updatedTask = await testDb.task.findUnique({ where: { id: task.id } });
      expect(updatedTask!.status).toBe(TaskStatus.in_progress);
    });

    it('invalid assignee returns error', async () => {
      const admin = await createUserWithProfile();
      const nonMember = await createUserWithProfile();
      const group = await createGroup(admin.id);
      const task = await createFixtureTask(group.id, admin.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const result = await updateTask({ taskId: task.id, assignedToId: nonMember.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized'); 
      }
    });

    it('non-member cannot update', async () => {
      const admin = await createUserWithProfile();
      const nonMember = await createUserWithProfile();
      const group = await createGroup(admin.id);
      const task = await createFixtureTask(group.id, admin.id);

      mockSession({ id: nonMember.id, email: nonMember.email, name: nonMember.name, role: nonMember.role, hasCompletedOnboarding: true });

      const result = await updateTask({ taskId: task.id, status: TaskStatus.in_progress });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });

  describe('deleteTask', () => {
    it('creator can delete their own task', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      const group = await createGroup(admin.id, [member.id]);
      const task = await createFixtureTask(group.id, member.id); 

      mockSession({ id: member.id, email: member.email, name: member.name, role: member.role, hasCompletedOnboarding: true });

      const result = await deleteTask({ taskId: task.id });
      expect(result.success).toBe(true);
      
      const deletedTask = await testDb.task.findUnique({ where: { id: task.id } });
      expect(deletedTask).toBeNull();
    });

    it('group_admin can delete any task', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      const group = await createGroup(admin.id, [member.id]);
      const task = await createFixtureTask(group.id, member.id);

      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const result = await deleteTask({ taskId: task.id });
      expect(result.success).toBe(true);
    });

    it('regular non-creator member cannot delete', async () => {
      const admin = await createUserWithProfile();
      const member1 = await createUserWithProfile();
      const member2 = await createUserWithProfile();
      const group = await createGroup(admin.id, [member1.id, member2.id]);
      const task = await createFixtureTask(group.id, member1.id);

      mockSession({ id: member2.id, email: member2.email, name: member2.name, role: member2.role, hasCompletedOnboarding: true });

      const result = await deleteTask({ taskId: task.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });
});
