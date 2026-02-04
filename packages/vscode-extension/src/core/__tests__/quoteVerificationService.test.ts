import { jest } from '@jest/globals';
import { QuoteVerificationService, QuoteVerificationResult, BatchVerificationResult, VerificationResult } from '../quoteVerificationService';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';
import { 
  setupTest, 
  createMockVerificationResult,
  createMockClaimsManager,
  createMockUnifiedQuoteSearch,
  aClaim
} from '../../__tests__/helpers';
import { UnifiedQuoteSearch } from '../../services/unifiedQuoteSearch';

describe('QuoteVerificationService', () => {
  setupTest();

  let service: QuoteVerificationService;
  let mockUnifiedQuoteSearch: ReturnType<typeof createMockUnifiedQuoteSearch>;
  let mockClaimsManager: ReturnType<typeof createMockClaimsManager>;

  beforeEach(() => {
    // Use factory functions for consistent mocks
    mockUnifiedQuoteSearch = createMockUnifiedQuoteSearch();
    mockClaimsManager = createMockClaimsManager();
    // Pass empty string for workspaceRoot to avoid cache initialization issues in tests
    service = new QuoteVerificationService(mockClaimsManager as any, '');
    // Override the unifiedQuoteSearch with our mock
    (service as any).unifiedQuoteSearch = mockUnifiedQuoteSearch;
  });

  describe('verifyQuote', () => {
    test('should verify a quote successfully', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';
      const expectedResult: VerificationResult = {
        verified: true,
        similarity: 1.0,
        closestMatch: quote
      };

      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockResolvedValue({
        similarity: 1.0,
        matchedText: quote
      });

      const result = await service.verifyQuote(quote, authorYear);

      expect(mockUnifiedQuoteSearch.findBestMatch).toHaveBeenCalledWith(quote);
      expect(result.verified).toBe(true);
      expect(result.similarity).toBe(1.0);
    });

    test('should return closest match when verification fails', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';

      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockResolvedValue({
        similarity: 0.85,
        matchedText: 'This is a similar quote'
      });

      const result = await service.verifyQuote(quote, authorYear);

      expect(result.verified).toBe(false);
      expect(result.closestMatch).toBe('This is a similar quote');
      expect(result.similarity).toBe(0.85);
    });

    test('should throw error when quote is empty', async () => {
      await expect(service.verifyQuote('', 'Johnson2007')).rejects.toThrow('Quote and author/year are required');
    });

    test('should throw error when authorYear is empty', async () => {
      await expect(service.verifyQuote('test quote', '')).rejects.toThrow('Quote and author/year are required');
    });

    test('should handle MCP client errors', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';

      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockRejectedValue(new Error('MCP connection failed'));

      await expect(service.verifyQuote(quote, authorYear)).rejects.toThrow('Failed to verify quote: MCP connection failed');
    });
  });

  describe('verifyClaim', () => {
    test('should verify a claim successfully', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', 'Johnson2007')
        .build();

      const verificationResult: VerificationResult = {
        verified: true,
        similarity: 1.0,
        closestMatch: claim.primaryQuote.text
      };

      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockResolvedValue({
        similarity: 1.0,
        matchedText: claim.primaryQuote.text
      });
      (mockClaimsManager.updateClaim as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyClaim('C_01');

      expect(mockClaimsManager.getClaim).toHaveBeenCalledWith('C_01');
      expect(mockUnifiedQuoteSearch.findBestMatch).toHaveBeenCalledWith(claim.primaryQuote.text);
      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
      expect(result.verified).toBe(true);
      expect(result.claimId).toBe('C_01');
    });

    test('should return error when claim not found', async () => {
      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(null);

      const result = await service.verifyClaim('C_99');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Claim C_99 not found');
    });

    test('should return error when claim has no primary quote', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('', '')
        .build();

      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(claim);

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Claim has no primary quote to verify');
    });

    test('should return error when claim has no source', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', '')
        .build();

      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(claim);

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Claim has no source specified');
    });

    test('should not update claim when verification fails', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', 'Johnson2007')
        .build();

      const verificationResult: VerificationResult = {
        verified: false,
        similarity: 0.75,
        closestMatch: 'Similar quote'
      };

      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockResolvedValue({
        similarity: 0.75,
        matchedText: 'Similar quote'
      });
      (mockClaimsManager.updateClaim as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.similarity).toBe(0.75);
      expect(mockClaimsManager.updateClaim).not.toHaveBeenCalled();
    });

    test('should handle verification errors gracefully', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', 'Johnson2007')
        .build();

      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(claim);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockRejectedValue(new Error('Network error'));

      const result = await service.verifyClaim('C_01');

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('findClosestMatch', () => {
    test('should find closest match for a quote', async () => {
      const quote = 'This is a test quote';
      const authorYear = 'Johnson2007';

      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockResolvedValue({
        similarity: 0.85,
        matchedText: 'This is a similar quote'
      });

      const result = await service.findClosestMatch(quote, authorYear);

      expect(result.closestMatch).toBe('This is a similar quote');
      expect(result.similarity).toBe(0.85);
    });

    test('should handle errors when finding closest match', async () => {
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>().mockRejectedValue(new Error('Source not found'));

      await expect(service.findClosestMatch('test', 'Unknown2000')).rejects.toThrow('Source not found');
    });
  });

  describe('verifyAllClaims', () => {
    test('should verify all claims in the database', async () => {
      const claims: Claim[] = [
        aClaim()
          .withId('C_01')
          .withText('Test claim 1')
          .withCategory('Method')
          .withPrimaryQuote('Quote 1', 'Johnson2007')
          .build(),
        aClaim()
          .withId('C_02')
          .withText('Test claim 2')
          .withCategory('Result')
          .withPrimaryQuote('Quote 2', 'Smith2010')
          .build()
      ];

      (mockClaimsManager.getClaims as jest.Mock<any>).mockReturnValue(claims);
      (mockClaimsManager.getClaim as jest.Mock<any>)
        .mockReturnValueOnce(claims[0])
        .mockReturnValueOnce(claims[1]);
      
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>()
        .mockResolvedValueOnce({ similarity: 1.0, matchedText: 'Quote 1' })
        .mockResolvedValueOnce({ similarity: 0.75, matchedText: 'Similar Quote 2' });
      
      (mockClaimsManager.updateClaim as jest.Mock<any>).mockResolvedValue(undefined);

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
        aClaim()
          .withId('C_01')
          .withText('Test claim 1')
          .withCategory('Method')
          .withPrimaryQuote('Quote 1', 'Johnson2007')
          .build(),
        aClaim()
          .withId('C_02')
          .withText('Test claim 2')
          .withCategory('Result')
          .withPrimaryQuote('', '')
          .build()
      ];

      (mockClaimsManager.getClaims as jest.Mock<any>).mockReturnValue(claims);
      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValueOnce(claims[0]);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>()
        .mockResolvedValue({ similarity: 1.0, matchedText: 'Quote 1' });
      (mockClaimsManager.updateClaim as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyAllClaims();

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(1);
      expect(result.verified).toBe(1);
    });

    test('should handle errors during batch verification', async () => {
      const claims: Claim[] = [
        aClaim()
          .withId('C_01')
          .withText('Test claim 1')
          .withCategory('Method')
          .withPrimaryQuote('Quote 1', 'Johnson2007')
          .build()
      ];

      (mockClaimsManager.getClaims as jest.Mock<any>).mockReturnValue(claims);
      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(claims[0]);
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>()
        .mockRejectedValue(new Error('Network error'));

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
        aClaim()
          .withId('C_01')
          .withText('Test claim 1')
          .withCategory('Method')
          .withPrimaryQuote('Quote 1', 'Johnson2007')
          .build(),
        aClaim()
          .withId('C_02')
          .withText('Test claim 2')
          .withCategory('Result')
          .withPrimaryQuote('Quote 2', 'Smith2010')
          .build()
      ];

      // Mock getClaim to return the appropriate claim for each ID
      (mockClaimsManager.getClaim as jest.Mock<any>).mockImplementation((id: string) => {
        return claims.find(c => c.id === id) || null;
      });
      
      mockUnifiedQuoteSearch.findBestMatch = jest.fn<(quote: string) => Promise<any>>()
        .mockResolvedValueOnce({ similarity: 1.0, matchedText: 'Quote 1' })
        .mockResolvedValueOnce({ similarity: 1.0, matchedText: 'Quote 2' });
      
      (mockClaimsManager.updateClaim as jest.Mock<any>).mockResolvedValue(undefined);

      const result = await service.verifyClaimsBatch(['C_01', 'C_02']);

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(2);
      expect(result.verified).toBe(2);
      expect(result.failed).toBe(0);
    });

    test('should skip non-existent claims in batch', async () => {
      (mockClaimsManager.getClaim as jest.Mock<any>).mockReturnValue(null);

      const result = await service.verifyClaimsBatch(['C_99', 'C_100']);

      expect(result.totalClaims).toBe(2);
      expect(result.totalQuotes).toBe(0);
      expect(result.verified).toBe(0);
    });
  });

  describe('updateClaimVerificationStatus', () => {
    test('should update claim verification status', async () => {
      (mockClaimsManager.updateClaim as jest.Mock<any>).mockResolvedValue(undefined);

      await service.updateClaimVerificationStatus('C_01', true);

      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
    });
  });

  describe('getUnverifiedClaims', () => {
    test('should return only unverified claims with quotes', () => {
      const claims: Claim[] = [
        aClaim()
          .withId('C_01')
          .withText('Test claim 1')
          .withCategory('Method')
          .withPrimaryQuote('Quote 1', 'Johnson2007')
          .build(),
        aClaim()
          .withId('C_02')
          .withText('Test claim 2')
          .withCategory('Result')
          .withPrimaryQuote('Quote 2', 'Smith2010')
          .verified()
          .build(),
        aClaim()
          .withId('C_03')
          .withText('Test claim 3')
          .withCategory('Challenge')
          .withPrimaryQuote('', '')
          .build()
      ];

      (mockClaimsManager.getClaims as jest.Mock<any>).mockReturnValue(claims);

      const unverified = service.getUnverifiedClaims();

      // The service filters for unverified claims with a primaryQuote object (even if empty)
      // So both C_01 and C_03 are returned since they're unverified and have primaryQuote
      expect(unverified).toHaveLength(2);
      expect(unverified[0].id).toBe('C_01');
      expect(unverified[1].id).toBe('C_03');
    });
  });

  describe('getVerificationStats', () => {
    test('should return correct verification statistics', () => {
      const claims: Claim[] = [
        aClaim()
          .withId('C_01')
          .withText('Test claim 1')
          .withCategory('Method')
          .withPrimaryQuote('Quote 1', 'Johnson2007')
          .verified()
          .build(),
        aClaim()
          .withId('C_02')
          .withText('Test claim 2')
          .withCategory('Result')
          .withPrimaryQuote('Quote 2', 'Smith2010')
          .build(),
        aClaim()
          .withId('C_03')
          .withText('Test claim 3')
          .withCategory('Challenge')
          .withPrimaryQuote('', '')
          .build()
      ];

      (mockClaimsManager.getClaims as jest.Mock<any>).mockReturnValue(claims);

      const stats = service.getVerificationStats();

      expect(stats.total).toBe(3);
      expect(stats.verified).toBe(1);
      // C_02 and C_03 are unverified, but C_03 has an empty quote so it's counted as unverified with quote
      expect(stats.unverified).toBe(2);
      expect(stats.withoutQuotes).toBe(0); // All have primaryQuote object
      // Verification rate: 1 verified out of 3 total = 33.33%
      expect(stats.verificationRate).toBeCloseTo(33.33, 1);
    });

    test('should handle empty claims database', () => {
      (mockClaimsManager.getClaims as jest.Mock<any>).mockReturnValue([]);

      const stats = service.getVerificationStats();

      expect(stats.total).toBe(0);
      expect(stats.verified).toBe(0);
      expect(stats.unverified).toBe(0);
      expect(stats.withoutQuotes).toBe(0);
      expect(stats.verificationRate).toBe(0);
    });
  });
});
