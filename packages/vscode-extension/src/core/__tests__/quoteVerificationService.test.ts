import { jest } from '@jest/globals';
import { QuoteVerificationService, QuoteVerificationResult, BatchVerificationResult } from '../quoteVerificationService';
import { VerificationResult } from '@research-assistant/core';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';
import { 
  setupTest, 
  createMockClaim, 
  createMockVerificationResult,
  createMockClaimsManager,
  createMockUnifiedQuoteSearch,
  aClaim
} from '../../__tests__/helpers';
import { UnifiedQuoteSearch } from '../../services/unifiedQuoteSearch';

// Mock the dependencies
jest.mock('../claimsManagerWrapper');
jest.mock('../../services/unifiedQuoteSearch');

describe('QuoteVerificationService', () => {
  setupTest();

  let service: QuoteVerificationService;
  let mockUnifiedQuoteSearch: ReturnType<typeof createMockUnifiedQuoteSearch>;
  let mockClaimsManager: ReturnType<typeof createMockClaimsManager>;

  beforeEach(() => {
    // Use factory functions for consistent mocks
    mockUnifiedQuoteSearch = createMockUnifiedQuoteSearch();
    mockClaimsManager = createMockClaimsManager();
    service = new QuoteVerificationService(mockUnifiedQuoteSearch as any, mockClaimsManager as any);
  });

  describe('verifyQuote', () => {
    test('should verify a quote successfully', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';
      const expectedResult = createMockVerificationResult({
        verified: true,
        similarity: 1.0
      });

      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockResolvedValue(expectedResult);

      const result = await service.verifyQuote(quote, authorYear);

      expect(mockUnifiedQuoteSearch.findBestMatch).toHaveBeenCalledWith(quote, authorYear);
      expect(result).toEqual(expectedResult);
    });

    test('should return closest match when verification fails', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';
      const expectedResult = createMockVerificationResult({
        verified: false,
        similarity: 0.85,
        nearestMatch: 'This is a similar quote',
        confidence: 0.85
      });

      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockResolvedValue(expectedResult);

      const result = await service.verifyQuote(quote, authorYear);

      expect(result.verified).toBe(false);
      expect((result as any).nearestMatch).toBe('This is a similar quote');
      expect(result.similarity).toBe(0.85);
    });

    test('should throw error when quote is empty', async () => {
      await expect(service.verifyQuote('', 'Johnson2007')).rejects.toThrow('Quote and authorYear are required');
    });

    test('should throw error when authorYear is empty', async () => {
      await expect(service.verifyQuote('test quote', '')).rejects.toThrow('Quote and authorYear are required');
    });

    test('should handle MCP client errors', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';

      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockRejectedValue(new Error('MCP connection failed'));

      await expect(service.verifyQuote(quote, authorYear)).rejects.toThrow('Failed to verify quote: MCP connection failed');
    });
  });

  describe('verifyClaim', () => {
    test('should verify a claim successfully', async () => {
      const claim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'This is a test quote', source: 'Johnson2007', verified: false }
      });

      const verificationResult = createMockVerificationResult({
        verified: true,
        similarity: 1.0,
        confidence: 1.0
      });

      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockResolvedValue(verificationResult);
      mockClaimsManager.updateClaim = (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyClaim('C_01');

      expect(mockClaimsManager.getClaim).toHaveBeenCalledWith('C_01');
      expect(mockUnifiedQuoteSearch.findBestMatch).toHaveBeenCalledWith(claim.primaryQuote.text, claim.primaryQuote.source);
      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
      expect(result.verified).toBe(true);
      expect(result.claimId).toBe('C_01');
    });

    test('should return error when claim not found', async () => {
      mockClaimsManager.getClaim = jest.fn().mockReturnValue(null);

      const result = await service.verifyClaim('C_99');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Claim C_99 not found');
    });

    test('should return error when claim has no primary quote', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Johnson2007',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: { text: '', source: '', verified: false },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claim);

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Claim has no primary quote to verify');
    });

    test('should return error when claim has no source', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: '',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: { text: 'This is a test quote', source: '', verified: false },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claim);

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Claim has no source specified');
    });

    test('should not update claim when verification fails', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Johnson2007',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: { text: 'This is a test quote', source: 'Johnson2007', verified: false },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      const verificationResult: VerificationResult = {
        verified: false,
        similarity: 0.75,
        closestMatch: 'This is a similar quote'
      };

      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockResolvedValue(verificationResult);
      mockClaimsManager.updateClaim = (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.closestMatch).toBe('This is a similar quote');
      expect(mockClaimsManager.updateClaim).not.toHaveBeenCalled();
    });

    test('should handle verification errors gracefully', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Johnson2007',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: { text: 'This is a test quote', source: 'Johnson2007', verified: false },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockRejectedValue(new Error('Network error'));

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('findClosestMatch', () => {
    test('should find closest match for a quote', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';
      const expectedResult: VerificationResult = {
        verified: false,
        similarity: 0.85,
        closestMatch: 'This is a similar quote',
        context: 'surrounding context'
      };

      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockResolvedValue(expectedResult);

      const result = await service.findClosestMatch(quote, authorYear);

      expect(result.closestMatch).toBe('This is a similar quote');
      expect(result.similarity).toBe(0.85);
    });

    test('should handle errors when finding closest match', async () => {
      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockRejectedValue(new Error('Source not found'));

      await expect(service.findClosestMatch('test', 'Unknown2000')).rejects.toThrow('Source not found');
    });
  });

  describe('verifyAllClaims', () => {
    test('should verify all claims in the database', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: { text: 'Quote 1', source: 'Johnson2007', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        {
          id: 'C_02',
          text: 'Test claim 2',
          category: 'Result',
          source: 'Smith2010',
          sourceId: 2,
          context: 'Test context',
          primaryQuote: { text: 'Quote 2', source: 'Smith2010', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      mockClaimsManager.getClaims = jest.fn().mockReturnValue(claims);
      mockClaimsManager.getClaim = jest.fn()
        .mockReturnValueOnce(claims[0])
        .mockReturnValueOnce(claims[1]);
      
      mockUnifiedQuoteSearch.findBestMatch = jest.fn()
        .mockResolvedValueOnce({ verified: true, similarity: 1.0 })
        .mockResolvedValueOnce({ verified: false, similarity: 0.75, closestMatch: 'Similar quote' });
      
      mockClaimsManager.updateClaim = (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyAllClaims();

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(2);
      expect(result.verified).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].claimId).toBe('C_02');
    });

    test('should skip claims without quotes', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: { text: 'Quote 1', source: 'Johnson2007', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        {
          id: 'C_02',
          text: 'Test claim 2',
          category: 'Result',
          source: 'Smith2010',
          sourceId: 2,
          context: 'Test context',
          primaryQuote: { text: '', source: '', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      mockClaimsManager.getClaims = jest.fn().mockReturnValue(claims);
      mockClaimsManager.getClaim = jest.fn().mockReturnValueOnce(claims[0]);
      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockResolvedValue({ verified: true, similarity: 1.0 });
      mockClaimsManager.updateClaim = (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyAllClaims();

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(1);
      expect(result.verified).toBe(1);
    });

    test('should handle errors during batch verification', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: { text: 'Quote 1', source: 'Johnson2007', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      mockClaimsManager.getClaims = jest.fn().mockReturnValue(claims);
      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claims[0]);
      mockUnifiedQuoteSearch.findBestMatch = (jest.fn() as jest.Mock<any>).mockRejectedValue(new Error('Network error'));

      const result = await service.verifyAllClaims();

      expect(result.totalClaims).toBe(1);
      expect(result.totalQuotes).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.verified).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('verifyClaimsBatch', () => {
    test('should verify a batch of specific claims', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: { text: 'Quote 1', source: 'Johnson2007', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        {
          id: 'C_02',
          text: 'Test claim 2',
          category: 'Result',
          source: 'Smith2010',
          sourceId: 2,
          context: 'Test context',
          primaryQuote: { text: 'Quote 2', source: 'Smith2010', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      // Mock getClaim to return the appropriate claim for each ID
      mockClaimsManager.getClaim = jest.fn((id: string) => {
        return claims.find(c => c.id === id) || null;
      });
      
      mockUnifiedQuoteSearch.findBestMatch = jest.fn()
        .mockResolvedValueOnce({ verified: true, similarity: 1.0 })
        .mockResolvedValueOnce({ verified: true, similarity: 1.0 });
      
      mockClaimsManager.updateClaim = (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyClaimsBatch(['C_01', 'C_02']);

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(2);
      expect(result.verified).toBe(2);
      expect(result.failed).toBe(0);
    });

    test('should skip non-existent claims in batch', async () => {
      mockClaimsManager.getClaim = jest.fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      const result = await service.verifyClaimsBatch(['C_99', 'C_100']);

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(0);
      expect(result.verified).toBe(0);
    });
  });

  describe('updateClaimVerificationStatus', () => {
    test('should update claim verification status', async () => {
      mockClaimsManager.updateClaim = (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined);

      await service.updateClaimVerificationStatus('C_01', true);

      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
    });
  });

  describe('getUnverifiedClaims', () => {
    test('should return only unverified claims with quotes', () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: { text: 'Quote 1', source: 'Johnson2007', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        {
          id: 'C_02',
          text: 'Test claim 2',
          category: 'Result',
          source: 'Smith2010',
          sourceId: 2,
          context: 'Test context',
          primaryQuote: { text: 'Quote 2', source: 'Smith2010', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: true,
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        {
          id: 'C_03',
          text: 'Test claim 3',
          category: 'Challenge',
          source: 'Brown2015',
          sourceId: 3,
          context: 'Test context',
          primaryQuote: { text: '', source: '', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      mockClaimsManager.getClaims = jest.fn().mockReturnValue(claims);

      const unverified = service.getUnverifiedClaims();

      expect(unverified).toHaveLength(1);
      expect(unverified[0].id).toBe('C_01');
    });
  });

  describe('getVerificationStats', () => {
    test('should return correct verification statistics', () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: { text: 'Quote 1', source: 'Johnson2007', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: true,
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        {
          id: 'C_02',
          text: 'Test claim 2',
          category: 'Result',
          source: 'Smith2010',
          sourceId: 2,
          context: 'Test context',
          primaryQuote: { text: 'Quote 2', source: 'Smith2010', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        {
          id: 'C_03',
          text: 'Test claim 3',
          category: 'Challenge',
          source: 'Brown2015',
          sourceId: 3,
          context: 'Test context',
          primaryQuote: { text: '', source: '', verified: false },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      mockClaimsManager.getClaims = jest.fn().mockReturnValue(claims);

      const stats = service.getVerificationStats();

      expect(stats.total).toBe(3);
      expect(stats.verified).toBe(1);
      expect(stats.unverified).toBe(1);
      expect(stats.withoutQuotes).toBe(1);
      expect(stats.verificationRate).toBe(50); // 1 verified out of 2 with quotes
    });

    test('should handle empty claims database', () => {
      mockClaimsManager.getClaims = jest.fn().mockReturnValue([]);

      const stats = service.getVerificationStats();

      expect(stats.total).toBe(0);
      expect(stats.verified).toBe(0);
      expect(stats.unverified).toBe(0);
      expect(stats.withoutQuotes).toBe(0);
      expect(stats.verificationRate).toBe(0);
    });
  });
});
