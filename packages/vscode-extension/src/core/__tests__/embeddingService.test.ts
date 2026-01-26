import { EmbeddingService, EmbeddingVector } from '../embeddingService';
import * as fc from 'fast-check';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService(100); // Small cache for testing
  });

  describe('Unit Tests', () => {
    describe('generateEmbedding', () => {
      it('should generate a vector for simple text', async () => {
        const text = 'This is a test sentence';
        const vector = await service.generateEmbedding(text);

        expect(vector).toBeDefined();
        expect(Array.isArray(vector)).toBe(true);
        expect(vector.length).toBe(384); // Standard embedding size
      });

      it('should generate normalized vectors', async () => {
        const text = 'Machine learning is fascinating';
        const vector = await service.generateEmbedding(text);

        // Calculate L2 norm
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        
        // Should be normalized (norm ≈ 1)
        expect(norm).toBeCloseTo(1.0, 5);
      });

      it('should handle empty text', async () => {
        const vector = await service.generateEmbedding('');
        
        expect(vector).toBeDefined();
        expect(vector.length).toBe(384);
      });

      it('should handle text with special characters', async () => {
        const text = 'Hello! @#$% World? (test) [brackets] {braces}';
        const vector = await service.generateEmbedding(text);

        expect(vector).toBeDefined();
        expect(vector.length).toBe(384);
      });

      it('should generate different vectors for different texts', async () => {
        const text1 = 'Machine learning algorithms';
        const text2 = 'Natural language processing';

        const vector1 = await service.generateEmbedding(text1);
        const vector2 = await service.generateEmbedding(text2);

        // Vectors should be different
        const areDifferent = vector1.some((val, idx) => val !== vector2[idx]);
        expect(areDifferent).toBe(true);
      });

      it('should generate similar vectors for similar texts', async () => {
        const text1 = 'Machine learning is a subset of artificial intelligence';
        const text2 = 'Machine learning is part of artificial intelligence';

        const vector1 = await service.generateEmbedding(text1);
        const vector2 = await service.generateEmbedding(text2);

        const similarity = service.cosineSimilarity(vector1, vector2);
        
        // Should have high similarity (> 0.7)
        expect(similarity).toBeGreaterThan(0.7);
      });
    });

    describe('generateBatch', () => {
      it('should generate embeddings for multiple texts', async () => {
        const texts = [
          'First text about machine learning',
          'Second text about deep learning',
          'Third text about neural networks'
        ];

        const vectors = await service.generateBatch(texts);

        expect(vectors.length).toBe(3);
        vectors.forEach(vector => {
          expect(vector.length).toBe(384);
        });
      });

      it('should handle empty batch', async () => {
        const vectors = await service.generateBatch([]);
        expect(vectors.length).toBe(0);
      });

      it('should generate consistent vectors in batch mode', async () => {
        const texts = ['Test text'];
        
        const batchVectors = await service.generateBatch(texts);
        const singleVector = await service.generateEmbedding(texts[0]);

        // Should generate same vector
        expect(batchVectors[0]).toEqual(singleVector);
      });
    });

    describe('cosineSimilarity', () => {
      it('should return 1 for identical vectors', () => {
        const vec = [1, 2, 3, 4, 5];
        const similarity = service.cosineSimilarity(vec, vec);
        
        expect(similarity).toBeCloseTo(1.0, 10);
      });

      it('should return 0 for orthogonal vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [0, 1, 0];
        
        const similarity = service.cosineSimilarity(vec1, vec2);
        expect(similarity).toBeCloseTo(0, 10);
      });

      it('should return -1 for opposite vectors', () => {
        const vec1 = [1, 2, 3];
        const vec2 = [-1, -2, -3];
        
        const similarity = service.cosineSimilarity(vec1, vec2);
        expect(similarity).toBeCloseTo(-1.0, 10);
      });

      it('should handle zero vectors', () => {
        const vec1 = [0, 0, 0];
        const vec2 = [1, 2, 3];
        
        const similarity = service.cosineSimilarity(vec1, vec2);
        expect(similarity).toBe(0);
      });

      it('should throw error for vectors of different lengths', () => {
        const vec1 = [1, 2, 3];
        const vec2 = [1, 2];
        
        expect(() => service.cosineSimilarity(vec1, vec2)).toThrow();
      });

      it('should be symmetric', () => {
        const vec1 = [1, 2, 3, 4];
        const vec2 = [5, 6, 7, 8];
        
        const sim1 = service.cosineSimilarity(vec1, vec2);
        const sim2 = service.cosineSimilarity(vec2, vec1);
        
        expect(sim1).toBeCloseTo(sim2, 10);
      });

      it('should return value between -1 and 1', () => {
        const vec1 = [1.5, -2.3, 4.7, -0.8];
        const vec2 = [3.2, 1.1, -5.4, 2.9];
        
        const similarity = service.cosineSimilarity(vec1, vec2);
        
        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
      });
    });

    describe('findMostSimilar', () => {
      it('should find most similar vectors', async () => {
        const queryText = 'machine learning algorithms';
        const candidateTexts = [
          'deep learning neural networks',
          'machine learning methods',
          'cooking recipes',
          'artificial intelligence'
        ];

        const queryVector = await service.generateEmbedding(queryText);
        const candidates: EmbeddingVector[] = await Promise.all(
          candidateTexts.map(async (text) => ({
            text,
            vector: await service.generateEmbedding(text),
            metadata: {}
          }))
        );

        const topResults = service.findMostSimilar(queryVector, candidates, 2);

        expect(topResults.length).toBe(2);
        // Most similar should be 'machine learning methods'
        expect(topResults[0].text).toBe('machine learning methods');
      });

      it('should return empty array when topK is 0', async () => {
        const query = [1, 2, 3];
        const candidates: EmbeddingVector[] = [
          { text: 'test', vector: [1, 2, 3], metadata: {} }
        ];

        const results = service.findMostSimilar(query, candidates, 0);
        expect(results.length).toBe(0);
      });

      it('should handle empty candidates', () => {
        const query = [1, 2, 3];
        const results = service.findMostSimilar(query, [], 5);
        
        expect(results.length).toBe(0);
      });

      it('should limit results to topK', async () => {
        const query = await service.generateEmbedding('test');
        const candidates: EmbeddingVector[] = [];
        
        for (let i = 0; i < 10; i++) {
          candidates.push({
            text: `text ${i}`,
            vector: await service.generateEmbedding(`text ${i}`),
            metadata: {}
          });
        }

        const results = service.findMostSimilar(query, candidates, 3);
        expect(results.length).toBe(3);
      });

      it('should sort results by similarity descending', async () => {
        const query = await service.generateEmbedding('machine learning');
        const candidates: EmbeddingVector[] = [
          {
            text: 'machine learning',
            vector: await service.generateEmbedding('machine learning'),
            metadata: {}
          },
          {
            text: 'deep learning',
            vector: await service.generateEmbedding('deep learning'),
            metadata: {}
          },
          {
            text: 'cooking',
            vector: await service.generateEmbedding('cooking'),
            metadata: {}
          }
        ];

        const results = service.findMostSimilar(query, candidates, 3);

        // Calculate similarities
        const similarities = results.map(r => 
          service.cosineSimilarity(query, r.vector)
        );

        // Should be in descending order
        for (let i = 1; i < similarities.length; i++) {
          expect(similarities[i - 1]).toBeGreaterThanOrEqual(similarities[i]);
        }
      });
    });

    describe('caching', () => {
      it('should cache embeddings', async () => {
        const text = 'Test text for caching';
        
        // First call - generates embedding
        const vector1 = await service.generateEmbedding(text);
        
        // Second call - should return cached
        const vector2 = await service.generateEmbedding(text);
        
        // Should be exactly the same reference
        expect(vector1).toBe(vector2);
      });

      it('should retrieve cached embeddings', async () => {
        const text = 'Cached text';
        const vector = await service.generateEmbedding(text);
        
        const cached = service.getCachedEmbedding(text);
        
        expect(cached).toBe(vector);
      });

      it('should return null for non-cached text', () => {
        const cached = service.getCachedEmbedding('Not in cache');
        expect(cached).toBeNull();
      });

      it('should evict entries when cache is full', async () => {
        const smallService = new EmbeddingService(3); // Very small cache
        
        // Fill cache
        await smallService.generateEmbedding('text1');
        await smallService.generateEmbedding('text2');
        await smallService.generateEmbedding('text3');
        
        // Add one more - should evict least recently used
        await smallService.generateEmbedding('text4');
        
        const stats = smallService.getCacheStats();
        expect(stats.size).toBeLessThanOrEqual(3);
      });

      it('should clear cache', async () => {
        await service.generateEmbedding('text1');
        await service.generateEmbedding('text2');
        
        service.clearCache();
        
        const stats = service.getCacheStats();
        expect(stats.size).toBe(0);
      });

      it('should provide cache statistics', async () => {
        await service.generateEmbedding('text1');
        await service.generateEmbedding('text2');
        
        const stats = service.getCacheStats();
        
        expect(stats.size).toBe(2);
        expect(stats.maxSize).toBe(100);
        expect(stats.hitRate).toBeDefined();
      });
    });

    describe('edge cases', () => {
      it('should handle very long text', async () => {
        const longText = 'word '.repeat(10000);
        const vector = await service.generateEmbedding(longText);
        
        expect(vector).toBeDefined();
        expect(vector.length).toBe(384);
      });

      it('should handle text with only punctuation', async () => {
        const text = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        const vector = await service.generateEmbedding(text);
        
        expect(vector).toBeDefined();
        expect(vector.length).toBe(384);
      });

      it('should handle text with numbers', async () => {
        const text = '123 456 789 numbers in text';
        const vector = await service.generateEmbedding(text);
        
        expect(vector).toBeDefined();
        expect(vector.length).toBe(384);
      });

      it('should handle unicode characters', async () => {
        const text = 'Hello 世界 مرحبا мир';
        const vector = await service.generateEmbedding(text);
        
        expect(vector).toBeDefined();
        expect(vector.length).toBe(384);
      });
    });
  });

  describe('Property-Based Tests', () => {
    // Arbitrary for generating random text
    const textArbitrary = () => fc.string({ minLength: 1, maxLength: 200 });
    
    // Arbitrary for generating random vectors
    const vectorArbitrary = (size: number) => 
      fc.array(fc.float({ min: -1, max: 1 }), { minLength: size, maxLength: size });

    it('Property: Generated vectors should always be normalized', async () => {
      await fc.assert(
        fc.asyncProperty(textArbitrary(), async (text) => {
          const vector = await service.generateEmbedding(text);
          
          // Calculate L2 norm
          const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
          
          // Should be normalized (norm ≈ 1) or zero vector
          return Math.abs(norm - 1.0) < 0.0001 || norm === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('Property: Cosine similarity should be symmetric', () => {
      fc.assert(
        fc.property(
          vectorArbitrary(10),
          vectorArbitrary(10),
          (vec1, vec2) => {
            const sim1 = service.cosineSimilarity(vec1, vec2);
            const sim2 = service.cosineSimilarity(vec2, vec1);
            
            return Math.abs(sim1 - sim2) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Cosine similarity should be in range [-1, 1]', () => {
      fc.assert(
        fc.property(
          vectorArbitrary(10),
          vectorArbitrary(10),
          (vec1, vec2) => {
            const similarity = service.cosineSimilarity(vec1, vec2);
            return similarity >= -1 && similarity <= 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Identical texts should produce identical embeddings', async () => {
      await fc.assert(
        fc.asyncProperty(textArbitrary(), async (text) => {
          const vector1 = await service.generateEmbedding(text);
          const vector2 = await service.generateEmbedding(text);
          
          // Should be exactly equal (cached)
          return vector1 === vector2;
        }),
        { numRuns: 50 }
      );
    });

    it('Property: Cosine similarity of vector with itself should be 1', () => {
      fc.assert(
        fc.property(
          vectorArbitrary(10),
          (vec) => {
            // Skip zero vectors
            const isZero = vec.every(v => v === 0);
            if (isZero) {
              return true;
            }
            
            const similarity = service.cosineSimilarity(vec, vec);
            return Math.abs(similarity - 1.0) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: findMostSimilar should return at most topK results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(textArbitrary(), { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 10 }),
          async (texts, topK) => {
            const query = await service.generateEmbedding('query text');
            const candidates: EmbeddingVector[] = await Promise.all(
              texts.map(async (text) => ({
                text,
                vector: await service.generateEmbedding(text),
                metadata: {}
              }))
            );
            
            const results = service.findMostSimilar(query, candidates, topK);
            
            return results.length <= topK && results.length <= candidates.length;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: findMostSimilar results should be sorted by similarity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(textArbitrary(), { minLength: 2, maxLength: 10 }),
          async (texts) => {
            const query = await service.generateEmbedding('test query');
            const candidates: EmbeddingVector[] = await Promise.all(
              texts.map(async (text) => ({
                text,
                vector: await service.generateEmbedding(text),
                metadata: {}
              }))
            );
            
            const results = service.findMostSimilar(query, candidates, texts.length);
            
            // Check if sorted in descending order
            for (let i = 1; i < results.length; i++) {
              const sim1 = service.cosineSimilarity(query, results[i - 1].vector);
              const sim2 = service.cosineSimilarity(query, results[i].vector);
              
              if (sim1 < sim2) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('Property: Batch generation should produce valid normalized vectors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(textArbitrary(), { minLength: 1, maxLength: 5 }),
          async (texts) => {
            const freshService = new EmbeddingService(100);
            const batchVectors = await freshService.generateBatch(texts);
            
            // All vectors should be normalized
            for (const vector of batchVectors) {
              const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
              
              // Should be normalized (norm ≈ 1) or zero vector
              if (!(Math.abs(norm - 1.0) < 0.0001 || norm === 0)) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('Property: Cache should preserve vector values', async () => {
      await fc.assert(
        fc.asyncProperty(textArbitrary(), async (text) => {
          const vector1 = await service.generateEmbedding(text);
          const cached = service.getCachedEmbedding(text);
          
          if (!cached) {
            return false;
          }
          
          // Should be identical
          return vector1 === cached;
        }),
        { numRuns: 50 }
      );
    });
  });
});
