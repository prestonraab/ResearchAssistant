/**
 * Unit tests for EmbeddingService
 * Tests basic functionality without making actual API calls
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EmbeddingService } from '../../src/core/EmbeddingService.js';
import * as fs from 'fs';
import * as path from 'path';

describe('EmbeddingService', () => {
  const testCacheDir = '.cache/test-embeddings';
  let service: EmbeddingService;

  beforeEach(() => {
    // Create service with test cache directory
    service = new EmbeddingService(
      'test-api-key',
      testCacheDir,
      100,
      'text-embedding-3-small'
    );
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3, 4, 5];
      const similarity = service.cosineSimilarity(vec, vec);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should return value between -1 and 1 for any vectors', () => {
      const vec1 = [1, 2, 3, 4];
      const vec2 = [5, 6, 7, 8];
      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => service.cosineSimilarity(vec1, vec2)).toThrow(
        'Vectors must have the same length'
      );
    });

    it('should return 0 for zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      const similarity = service.cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });
  });

  describe('cache management', () => {
    it('should initialize with empty cache', () => {
      expect(service.getCacheSize()).toBe(0);
    });

    it('should clear cache', () => {
      service.clearCache();
      expect(service.getCacheSize()).toBe(0);
    });

    it('should trim cache to specified size', () => {
      // Manually add items to cache for testing
      const cache = (service as any).cache;
      for (let i = 0; i < 150; i++) {
        cache.set(`key${i}`, [i]);
      }

      expect(service.getCacheSize()).toBe(150);
      
      service.trimCache(100);
      
      expect(service.getCacheSize()).toBe(100);
    });

    it('should not trim cache if size is below threshold', () => {
      const cache = (service as any).cache;
      for (let i = 0; i < 50; i++) {
        cache.set(`key${i}`, [i]);
      }

      expect(service.getCacheSize()).toBe(50);
      
      service.trimCache(100);
      
      expect(service.getCacheSize()).toBe(50);
    });

    it('should implement LRU eviction - keep most recently used entries', () => {
      const cache = (service as any).cache;
      
      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, [i]);
      }

      // Access key0 and key1 to make them recently used
      cache.get('key0');
      cache.delete('key0');
      cache.set('key0', [0]);
      
      cache.get('key1');
      cache.delete('key1');
      cache.set('key1', [1]);

      // Trim to 3 entries - should keep key0, key1, and key4 (most recent)
      service.trimCache(3);
      
      expect(service.getCacheSize()).toBe(3);
      expect(cache.has('key0')).toBe(true); // Recently accessed
      expect(cache.has('key1')).toBe(true); // Recently accessed
      expect(cache.has('key4')).toBe(true); // Most recently added
      expect(cache.has('key2')).toBe(false); // Should be evicted
      expect(cache.has('key3')).toBe(false); // Should be evicted
    });
  });

  describe('cache directory', () => {
    it('should create cache directory if it does not exist', () => {
      expect(fs.existsSync(testCacheDir)).toBe(true);
    });

    it('should persist cache to disk', () => {
      const cache = (service as any).cache;
      const testKey = 'test-cache-key';
      const testEmbedding = [1, 2, 3, 4, 5];
      
      // Manually save to disk cache
      (service as any).saveToDiskCache(testKey, testEmbedding);
      
      // Verify file exists
      const cachePath = path.join(testCacheDir, `${testKey}.json`);
      expect(fs.existsSync(cachePath)).toBe(true);
      
      // Verify content
      const loaded = (service as any).loadFromDiskCache(testKey);
      expect(loaded).toEqual(testEmbedding);
    });

    it('should load cache from disk on initialization', () => {
      // Create a cache file manually
      const testKey = 'persisted-key';
      const testEmbedding = [10, 20, 30];
      const cachePath = path.join(testCacheDir, `${testKey}.json`);
      
      fs.writeFileSync(cachePath, JSON.stringify(testEmbedding));
      
      // Create new service instance - should load from disk
      const newService = new EmbeddingService(
        'test-api-key',
        testCacheDir,
        100,
        'text-embedding-3-small'
      );
      
      // Verify cache was loaded
      const cache = (newService as any).cache;
      expect(cache.has(testKey)).toBe(true);
      expect(cache.get(testKey)).toEqual(testEmbedding);
    });

    it('should respect maxCacheSize when loading from disk', () => {
      // Create multiple cache files
      for (let i = 0; i < 150; i++) {
        const cachePath = path.join(testCacheDir, `key${i}.json`);
        fs.writeFileSync(cachePath, JSON.stringify([i]));
      }
      
      // Create new service with max size 100
      const newService = new EmbeddingService(
        'test-api-key',
        testCacheDir,
        100,
        'text-embedding-3-small'
      );
      
      // Should only load up to maxCacheSize
      expect(newService.getCacheSize()).toBeLessThanOrEqual(100);
    });
  });
});
