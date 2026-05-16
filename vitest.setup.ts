import { beforeAll, vi } from 'vitest';
import dotenv from 'dotenv';

// Load the environment variables from .env if present
dotenv.config();

// Enforce using TEST DB to avoid mutating dev or prod
if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST must be defined in your environment to run tests safely. Set it in .env');
}

// Override the main database URL with the test URL
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
