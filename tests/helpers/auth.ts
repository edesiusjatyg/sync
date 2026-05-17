import { vi } from 'vitest';
import type { Session } from 'next-auth';
import type { SessionUser } from '@/lib/utils';
import { auth } from '@/lib/auth';

export function mockSession(user: SessionUser): void {
  vi.mocked(auth).mockResolvedValue({
    user: {
      ...user,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as Session);
}

export function clearSession(): void {
  vi.mocked(auth).mockResolvedValue(null);
}
