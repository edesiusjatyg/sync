import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGroup, updateGroupInfo, kickMember, leaveGroup } from '@/app/actions/group.actions';
import { resetDb, db } from '@/tests/helpers/db';
import { createUser } from '@/tests/helpers/fixtures';
import { GoalType, GroupMemberRole } from '@prisma/client';
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

describe('group.actions', () => {
  describe('createGroup', () => {
    it('creates Group + GroupMember with role admin', async () => {
      const user = await createUser();

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await createGroup({
        name: 'Study Buddy',
        goalTypes: [GoalType.tugas],
        maxMembers: 5,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        const group = await db.group.findUnique({ where: { id: result.groupId } });
        expect(group?.name).toBe('Study Buddy');

        const member = await db.groupMember.findFirst({ where: { groupId: result.groupId, userId: user.id } });
        expect(member?.role).toBe(GroupMemberRole.admin);
      }
    });

    it('creates GroupMember records for each invited user', async () => {
      const user = await createUser();
      const invitee = await createUser();

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await createGroup({
        name: 'Group with invites',
        goalTypes: [GoalType.tugas],
        maxMembers: 5,
        invitedUserIds: [invitee.id],
      });

      expect(result.success).toBe(true);

      if (result.success) {
        const members = await db.groupMember.findMany({ where: { groupId: result.groupId } });
        expect(members).toHaveLength(2);
        expect(members.some((m) => m.userId === invitee.id && m.role === GroupMemberRole.member)).toBe(true);
      }
    });
  });

  describe('updateGroupInfo', () => {
    it('succeeds when caller is group admin', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'Old Name', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.admin },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await updateGroupInfo({ groupId: group.id, name: 'New Name' });
      expect(result.success).toBe(true);

      const updatedGroup = await db.group.findUnique({ where: { id: group.id } });
      expect(updatedGroup?.name).toBe('New Name');
    });

    it('returns success: false, error: Unauthorized when caller is a regular member', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'Old Name', createdById: 'someone-else', goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.member },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await updateGroupInfo({ groupId: group.id, name: 'New Name' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Unauthorized');
    });
  });

  describe('kickMember', () => {
    it('removes member; cannot kick self', async () => {
      const user = await createUser();
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.admin },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await kickMember({ groupId: group.id, userId: user.id });
      expect(result.success).toBe(false);
    });
  });

  describe('leaveGroup', () => {
    it('group admin cannot leave without transferring admin first', async () => {
      const user = await createUser();
      const member2 = await createUser();
      
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.createMany({
        data: [
          { groupId: group.id, userId: user.id, role: GroupMemberRole.admin },
          { groupId: group.id, userId: member2.id, role: GroupMemberRole.member },
        ]
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await leaveGroup({ groupId: group.id });
      expect(result.success).toBe(false); // Should prevent
    });

    it('last member leaving deletes the group', async () => {
      const user = await createUser();
      
      const group = await db.group.create({
        data: { name: 'G', createdById: user.id, goalTypes: [GoalType.tugas] },
      });
      await db.groupMember.create({
        data: { groupId: group.id, userId: user.id, role: GroupMemberRole.admin },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, hasCompletedOnboarding: true },
        expires: '9999-12-31T23:59:59.999Z',
      } as any);

      const result = await leaveGroup({ groupId: group.id });
      expect(result.success).toBe(true);

      const groupInDb = await db.group.findUnique({ where: { id: group.id } });
      expect(groupInDb).toBeNull();
    });
  });
});
