import { describe, it, expect } from 'vitest';
import { registerUser } from '@/app/actions/auth.actions';
import { testDb } from '../helpers/db';

describe('Auth Server Actions', () => {
  describe('registerUser', () => {
    it('registers a new user successfully', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };
      
      const result = await registerUser(input);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBeDefined();
        
        const userInDb = await testDb.user.findUnique({ where: { id: result.data.userId } });
        expect(userInDb).toBeDefined();
        expect(userInDb!.email).toBe('john@example.com');
      }
    });

    it('returns error on duplicate email', async () => {
      const input = {
        name: 'Jane Doe',
        email: 'duplicate@example.com',
        password: 'password123',
      };
      
      await registerUser(input);
      const result = await registerUser(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('An account with this email already exists.');
      }
    });

    it('returns error on invalid email format', async () => {
      const result = await registerUser({
        name: 'Invalid Email',
        email: 'not-an-email',
        password: 'password123',
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input.');
      }
    });

    it('returns error on short password', async () => {
      const result = await registerUser({
        name: 'Short Pass',
        email: 'short@example.com',
        password: 'pass',
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input.');
      }
    });
    
    it('returns error on empty name', async () => {
      const result = await registerUser({
        name: '',
        email: 'noname@example.com',
        password: 'password123',
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid input.');
      }
    });
  });
});
