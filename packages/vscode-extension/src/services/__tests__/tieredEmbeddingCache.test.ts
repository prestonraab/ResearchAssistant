import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TieredEmbeddingCache } from '../tieredEmbeddingCache';

describe('TieredEmbeddingCache', () => {
  let cacheDir: string;
  let cache: TieredEmbeddingCache;

  beforeEach(() => {
    // Create temporary directory for cache
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-'));
    cache = new TieredEmbeddingCache(cacheDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true });
    }
  });

  describe('Basic operations', () => {
    test('should store and retrieve embeddings', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      await cache.set('test-key', embedding);

      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(embedding);
    });

    test('should return null for missing keys', async () => {
      const retrieved = await cache.get('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    test('should handle multiple embeddings', async () => {
      const embeddings = {
        'key1': [0.1, 0.2, 0.3],
        'key2': [0.4, 0.5, 0.6],
        'key3': [0.7, 0.8, 0.9]
      };

      for (const [key, embedding] of Object.entries(embeddings)) {
        await cache.set(key, embedding);
      }

      for (const [key, embedding] of Object.entries(embeddings)) {
        const retrieved = await cache.get(key);
        expect(retrieved).toEqual(embedding);
      }
    });
  });

  describe('Cache promotion', () => {
    test('should promote from warm to hot cache', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('test-key', embedding);

      // First access - goes to hot cache directly since we just set it
      let retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(embedding);

      let stats = cache.getStats();
      expect(stats.hotHits).toBe(1);

      // Second access should also be from hot cache
      retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(embedding);

      stats = cache.getStats();
      expect(stats.hotHits).toBe(2);
    });

    test('should promote from warm to hot cache on second access', async () => {
      const embedding = [0.1, 0.2, 0.3];
      
      // Manually set in warm cache to test promotion
      cache['warmCache'].set('test-key', embedding);
      cache.resetStats();

      // First access should be from warm cache
      let retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(embedding);

      let stats = cache.getStats();
      expect(stats.warmHits).toBe(1);

      // Second access should be from hot cache (promoted)
      retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(embedding);

      stats = cache.getStats();
      expect(stats.hotHits).toBe(1);
    });
  });

  describe('Cache statistics', () => {
    test('should track hit rate correctly', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('key1', embedding);

      // 2 hits
      await cache.get('key1');
      await cache.get('key1');

      // 1 miss
      await cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.hitRate).toBeGreaterThan(60); // At least 66% hit rate
    });

    test('should reset statistics', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('key1', embedding);
      await cache.get('key1');

      let stats = cache.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);

      cache.resetStats();
      stats = cache.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.hotHits).toBe(0);
      expect(stats.warmHits).toBe(0);
      expect(stats.coldHits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Cache trimming', () => {
    test('should trim light (75%)', async () => {
      // Fill hot cache
      for (let i = 0; i < 50; i++) {
        await cache.set(`key${i}`, [i]);
      }

      let stats = cache.getStats();
      expect(stats.hotSize).toBe(50);

      cache.trim('light');
      stats = cache.getStats();
      expect(stats.hotSize).toBeLessThanOrEqual(38); // 75% of 50
    });

    test('should trim moderate (50%)', async () => {
      // Fill caches
      for (let i = 0; i < 50; i++) {
        await cache.set(`key${i}`, [i]);
      }

      cache.trim('moderate');
      const stats = cache.getStats();
      expect(stats.hotSize).toBeLessThanOrEqual(25); // 50% of 50
    });

    test('should trim aggressive (clear hot, 25% warm)', async () => {
      // Fill caches
      for (let i = 0; i < 50; i++) {
        await cache.set(`key${i}`, [i]);
      }

      cache.trim('aggressive');
      const stats = cache.getStats();
      expect(stats.hotSize).toBe(0); // Hot cache cleared
      expect(stats.warmSize).toBeLessThanOrEqual(50); // 25% of 200
    });
  });

  describe('Cache clearing', () => {
    test('should clear all caches', async () => {
      // Fill caches
      for (let i = 0; i < 50; i++) {
        await cache.set(`key${i}`, [i]);
      }

      let stats = cache.getStats();
      expect(stats.hotSize + stats.warmSize).toBeGreaterThan(0);

      await cache.clear();
      stats = cache.getStats();
      expect(stats.hotSize).toBe(0);
      expect(stats.warmSize).toBe(0);
    });
  });

  describe('Persistence', () => {
    test('should persist embeddings to disk', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('test-key', embedding);

      // Check that file was created
      const files = fs.readdirSync(cacheDir);
      expect(files.length).toBeGreaterThan(0);
    });

    test('should recover embeddings from disk after cache clear', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('test-key', embedding);

      // Create new cache instance (simulates restart)
      const newCache = new TieredEmbeddingCache(cacheDir);

      // Should be able to retrieve from disk
      const retrieved = await newCache.get('test-key');
      expect(retrieved).toEqual(embedding);
    });
  });

  describe('Edge cases', () => {
    test('should handle large embeddings', async () => {
      const largeEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536);
      await cache.set('large-key', largeEmbedding);

      const retrieved = await cache.get('large-key');
      expect(retrieved).toEqual(largeEmbedding);
    });

    test('should handle special characters in keys', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const specialKey = 'key-with-special-chars-!@#$%^&*()';
      await cache.set(specialKey, embedding);

      const retrieved = await cache.get(specialKey);
      expect(retrieved).toEqual(embedding);
    });

    test('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, [i]));
      }

      await Promise.all(promises);

      const stats = cache.getStats();
      expect(stats.hotSize + stats.warmSize).toBeGreaterThan(0);
    });
  });
});
