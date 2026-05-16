import { describe, it, expect, vi } from 'vitest';
import { assertGroupMember, assertGroupAdmin, AuthorizationError } from '@/lib/utils';

vi.mock('@/lib/db', () => ({
  db: {
    groupMember: {
      findUnique: vi.fn(),
    },
  },
}));

describe('utils.ts', () => {
  describe('assertGroupMember', () => {
    it('throws AuthorizationError if not a member', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.groupMember.findUnique).mockResolvedValue(null);
      
      await expect(assertGroupMember('u1', 'g1')).rejects.toThrow(AuthorizationError);
      expect(db.groupMember.findUnique).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'g1', userId: 'u1' } },
        select: { userId: true },
      });
    });

    it('resolves if user is a member', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.groupMember.findUnique).mockResolvedValue({ userId: 'u1' } as any);
      
      await expect(assertGroupMember('u1', 'g1')).resolves.toBeUndefined();
    });
  });

  describe('assertGroupAdmin', () => {
    it('throws AuthorizationError if not a member at all', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.groupMember.findUnique).mockResolvedValue(null);
      
      await expect(assertGroupAdmin('u1', 'g1')).rejects.toThrow(AuthorizationError);
    });

    it('throws AuthorizationError if member but not admin', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.groupMember.findUnique).mockResolvedValue({ role: 'member' } as any);
      
      await expect(assertGroupAdmin('u1', 'g1')).rejects.toThrow(AuthorizationError);
    });

    it('resolves if member is admin', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.groupMember.findUnique).mockResolvedValue({ role: 'admin' } as any);
      
      await expect(assertGroupAdmin('u1', 'g1')).resolves.toBeUndefined();
    });
  });
});
