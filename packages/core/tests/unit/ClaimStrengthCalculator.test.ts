/**
 * Unit tests for ClaimStrengthCalculator
 * 
 * Tests cover:
 * - calculateStrength() for single claims
 * - calculateStrengthBatch() for multiple claims
 * - detectContradiction() for various contradiction types
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const { ClaimStrengthCalculator } = await import('../../src/services/ClaimStrengthCalculator.js');

describe('ClaimStrengthCalculator', () => {
  let calculator: any;
  let embeddingService: any;
  let claimsManager: any;

  const mockClaims = [
    {
      id: 'C_01',
      text: 'Machine learning improves classification accuracy',
      category: 'result',
      source: 'Smith2020',
      sourceId: 1,
      context: 'Test context',
      primaryQuote: 'ML improves accuracy',
      supportingQuotes: [],
      sections: ['2.1'],
      verified: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
    {
      id: 'C_02',
      text: 'Deep learning enhances model performance',
      category: 'result',
      source: 'Johnson2021',
      sourceId: 2,
      context: 'Test context',
      primaryQuote: 'Deep learning enhances performance',
      supportingQuotes: [],
      sections: ['2.1'],
      verified: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
    },
  ];

  beforeEach(() => {
    embeddingService = {
      generateEmbedding: jest.fn(async (text: string) => [0.1, 0.2, 0.3]),
      generateBatch: jest.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
      cosineSimilarity: jest.fn(() => 0.8),
      trimCache: jest.fn(),
      clearCache: jest.fn(),
      getCacheSize: jest.fn(() => 0),
    };

    claimsManager = {
      getClaim: jest.fn((id: string) => mockClaims.find((c: any) => c.id === id) || null),
      getAllClaims: jest.fn(() => mockClaims),
      findClaimsBySource: jest.fn((source: string) => mockClaims.filter((c: any) => c.source === source)),
      findClaimsBySection: jest.fn((section: string) => mockClaims.filter((c: any) => c.sections.includes(section))),
      getClaimCount: jest.fn(() => mockClaims.length),
      loadClaims: jest.fn(async () => mockClaims),
    };

    calculator = new ClaimStrengthCalculator(embeddingService, claimsManager, 0.5);
  });

  describe('calculateStrength', () => {
    it('should calculate strength for a single claim', async () => {
      const result = await calculator.calculateStrength('C_01');

      expect(result.claimId).toBe('C_01');
      expect(result.strengthScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.supportingClaims)).toBe(true);
      expect(Array.isArray(result.contradictoryClaims)).toBe(true);
    });

    it('should throw error for non-existent claim', async () => {
      await expect(calculator.calculateStrength('C_999')).rejects.toThrow('Claim not found');
    });
  });

  describe('calculateStrengthBatch', () => {
    it('should calculate strength for multiple claims', async () => {
      const results = await calculator.calculateStrengthBatch(['C_01', 'C_02']);

      expect(results.size).toBe(2);
      expect(results.has('C_01')).toBe(true);
      expect(results.has('C_02')).toBe(true);
    });

    it('should handle empty input', async () => {
      const results = await calculator.calculateStrengthBatch([]);

      expect(results.size).toBe(0);
    });
  });

  describe('detectContradiction', () => {
    it('should detect negation-based contradictions', () => {
      const result = calculator.detectContradiction(
        'Machine learning improves accuracy',
        'Machine learning does not improve accuracy',
        0.8
      );

      expect(result).toBe(true);
    });

    it('should not detect contradiction below threshold', () => {
      const result = calculator.detectContradiction(
        'Machine learning improves accuracy',
        'Machine learning does not improve accuracy',
        0.3
      );

      expect(result).toBe(false);
    });
  });
});
