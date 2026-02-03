import { jest } from '@jest/globals';
import { ClaimMatchingService, SimilarClaim } from '../claimMatchingService';

describe('ClaimMatchingService', () => {
  let service: ClaimMatchingService;
  let mockClaimsManager: any;
  let mockEmbeddingService: any;

  beforeEach(() => {
    mockClaimsManager = {
      getClaims: () => [
        {
          id: 'C_1',
          text: 'Batch correction methods improve cross-study prediction',
          category: 'Method',
          source: 'Smith2020'
        },
        {
          id: 'C_2',
          text: 'Results show significant improvement',
          category: 'Result',
          source: 'Johnson2021'
        },
        {
          id: 'C_3',
          text: 'Correction techniques enhance accuracy',
          category: 'Method',
          source: 'Brown2019'
        }
      ],
      getClaim: (id: string) => {
        const claims = mockClaimsManager.getClaims();
        return claims.find((c: any) => c.id === id);
      }
    };

    mockEmbeddingService = {
      generateEmbedding: async (text: string) => {
        // Simple mock: return a vector based on text length
        const vector = new Array(10).fill(0);
        for (let i = 0; i < Math.min(text.length, 10); i++) {
          vector[i] = text.charCodeAt(i) / 100;
        }
        return vector;
      }
    };

    service = new ClaimMatchingService(mockClaimsManager, mockEmbeddingService);
  });

  describe('findSimilarClaims', () => {
    test('should find similar claims', async () => {
      const sentenceText = 'Batch correction improves prediction';
      const similar = await service.findSimilarClaims(sentenceText);

      expect(similar).toBeDefined();
      expect(Array.isArray(similar)).toBe(true);
    });

    test('should return SimilarClaim objects with required fields', async () => {
      const sentenceText = 'Batch correction improves prediction';
      const similar = await service.findSimilarClaims(sentenceText);

      if (similar.length > 0) {
        const claim = similar[0];
        expect(claim).toHaveProperty('claimId');
        expect(claim).toHaveProperty('text');
        expect(claim).toHaveProperty('category');
        expect(claim).toHaveProperty('source');
        expect(claim).toHaveProperty('similarity');
      }
    });

    test('should limit results to top 20', async () => {
      const sentenceText = 'Test sentence';
      const similar = await service.findSimilarClaims(sentenceText);

      expect(similar.length).toBeLessThanOrEqual(20);
    });

    test('should sort by similarity descending', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const similar = await service.findSimilarClaims(sentenceText);

      if (similar.length > 1) {
        for (let i = 0; i < similar.length - 1; i++) {
          expect(similar[i].similarity).toBeGreaterThanOrEqual(similar[i + 1].similarity);
        }
      }
    });

    test('should respect similarity threshold', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const threshold = 0.7;
      const similar = await service.findSimilarClaims(sentenceText, threshold);

      for (const claim of similar) {
        expect(claim.similarity).toBeGreaterThanOrEqual(threshold);
      }
    });

    test('should handle empty results', async () => {
      const sentenceText = 'xyz abc def ghi jkl';
      const similar = await service.findSimilarClaims(sentenceText, 0.99);

      expect(Array.isArray(similar)).toBe(true);
    });

    test('should handle embedding service errors gracefully', async () => {
      mockEmbeddingService.generateEmbedding = async () => null;

      const sentenceText = 'Test sentence';
      const similar = await service.findSimilarClaims(sentenceText);

      expect(similar).toEqual([]);
    });
  });

  describe('findSimilarClaimsWithThreshold', () => {
    test('should use custom threshold', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const threshold = 0.6;
      const similar = await service.findSimilarClaimsWithThreshold(sentenceText, threshold);

      for (const claim of similar) {
        expect(claim.similarity).toBeGreaterThanOrEqual(threshold);
      }
    });
  });

  describe('getTopSimilarClaims', () => {
    test('should return top N claims', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const topN = 2;
      const similar = await service.getTopSimilarClaims(sentenceText, topN);

      expect(similar.length).toBeLessThanOrEqual(topN);
    });

    test('should return all claims if topN is larger than available', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const topN = 100;
      const similar = await service.getTopSimilarClaims(sentenceText, topN);

      expect(similar.length).toBeLessThanOrEqual(mockClaimsManager.getClaims().length);
    });
  });

  describe('isSimilar', () => {
    test('should check if claim is similar to sentence', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const claimId = 'C_1';
      const isSimilar = await service.isSimilar(sentenceText, claimId, 0.5);

      expect(typeof isSimilar).toBe('boolean');
    });

    test('should return false for non-existent claim', async () => {
      const sentenceText = 'Test sentence';
      const claimId = 'C_nonexistent';
      const isSimilar = await service.isSimilar(sentenceText, claimId);

      expect(isSimilar).toBe(false);
    });

    test('should respect similarity threshold', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const claimId = 'C_1';
      const threshold = 0.99;
      const isSimilar = await service.isSimilar(sentenceText, claimId, threshold);

      expect(typeof isSimilar).toBe('boolean');
    });
  });

  describe('batchFindSimilarClaims', () => {
    test('should find similar claims for multiple sentences', async () => {
      const sentences = [
        'Batch correction methods improve prediction',
        'Results show improvement',
        'Correction techniques enhance accuracy'
      ];
      const results = await service.batchFindSimilarClaims(sentences);

      expect(results.size).toBe(sentences.length);
    });

    test('should return map with correct keys', async () => {
      const sentences = ['Sentence 1', 'Sentence 2'];
      const results = await service.batchFindSimilarClaims(sentences);

      expect(results.has('sentence_0')).toBe(true);
      expect(results.has('sentence_1')).toBe(true);
    });

    test('should return arrays of similar claims', async () => {
      const sentences = ['Batch correction methods improve prediction'];
      const results = await service.batchFindSimilarClaims(sentences);

      const similar = results.get('sentence_0');
      expect(Array.isArray(similar)).toBe(true);
    });
  });

  describe('getSimilarityScore', () => {
    test('should calculate similarity score', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const claimId = 'C_1';
      const score = await service.getSimilarityScore(sentenceText, claimId);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should return 0 for non-existent claim', async () => {
      const sentenceText = 'Test sentence';
      const claimId = 'C_nonexistent';
      const score = await service.getSimilarityScore(sentenceText, claimId);

      expect(score).toBe(0);
    });

    test('should return higher score for more similar text', async () => {
      const sentenceText = 'Batch correction methods improve cross-study prediction';
      const claimId = 'C_1';
      const score = await service.getSimilarityScore(sentenceText, claimId);

      // Should have some similarity since the texts are related
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    test('should handle empty sentence text', async () => {
      const similar = await service.findSimilarClaims('');

      expect(Array.isArray(similar)).toBe(true);
    });

    test('should handle very long sentence text', async () => {
      const longText = 'word '.repeat(1000);
      const similar = await service.findSimilarClaims(longText);

      expect(Array.isArray(similar)).toBe(true);
    });

    test('should handle special characters', async () => {
      const sentenceText = 'Test @#$% special & characters!';
      const similar = await service.findSimilarClaims(sentenceText);

      expect(Array.isArray(similar)).toBe(true);
    });

    test('should handle unicode characters', async () => {
      const sentenceText = 'Test with unicode: 你好 مرحبا';
      const similar = await service.findSimilarClaims(sentenceText);

      expect(Array.isArray(similar)).toBe(true);
    });
  });
});
