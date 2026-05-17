import { redis } from '@/lib/cache';

export async function flushTestCache(): Promise<void> {
  if (!redis) return;
  const keys = await redis.keys('sync:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
