import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClaimStrengthCalculator } from '../../src/services/ClaimStrengthCalculator.js';
import { EmbeddingService } from '../../src/core/EmbeddingService.js';
import { ClaimsManager } from '../../src/core/ClaimsManager.js';
import { Claim } from '../../src/types/index.js';

describe('ClaimStrengthCalculator', () => {
  let calculator: ClaimStrengthCalculator;
  let embeddingService: EmbeddingService;
  let claimsManager: ClaimsManager;

  // Mock claims for testing
  const mockClaims: Claim[] = [
    {
      id: 'C_01',
      text: 'Machine learning improves prediction accuracy',
      category: 'Result',
      source: 'Smith2020',
      verified: true,
      primaryQuote: 'ML models showed significant improvement',
      supportingQuotes: [],
      sections: [],
    },
    {
      id: 'C_02',
      text: 'Machine learning enhances prediction accuracy',
      category: 'Result',
      source: 'Jones2021',
      verified: true,
      primaryQuote: 'ML techniques enhanced accuracy',
      supportingQuotes: [],
      sections: [],
    },
    {
      id: 'C_03',
      text: 'Deep learning increases prediction performance',
      category: 'Result',
      source: 'Brown2022',
      verified: true,
      primaryQuote: 'Deep learning showed better performance',
      supportingQuotes: [],
      sections: [],
    },
    {
      id: 'C_04',
      text: 'Machine learning does not improve prediction accuracy',
      category: 'Result',
      source: 'Wilson2023',
      verified: true,
      primaryQuote: 'ML models showed no improvement',
      supportingQuotes: [],
      sections: [],
    },
    {
      id: 'C_05',
      text: 'Traditional methods are more effective than machine learning',
      category: 'Result',
      source: 'Davis2023',
      verified: true,
      primaryQuote: 'Traditional approaches outperformed ML',
      supportingQuotes: [],
      sections: [],
    },
  ];

  beforeEach(() => {
    // Create embedding service with test API key
    const apiKey = process.env.OPENAI_API_KEY || 'test-key';
    embeddingService = new EmbeddingService(apiKey, '.cache/test-embeddings');

    // Create claims manager with mock data
    claimsManager = new ClaimsManager('test-workspace');
    
    // Mock the loadClaims and getAllClaims methods
    jest.spyOn(claimsManager, 'getAllClaims').mockReturnValue(mockClaims);
    jest.spyOn(claimsManager, 'getClaim').mockImplementation((id: string) => {
      return mockClaims.find(c => c.id === id) || null;
    });

    calculator = new ClaimStrengthCalculator(embeddingService, claimsManager, 0.7);
  });

  describe('calculateStrength', () => {
    it('should throw error for non-existent claim', async () => {
      jest.spyOn(claimsManager, 'getClaim').mockReturnValue(null);
      
      await expect(calculator.calculateStrength('C_99')).rejects.toThrow(
        'Claim not found: C_99'
      );
    });

    it('should return zero strength for claim with no supporting claims', async () => {
      // Mock embeddings to ensure no similarity
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0)
      );
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.3);

      const result = await calculator.calculateStrength('C_01');

      expect(result.claimId).toBe('C_01');
      expect(result.strengthScore).toBe(0);
      expect(result.supportingClaims).toHaveLength(0);
    });

    it('should exclude claims from the same source', async () => {
      // Add another claim from Smith2020
      const claimsWithDuplicate = [
        ...mockClaims,
        {
          id: 'C_06',
          text: 'Machine learning improves accuracy significantly',
          category: 'Result',
          source: 'Smith2020', // Same source as C_01
          verified: true,
          primaryQuote: 'Significant improvement observed',
          supportingQuotes: [],
          sections: [],
        },
      ];

      jest.spyOn(claimsManager, 'getAllClaims').mockReturnValue(claimsWithDuplicate);
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.9);

      const result = await calculator.calculateStrength('C_01');

      // Should not include C_06 as it's from the same source
      const hasSameSource = result.supportingClaims.some(
        sc => sc.source === 'Smith2020'
      );
      expect(hasSameSource).toBe(false);
    });

    it('should calculate strength score of 1 for one supporting claim', async () => {
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      
      // Mock similarity: high for C_02, low for others
      jest.spyOn(embeddingService, 'cosineSimilarity').mockImplementation(
        (vec1, vec2) => {
          // Simulate high similarity only for one claim
          return 0.85;
        }
      );

      // Override to return only C_01 and C_02
      jest.spyOn(claimsManager, 'getAllClaims').mockReturnValue([
        mockClaims[0],
        mockClaims[1],
      ]);

      const result = await calculator.calculateStrength('C_01');

      expect(result.strengthScore).toBe(1);
      expect(result.supportingClaims).toHaveLength(1);
    });

    it('should calculate strength score of 2 for two supporting claims', async () => {
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      // Override to return C_01, C_02, C_03
      jest.spyOn(claimsManager, 'getAllClaims').mockReturnValue([
        mockClaims[0],
        mockClaims[1],
        mockClaims[2],
      ]);

      const result = await calculator.calculateStrength('C_01');

      expect(result.strengthScore).toBe(2);
      expect(result.supportingClaims).toHaveLength(2);
    });

    it('should calculate strength score > 3 for three or more supporting claims', async () => {
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      // Add more supporting claims
      const manyClaims = [
        mockClaims[0],
        mockClaims[1],
        mockClaims[2],
        {
          id: 'C_06',
          text: 'ML algorithms improve accuracy',
          category: 'Result',
          source: 'Taylor2023',
          verified: true,
          primaryQuote: 'Accuracy improved',
          supportingQuotes: [],
          sections: [],
        },
      ];

      jest.spyOn(claimsManager, 'getAllClaims').mockReturnValue(manyClaims);

      const result = await calculator.calculateStrength('C_01');

      // Should be 3 + log(3-2) = 3 + log(1) = 3
      expect(result.strengthScore).toBeCloseTo(3, 1);
      expect(result.supportingClaims).toHaveLength(3);
    });

    it('should identify contradictory claims', async () => {
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      const result = await calculator.calculateStrength('C_01');

      // C_04 should be identified as contradictory (has "not")
      const hasContradiction = result.contradictoryClaims.some(
        cc => cc.claimId === 'C_04'
      );
      expect(hasContradiction).toBe(true);
    });

    it('should sort supporting claims by similarity', async () => {
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );

      let callCount = 0;
      jest.spyOn(embeddingService, 'cosineSimilarity').mockImplementation(() => {
        // Return different similarities for different claims
        const similarities = [0.95, 0.75, 0.85];
        return similarities[callCount++ % similarities.length] || 0.7;
      });

      jest.spyOn(claimsManager, 'getAllClaims').mockReturnValue([
        mockClaims[0],
        mockClaims[1],
        mockClaims[2],
      ]);

      const result = await calculator.calculateStrength('C_01');

      // Should be sorted by descending similarity
      for (let i = 0; i < result.supportingClaims.length - 1; i++) {
        expect(result.supportingClaims[i].similarity).toBeGreaterThanOrEqual(
          result.supportingClaims[i + 1].similarity
        );
      }
    });
  });

  describe('calculateStrengthBatch', () => {
    it('should handle empty input array', async () => {
      const result = await calculator.calculateStrengthBatch([]);
      expect(result.size).toBe(0);
    });

    it('should return results in a map', async () => {
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue(
        mockClaims.map(() => new Array(1536).fill(0.5))
      );
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      const result = await calculator.calculateStrengthBatch(['C_01', 'C_02']);

      expect(result.size).toBe(2);
      expect(result.has('C_01')).toBe(true);
      expect(result.has('C_02')).toBe(true);
    });

    it('should skip invalid claim IDs', async () => {
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue(
        mockClaims.map(() => new Array(1536).fill(0.5))
      );
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      const result = await calculator.calculateStrengthBatch(['C_01', 'C_99', 'C_02']);

      expect(result.size).toBe(2);
      expect(result.has('C_01')).toBe(true);
      expect(result.has('C_02')).toBe(true);
      expect(result.has('C_99')).toBe(false);
    });

    it('should use batch embedding generation for efficiency', async () => {
      const generateBatchSpy = jest.spyOn(embeddingService, 'generateBatch')
        .mockResolvedValue(mockClaims.map(() => new Array(1536).fill(0.5)));
      
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      await calculator.calculateStrengthBatch(['C_01', 'C_02']);

      // Should call generateBatch once for all claims
      expect(generateBatchSpy).toHaveBeenCalledTimes(1);
      expect(generateBatchSpy).toHaveBeenCalledWith(
        mockClaims.map(c => c.text)
      );
    });
  });

  describe('detectContradiction', () => {
    it('should detect negation patterns', () => {
      const claim1 = 'Machine learning improves accuracy';
      const claim2 = 'Machine learning does not improve accuracy';

      const result = calculator.detectContradiction(claim1, claim2, 0.85);

      expect(result).toBe(true);
    });

    it('should detect contradictory keyword pairs', () => {
      const claim1 = 'The method is effective for prediction';
      const claim2 = 'The method is ineffective for prediction';

      const result = calculator.detectContradiction(claim1, claim2, 0.85);

      expect(result).toBe(true);
    });

    it('should detect sentiment opposition', () => {
      const claim1 = 'The approach shows positive results';
      const claim2 = 'The approach shows negative results';

      const result = calculator.detectContradiction(claim1, claim2, 0.85);

      expect(result).toBe(true);
    });

    it('should not detect contradiction for low similarity', () => {
      const claim1 = 'Machine learning improves accuracy';
      const claim2 = 'Machine learning does not improve accuracy';

      const result = calculator.detectContradiction(claim1, claim2, 0.3);

      expect(result).toBe(false);
    });

    it('should not detect contradiction for similar claims without negation', () => {
      const claim1 = 'Machine learning improves accuracy';
      const claim2 = 'Machine learning enhances accuracy';

      const result = calculator.detectContradiction(claim1, claim2, 0.85);

      expect(result).toBe(false);
    });

    it('should handle various negation keywords', () => {
      const negationKeywords = ['not', 'no', 'never', 'without', 'neither'];
      const baseClaim = 'Machine learning improves accuracy';

      for (const keyword of negationKeywords) {
        const contradictoryClaim = `Machine learning ${keyword} improves accuracy`;
        const result = calculator.detectContradiction(baseClaim, contradictoryClaim, 0.85);
        expect(result).toBe(true);
      }
    });

    it('should handle contradictory pairs in reverse order', () => {
      const claim1 = 'The method shows decrease in performance';
      const claim2 = 'The method shows increase in performance';

      const result = calculator.detectContradiction(claim1, claim2, 0.85);

      expect(result).toBe(true);
    });
  });

  describe('strength score monotonicity', () => {
    it('should increase monotonically with more supporting claims', () => {
      const scores: number[] = [];

      // Calculate scores for 0 to 5 supporting claims
      for (let n = 0; n <= 5; n++) {
        const score = (calculator as any).calculateStrengthScore(n);
        scores.push(score);
      }

      // Verify monotonicity: each score should be >= previous score
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    it('should follow the specified formula', () => {
      const calc = (calculator as any).calculateStrengthScore.bind(calculator);

      expect(calc(0)).toBe(0);
      expect(calc(1)).toBe(1);
      expect(calc(2)).toBe(2);
      expect(calc(3)).toBeCloseTo(3, 1);
      expect(calc(4)).toBeCloseTo(3 + Math.log(2), 2);
      expect(calc(5)).toBeCloseTo(3 + Math.log(3), 2);
    });
  });
});
