import { SentenceClaimQuoteLinkManager } from '../core/sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../core/claimsManagerWrapper';

describe('SentenceClaimQuoteLinkManager', () => {
  let manager: SentenceClaimQuoteLinkManager;
  let claimsManager: any;

  beforeEach(() => {
    // Mock ClaimsManager
    claimsManager = {
      getClaim: () => null,
      updateClaim: () => Promise.resolve(),
      deleteClaim: () => Promise.resolve()
    };

    manager = new SentenceClaimQuoteLinkManager(claimsManager);
  });

  describe('markQuoteForCitation', () => {
    it('should mark a quote for citation', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      
      const isCited = manager.isQuoteCitedForSentence('sent1', 'claim1', 0);
      expect(isCited).toBe(true);
    });
  });

  describe('unmarkQuoteForCitation', () => {
    it('should unmark a quote for citation', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.unmarkQuoteForCitation('sent1', 'claim1', 0);
      
      const isCited = manager.isQuoteCitedForSentence('sent1', 'claim1', 0);
      expect(isCited).toBe(false);
    });
  });

  describe('toggleQuoteCitation', () => {
    it('should toggle citation status from false to true', async () => {
      const result = await manager.toggleQuoteCitation('sent1', 'claim1', 0);
      expect(result).toBe(true);
    });

    it('should toggle citation status from true to false', async () => {
      await manager.toggleQuoteCitation('sent1', 'claim1', 0);
      const result = await manager.toggleQuoteCitation('sent1', 'claim1', 0);
      expect(result).toBe(false);
    });
  });

  describe('getCitationsForSentence', () => {
    it('should return all citations for a sentence', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent1', 'claim2', 0);
      
      const citations = manager.getCitationsForSentence('sent1');
      expect(citations).toHaveLength(2);
      expect(citations[0].claimId).toBe('claim1');
      expect(citations[1].claimId).toBe('claim2');
    });
  });

  describe('getCitationsForClaim', () => {
    it('should return all citations for a claim', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent2', 'claim1', 0);
      
      const citations = manager.getCitationsForClaim('claim1');
      expect(citations).toHaveLength(2);
      expect(citations[0].sentenceId).toBe('sent1');
      expect(citations[1].sentenceId).toBe('sent2');
    });
  });

  describe('getSentencesWithQuoteCited', () => {
    it('should return all sentences with a quote marked for citation', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent2', 'claim1', 0);
      
      const sentences = manager.getSentencesWithQuoteCited('claim1', 0);
      expect(sentences).toHaveLength(2);
      expect(sentences).toContain('sent1');
      expect(sentences).toContain('sent2');
    });
  });

  describe('deleteSentenceLinks', () => {
    it('should delete all links for a sentence', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent1', 'claim2', 0);
      
      await manager.deleteSentenceLinks('sent1');
      
      const citations = manager.getCitationsForSentence('sent1');
      expect(citations).toHaveLength(0);
    });
  });

  describe('deleteClaimLinks', () => {
    it('should delete all links for a claim', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent2', 'claim1', 0);
      
      await manager.deleteClaimLinks('claim1');
      
      const citations = manager.getCitationsForClaim('claim1');
      expect(citations).toHaveLength(0);
    });
  });

  describe('deleteLink', () => {
    it('should delete a specific link', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent1', 'claim2', 0);
      
      await manager.deleteLink('sent1', 'claim1');
      
      const citations = manager.getCitationsForSentence('sent1');
      expect(citations).toHaveLength(1);
      expect(citations[0].claimId).toBe('claim2');
    });
  });

  describe('getAllLinks', () => {
    it('should return all links', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent2', 'claim2', 0);
      
      const links = manager.getAllLinks();
      expect(links).toHaveLength(2);
    });
  });

  describe('clearLinks', () => {
    it('should clear all links', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent2', 'claim2', 0);
      
      manager.clearLinks();
      
      const links = manager.getAllLinks();
      expect(links).toHaveLength(0);
    });
  });

  describe('getLinkCount', () => {
    it('should return the count of links', async () => {
      await manager.markQuoteForCitation('sent1', 'claim1', 0);
      await manager.markQuoteForCitation('sent2', 'claim2', 0);
      
      const count = manager.getLinkCount();
      expect(count).toBe(2);
    });
  });
});
