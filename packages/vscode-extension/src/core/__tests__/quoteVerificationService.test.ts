import { QuoteVerificationService, QuoteVerificationResult, BatchVerificationResult } from '../quoteVerificationService';
import { VerificationResult } from '../../services/zoteroApiService';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';
import { setupTest, createMockClaim, createMockVerificationResult } from '../../__tests__/helpers';
import { UnifiedQuoteSearch } from '../unifiedQuoteSearch';

// Mock the dependencies
jest.mock('../claimsManagerWrapper');
jest.mock('../unifiedQuoteSearch');

describe('QuoteVerificationService', () => {
  setupTest();

  let service: QuoteVerificationService;
  let mockUnifiedQuoteSearch: jest.Mocked<UnifiedQuoteSearch>;
  let mockClaimsManager: jest.Mocked<ClaimsManager>;

  beforeEach(() => {
    mockUnifiedQuoteSearch = new UnifiedQuoteSearch() as jest.Mocked<UnifiedQuoteSearch>;
    mockClaimsManager = new ClaimsManager('test.md') as jest.Mocked<ClaimsManager>;
    service = new QuoteVerificationService(mockUnifiedQuoteSearch, mockClaimsManager);
  });

  describe('verifyQuote', () => {
    it('should verify a quote successfully', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';
      const expectedResult = createMockVerificationResult({
        verified: true,
        similarity: 1.0
      });

      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockResolvedValue(expectedResult);

      const result = await service.verifyQuote(quote, authorYear);

      expect(mockUnifiedQuoteSearch.findBestMatch).toHaveBeenCalledWith(quote, authorYear);
      expect(result).toEqual(expectedResult);
    });

    it('should return closest match when verification fails', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';
      const expectedResult = createMockVerificationResult({
        verified: false,
        similarity: 0.85,
        closestMatch: 'This is a similar quote',
        context: 'surrounding context'
      });

      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockResolvedValue(expectedResult);

      const result = await service.verifyQuote(quote, authorYear);

      expect(result.verified).toBe(false);
      expect(result.closestMatch).toBe('This is a similar quote');
      expect(result.similarity).toBe(0.85);
    });

    it('should throw error when quote is empty', async () => {
      await expect(service.verifyQuote('', 'Johnson2007')).rejects.toThrow('Quote and authorYear are required');
    });

    it('should throw error when authorYear is empty', async () => {
      await expect(service.verifyQuote('test quote', '')).rejects.toThrow('Quote and authorYear are required');
    });

    it('should handle MCP client errors', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';

      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockRejectedValue(new Error('MCP connection failed'));

      await expect(service.verifyQuote(quote, authorYear)).rejects.toThrow('Failed to verify quote: MCP connection failed');
    });
  });

  describe('verifyClaim', () => {
    it('should verify a claim successfully', async () => {
      const claim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Johnson2007',
        sourceId: 1,
        primaryQuote: { text: 'This is a test quote', source: 'Johnson2007', verified: false }
      });

      const verificationResult = createMockVerificationResult({
        verified: true,
        similarity: 1.0
      });

      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockResolvedValue(verificationResult);
      mockClaimsManager.updateClaim = jest.fn().mockResolvedValue(undefined);

      const result = await service.verifyClaim('C_01');

      expect(mockClaimsManager.getClaim).toHaveBeenCalledWith('C_01');
      expect(mockUnifiedQuoteSearch.findBestMatch).toHaveBeenCalledWith(claim.primaryQuote.text, claim.primaryQuote.source);
      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
      expect(result.verified).toBe(true);
      expect(result.claimId).toBe('C_01');
    });

    it('should return error when claim not found', async () => {
      mockClaimsManager.getClaim = jest.fn().mockReturnValue(null);

      const result = await service.verifyClaim('C_99');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Claim C_99 not found');
    });

    it('should return error when claim has no primary quote', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Johnson2007',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: '',
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

    it('should return error when claim has no source', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: '',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: 'This is a test quote',
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

    it('should not update claim when verification fails', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Johnson2007',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: 'This is a test quote',
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
      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockResolvedValue(verificationResult);
      mockClaimsManager.updateClaim = jest.fn().mockResolvedValue(undefined);

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.closestMatch).toBe('This is a similar quote');
      expect(mockClaimsManager.updateClaim).not.toHaveBeenCalled();
    });

    it('should handle verification errors gracefully', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Johnson2007',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: 'This is a test quote',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('findClosestMatch', () => {
    it('should find closest match for a quote', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';
      const expectedResult: VerificationResult = {
        verified: false,
        similarity: 0.85,
        closestMatch: 'This is a similar quote',
        context: 'surrounding context'
      };

      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockResolvedValue(expectedResult);

      const result = await service.findClosestMatch(quote, authorYear);

      expect(result.closestMatch).toBe('This is a similar quote');
      expect(result.similarity).toBe(0.85);
    });

    it('should handle errors when finding closest match', async () => {
      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockRejectedValue(new Error('Source not found'));

      await expect(service.findClosestMatch('test', 'Unknown2000')).rejects.toThrow('Source not found');
    });
  });

  describe('verifyAllClaims', () => {
    it('should verify all claims in the database', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: 'Quote 1',
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
          primaryQuote: 'Quote 2',
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
      
      mockClaimsManager.updateClaim = jest.fn().mockResolvedValue(undefined);

      const result = await service.verifyAllClaims();

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(2);
      expect(result.verified).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].claimId).toBe('C_02');
    });

    it('should skip claims without quotes', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: 'Quote 1',
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
          primaryQuote: '',
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      mockClaimsManager.getClaims = jest.fn().mockReturnValue(claims);
      mockClaimsManager.getClaim = jest.fn().mockReturnValueOnce(claims[0]);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockResolvedValue({ verified: true, similarity: 1.0 });
      mockClaimsManager.updateClaim = jest.fn().mockResolvedValue(undefined);

      const result = await service.verifyAllClaims();

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(1);
      expect(result.verified).toBe(1);
    });

    it('should handle errors during batch verification', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: 'Quote 1',
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      ];

      mockClaimsManager.getClaims = jest.fn().mockReturnValue(claims);
      mockClaimsManager.getClaim = jest.fn().mockReturnValue(claims[0]);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.verifyAllClaims();

      expect(result.totalClaims).toBe(1);
      expect(result.totalQuotes).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.verified).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('verifyClaimsBatch', () => {
    it('should verify a batch of specific claims', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: 'Quote 1',
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
          primaryQuote: 'Quote 2',
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
      
      mockClaimsManager.updateClaim = jest.fn().mockResolvedValue(undefined);

      const result = await service.verifyClaimsBatch(['C_01', 'C_02']);

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(2);
      expect(result.verified).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should skip non-existent claims in batch', async () => {
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
    it('should update claim verification status', async () => {
      mockClaimsManager.updateClaim = jest.fn().mockResolvedValue(undefined);

      await service.updateClaimVerificationStatus('C_01', true);

      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
    });
  });

  describe('getUnverifiedClaims', () => {
    it('should return only unverified claims with quotes', () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: 'Quote 1',
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
          primaryQuote: 'Quote 2',
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
          primaryQuote: '',
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
    it('should return correct verification statistics', () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Test claim 1',
          category: 'Method',
          source: 'Johnson2007',
          sourceId: 1,
          context: 'Test context',
          primaryQuote: 'Quote 1',
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
          primaryQuote: 'Quote 2',
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
          primaryQuote: '',
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

    it('should handle empty claims database', () => {
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
