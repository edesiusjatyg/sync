import { beforeEach, afterAll, vi } from 'vitest';
import { testDb } from './tests/helpers/db';
import { flushTestCache } from './tests/helpers/cache';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/db', async () => {
  const { testDb } = await import('./tests/helpers/db');
  return { db: testDb };
});

beforeEach(async () => {
  // Respect FK constraints when truncating
  const tableNames = await testDb.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tableNames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables.length > 0) {
    await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  }

  await flushTestCache();
  
  // Clear any auth mocks
  vi.clearAllMocks();
});

afterAll(async () => {
  await testDb.$disconnect();
});
