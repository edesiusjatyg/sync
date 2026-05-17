import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cached, invalidate, CacheKey } from '@/lib/cache';
import { redis } from '@/lib/cache';

describe('Cache Layer', () => {
  beforeEach(async () => {
    if (redis) {
      const keys = await redis.keys('sync:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  });

  describe('cached()', () => {
    it('calls loader and caches on MISS', async () => {
      const loader = vi.fn().mockResolvedValue({ test: 'data' });
      const result = await cached('sync:test:1', loader, 60);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ test: 'data' });
      
      if (redis) {
        const stored = await redis.get('sync:test:1');
        expect(JSON.parse(stored!)).toEqual({ test: 'data' });
      }
    });

    it('returns cached value without calling loader on HIT', async () => {
      if (!redis) return;
      await redis.set('sync:test:2', JSON.stringify({ cached: 'value' }));
      
      const loader = vi.fn();
      const result = await cached('sync:test:2', loader, 60);
      
      expect(loader).not.toHaveBeenCalled();
      expect(result).toEqual({ cached: 'value' });
    });

    it('returns data gracefully when redis errors on get', async () => {
      if (redis) {
        const getSpy = vi.spyOn(redis, 'get').mockRejectedValueOnce(new Error('Redis Error'));
        const loader = vi.fn().mockResolvedValue({ fallback: 'data' });
        
        const result = await cached('sync:test:error:get', loader, 60);
        expect(loader).toHaveBeenCalled();
        expect(result).toEqual({ fallback: 'data' });
        getSpy.mockRestore();
      }
    });

    it('returns data gracefully when redis errors on set', async () => {
      if (redis) {
        const setSpy = vi.spyOn(redis, 'set').mockRejectedValueOnce(new Error('Redis Error'));
        const loader = vi.fn().mockResolvedValue({ data: 'val' });
        
        const result = await cached('sync:test:error:set', loader, 60);
        expect(result).toEqual({ data: 'val' });
        setSpy.mockRestore();
      }
    });

    it('preserves deep equality across serialization', async () => {
      const complexObject = {
        array: [1, 2, { nested: 'string' }],
        flag: true,
        nullVal: null,
      };
      const loader = vi.fn().mockResolvedValue(complexObject);
      const result = await cached('sync:test:complex', loader, 60);
      
      expect(result).toEqual(complexObject);

      if (redis) {
        const secondResult = await cached('sync:test:complex', vi.fn(), 60);
        expect(secondResult).toEqual(complexObject);
      }
    });
  });

  describe('invalidate()', () => {
    it('deletes keys correctly', async () => {
      if (!redis) return;
      await redis.set('sync:test:inv1', 'val');
      await redis.set('sync:test:inv2', 'val');
      
      await invalidate('sync:test:inv1', 'sync:test:inv2');
      
      expect(await redis.get('sync:test:inv1')).toBeNull();
      expect(await redis.get('sync:test:inv2')).toBeNull();
    });

    it('is a no-op with empty keys array', async () => {
      await expect(invalidate()).resolves.toBeUndefined();
    });
    
    it('is graceful when redis unavailable or fails', async () => {
      if (redis) {
        const delSpy = vi.spyOn(redis, 'del').mockRejectedValueOnce(new Error('Redis Error'));
        await expect(invalidate('sync:test:fail')).resolves.toBeUndefined();
        delSpy.mockRestore();
      }
    });
  });

  describe('CacheKey formatting', () => {
    it('returns consistent key formats', () => {
      expect(CacheKey.candidates('user123')).toBe('sync:candidates:user123');
      expect(CacheKey.matches('user123')).toBe('sync:matches:user123');
      expect(CacheKey.groupDetail('group123')).toBe('sync:group:group123');
    });
  });
});
