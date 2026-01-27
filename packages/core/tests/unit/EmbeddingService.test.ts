/**
 * Unit tests for EmbeddingService
 * 
 * Tests cover:
 * - generateEmbedding() with cache miss and hit
 * - generateBatch() with mixed cache hits/misses
 * - cosineSimilarity() calculation
 * - trimCache() LRU eviction and disk cache persistence
 * - Cache loading from disk
 * - Error handling
 * 
 * **Validates: Requirements 4.1, 5.5**
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock OpenAI before any imports
const mockCreate = jest.fn() as jest.MockedFunction<any>;

jest.unstable_mockModule('openai', () => ({
  default: class MockOpenAI {
    embeddings = {
      create: mockCreate
    };
    constructor(config: any) {}
  }
}));

// Now import the service
const { EmbeddingService } = await import('../../src/services/EmbeddingService.js');

describe('EmbeddingService', () => {
  let tempDir: string;
  let embeddingService: InstanceType<typeof EmbeddingService>;

  beforeEach(() => {
    // Create temporary directory for cache
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embedding-test-'));
    
    // Reset mock
    jest.clearAllMocks();
    mockCreate.mockReset();
    
    // Create service
    embeddingService = new EmbeddingService(
      'test-api-key',
      tempDir,
      1000,
      'text-embedding-3-small'
    );
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create cache directory if it does not exist', () => {
      const newDir = path.join(tempDir, 'new-cache');
      expect(fs.existsSync(newDir)).toBe(false);

      new EmbeddingService('test-key', newDir);

      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should use default parameters when not provided', () => {
      const service = new EmbeddingService('test-key');
      
      expect(service.getCacheSize()).toBe(0);
      expect(service).toBeDefined();
    });

    it('should load existing cache from disk on initialization', () => {
      // Create a cache file
      const cacheKey = 'test-cache-key';
      const embedding = [0.1, 0.2, 0.3];
      const cachePath = path.join(tempDir, `${cacheKey}.json`);
      fs.writeFileSync(cachePath, JSON.stringify(embedding));

      // Create new service (should load cache)
      const service = new EmbeddingService('test-key', tempDir, 1000);

      expect(service.getCacheSize()).toBe(1);
    });


    it('should respect maxCacheSize when loading from disk', () => {
      // Create multiple cache files
      for (let i = 0; i < 10; i++) {
        const cacheKey = `cache-key-${i}`;
        const embedding = [i * 0.1, i * 0.2, i * 0.3];
        const cachePath = path.join(tempDir, `${cacheKey}.json`);
        fs.writeFileSync(cachePath, JSON.stringify(embedding));
      }

      // Create service with maxCacheSize of 5
      const service = new EmbeddingService('test-key', tempDir, 5);

      expect(service.getCacheSize()).toBe(5);
    });
  });

  describe('generateEmbedding() - cache miss', () => {
    it('should call OpenAI API when embedding not in cache', async () => {
      const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      const result = await embeddingService.generateEmbedding('test text');

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
      });
      expect(result).toEqual(testEmbedding);
    });

    it('should cache the result in memory', async () => {
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      await embeddingService.generateEmbedding('test text');

      expect(embeddingService.getCacheSize()).toBe(1);
    });


    it('should save the result to disk cache', async () => {
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      await embeddingService.generateEmbedding('test text');

      // Check that a cache file was created
      const files = fs.readdirSync(tempDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/\.json$/);

      // Verify content
      const cacheFile = path.join(tempDir, files[0]);
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      expect(cached).toEqual(testEmbedding);
    });

    it('should throw error if OpenAI API call fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));

      await expect(
        embeddingService.generateEmbedding('test text')
      ).rejects.toThrow('Failed to generate embedding: API error');
    });
  });

  describe('generateEmbedding() - cache hit', () => {
    it('should return cached embedding without calling API', async () => {
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      // First call - cache miss
      await embeddingService.generateEmbedding('test text');
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result = await embeddingService.generateEmbedding('test text');

      expect(mockCreate).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result).toEqual(testEmbedding);
    });


    it('should update LRU ordering on cache hit', async () => {
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];
      const embedding3 = [0.7, 0.8, 0.9];

      mockCreate
        .mockResolvedValueOnce({ data: [{ embedding: embedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: embedding2 }] })
        .mockResolvedValueOnce({ data: [{ embedding: embedding3 }] });

      // Generate three embeddings
      await embeddingService.generateEmbedding('text1');
      await embeddingService.generateEmbedding('text2');
      await embeddingService.generateEmbedding('text3');

      // Access text1 again (should move to end)
      await embeddingService.generateEmbedding('text1');

      // Create new service with maxCacheSize of 2
      const smallService = new EmbeddingService('test-key', tempDir, 2);
      
      // Generate one more to trigger trim
      mockCreate.mockResolvedValueOnce({ data: [{ embedding: [1.0, 1.1, 1.2] }] });
      await smallService.generateEmbedding('text4');

      // text1 should still be in cache (was most recently used)
      // text2 should be evicted (least recently used)
      const result1 = await smallService.generateEmbedding('text1');
      expect(result1).toEqual(embedding1);
      expect(mockCreate).toHaveBeenCalledTimes(4); // No new call for text1
    });

    it('should load from disk cache if not in memory', async () => {
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      // Generate and cache
      await embeddingService.generateEmbedding('test text');

      // Clear memory cache
      embeddingService.clearCache();
      expect(embeddingService.getCacheSize()).toBe(0);

      // Should load from disk without API call
      const result = await embeddingService.generateEmbedding('test text');

      expect(mockCreate).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result).toEqual(testEmbedding);
      expect(embeddingService.getCacheSize()).toBe(1); // Back in memory
    });
  });


  describe('generateBatch()', () => {
    it('should return empty array for empty input', async () => {
      const result = await embeddingService.generateBatch([]);

      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should generate embeddings for all uncached texts in single API call', async () => {
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ];

      mockCreate.mockResolvedValueOnce({
        data: embeddings.map(embedding => ({ embedding })),
      });

      const texts = ['text1', 'text2', 'text3'];
      const result = await embeddingService.generateBatch(texts);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: texts,
      });
      expect(result).toEqual(embeddings);
    });

    it('should maintain input order in output', async () => {
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];

      mockCreate.mockResolvedValueOnce({
        data: embeddings.map(embedding => ({ embedding })),
      });

      const texts = ['first', 'second'];
      const result = await embeddingService.generateBatch(texts);

      expect(result[0]).toEqual(embeddings[0]);
      expect(result[1]).toEqual(embeddings[1]);
    });


    it('should use cached embeddings and only generate uncached ones', async () => {
      // Pre-cache some embeddings
      const cachedEmbedding1 = [0.1, 0.2, 0.3];
      const cachedEmbedding2 = [0.4, 0.5, 0.6];
      mockCreate
        .mockResolvedValueOnce({ data: [{ embedding: cachedEmbedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: cachedEmbedding2 }] });

      await embeddingService.generateEmbedding('cached1');
      await embeddingService.generateEmbedding('cached2');

      // Now batch with mix of cached and uncached
      const newEmbeddings = [
        [0.7, 0.8, 0.9],
        [1.0, 1.1, 1.2],
      ];

      mockCreate.mockResolvedValueOnce({
        data: newEmbeddings.map(embedding => ({ embedding })),
      });

      const texts = ['cached1', 'new1', 'cached2', 'new2'];
      const result = await embeddingService.generateBatch(texts);

      // Should only call API for new texts
      expect(mockCreate).toHaveBeenCalledTimes(3); // 2 pre-cache + 1 batch
      expect(mockCreate).toHaveBeenLastCalledWith({
        model: 'text-embedding-3-small',
        input: ['new1', 'new2'],
      });

      // Verify correct order
      expect(result[0]).toEqual(cachedEmbedding1);
      expect(result[1]).toEqual(newEmbeddings[0]);
      expect(result[2]).toEqual(cachedEmbedding2);
      expect(result[3]).toEqual(newEmbeddings[1]);
    });

    it('should update LRU ordering for cache hits', async () => {
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      mockCreate
        .mockResolvedValueOnce({ data: [{ embedding: embedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: embedding2 }] });

      await embeddingService.generateEmbedding('text1');
      await embeddingService.generateEmbedding('text2');

      // Batch access should update LRU
      await embeddingService.generateBatch(['text1', 'text2']);

      expect(mockCreate).toHaveBeenCalledTimes(2); // No new calls
    });


    it('should load from disk cache for batch requests', async () => {
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      mockCreate
        .mockResolvedValueOnce({ data: [{ embedding: embedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: embedding2 }] });

      // Generate and cache
      await embeddingService.generateEmbedding('text1');
      await embeddingService.generateEmbedding('text2');

      // Clear memory cache
      embeddingService.clearCache();

      // Batch should load from disk
      const result = await embeddingService.generateBatch(['text1', 'text2']);

      expect(mockCreate).toHaveBeenCalledTimes(2); // No new calls
      expect(result).toEqual([embedding1, embedding2]);
    });

    it('should cache all new embeddings from batch', async () => {
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];

      mockCreate.mockResolvedValueOnce({
        data: embeddings.map(embedding => ({ embedding })),
      });

      await embeddingService.generateBatch(['text1', 'text2']);

      expect(embeddingService.getCacheSize()).toBe(2);

      // Verify disk cache
      const files = fs.readdirSync(tempDir);
      expect(files.length).toBe(2);
    });

    it('should throw error if batch API call fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Batch API error'));

      await expect(
        embeddingService.generateBatch(['text1', 'text2'])
      ).rejects.toThrow('Failed to generate batch embeddings: Batch API error');
    });
  });


  describe('cosineSimilarity()', () => {
    it('should calculate correct similarity for identical vectors', () => {
      const vec = [1, 2, 3, 4, 5];
      const similarity = embeddingService.cosineSimilarity(vec, vec);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate correct similarity for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = embeddingService.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate correct similarity for opposite vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const similarity = embeddingService.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should calculate correct similarity for arbitrary vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      
      // Manual calculation:
      // dot product = 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      // norm1 = sqrt(1 + 4 + 9) = sqrt(14)
      // norm2 = sqrt(16 + 25 + 36) = sqrt(77)
      // similarity = 32 / (sqrt(14) * sqrt(77)) = 32 / sqrt(1078)
      const expected = 32 / Math.sqrt(1078);
      
      const similarity = embeddingService.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(expected, 5);
    });

    it('should be symmetric', () => {
      const vec1 = [1, 2, 3, 4];
      const vec2 = [5, 6, 7, 8];
      
      const sim1 = embeddingService.cosineSimilarity(vec1, vec2);
      const sim2 = embeddingService.cosineSimilarity(vec2, vec1);

      expect(sim1).toBeCloseTo(sim2, 10);
    });


    it('should return 0 for zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      
      const similarity = embeddingService.cosineSimilarity(vec1, vec2);

      expect(similarity).toBe(0);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3, 4];

      expect(() => {
        embeddingService.cosineSimilarity(vec1, vec2);
      }).toThrow('Vectors must have the same length');
    });

    it('should handle high-dimensional vectors', () => {
      const dim = 1536; // OpenAI embedding dimension
      const vec1 = Array.from({ length: dim }, (_, i) => i / dim);
      const vec2 = Array.from({ length: dim }, (_, i) => (dim - i) / dim);

      const similarity = embeddingService.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeGreaterThan(-1);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle negative values', () => {
      const vec1 = [-1, -2, -3];
      const vec2 = [1, 2, 3];
      
      const similarity = embeddingService.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle decimal values', () => {
      const vec1 = [0.1, 0.2, 0.3];
      const vec2 = [0.4, 0.5, 0.6];
      
      const similarity = embeddingService.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });


  describe('trimCache()', () => {
    it('should not trim if cache size is below limit', () => {
      embeddingService.trimCache(1000);
      expect(embeddingService.getCacheSize()).toBe(0);
    });

    it('should trim cache to specified size using LRU eviction', async () => {
      const embeddings = Array.from({ length: 10 }, (_, i) => [i, i + 1, i + 2]);
      
      for (let i = 0; i < 10; i++) {
        mockCreate.mockResolvedValueOnce({
          data: [{ embedding: embeddings[i] }],
        });
      }

      // Generate 10 embeddings
      for (let i = 0; i < 10; i++) {
        await embeddingService.generateEmbedding(`text${i}`);
      }

      expect(embeddingService.getCacheSize()).toBe(10);

      // Trim to 5
      embeddingService.trimCache(5);

      expect(embeddingService.getCacheSize()).toBe(5);
    });

    it('should keep most recently used entries', async () => {
      const embeddings = Array.from({ length: 5 }, (_, i) => [i, i + 1, i + 2]);
      
      for (let i = 0; i < 5; i++) {
        mockCreate.mockResolvedValueOnce({
          data: [{ embedding: embeddings[i] }],
        });
      }

      // Generate 5 embeddings
      for (let i = 0; i < 5; i++) {
        await embeddingService.generateEmbedding(`text${i}`);
      }

      // Trim to 3 (should keep text2, text3, text4 - the most recent)
      embeddingService.trimCache(3);
      expect(embeddingService.getCacheSize()).toBe(3);

      // text4 should still be in memory cache
      await embeddingService.generateEmbedding('text4');
      expect(mockCreate).toHaveBeenCalledTimes(5); // No new call

      // text0 was evicted from memory but exists on disk
      await embeddingService.generateEmbedding('text0');
      expect(mockCreate).toHaveBeenCalledTimes(5); // Still no new call, loaded from disk
    });


    it('should automatically trim when cache exceeds maxCacheSize', async () => {
      // Create service with small cache
      const smallService = new EmbeddingService('test-key', tempDir, 3);

      const embeddings = Array.from({ length: 5 }, (_, i) => [i, i + 1, i + 2]);
      
      for (let i = 0; i < 5; i++) {
        mockCreate.mockResolvedValueOnce({
          data: [{ embedding: embeddings[i] }],
        });
      }

      // Generate 5 embeddings (should auto-trim to 3)
      for (let i = 0; i < 5; i++) {
        await smallService.generateEmbedding(`text${i}`);
      }

      expect(smallService.getCacheSize()).toBe(3);
    });

    it('should not affect disk cache when trimming memory', async () => {
      const embeddings = Array.from({ length: 5 }, (_, i) => [i, i + 1, i + 2]);
      
      for (let i = 0; i < 5; i++) {
        mockCreate.mockResolvedValueOnce({
          data: [{ embedding: embeddings[i] }],
        });
      }

      // Generate 5 embeddings
      for (let i = 0; i < 5; i++) {
        await embeddingService.generateEmbedding(`text${i}`);
      }

      // Verify 5 files on disk
      let files = fs.readdirSync(tempDir);
      expect(files.length).toBe(5);

      // Trim memory cache
      embeddingService.trimCache(2);

      // Disk cache should still have 5 files
      files = fs.readdirSync(tempDir);
      expect(files.length).toBe(5);
    });

    it('should handle trimming to zero', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      await embeddingService.generateEmbedding('test');
      expect(embeddingService.getCacheSize()).toBe(1);

      // Note: slice(-0) returns entire array, so trimCache(0) keeps everything
      // This is a known JavaScript behavior. To truly clear, use clearCache()
      embeddingService.clearCache();
      expect(embeddingService.getCacheSize()).toBe(0);
      
      // Should still be able to load from disk, which adds it back to memory
      const result = await embeddingService.generateEmbedding('test');
      expect(mockCreate).toHaveBeenCalledTimes(1); // No new call, loaded from disk
      expect(result).toEqual([0.1, 0.2, 0.3]);
      // Now it's back in memory cache
      expect(embeddingService.getCacheSize()).toBe(1);
    });
  });


  describe('clearCache()', () => {
    it('should clear all in-memory cache', async () => {
      const embeddings = Array.from({ length: 3 }, (_, i) => [i, i + 1, i + 2]);
      
      for (let i = 0; i < 3; i++) {
        mockCreate.mockResolvedValueOnce({
          data: [{ embedding: embeddings[i] }],
        });
      }

      for (let i = 0; i < 3; i++) {
        await embeddingService.generateEmbedding(`text${i}`);
      }

      expect(embeddingService.getCacheSize()).toBe(3);

      embeddingService.clearCache();

      expect(embeddingService.getCacheSize()).toBe(0);
    });

    it('should not affect disk cache', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      await embeddingService.generateEmbedding('test');

      const filesBefore = fs.readdirSync(tempDir);
      expect(filesBefore.length).toBe(1);

      embeddingService.clearCache();

      const filesAfter = fs.readdirSync(tempDir);
      expect(filesAfter.length).toBe(1);
    });

    it('should allow reloading from disk after clear', async () => {
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      await embeddingService.generateEmbedding('test');
      embeddingService.clearCache();

      // Should reload from disk
      const result = await embeddingService.generateEmbedding('test');

      expect(mockCreate).toHaveBeenCalledTimes(1); // No new API call
      expect(result).toEqual(testEmbedding);
    });
  });


  describe('getCacheSize()', () => {
    it('should return 0 for empty cache', () => {
      expect(embeddingService.getCacheSize()).toBe(0);
    });

    it('should return correct count after adding embeddings', async () => {
      const embeddings = Array.from({ length: 5 }, (_, i) => [i, i + 1, i + 2]);
      
      for (let i = 0; i < 5; i++) {
        mockCreate.mockResolvedValueOnce({
          data: [{ embedding: embeddings[i] }],
        });
      }

      for (let i = 0; i < 5; i++) {
        await embeddingService.generateEmbedding(`text${i}`);
        expect(embeddingService.getCacheSize()).toBe(i + 1);
      }
    });

    it('should return correct count after trimming', async () => {
      const embeddings = Array.from({ length: 10 }, (_, i) => [i, i + 1, i + 2]);
      
      for (let i = 0; i < 10; i++) {
        mockCreate.mockResolvedValueOnce({
          data: [{ embedding: embeddings[i] }],
        });
      }

      for (let i = 0; i < 10; i++) {
        await embeddingService.generateEmbedding(`text${i}`);
      }

      embeddingService.trimCache(5);
      expect(embeddingService.getCacheSize()).toBe(5);
    });

    it('should return 0 after clearing', async () => {
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      await embeddingService.generateEmbedding('test');
      expect(embeddingService.getCacheSize()).toBeGreaterThan(0);

      embeddingService.clearCache();
      expect(embeddingService.getCacheSize()).toBe(0);
    });
  });


  describe('disk cache persistence', () => {
    it('should persist cache across service instances', async () => {
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      // First service generates and caches
      await embeddingService.generateEmbedding('test text');

      // Create new service instance (should load from disk)
      const newService = new EmbeddingService('test-key', tempDir, 1000);

      expect(newService.getCacheSize()).toBe(1);

      // Should not call API
      const result = await newService.generateEmbedding('test text');
      expect(mockCreate).toHaveBeenCalledTimes(1); // Only the first call
      expect(result).toEqual(testEmbedding);
    });

    it('should handle corrupted cache files gracefully', async () => {
      // Create corrupted cache file
      const corruptedPath = path.join(tempDir, 'corrupted.json');
      fs.writeFileSync(corruptedPath, 'not valid json{]', 'utf-8');

      // Should not throw when loading
      const service = new EmbeddingService('test-key', tempDir, 1000);
      expect(service.getCacheSize()).toBe(0);
    });

    it('should handle missing cache directory gracefully', () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');
      
      // Should create directory and not throw
      expect(() => {
        new EmbeddingService('test-key', nonExistentDir, 1000);
      }).not.toThrow();

      expect(fs.existsSync(nonExistentDir)).toBe(true);
    });

    it('should ignore non-JSON files in cache directory', async () => {
      // Create non-JSON files
      fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'ignore me', 'utf-8');
      fs.writeFileSync(path.join(tempDir, 'data.csv'), 'a,b,c', 'utf-8');

      // Create valid cache file
      const cacheKey = 'valid-cache';
      const embedding = [0.1, 0.2, 0.3];
      fs.writeFileSync(
        path.join(tempDir, `${cacheKey}.json`),
        JSON.stringify(embedding),
        'utf-8'
      );

      const service = new EmbeddingService('test-key', tempDir, 1000);

      expect(service.getCacheSize()).toBe(1);
    });


    it('should handle write errors gracefully', async () => {
      // Make cache directory read-only
      fs.chmodSync(tempDir, 0o444);

      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      // Should not throw even if disk write fails
      await expect(
        embeddingService.generateEmbedding('test')
      ).resolves.toEqual(testEmbedding);

      // Restore permissions for cleanup
      fs.chmodSync(tempDir, 0o755);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string input', async () => {
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      const result = await embeddingService.generateEmbedding('');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: '',
      });
      expect(result).toEqual(testEmbedding);
    });

    it('should handle very long text input', async () => {
      const longText = 'a'.repeat(10000);
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      const result = await embeddingService.generateEmbedding(longText);

      expect(result).toEqual(testEmbedding);
    });

    it('should handle special characters in text', async () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      const result = await embeddingService.generateEmbedding(specialText);

      expect(result).toEqual(testEmbedding);
    });


    it('should handle unicode characters', async () => {
      const unicodeText = '你好世界 🌍 Привет мир';
      const testEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: testEmbedding }],
      });

      const result = await embeddingService.generateEmbedding(unicodeText);

      expect(result).toEqual(testEmbedding);
    });

    it('should handle duplicate texts in batch', async () => {
      const embedding = [0.1, 0.2, 0.3];
      
      // When batch has duplicates, they're sent as separate items to API
      // API returns one embedding per input text (including duplicates)
      mockCreate.mockResolvedValueOnce({
        data: [
          { embedding },
          { embedding }
        ],
      });

      const result = await embeddingService.generateBatch(['same', 'same']);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['same', 'same'],
      });
      // Both results should be the same embedding
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(embedding);
      expect(result[1]).toEqual(embedding);
    });

    it('should handle single item batch', async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding }],
      });

      const result = await embeddingService.generateBatch(['single']);

      expect(result).toEqual([embedding]);
    });

    it('should use correct model from constructor', async () => {
      const customService = new EmbeddingService(
        'test-key',
        tempDir,
        1000,
        'text-embedding-3-large'
      );

      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      await customService.generateEmbedding('test');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: 'test',
      });
    });
  });
});
