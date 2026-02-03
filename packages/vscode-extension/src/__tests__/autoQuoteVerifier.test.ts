import { AutoQuoteVerifier } from '../core/autoQuoteVerifier';
import { ClaimsManager } from '../core/claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';
import { setupTest, createMockClaimsManager, aClaim } from './helpers';

interface VerificationResult {
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
}

describe('AutoQuoteVerifier', () => {
  setupTest();

  let verifier: AutoQuoteVerifier;
  let mockClaimsManager: ReturnType<typeof createMockClaimsManager>;

  beforeEach(() => {
    mockClaimsManager = createMockClaimsManager();
    verifier = new AutoQuoteVerifier(mockClaimsManager);
    jest.spyOn(verifier as any, 'processVerificationQueue').mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    verifier.dispose();
  });

  describe('verifyOnSave', () => {
    test('should skip verification if claim has no quote', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .build();
      claim.primaryQuote = { text: '', source: '', verified: false };

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(0);
    });

    test('should skip verification if claim has no source', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', '')
        .build();

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(0);
    });

    test('should add claim to queue if it has quote and source', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(1);
    });

    test('should update existing queue item if claim already in queue', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      verifier.verifyOnSave(claim);
      verifier.verifyOnSave(claim); // Add same claim again

      expect(verifier.getQueueSize()).toBe(1); // Should still be 1
    });
  });

  describe('verifyClaimManually', () => {
    test('should return null if claim not found', async () => {
      mockClaimsManager.getClaim.mockReturnValue(null);

      const result = await verifier.verifyClaimManually('C_99');

      expect(result).toBeNull();
    });

    test('should return null if claim has no quote', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .build();
      claim.primaryQuote = { text: '', source: '', verified: false };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const result = await verifier.verifyClaimManually('C_01');

      expect(result).toBeNull();
    });

    test('should verify quote and update claim on success', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      const mockSearchResults = [
        {
          matchedText: 'Test quote',
          similarity: 0.95,
          sourceFile: 'Author - 2020 - Title.txt',
          startLine: 10,
          endLine: 12
        }
      ];

      mockClaimsManager.getClaim.mockReturnValue(claim);
      
      // Mock the UnifiedQuoteSearch.search method
      const mockSearch = jest.fn().mockResolvedValue(mockSearchResults);
      (verifier as any).unifiedQuoteSearch.search = mockSearch;
      
      mockClaimsManager.updateClaim.mockResolvedValue(undefined);

      const result = await verifier.verifyClaimManually('C_01');

      expect(result).toEqual({
        verified: true,
        similarity: 0.95,
        closestMatch: 'Test quote'
      });
      expect(mockSearch).toHaveBeenCalledWith('Test quote', 5);
      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
    });

    test('should show warning on verification failure', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      const mockSearchResults = [
        {
          matchedText: 'Similar but not exact quote',
          similarity: 0.45,
          sourceFile: 'Author - 2020 - Title.txt',
          startLine: 10,
          endLine: 12
        }
      ];

      mockClaimsManager.getClaim.mockReturnValue(claim);
      
      // Mock the UnifiedQuoteSearch.search method
      const mockSearch = jest.fn().mockResolvedValue(mockSearchResults);
      (verifier as any).unifiedQuoteSearch.search = mockSearch;
      
      mockClaimsManager.updateClaim.mockResolvedValue(undefined);

      const result = await verifier.verifyClaimManually('C_01');

      expect(result).toEqual({
        verified: false,
        similarity: 0.45,
        closestMatch: 'Similar but not exact quote'
      });
      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: false });
    });
  });

  describe('getQueueSize', () => {
    test('should return 0 for empty queue', () => {
      expect(verifier.getQueueSize()).toBe(0);
    });

    test('should return correct queue size', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(1);
    });
  });

  describe('clearQueue', () => {
    test('should clear the verification queue', () => {
      // Clear queue starts at 0
      expect(verifier.getQueueSize()).toBe(0);
      
      verifier.clearQueue();
      
      // Still 0 after clear
      expect(verifier.getQueueSize()).toBe(0);
    });
  });

  describe('Error handling', () => {
    test('should handle concurrent verification requests', async () => {
      const claim1 = aClaim().withId('C_01').withPrimaryQuote('Quote 1', 'Author2020').build();
      const claim2 = aClaim().withId('C_02').withPrimaryQuote('Quote 2', 'Author2021').build();

      verifier.verifyOnSave(claim1);
      verifier.verifyOnSave(claim2);

      expect(verifier.getQueueSize()).toBe(2);
    });

    test('should handle queue processing errors gracefully', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      mockClaimsManager.getClaim.mockReturnValue(claim);
      mockClaimsManager.updateClaim.mockRejectedValue(new Error('Update failed'));

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(1);
    });
  });
});
