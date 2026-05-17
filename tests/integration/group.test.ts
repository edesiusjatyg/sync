import { describe, it, expect, beforeEach } from 'vitest';
import { createGroup, inviteMember, kickMember, transferAdmin, leaveGroup } from '@/app/actions/group.actions';
import { createUserWithProfile } from '../helpers/fixtures';
import { mockSession, clearSession } from '../helpers/auth';
import { testDb } from '../helpers/db';
import { GoalType } from '@prisma/client';

describe('Group Server Actions', () => {
  beforeEach(() => {
    clearSession();
  });

  describe('createGroup', () => {
    it('creates group and group member admin', async () => {
      const user = await createUserWithProfile();
      mockSession({
        id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true,
      });

      const result = await createGroup({
        name: 'Study Group 1',
        goalTypes: [GoalType.tugas],
        maxMembers: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const group = await testDb.group.findUnique({
          where: { id: result.data.groupId },
          include: { members: true },
        });
        expect(group).toBeDefined();
        expect(group!.members).toHaveLength(1);
        expect(group!.members[0].role).toBe('admin');
      }
    });

    it('creates group members for invited users', async () => {
      const user = await createUserWithProfile();
      const invited = await createUserWithProfile();
      
      mockSession({
        id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true,
      });

      const result = await createGroup({
        name: 'Study Group 2',
        goalTypes: [GoalType.tugas],
        maxMembers: 5,
        invitedUserIds: [invited.id],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const group = await testDb.group.findUnique({
          where: { id: result.data.groupId },
          include: { members: { orderBy: { role: 'asc' } } },
        });
        expect(group!.members).toHaveLength(2);
        expect(group!.members.find(m => m.userId === invited.id)?.role).toBe('member');
      }
    });
  });

  describe('inviteMember', () => {
    it('invites successfully', async () => {
      const admin = await createUserWithProfile();
      const target = await createUserWithProfile();
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5 });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await inviteMember({ groupId: groupRes.data.groupId, userId: target.id });
      expect(result.success).toBe(true);
    });

    it('returns error if group is at max capacity', async () => {
      const admin = await createUserWithProfile();
      const target1 = await createUserWithProfile();
      const target2 = await createUserWithProfile();
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 2, invitedUserIds: [target1.id] });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await inviteMember({ groupId: groupRes.data.groupId, userId: target2.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('The group is already at full capacity.');
      }
    });

    it('returns error if already a member', async () => {
      const admin = await createUserWithProfile();
      const target1 = await createUserWithProfile();
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });

      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5, invitedUserIds: [target1.id] });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await inviteMember({ groupId: groupRes.data.groupId, userId: target1.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('That user is already in the group.');
      }
    });
    
    it('returns unauthorized if non-admin invites', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      const target = await createUserWithProfile();
      
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5, invitedUserIds: [member.id] });
      if (!groupRes.success) throw new Error('Setup failed');

      mockSession({ id: member.id, email: member.email, name: member.name, role: member.role, hasCompletedOnboarding: true });
      const result = await inviteMember({ groupId: groupRes.data.groupId, userId: target.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });
  });

  describe('kickMember', () => {
    it('group_admin can kick a member', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5, invitedUserIds: [member.id] });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await kickMember({ groupId: groupRes.data.groupId, userId: member.id });
      expect(result.success).toBe(true);
    });

    it('cannot kick self', async () => {
      const admin = await createUserWithProfile();
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5 });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await kickMember({ groupId: groupRes.data.groupId, userId: admin.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('You cannot remove yourself from the group with this action.');
      }
    });
  });

  describe('leaveGroup', () => {
    it('member can leave group', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5, invitedUserIds: [member.id] });
      if (!groupRes.success) throw new Error('Setup failed');

      mockSession({ id: member.id, email: member.email, name: member.name, role: member.role, hasCompletedOnboarding: true });
      const result = await leaveGroup({ groupId: groupRes.data.groupId });
      expect(result.success).toBe(true);
    });

    it('group_admin cannot leave without transferring first', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5, invitedUserIds: [member.id] });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await leaveGroup({ groupId: groupRes.data.groupId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Transfer admin before leaving the group.');
      }
    });

    it('last member leaving deletes the group', async () => {
      const admin = await createUserWithProfile();
      
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5 });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await leaveGroup({ groupId: groupRes.data.groupId });
      expect(result.success).toBe(true);

      const group = await testDb.group.findUnique({ where: { id: groupRes.data.groupId } });
      expect(group).toBeNull();
    });
  });

  describe('transferAdmin', () => {
    it('admin can transfer to member', async () => {
      const admin = await createUserWithProfile();
      const member = await createUserWithProfile();
      
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5, invitedUserIds: [member.id] });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await transferAdmin({ groupId: groupRes.data.groupId, userId: member.id });
      expect(result.success).toBe(true);
      
      const newAdmin = await testDb.groupMember.findUnique({ where: { groupId_userId: { groupId: groupRes.data.groupId, userId: member.id } } });
      expect(newAdmin!.role).toBe('admin');
    });

    it('target must be a member', async () => {
      const admin = await createUserWithProfile();
      const nonMember = await createUserWithProfile();
      
      mockSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, hasCompletedOnboarding: true });
      const groupRes = await createGroup({ name: 'Group', goalTypes: [GoalType.tugas], maxMembers: 5 });
      if (!groupRes.success) throw new Error('Setup failed');

      const result = await transferAdmin({ groupId: groupRes.data.groupId, userId: nonMember.id });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('That user is not a member of this group.');
      }
    });
  });
});
