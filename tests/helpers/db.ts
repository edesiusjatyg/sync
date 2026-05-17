import { PrismaClient } from '@prisma/client';

export const testDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL_TEST
});
