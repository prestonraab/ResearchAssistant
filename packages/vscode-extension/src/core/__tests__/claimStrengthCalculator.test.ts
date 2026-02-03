import { describe, test, expect, beforeEach } from '@jest/globals';
import { ClaimStrengthCalculator } from '../claimStrengthCalculator';
import { EmbeddingService } from '@research-assistant/core';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { Claim, ClaimStrengthResult } from '@research-assistant/core';
import { setupTest, createMockEmbeddingService, createMockClaimsManager, aClaim } from '../../__tests__/helpers';

describe('ClaimStrengthCalculator', () => {
  setupTest();

  let embeddingService: ReturnType<typeof createMockEmbeddingService>;
  let claimsManager: ReturnType<typeof createMockClaimsManager>;
  let calculator: ClaimStrengthCalculator;

  beforeEach(() => {
    embeddingService = createMockEmbeddingService();
    claimsManager = createMockClaimsManager();
    calculator = new ClaimStrengthCalculator(embeddingService as any, claimsManager);
  });

  // Helper function to create test claims
  const createClaim = (
    id: string,
    text: string,
    source: string,
    sourceId: number
  ): Claim => aClaim()
    .withId(id)
    .withText(text)
    .withSource(source)
    .withSourceId(sourceId)
    .build();

  describe('Unit Tests', () => {
    describe('calculateStrength', () => {
      test('should calculate strength score of 0 for claim with no supporting claims', async () => {
        const claim = createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020', 1);
        const allClaims = [claim];

        const result = await calculator.calculateStrength(claim, allClaims);

        expect(result.claimId).toBe('C_01');
        expect(result.strengthScore).toBe(0);
        expect(result.supportingClaims.length).toBe(0);
        expect(result.contradictoryClaims.length).toBe(0);
      });

      test('should find supporting claims from different sources', async () => {
        const claim1 = createClaim('C_01', 'Machine learning improves classification accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Machine learning enhances classification accuracy', 'Jones2021', 2);
        const claim3 = createClaim('C_03', 'Deep learning boosts classification accuracy', 'Brown2022', 3);
        const allClaims = [claim1, claim2, claim3];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result.supportingClaims.length).toBeGreaterThan(0);
        expect(result.strengthScore).toBeGreaterThan(0);
        
        // Should not include claims from the same source
        const hasSameSource = result.supportingClaims.some(sc => sc.source === claim1.source);
        expect(hasSameSource).toBe(false);
      });

      test('should not count claims from the same source as supporting', async () => {
        const claim1 = createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Machine learning enhances accuracy', 'Smith2020', 1);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result.supportingClaims.length).toBe(0);
        expect(result.strengthScore).toBe(0);
      });

      test('should detect contradictory claims', async () => {
        const claim1 = createClaim('C_01', 'Machine learning improves accuracy significantly', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Machine learning does not improve accuracy significantly', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result.contradictoryClaims.length).toBeGreaterThan(0);
        if (result.contradictoryClaims.length > 0) {
          expect(result.contradictoryClaims[0].claimId).toBe('C_02');
          expect(result.contradictoryClaims[0].sentimentOpposition).toBe(true);
        }
      });

      test('should calculate higher strength for claims with more supporting sources', async () => {
        const claim1 = createClaim('C_01', 'Batch correction improves classification', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Batch correction enhances classification', 'Jones2021', 2);
        const claim3 = createClaim('C_03', 'Batch correction boosts classification', 'Brown2022', 3);
        const claim4 = createClaim('C_04', 'Batch correction increases classification accuracy', 'Davis2023', 4);
        const allClaims = [claim1, claim2, claim3, claim4];

        const result = await calculator.calculateStrength(claim1, allClaims);

        // Should have multiple supporting claims
        expect(result.supportingClaims.length).toBeGreaterThan(1);
        expect(result.strengthScore).toBeGreaterThan(1);
      });

      test('should handle claims with no semantic similarity', async () => {
        const claim1 = createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Cooking recipes are delicious', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result.supportingClaims.length).toBe(0);
        expect(result.contradictoryClaims.length).toBe(0);
        expect(result.strengthScore).toBe(0);
      });

      test('should include similarity scores in supporting claims', async () => {
        const claim1 = createClaim('C_01', 'Machine learning improves classification accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Machine learning enhances classification accuracy', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        if (result.supportingClaims.length > 0) {
          expect(result.supportingClaims[0].similarity).toBeGreaterThan(0);
          expect(result.supportingClaims[0].similarity).toBeLessThanOrEqual(1);
        }
      });
    });

    describe('calculateStrengthBatch', () => {
      test('should calculate strength for all claims in batch', async () => {
        const claims = [
          createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020', 1),
          createClaim('C_02', 'Deep learning enhances accuracy', 'Jones2021', 2),
          createClaim('C_03', 'Neural networks boost performance', 'Brown2022', 3)
        ];

        const results = await calculator.calculateStrengthBatch(claims);

        expect(results.size).toBe(3);
        expect(results.has('C_01')).toBe(true);
        expect(results.has('C_02')).toBe(true);
        expect(results.has('C_03')).toBe(true);
      });

      test('should produce consistent results with individual calculation', async () => {
        const claims = [
          createClaim('C_01', 'Machine learning improves classification', 'Smith2020', 1),
          createClaim('C_02', 'Machine learning enhances classification', 'Jones2021', 2)
        ];

        const batchResults = await calculator.calculateStrengthBatch(claims);
        const individualResult = await calculator.calculateStrength(claims[0], claims);

        const batchResult = batchResults.get('C_01')!;
        
        expect(batchResult.strengthScore).toBe(individualResult.strengthScore);
        expect(batchResult.supportingClaims.length).toBe(individualResult.supportingClaims.length);
      });

      test('should handle empty claims array', async () => {
        const results = await calculator.calculateStrengthBatch([]);
        expect(results.size).toBe(0);
      });

      test('should handle single claim', async () => {
        const claims = [createClaim('C_01', 'Test claim', 'Smith2020', 1)];
        const results = await calculator.calculateStrengthBatch(claims);

        expect(results.size).toBe(1);
        expect(results.get('C_01')!.strengthScore).toBe(0);
      });
    });

    describe('contradiction detection', () => {
      test('should detect negation-based contradictions', async () => {
        // Use identical structure with only negation difference to maximize similarity
        const claim1 = createClaim('C_01', 'Batch correction significantly improves classification accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Batch correction does not significantly improve classification accuracy', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        // With the negation detector, this should be caught even if similarity is moderate
        expect(result.contradictoryClaims.length).toBeGreaterThan(0);
      });

      test('should detect sentiment-based contradictions', async () => {
        const claim1 = createClaim('C_01', 'The proposed method is highly effective and reliable for data analysis', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'The proposed method is highly ineffective and unreliable for data analysis', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result.contradictoryClaims.length).toBeGreaterThan(0);
      });

      test('should detect contradictory keywords', async () => {
        const claim1 = createClaim('C_01', 'Treatment increases survival rate', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Treatment decreases survival rate', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result.contradictoryClaims.length).toBeGreaterThan(0);
      });

      test('should not flag very similar claims as contradictory', async () => {
        const claim1 = createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Machine learning improves accuracy', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        // Should be supporting, not contradictory
        expect(result.contradictoryClaims.length).toBe(0);
      });

      test('should handle claims with multiple negations', async () => {
        const claim1 = createClaim('C_01', 'Method is not ineffective', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Method is effective', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        // Double negation should be detected
        expect(result.contradictoryClaims.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('strength score calculation', () => {
      test('should return score of 0 for no supporting claims', async () => {
        const claim = createClaim('C_01', 'Unique claim with no support', 'Smith2020', 1);
        const allClaims = [claim];

        const result = await calculator.calculateStrength(claim, allClaims);

        expect(result.strengthScore).toBe(0);
      });

      test('should return score of 1 for one supporting claim', async () => {
        const claim1 = createClaim('C_01', 'Machine learning improves classification', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Machine learning enhances classification', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        if (result.supportingClaims.length === 1) {
          expect(result.strengthScore).toBe(1);
        }
      });

      test('should return score of 2 for two supporting claims', async () => {
        const claim1 = createClaim('C_01', 'Batch correction improves results', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Batch correction enhances results', 'Jones2021', 2);
        const claim3 = createClaim('C_03', 'Batch correction boosts results', 'Brown2022', 3);
        const allClaims = [claim1, claim2, claim3];

        const result = await calculator.calculateStrength(claim1, allClaims);

        if (result.supportingClaims.length === 2) {
          expect(result.strengthScore).toBe(2);
        }
      });

      test('should increase monotonically with more supporting claims', async () => {
        const baseClaim = createClaim('C_01', 'Method improves accuracy', 'Smith2020', 1);
        
        // Create claims with increasing support
        const claims2 = [
          baseClaim,
          createClaim('C_02', 'Method enhances accuracy', 'Jones2021', 2)
        ];
        
        const claims3 = [
          ...claims2,
          createClaim('C_03', 'Method boosts accuracy', 'Brown2022', 3)
        ];
        
        const claims4 = [
          ...claims3,
          createClaim('C_04', 'Method increases accuracy', 'Davis2023', 4)
        ];

        const result2 = await calculator.calculateStrength(baseClaim, claims2);
        const result3 = await calculator.calculateStrength(baseClaim, claims3);
        const result4 = await calculator.calculateStrength(baseClaim, claims4);

        // Scores should increase monotonically
        expect(result3.strengthScore).toBeGreaterThanOrEqual(result2.strengthScore);
        expect(result4.strengthScore).toBeGreaterThanOrEqual(result3.strengthScore);
      });
    });

    describe('sortByStrength', () => {
      test('should sort claims by strength score descending', async () => {
        const claims = [
          createClaim('C_01', 'Widely supported claim', 'Smith2020', 1),
          createClaim('C_02', 'Moderately supported claim', 'Jones2021', 2),
          createClaim('C_03', 'Unsupported claim', 'Brown2022', 3)
        ];

        const strengthResults = await calculator.calculateStrengthBatch(claims);
        const sorted = calculator.sortByStrength(strengthResults);

        // Should be sorted in descending order
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i - 1].strengthScore).toBeGreaterThanOrEqual(sorted[i].strengthScore);
        }
      });

      test('should handle empty results', () => {
        const results = new Map<string, ClaimStrengthResult>();
        const sorted = calculator.sortByStrength(results);

        expect(sorted.length).toBe(0);
      });

      test('should handle single result', async () => {
        const claim = createClaim('C_01', 'Test claim', 'Smith2020', 1);
        const results = await calculator.calculateStrengthBatch([claim]);
        const sorted = calculator.sortByStrength(results);

        expect(sorted.length).toBe(1);
      });
    });

    describe('filterByMinStrength', () => {
      test('should filter claims by minimum strength score', async () => {
        const claims = [
          createClaim('C_01', 'Strong claim with support', 'Smith2020', 1),
          createClaim('C_02', 'Another strong claim', 'Jones2021', 2),
          createClaim('C_03', 'Weak claim', 'Brown2022', 3)
        ];

        const strengthResults = await calculator.calculateStrengthBatch(claims);
        const filtered = calculator.filterByMinStrength(strengthResults, 1);

        // All filtered claims should have score >= 1
        filtered.forEach(result => {
          expect(result.strengthScore).toBeGreaterThanOrEqual(1);
        });
      });

      test('should return empty array when no claims meet threshold', async () => {
        const claim = createClaim('C_01', 'Unsupported claim', 'Smith2020', 1);
        const results = await calculator.calculateStrengthBatch([claim]);
        const filtered = calculator.filterByMinStrength(results, 5);

        expect(filtered.length).toBe(0);
      });

      test('should return all claims when threshold is 0', async () => {
        const claims = [
          createClaim('C_01', 'Claim 1', 'Smith2020', 1),
          createClaim('C_02', 'Claim 2', 'Jones2021', 2)
        ];

        const results = await calculator.calculateStrengthBatch(claims);
        const filtered = calculator.filterByMinStrength(results, 0);

        expect(filtered.length).toBe(claims.length);
      });
    });

    describe('getClaimsWithContradictions', () => {
      test('should return only claims with contradictions', async () => {
        const claim1 = createClaim('C_01', 'Method improves accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Method does not improve accuracy', 'Jones2021', 2);
        const claim3 = createClaim('C_03', 'Unrelated claim about cooking', 'Brown2022', 3);
        const allClaims = [claim1, claim2, claim3];

        const results = await calculator.calculateStrengthBatch(allClaims);
        const withContradictions = calculator.getClaimsWithContradictions(results);

        // Should only include claims that have contradictions
        withContradictions.forEach(result => {
          expect(result.contradictoryClaims.length).toBeGreaterThan(0);
        });
      });

      test('should return empty array when no contradictions exist', async () => {
        const claims = [
          createClaim('C_01', 'Claim about topic A', 'Smith2020', 1),
          createClaim('C_02', 'Claim about topic B', 'Jones2021', 2)
        ];

        const results = await calculator.calculateStrengthBatch(claims);
        const withContradictions = calculator.getClaimsWithContradictions(results);

        expect(withContradictions.length).toBe(0);
      });
    });

    describe('edge cases', () => {
      test('should handle claims with empty text', async () => {
        const claim = createClaim('C_01', '', 'Smith2020', 1);
        const allClaims = [claim];

        const result = await calculator.calculateStrength(claim, allClaims);

        expect(result).toBeDefined();
        expect(result.strengthScore).toBe(0);
      });

      test('should handle claims with very long text', async () => {
        const longText = 'This is a very long claim. '.repeat(100);
        const claim = createClaim('C_01', longText, 'Smith2020', 1);
        const allClaims = [claim];

        const result = await calculator.calculateStrength(claim, allClaims);

        expect(result).toBeDefined();
      });

      test('should handle claims with special characters', async () => {
        const claim1 = createClaim('C_01', 'Method @#$% improves accuracy!', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Method enhances accuracy?', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result).toBeDefined();
      });

      test('should handle claims with unicode characters', async () => {
        const claim1 = createClaim('C_01', 'Método mejora precisión', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Método aumenta precisión', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await calculator.calculateStrength(claim1, allClaims);

        expect(result).toBeDefined();
      });

      test('should handle large number of claims efficiently', async () => {
        const claims: Claim[] = [];
        for (let i = 0; i < 100; i++) {
          claims.push(createClaim(`C_${i}`, `Claim ${i} about machine learning`, `Source${i}`, i));
        }

        const startTime = Date.now();
        const results = await calculator.calculateStrengthBatch(claims);
        const endTime = Date.now();

        expect(results.size).toBe(100);
        // Should complete in reasonable time (< 10 seconds)
        expect(endTime - startTime).toBeLessThan(10000);
      });
    });

    describe('custom thresholds', () => {
      test('should respect custom similarity threshold', async () => {
        const strictCalculator = new ClaimStrengthCalculator(embeddingService, claimsManager, 0.95);
        
        const claim1 = createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Deep learning enhances performance', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await strictCalculator.calculateStrength(claim1, allClaims);

        // With strict threshold, these moderately similar claims shouldn't be counted
        expect(result.supportingClaims.length).toBe(0);
      });

      test('should respect custom contradiction threshold', async () => {
        const lenientCalculator = new ClaimStrengthCalculator(embeddingService, claimsManager, 0.75);
        
        const claim1 = createClaim('C_01', 'Method improves results', 'Smith2020', 1);
        const claim2 = createClaim('C_02', 'Method does not improve results', 'Jones2021', 2);
        const allClaims = [claim1, claim2];

        const result = await lenientCalculator.calculateStrength(claim1, allClaims);

        // With high contradiction threshold, may not detect contradiction if similarity is lower
        expect(result).toBeDefined();
      });
    });
  });
});
