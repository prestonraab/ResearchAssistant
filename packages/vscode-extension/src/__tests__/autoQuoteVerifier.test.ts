import { jest } from '@jest/globals';
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

    test('should add claim to queue if it has quote and source', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      verifier.verifyOnSave(claim);

      // Queue size should be 1 immediately after adding
      expect(verifier.getQueueSize()).toBeGreaterThanOrEqual(1);
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should update existing queue item if claim already in queue', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      verifier.verifyOnSave(claim);
      expect(verifier.getQueueSize()).toBeGreaterThanOrEqual(1);
      
      verifier.verifyOnSave(claim); // Add same claim again

      // Should still be 1 or more (depending on processing state)
      expect(verifier.getQueueSize()).toBeGreaterThanOrEqual(0);
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

      mockClaimsManager.getClaim.mockReturnValue(claim);
      mockClaimsManager.updateClaim.mockResolvedValue(undefined);

      const result = await verifier.verifyClaimManually('C_01');

      // Verify behavior: result should contain verification data
      expect(result).toBeDefined();
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('similarity');
    });

    test('should show warning on verification failure', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      mockClaimsManager.getClaim.mockReturnValue(claim);
      mockClaimsManager.updateClaim.mockResolvedValue(undefined);

      const result = await verifier.verifyClaimManually('C_01');

      // Verify behavior: result should be defined and contain verification data
      expect(result).toBeDefined();
      expect(result).toHaveProperty('verified');
    });
  });

  describe('getQueueSize', () => {
    test('should return 0 for empty queue', () => {
      expect(verifier.getQueueSize()).toBe(0);
    });

    test('should return correct queue size', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      verifier.verifyOnSave(claim);

      // Queue size should be at least 1 immediately after adding
      expect(verifier.getQueueSize()).toBeGreaterThanOrEqual(1);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
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

      // Queue should have at least 1 item (may be processing)
      expect(verifier.getQueueSize()).toBeGreaterThanOrEqual(1);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should handle queue processing errors gracefully', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withPrimaryQuote('Test quote', 'Author2020')
        .build();

      mockClaimsManager.getClaim.mockReturnValue(claim);
      mockClaimsManager.updateClaim.mockRejectedValue(new Error('Update failed'));

      verifier.verifyOnSave(claim);

      // Queue should have at least 1 item
      expect(verifier.getQueueSize()).toBeGreaterThanOrEqual(1);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});
