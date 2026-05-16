import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerUser } from '@/app/actions/auth.actions';
import { resetDb, db } from '@/tests/helpers/db';
import bcrypt from 'bcryptjs';

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

describe('auth.actions', () => {
  describe('registerUser', () => {
    it('creates User in DB and returns success for happy path', async () => {
      const result = await registerUser({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword',
      });

      expect(result.success).toBe(true);

      const userInDb = await db.user.findUnique({
        where: { email: 'john@example.com' },
      });

      expect(userInDb).toBeDefined();
      expect(userInDb?.name).toBe('John Doe');
      
      const isPasswordHashed = await bcrypt.compare('securepassword', userInDb!.passwordHash);
      expect(isPasswordHashed).toBe(true);
    });

    it('returns success: false when email is duplicate', async () => {
      await registerUser({
        name: 'First User',
        email: 'duplicate@example.com',
        password: 'securepassword',
      });

      const result = await registerUser({
        name: 'Second User',
        email: 'duplicate@example.com',
        password: 'anotherpassword',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('returns success: false when email format is invalid', async () => {
      const result = await registerUser({
        name: 'Invalid Email',
        email: 'not-an-email',
        password: 'securepassword',
      });

      expect(result.success).toBe(false);
    });

    it('returns success: false when password is under 8 chars', async () => {
      const result = await registerUser({
        name: 'Short Password',
        email: 'short@example.com',
        password: 'short',
      });

      expect(result.success).toBe(false);
    });
  });
});
