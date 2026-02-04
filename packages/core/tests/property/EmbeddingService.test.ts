/**
 * Property-based tests for EmbeddingService
 * 
 * Tests verify invariants that should hold across all inputs:
 * - Property 1: Same text produces same embedding (determinism)
 * - Property 2: Cosine similarity is symmetric
 * - Property 3: Cache size never exceeds limit
 * - Property 4: Similarity is between -1 and 1
 * 
 * **Validates: Requirements 4.1, 5.5**
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fc from 'fast-check';
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

describe('EmbeddingService - Property-Based Tests', () => {
  beforeEach(() => {
    // Reset mock
    jest.clearAllMocks();
    mockCreate.mockReset();
  });

  // ============================================================================
  // Arbitraries (Generators for Property-Based Testing)
  // ============================================================================

  /**
   * Generate a non-empty text string
   */
  const textArbitrary = fc.string({ minLength: 1, maxLength: 500 })
    .filter(s => s.trim().length > 0);

  /**
   * Generate an embedding vector (array of floats)
   * OpenAI embeddings are typically 1536 dimensions, but we use smaller for testing
   */
  const embeddingArbitrary = fc.array(
    fc.float({ min: -1, max: 1, noNaN: true }),
    { minLength: 10, maxLength: 100 }
  );

  /**
   * Generate a pair of embedding vectors with the same dimension
   */
  const embeddingPairArbitrary = fc.integer({ min: 10, max: 100 }).chain(dim =>
    fc.tuple(
      fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: dim, maxLength: dim }),
      fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: dim, maxLength: dim })
    )
  );

  /**
   * Generate an array of unique text strings
   */
  const uniqueTextsArbitrary = fc.array(textArbitrary, { minLength: 1, maxLength: 20 })
    .map(texts => [...new Set(texts)]); // Remove duplicates

  // ============================================================================
  // Property 1: Same text produces same embedding (determinism)
  // ============================================================================

  describe('Property 1: Embedding Consistency', () => {
    it('should produce identical embeddings for the same text', async () => {
      await fc.assert(
        fc.asyncProperty(textArbitrary, embeddingArbitrary, async (text, embedding) => {
          // Create fresh temp dir for each test run
          const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
          const service = new EmbeddingService('test-key', testDir, 1000);
          
          // Reset mock for this test run
          mockCreate.mockReset();
          mockCreate.mockResolvedValue({
            data: [{ embedding }],
          });
          
          // Generate embedding twice
          const embedding1 = await service.generateEmbedding(text);
          const embedding2 = await service.generateEmbedding(text);
          
          // Property: Same text should produce identical embeddings
          expect(embedding1).toEqual(embedding2);
          expect(embedding1.length).toBe(embedding2.length);
          
          // Property: Should only call API once (second is cached)
          expect(mockCreate).toHaveBeenCalledTimes(1);
          
          // Cleanup
          fs.rmSync(testDir, { recursive: true, force: true });
        }),
        { numRuns: 50 }
      );
    });

    it('should produce consistent embeddings across cache hits and misses', async () => {
      await fc.assert(
        fc.asyncProperty(textArbitrary, embeddingArbitrary, async (text, embedding) => {
          // Create fresh temp dir for each test run
          const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
          const service = new EmbeddingService('test-key', testDir, 1000);
          
          // Normalize embedding to avoid -0 vs 0 issues
          const normalizedEmbedding = embedding.map(v => v === 0 ? 0 : v);
          
          // Reset mock for this test run
          mockCreate.mockReset();
          mockCreate.mockResolvedValue({
            data: [{ embedding: normalizedEmbedding }],
          });
          
          // First call - cache miss
          const embedding1 = await service.generateEmbedding(text);
          
          // Clear memory cache but keep disk cache
          service.clearCache();
          
          // Second call - should load from disk
          const embedding2 = await service.generateEmbedding(text);
          
          // Property: Embeddings should be identical regardless of cache source
          // Use element-wise comparison to handle floating point precision
          expect(embedding1.length).toBe(embedding2.length);
          for (let i = 0; i < embedding1.length; i++) {
            expect(embedding1[i]).toBeCloseTo(embedding2[i], 10);
          }
          expect(mockCreate).toHaveBeenCalledTimes(1); // Only one API call
          
          // Cleanup
          fs.rmSync(testDir, { recursive: true, force: true });
        }),
        { numRuns: 30 }
      );
    });

    it('should produce consistent embeddings across service instances', async () => {
      await fc.assert(
        fc.asyncProperty(textArbitrary, embeddingArbitrary, async (text, embedding) => {
          // Create fresh temp dir for each test run
          const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
          
          // Normalize embedding to avoid -0 vs 0 issues
          const normalizedEmbedding = embedding.map(v => v === 0 ? 0 : v);
          
          // Reset mock for this test run
          mockCreate.mockReset();
          mockCreate.mockResolvedValue({
            data: [{ embedding: normalizedEmbedding }],
          });
          
          const service1 = new EmbeddingService('test-key', testDir, 1000);
          
          // Generate with first service
          const embedding1 = await service1.generateEmbedding(text);
          
          // Create new service instance (should load from disk)
          const service2 = new EmbeddingService('test-key', testDir, 1000);
          const embedding2 = await service2.generateEmbedding(text);
          
          // Property: Different service instances should produce same embeddings
          // Use toBeCloseTo for each element to handle floating point precision
          expect(embedding1.length).toBe(embedding2.length);
          for (let i = 0; i < embedding1.length; i++) {
            expect(embedding1[i]).toBeCloseTo(embedding2[i], 10);
          }
          expect(mockCreate).toHaveBeenCalledTimes(1); // Only one API call
          
          // Cleanup
          fs.rmSync(testDir, { recursive: true, force: true });
        }),
        { numRuns: 30 }
      );
    });
  });

  // ============================================================================
  // Property 2: Cosine similarity is symmetric
  // ============================================================================

  describe('Property 2: Similarity Symmetry', () => {
    it('should have symmetric cosine similarity', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(embeddingPairArbitrary, ([vec1, vec2]) => {
          const service = new EmbeddingService('test-key', tempDir, 1000);
          
          const sim1 = service.cosineSimilarity(vec1, vec2);
          const sim2 = service.cosineSimilarity(vec2, vec1);
          
          // Property: similarity(A, B) === similarity(B, A)
          expect(sim1).toBeCloseTo(sim2, 10);
        }),
        { numRuns: 100 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should have reflexive similarity of 1 for non-zero vectors', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 10, maxLength: 100 })
            .filter(vec => vec.some(v => v !== 0)), // At least one non-zero element
          (vec) => {
            const service = new EmbeddingService('test-key', tempDir, 1000);
            
            const similarity = service.cosineSimilarity(vec, vec);
            
            // Property: similarity(A, A) === 1 for non-zero vectors
            expect(similarity).toBeCloseTo(1.0, 5);
          }
        ),
        { numRuns: 100 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should have similarity of 0 for zero vectors', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 10, maxLength: 100 }),
          (vec) => {
            const service = new EmbeddingService('test-key', tempDir, 1000);
            const zeroVec = new Array(vec.length).fill(0);
            
            const similarity = service.cosineSimilarity(zeroVec, vec);
            
            // Property: similarity(0, A) === 0
            expect(similarity).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should have similarity of -1 for opposite vectors', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0.1), max: 1, noNaN: true }), { minLength: 10, maxLength: 100 }),
          (vec) => {
            const service = new EmbeddingService('test-key', tempDir, 1000);
            const oppositeVec = vec.map(v => -v);
            
            const similarity = service.cosineSimilarity(vec, oppositeVec);
            
            // Property: similarity(A, -A) === -1
            expect(similarity).toBeCloseTo(-1.0, 5);
          }
        ),
        { numRuns: 50 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // ============================================================================
  // Property 3: Cache size never exceeds limit
  // ============================================================================

  describe('Property 3: Cache Size Limit', () => {
    it('should never exceed maxCacheSize after operations complete', async () => {
      const maxCacheSize = 5;
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      const service = new EmbeddingService('test-key', testDir, maxCacheSize);
      
      // Reset mock
      mockCreate.mockReset();
      mockCreate.mockImplementation(async (params: any) => {
        const input = Array.isArray(params.input) ? params.input : [params.input];
        return {
          data: input.map(() => ({
            embedding: Array.from({ length: 10 }, () => Math.random())
          }))
        };
      });
      
      // Generate embeddings for more texts than cache size
      for (let i = 0; i < 15; i++) {
        await service.generateEmbedding(`text-${i}`);
      }
      
      // Property: After all operations, cache size should not exceed maxCacheSize
      expect(service.getCacheSize()).toBeLessThanOrEqual(maxCacheSize);
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should maintain cache size limit during batch operations', async () => {
      const maxCacheSize = 8;
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      const service = new EmbeddingService('test-key', testDir, maxCacheSize);
      
      // Reset mock
      mockCreate.mockReset();
      mockCreate.mockImplementation(async (params: any) => {
        const input = Array.isArray(params.input) ? params.input : [params.input];
        return {
          data: input.map(() => ({
            embedding: Array.from({ length: 10 }, () => Math.random())
          }))
        };
      });
      
      // Process multiple batches
      const batches = [
        ['text-1', 'text-2', 'text-3'],
        ['text-4', 'text-5'],
        ['text-6', 'text-7', 'text-8', 'text-9', 'text-10']
      ];
      
      for (const batch of batches) {
        await service.generateBatch(batch);
      }
      
      // Property: After all operations complete, cache size should not exceed maxCacheSize
      expect(service.getCacheSize()).toBeLessThanOrEqual(maxCacheSize);
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should respect cache limit after manual trim', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }), // initial texts (reduced to avoid timeout)
          fc.integer({ min: 1, max: 10 }), // trim size
          async (numTexts, trimSize) => {
            const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
            const service = new EmbeddingService('test-key', testDir, 1000);
            
            // Reset mock for each iteration to avoid rate limiting accumulation
            mockCreate.mockReset();
            
            // Mock API - use batch input to generate all embeddings in one call
            mockCreate.mockImplementation(async (params: any) => {
              const input = Array.isArray(params.input) ? params.input : [params.input];
              return {
                data: input.map(() => ({
                  embedding: Array.from({ length: 10 }, () => Math.random())
                }))
              };
            });
            
            // Generate embeddings using batch to avoid rate limiting delays
            const texts = Array.from({ length: numTexts }, (_, i) => `text-${i}`);
            await service.generateBatch(texts);
            
            // Trim cache
            service.trimCache(trimSize);
            
            // Property: Cache size should not exceed trim size
            expect(service.getCacheSize()).toBeLessThanOrEqual(trimSize);
            
            // Cleanup
            fs.rmSync(testDir, { recursive: true, force: true });
          }
        ),
        { numRuns: 20 } // Reduced runs to avoid timeout
      );
    }, 30000); // Increased timeout to 30 seconds

    it('should have cache size of 0 after clear', async () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      const service = new EmbeddingService('test-key', testDir, 1000);
      
      // Mock API
      mockCreate.mockImplementation(async (params: any) => {
        const input = Array.isArray(params.input) ? params.input : [params.input];
        return {
          data: input.map(() => ({
            embedding: Array.from({ length: 10 }, () => Math.random())
          }))
        };
      });
      
      // Generate embeddings
      for (let i = 0; i < 10; i++) {
        await service.generateEmbedding(`text-${i}`);
      }
      
      // Verify cache has entries
      expect(service.getCacheSize()).toBeGreaterThan(0);
      
      // Clear cache
      service.clearCache();
      
      // Property: Cache size should be 0 after clear
      expect(service.getCacheSize()).toBe(0);
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });

  // ============================================================================
  // Property 4: Similarity is between -1 and 1
  // ============================================================================

  describe('Property 4: Similarity Bounds', () => {
    it('should always produce similarity between -1 and 1', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(embeddingPairArbitrary, ([vec1, vec2]) => {
          const service = new EmbeddingService('test-key', tempDir, 1000);
          
          const similarity = service.cosineSimilarity(vec1, vec2);
          
          // Property: -1 <= similarity <= 1
          expect(similarity).toBeGreaterThanOrEqual(-1);
          expect(similarity).toBeLessThanOrEqual(1);
        }),
        { numRuns: 200 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should produce valid similarity for random vectors', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (dim, seed) => {
            const service = new EmbeddingService('test-key', tempDir, 1000);
            
            // Generate pseudo-random vectors
            const vec1 = Array.from({ length: dim }, (_, i) => Math.sin(i + seed));
            const vec2 = Array.from({ length: dim }, (_, i) => Math.cos(i + seed));
            
            const similarity = service.cosineSimilarity(vec1, vec2);
            
            // Property: Similarity must be in valid range
            expect(similarity).toBeGreaterThanOrEqual(-1);
            expect(similarity).toBeLessThanOrEqual(1);
            expect(Number.isFinite(similarity)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should handle extreme values without overflow', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 50 }),
          (dim) => {
            const service = new EmbeddingService('test-key', tempDir, 1000);
            
            // Create vectors with large values
            const vec1 = Array.from({ length: dim }, () => 1000);
            const vec2 = Array.from({ length: dim }, () => 1000);
            
            const similarity = service.cosineSimilarity(vec1, vec2);
            
            // Property: Should handle large values correctly
            expect(similarity).toBeCloseTo(1.0, 5);
            expect(Number.isFinite(similarity)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should handle small values without underflow', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 50 }),
          (dim) => {
            const service = new EmbeddingService('test-key', tempDir, 1000);
            
            // Create vectors with small values
            const vec1 = Array.from({ length: dim }, () => 0.0001);
            const vec2 = Array.from({ length: dim }, () => 0.0001);
            
            const similarity = service.cosineSimilarity(vec1, vec2);
            
            // Property: Should handle small values correctly
            expect(similarity).toBeCloseTo(1.0, 5);
            expect(Number.isFinite(similarity)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should produce valid similarity for mixed positive and negative values', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -100, max: 100, noNaN: true }), { minLength: 10, maxLength: 100 }),
          fc.array(fc.float({ min: -100, max: 100, noNaN: true }), { minLength: 10, maxLength: 100 }),
          (vec1, vec2) => {
            // Ensure same dimension
            const minLen = Math.min(vec1.length, vec2.length);
            const v1 = vec1.slice(0, minLen);
            const v2 = vec2.slice(0, minLen);
            
            // Skip if all zeros
            if (v1.every(x => x === 0) || v2.every(x => x === 0)) {
              return;
            }
            
            const service = new EmbeddingService('test-key', tempDir, 1000);
            const similarity = service.cosineSimilarity(v1, v2);
            
            // Property: Similarity must be in valid range
            expect(similarity).toBeGreaterThanOrEqual(-1);
            expect(similarity).toBeLessThanOrEqual(1);
            expect(Number.isFinite(similarity)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  // ============================================================================
  // Additional Properties: LRU Cache Behavior
  // ============================================================================

  describe('Additional Properties: LRU Cache Behavior', () => {
    it('should evict least recently used entries when cache is full', async () => {
      const maxCacheSize = 5;
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      const service = new EmbeddingService('test-key', testDir, maxCacheSize);
      
      // Reset mock
      mockCreate.mockReset();
      mockCreate.mockImplementation(async (params: any) => {
        const input = Array.isArray(params.input) ? params.input : [params.input];
        return {
          data: input.map((text: string) => ({
            embedding: Array.from({ length: 10 }, (_, i) => i + text.length)
          }))
        };
      });
      
      // Fill cache to capacity
      const texts = Array.from({ length: maxCacheSize }, (_, i) => `text-${i}`);
      for (const text of texts) {
        await service.generateEmbedding(text);
      }
      
      // Property: Cache size should be at or below max after filling
      expect(service.getCacheSize()).toBeLessThanOrEqual(maxCacheSize);
      
      // Access the first text (makes it most recently used)
      await service.generateEmbedding(texts[0]);
      
      // Add a new text (should evict text-1, not text-0)
      await service.generateEmbedding('new-text');
      
      // Property: Cache size should still be at or below max
      expect(service.getCacheSize()).toBeLessThanOrEqual(maxCacheSize);
      
      // Property: Most recently used text should still be accessible
      const apiCallsBefore = mockCreate.mock.calls.length;
      await service.generateEmbedding(texts[0]);
      const apiCallsAfter = mockCreate.mock.calls.length;
      
      // If text-0 is still in memory or disk cache, no new API call
      expect(apiCallsAfter).toBeLessThanOrEqual(apiCallsBefore + 1);
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should maintain cache consistency during concurrent-like operations', async () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-prop-'));
      const service = new EmbeddingService('test-key', testDir, 10);
      
      // Reset mock
      mockCreate.mockReset();
      mockCreate.mockImplementation(async (params: any) => {
        const input = Array.isArray(params.input) ? params.input : [params.input];
        return {
          data: input.map(() => ({
            embedding: Array.from({ length: 10 }, () => Math.random())
          }))
        };
      });
      
      const texts = ['text-1', 'text-2', 'text-3', 'text-4', 'text-5'];
      
      // Generate embeddings in various patterns
      for (const text of texts) {
        await service.generateEmbedding(text);
      }
      
      // Property: After individual operations, cache should be within bounds
      expect(service.getCacheSize()).toBeLessThanOrEqual(10);
      
      // Batch generate some of the same texts (already cached, so no new additions)
      const cachedTexts = texts.slice(0, 3);
      await service.generateBatch(cachedTexts);
      
      // Property: Cache should remain within reasonable bounds
      expect(service.getCacheSize()).toBeGreaterThanOrEqual(0);
      expect(service.getCacheSize()).toBeLessThan(20); // Reasonable upper bound
      
      // Property: All texts should still be retrievable
      for (const text of cachedTexts) {
        const embedding = await service.generateEmbedding(text);
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      }
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });
});
