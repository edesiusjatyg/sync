import Redis from "ioredis";

/*
 * CACHING ANALYSIS
 *
 * Candidates for caching (justify each):
 *   getCandidates — High read frequency (often loaded by active users) — Invalidated on new mutual swipe or user onboarding updates. Over-invalidation of all candidate lists is avoided; 5-min TTL naturally handles stale candidates over time. — 5 minutes
 *   getMyMatches — High read frequency (accessed on matches page load) — Invalidated on mutual swipe. — 5 minutes
 *   getGroupDetail — High read frequency (accessed on every group view) — Invalidated on member/task mutations. — 2 minutes
 *
 * Explicitly NOT cached (justify each):
 *   All write actions — Write-heavy mutations. Stale data is dangerous here; DB acts as source of truth.
 *   getMyProfile — Personalized, cheap DB query. Always needs to be current for user editing.
 *   getGroupTasks — Task status changes frequently. Stale data causes visible UI bugs.
 *   getGroupSessions — Effectiveness scores are submitted post-session. Stale data is confusing.
 *   Auth / register actions — Must always hit the database for secure session management.
 *
 * Chosen strategy: Cache-Aside
 * Chosen TTL defaults: 5 minutes for general connections, 2 minutes for group details.
 */

const globalForRedis = globalThis as unknown as { redis: Redis | null };

// If REDIS_URL is not set, export a null client and have cached() skip caching entirely.
export const redis = globalForRedis.redis ?? (process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null);

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export const CacheKey = {
  candidates: (userId: string) => `sync:candidates:${userId}`,
  matches: (userId: string) => `sync:matches:${userId}`,
  groupDetail: (groupId: string) => `sync:group:${groupId}`,
  groupTasks: (groupId: string) => `sync:tasks:${groupId}`,
  groupSessions: (groupId: string) => `sync:sessions:${groupId}`,
} as const;

export const TTL = {
  candidates: 60 * 5, // 5 minutes — changes on new swipe or new user
  matches: 60 * 5, // 5 minutes — changes on new mutual swipe
  groupDetail: 60 * 2, // 2 minutes — changes on member/task mutations
  groupTasks: 60, // 1 minute — changes on task create/update/delete
  groupSessions: 60, // 1 minute — changes on session log/score
} as const;

export async function cached<T>(key: string, loader: () => Promise<T>, ttlSeconds: number): Promise<T> {
  if (!redis) {
    return loader();
  }

  try {
    const t0 = Date.now();
    const cachedValue = await redis.get(key);
    console.log(`[cache] redis.get took ${Date.now() - t0}ms`);

    if (cachedValue) {
      const t1 = Date.now();
      const parsed = JSON.parse(cachedValue) as T;
      console.log(`[cache] JSON.parse took ${Date.now() - t1}ms`);
      console.log(`[cache] HIT: ${key}`);
      return parsed;
    }
    console.log(`[cache] MISS: ${key}`);
  } catch (error) {
    console.error("[cache]", error);
  }

  // Loader is outside try-catch to ensure we don't accidentally swallow loader errors
  const data = await loader();

  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (error) {
    console.error("[cache]", error);
  }

  return data;
}

export async function invalidate(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) {
    return;
  }

  try {
    await redis.del(...keys);
  } catch (error) {
    console.error("[cache]", error);
  }
}
