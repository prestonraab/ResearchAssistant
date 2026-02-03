/**
 * Unit tests for QuoteManager
 * 
 * Tests cover:
 * - Creating quotes with Zotero metadata
 * - Filtering quotes by Zotero flag
 * - Finding page numbers for quotes
 * - Backfilling page numbers for existing quotes
 * - Searching quotes with equal scoring
 * - Quote retrieval and deletion
 * 
 * **Validates: Requirements 1.6, 1.7, 3.2, 3.3, 3.4, 3.9, 4.1, 4.3**
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { QuoteManager } from '../../src/managers/QuoteManager.js';
import type { SourcedQuote, ZoteroQuoteMetadata } from '../../src/types/index.js';

describe('QuoteManager', () => {
  let manager: QuoteManager;

  beforeEach(() => {
    manager = new QuoteManager();
  });

  describe('createQuoteWithZoteroMetadata()', () => {
    it('should create a quote with Zotero metadata', async () => {
      const zoteroMetadata: ZoteroQuoteMetadata = {
        annotationKey: 'ABC123DEF456',
        highlightColor: '#ffff00',
        importedAt: new Date().toISOString(),
        fromZotero: true,
        matchConfidence: 0.95,
      };

      const quote: SourcedQuote = {
        text: 'RNA-seq is widely used',
        source: 'Smith2020',
        verified: false,
        pageNumber: 5,
        zoteroMetadata,
      };

      const quoteId = await manager.createQuoteWithZoteroMetadata(quote);

      expect(quoteId).toBeDefined();
      expect(quoteId).toMatch(/^quote_\d+$/);

      const retrieved = manager.getQuote(quoteId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.text).toBe('RNA-seq is widely used');
      expect(retrieved?.zoteroMetadata?.annotationKey).toBe('ABC123DEF456');
      expect(retrieved?.zoteroMetadata?.fromZotero).toBe(true);
    });

    it('should validate annotation key format before storing', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'invalid', // Too short
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: true,
        },
      };

      await expect(manager.createQuoteWithZoteroMetadata(quote)).rejects.toThrow(
        'Invalid annotation key'
      );
    });

    it('should reject annotation key with special characters', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'ABC!@#$%^&*', // Invalid characters
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: true,
        },
      };

      await expect(manager.createQuoteWithZoteroMetadata(quote)).rejects.toThrow(
        'Invalid annotation key'
      );
    });

    it('should mark annotation key as immutable after creation', async () => {
      const zoteroMetadata: ZoteroQuoteMetadata = {
        annotationKey: 'ABC123DEF456',
        highlightColor: '#ffff00',
        importedAt: new Date().toISOString(),
        fromZotero: true,
      };

      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
        zoteroMetadata,
      };

      await manager.createQuoteWithZoteroMetadata(quote);

      expect(manager.isAnnotationKeyImmutable('ABC123DEF456')).toBe(true);
    });

    it('should set fromZotero flag to true when creating with Zotero metadata', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'TestSource',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'KEY123DEF456',
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: false, // Should be overridden
          matchConfidence: 0.9,
        },
      };

      const quoteId = await manager.createQuoteWithZoteroMetadata(quote);
      const retrieved = manager.getQuote(quoteId);

      expect(retrieved?.zoteroMetadata?.fromZotero).toBe(true);
    });

    it('should create multiple quotes with unique IDs', async () => {
      const quote1: SourcedQuote = {
        text: 'Quote 1',
        source: 'Source1',
        verified: false,
      };

      const quote2: SourcedQuote = {
        text: 'Quote 2',
        source: 'Source2',
        verified: false,
      };

      const id1 = await manager.createQuoteWithZoteroMetadata(quote1);
      const id2 = await manager.createQuoteWithZoteroMetadata(quote2);

      expect(id1).not.toBe(id2);
      expect(manager.getQuote(id1)?.text).toBe('Quote 1');
      expect(manager.getQuote(id2)?.text).toBe('Quote 2');
    });
  });

  describe('getQuotesByZoteroFlag()', () => {
    it('should return only Zotero quotes when filtering for fromZotero=true', async () => {
      const zoteroQuote: SourcedQuote = {
        text: 'From Zotero',
        source: 'Source1',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'KEY1ABC123DEF',
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: true,
        },
      };

      const nonZoteroQuote: SourcedQuote = {
        text: 'Not from Zotero',
        source: 'Source2',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(zoteroQuote);
      await manager.createQuoteWithZoteroMetadata(nonZoteroQuote);

      const zoteroQuotes = await manager.getQuotesByZoteroFlag(true);
      expect(zoteroQuotes).toHaveLength(1);
      expect(zoteroQuotes[0].text).toBe('From Zotero');
    });

    it('should return only non-Zotero quotes when filtering for fromZotero=false', async () => {
      const zoteroQuote: SourcedQuote = {
        text: 'From Zotero',
        source: 'Source1',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'KEY1ABC123DEF',
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: true,
        },
      };

      const nonZoteroQuote: SourcedQuote = {
        text: 'Not from Zotero',
        source: 'Source2',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(zoteroQuote);
      await manager.createQuoteWithZoteroMetadata(nonZoteroQuote);

      const nonZoteroQuotes = await manager.getQuotesByZoteroFlag(false);
      expect(nonZoteroQuotes).toHaveLength(1);
      expect(nonZoteroQuotes[0].text).toBe('Not from Zotero');
    });

    it('should return empty array when no quotes match filter', async () => {
      const quote: SourcedQuote = {
        text: 'Test',
        source: 'Source',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote);

      const zoteroQuotes = await manager.getQuotesByZoteroFlag(true);
      expect(zoteroQuotes).toHaveLength(0);
    });
  });

  describe('findPageNumber()', () => {
    it('should return null for page number lookup (placeholder implementation)', async () => {
      const pageNumber = await manager.findPageNumber('Test quote', 'paper_123');
      expect(pageNumber).toBeNull();
    });
  });

  describe('backfillPageNumbers()', () => {
    it('should return 0 when no quotes need backfilling', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
        pageNumber: 5, // Already has page number
      };

      await manager.createQuoteWithZoteroMetadata(quote);

      const updated = await manager.backfillPageNumbers();
      expect(updated).toBe(0);
    });

    it('should attempt to backfill quotes without page numbers', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
        // No page number
      };

      await manager.createQuoteWithZoteroMetadata(quote);

      const updated = await manager.backfillPageNumbers();
      // With placeholder implementation, should return 0 since findPageNumber returns null
      expect(updated).toBe(0);
    });

    it('should skip quotes that already have page numbers', async () => {
      const quote1: SourcedQuote = {
        text: 'Quote with page',
        source: 'Source',
        verified: false,
        pageNumber: 5,
      };

      const quote2: SourcedQuote = {
        text: 'Quote without page',
        source: 'Source',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote1);
      await manager.createQuoteWithZoteroMetadata(quote2);

      const updated = await manager.backfillPageNumbers();
      // Should only attempt to backfill quote2, but findPageNumber returns null
      expect(updated).toBe(0);
    });
  });

  describe('searchQuotes()', () => {
    it('should find quotes matching text query', async () => {
      const quote1: SourcedQuote = {
        text: 'RNA-seq is widely used',
        source: 'Smith2020',
        verified: false,
      };

      const quote2: SourcedQuote = {
        text: 'Single-cell analysis',
        source: 'Johnson2021',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote1);
      await manager.createQuoteWithZoteroMetadata(quote2);

      const results = await manager.searchQuotes('RNA-seq');
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('RNA-seq is widely used');
    });

    it('should find quotes matching source query', async () => {
      const quote1: SourcedQuote = {
        text: 'Some text',
        source: 'Smith2020',
        verified: false,
      };

      const quote2: SourcedQuote = {
        text: 'Other text',
        source: 'Johnson2021',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote1);
      await manager.createQuoteWithZoteroMetadata(quote2);

      const results = await manager.searchQuotes('Smith2020');
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Smith2020');
    });

    it('should include both Zotero and non-Zotero quotes in results', async () => {
      const zoteroQuote: SourcedQuote = {
        text: 'RNA-seq from Zotero',
        source: 'Smith2020',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'KEY1ABC123DEF',
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: true,
        },
      };

      const nonZoteroQuote: SourcedQuote = {
        text: 'RNA-seq from manual entry',
        source: 'Johnson2021',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(zoteroQuote);
      await manager.createQuoteWithZoteroMetadata(nonZoteroQuote);

      const results = await manager.searchQuotes('RNA-seq');
      expect(results).toHaveLength(2);
    });

    it('should return empty array when no quotes match', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote);

      const results = await manager.searchQuotes('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should sort results by relevance', async () => {
      const quote1: SourcedQuote = {
        text: 'RNA-seq analysis',
        source: 'Source1',
        verified: false,
      };

      const quote2: SourcedQuote = {
        text: 'This is about RNA-seq',
        source: 'Source2',
        verified: false,
      };

      const quote3: SourcedQuote = {
        text: 'RNA-seq',
        source: 'Source3',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote1);
      await manager.createQuoteWithZoteroMetadata(quote2);
      await manager.createQuoteWithZoteroMetadata(quote3);

      const results = await manager.searchQuotes('RNA-seq');
      expect(results).toHaveLength(3);
      // Exact match should rank higher
      expect(results[0].text).toBe('RNA-seq');
    });
  });

  describe('getQuote()', () => {
    it('should retrieve a quote by ID', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
      };

      const quoteId = await manager.createQuoteWithZoteroMetadata(quote);
      const retrieved = manager.getQuote(quoteId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.text).toBe('Test quote');
    });

    it('should return null for non-existent quote ID', () => {
      const retrieved = manager.getQuote('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllQuotes()', () => {
    it('should return all quotes', async () => {
      const quote1: SourcedQuote = {
        text: 'Quote 1',
        source: 'Source1',
        verified: false,
      };

      const quote2: SourcedQuote = {
        text: 'Quote 2',
        source: 'Source2',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote1);
      await manager.createQuoteWithZoteroMetadata(quote2);

      const all = manager.getAllQuotes();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no quotes exist', () => {
      const all = manager.getAllQuotes();
      expect(all).toHaveLength(0);
    });
  });

  describe('getQuoteCount()', () => {
    it('should return correct quote count', async () => {
      expect(manager.getQuoteCount()).toBe(0);

      const quote: SourcedQuote = {
        text: 'Test',
        source: 'Source',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote);
      expect(manager.getQuoteCount()).toBe(1);

      await manager.createQuoteWithZoteroMetadata(quote);
      expect(manager.getQuoteCount()).toBe(2);
    });
  });

  describe('deleteQuote()', () => {
    it('should delete a quote by ID', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
      };

      const quoteId = await manager.createQuoteWithZoteroMetadata(quote);
      expect(manager.getQuoteCount()).toBe(1);

      const deleted = manager.deleteQuote(quoteId);
      expect(deleted).toBe(true);
      expect(manager.getQuoteCount()).toBe(0);
      expect(manager.getQuote(quoteId)).toBeNull();
    });

    it('should return false when deleting non-existent quote', () => {
      const deleted = manager.deleteQuote('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should remove quote from Zotero index when deleted', async () => {
      const quote: SourcedQuote = {
        text: 'From Zotero',
        source: 'Source',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'KEY1ABC123DEF',
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: true,
        },
      };

      const quoteId = await manager.createQuoteWithZoteroMetadata(quote);
      const zoteroQuotes = await manager.getQuotesByZoteroFlag(true);
      expect(zoteroQuotes).toHaveLength(1);

      manager.deleteQuote(quoteId);
      const zoteroQuotesAfter = await manager.getQuotesByZoteroFlag(true);
      expect(zoteroQuotesAfter).toHaveLength(0);
    });

    it('should log deleted quote with annotation key to audit trail', async () => {
      const quote: SourcedQuote = {
        text: 'Test quote',
        source: 'Source',
        verified: false,
        zoteroMetadata: {
          annotationKey: 'KEY1ABC123DEF',
          highlightColor: '#ffff00',
          importedAt: new Date().toISOString(),
          fromZotero: true,
        },
      };

      const quoteId = await manager.createQuoteWithZoteroMetadata(quote);
      manager.deleteQuote(quoteId);

      const auditLog = manager.getAuditLog();
      const entries = auditLog.getEntriesByAnnotationKey('KEY1ABC123DEF');
      expect(entries).toHaveLength(1);
      expect(entries[0].quoteId).toBe(quoteId);
      expect(entries[0].quoteText).toBe('Test quote');
    });
  });

  describe('clear()', () => {
    it('should clear all quotes', async () => {
      const quote: SourcedQuote = {
        text: 'Test',
        source: 'Source',
        verified: false,
      };

      await manager.createQuoteWithZoteroMetadata(quote);
      expect(manager.getQuoteCount()).toBe(1);

      manager.clear();
      expect(manager.getQuoteCount()).toBe(0);
      expect(manager.getAllQuotes()).toHaveLength(0);
    });
  });
});
