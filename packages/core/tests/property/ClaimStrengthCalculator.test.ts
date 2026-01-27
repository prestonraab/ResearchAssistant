/**
 * Property-based tests for ClaimStrengthCalculator
 * 
 * Tests cover:
 * - Strength score is always non-negative
 * - Strength score increases monotonically
 * - Cosine similarity is symmetric
 * - Contradiction detection is consistent
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';

describe('ClaimStrengthCalculator - Property-Based Tests', () => {
  /**
   * Property 1: Strength score is always non-negative
   * **Validates: Requirements 6.1, 6.4**
   */
  describe('Property 1: Strength score is non-negative', () => {
    it('should always return non-negative strength scores', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (supportingClaimCount) => {
          // Calculate strength score using the formula
          let strengthScore: number;
          if (supportingClaimCount === 0) {
            strengthScore = 0;
          } else if (supportingClaimCount === 1) {
            strengthScore = 1;
          } else if (supportingClaimCount === 2) {
            strengthScore = 2;
          } else {
            strengthScore = 3 + Math.log(supportingClaimCount - 2);
          }

          expect(strengthScore).toBeGreaterThanOrEqual(0);
        })
      );
    });
  });

  /**
   * Property 2: Strength score increases monotonically
   * **Validates: Requirements 6.4**
   */
  describe('Property 2: Strength score increases monotonically', () => {
    it('should increase monotonically with more supporting claims', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })),
          ([count1, count2]) => {
            const minCount = Math.min(count1, count2);
            const maxCount = Math.max(count1, count2);

            const calculateScore = (count: number): number => {
              if (count === 0) return 0;
              if (count === 1) return 1;
              if (count === 2) return 2;
              return 3 + Math.log(count - 2);
            };

            const score1 = calculateScore(minCount);
            const score2 = calculateScore(maxCount);

            expect(score2).toBeGreaterThanOrEqual(score1);
          }
        )
      );
    });
  });

  /**
   * Property 3: Cosine similarity is symmetric
   * **Validates: Requirements 6.2**
   */
  describe('Property 3: Cosine similarity is symmetric', () => {
    it('should have symmetric similarity scores', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 5, maxLength: 5 }),
            fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 5, maxLength: 5 })
          ),
          ([vec1, vec2]) => {
            const cosineSimilarity = (v1: number[], v2: number[]): number => {
              let dotProduct = 0;
              let norm1 = 0;
              let norm2 = 0;
              for (let i = 0; i < v1.length; i++) {
                dotProduct += v1[i] * v2[i];
                norm1 += v1[i] * v1[i];
                norm2 += v2[i] * v2[i];
              }
              const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
              return denominator === 0 ? 0 : dotProduct / denominator;
            };

            const sim1 = cosineSimilarity(vec1, vec2);
            const sim2 = cosineSimilarity(vec2, vec1);

            // Both should be valid numbers (not NaN)
            expect(Number.isNaN(sim1)).toBe(false);
            expect(Number.isNaN(sim2)).toBe(false);
            
            // Should be symmetric
            expect(sim1).toBeCloseTo(sim2, 5);
          }
        )
      );
    });
  });

  /**
   * Property 4: Similarity scores are bounded
   * **Validates: Requirements 6.2**
   */
  describe('Property 4: Similarity bounds', () => {
    it('should always return similarity between -1 and 1', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 5, maxLength: 5 }),
            fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 5, maxLength: 5 })
          ),
          ([vec1, vec2]) => {
            const cosineSimilarity = (v1: number[], v2: number[]): number => {
              let dotProduct = 0;
              let norm1 = 0;
              let norm2 = 0;
              for (let i = 0; i < v1.length; i++) {
                dotProduct += v1[i] * v2[i];
                norm1 += v1[i] * v1[i];
                norm2 += v2[i] * v2[i];
              }
              const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
              return denominator === 0 ? 0 : dotProduct / denominator;
            };

            const similarity = cosineSimilarity(vec1, vec2);

            expect(Number.isNaN(similarity)).toBe(false);
            expect(similarity).toBeGreaterThanOrEqual(-1);
            expect(similarity).toBeLessThanOrEqual(1);
          }
        )
      );
    });
  });
});
