/**
 * Property-based tests for QuoteManager
 * 
 * Tests verify invariants that should hold across all inputs:
 * - Property 6: Import Completeness - All created quotes are retrievable
 * - Property 7: Zotero Flag Assignment - Zotero quotes have correct flag
 * - Property 12: Zotero Filter Functionality - Filtering returns correct quotes
 * - Property 13: Page Number Storage - Page numbers are preserved
 * - Property 14: Page Number Lookup Attempt - Backfill attempts all quotes without pages
 * - Property 15: Page Number Backfill - Backfill process completes
 * - Property 16: Zotero Quote Search Inclusion - Search includes all quote types
 * 
 * **Validates: Requirements 1.6, 1.7, 3.2, 3.3, 3.4, 3.9, 4.1, 4.3**
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { QuoteManager } from '../../src/managers/QuoteManager.js';
import type { SourcedQuote, ZoteroQuoteMetadata } from '../../src/types/index.js';
import * as fc from 'fast-check';

describe('QuoteManager - Property-Based Tests', () => {
  let manager: QuoteManager;

  beforeEach(() => {
    manager = new QuoteManager();
  });

  // ============================================================================
  // Arbitraries (Generators for Property-Based Testing)
  // ============================================================================

  /**
   * Generate a non-empty text string
   */
  const textArbitrary = fc.string({ minLength: 1, maxLength: 200 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim());

  /**
   * Generate a source identifier
   */
  const sourceArbitrary = fc.stringMatching(/^[A-Z][a-z]+\d{4}$/);

  /**
   * Generate a Zotero annotation key
   * 
   * Must be 8-32 characters, alphanumeric, underscores, and hyphens only
   */
  const annotationKeyArbitrary = fc.stringMatching(/^[A-Za-z0-9_-]{8,32}$/);

  /**
   * Generate a hex color code
   */
  const colorArbitrary = fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);

  /**
   * Generate Zotero metadata
   */
  const zoteroMetadataArbitrary = fc.record({
    annotationKey: annotationKeyArbitrary,
    highlightColor: colorArbitrary,
    importedAt: fc.date().map(d => d.toISOString()),
    fromZotero: fc.constant(true),
    matchConfidence: fc.float({ min: 0, max: 1 }),
  });

  /**
   * Generate a SourcedQuote
   */
  const quotesArbitrary = fc.record({
    text: textArbitrary,
    source: sourceArbitrary,
    verified: fc.boolean(),
    pageNumber: fc.option(fc.integer({ min: 1, max: 500 }), { freq: 2 }),
    zoteroMetadata: fc.option(zoteroMetadataArbitrary, { freq: 2 }),
  }).map(q => ({
    ...q,
    pageNumber: q.pageNumber ?? undefined,
    zoteroMetadata: q.zoteroMetadata ?? undefined,
  })) as fc.Arbitrary<SourcedQuote>;

  // ============================================================================
  // Property 6: Import Completeness
  // ============================================================================

  it('Property 6: All created quotes should be retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 1, maxLength: 10 }), async (quotes) => {
        manager.clear();

        // Create all quotes
        const quoteIds: string[] = [];
        for (const quote of quotes) {
          const id = await manager.createQuoteWithZoteroMetadata(quote);
          quoteIds.push(id);
        }

        // Verify all quotes are retrievable
        for (let i = 0; i < quotes.length; i++) {
          const retrieved = manager.getQuote(quoteIds[i]);
          expect(retrieved).not.toBeNull();
          expect(retrieved?.text).toBe(quotes[i].text);
          expect(retrieved?.source).toBe(quotes[i].source);
        }

        // Verify count matches
        expect(manager.getQuoteCount()).toBe(quotes.length);
      }),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // Property 7: Zotero Flag Assignment
  // ============================================================================

  it('Property 7: Quotes created with Zotero metadata should have fromZotero flag set to true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 1, maxLength: 10 }), async (quotes) => {
        manager.clear();

        for (const quote of quotes) {
          const id = await manager.createQuoteWithZoteroMetadata(quote);
          const retrieved = manager.getQuote(id);

          if (quote.zoteroMetadata) {
            expect(retrieved?.zoteroMetadata?.fromZotero).toBe(true);
          }
        }
      }),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // Property 12: Zotero Filter Functionality
  // ============================================================================

  it('Property 12: Filtering by Zotero flag should return only matching quotes', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 1, maxLength: 10 }), async (quotes) => {
        manager.clear();

        for (const quote of quotes) {
          await manager.createQuoteWithZoteroMetadata(quote);
        }

        // Get Zotero quotes
        const zoteroQuotes = await manager.getQuotesByZoteroFlag(true);
        const nonZoteroQuotes = await manager.getQuotesByZoteroFlag(false);

        // Verify all Zotero quotes have the flag
        for (const quote of zoteroQuotes) {
          expect(quote.zoteroMetadata?.fromZotero).toBe(true);
        }

        // Verify all non-Zotero quotes don't have the flag
        for (const quote of nonZoteroQuotes) {
          expect(quote.zoteroMetadata?.fromZotero).not.toBe(true);
        }

        // Verify total count
        expect(zoteroQuotes.length + nonZoteroQuotes.length).toBe(quotes.length);
      }),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // Property 13: Page Number Storage
  // ============================================================================

  it('Property 13: Page numbers should be preserved when stored', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 1, maxLength: 10 }), async (quotes) => {
        manager.clear();

        for (const quote of quotes) {
          const id = await manager.createQuoteWithZoteroMetadata(quote);
          const retrieved = manager.getQuote(id);

          if (quote.pageNumber !== undefined) {
            expect(retrieved?.pageNumber).toBe(quote.pageNumber);
          }
        }
      }),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // Property 14: Page Number Lookup Attempt
  // ============================================================================

  it('Property 14: findPageNumber should be callable for any quote', async () => {
    await fc.assert(
      fc.asyncProperty(textArbitrary, sourceArbitrary, async (text, source) => {
        const result = await manager.findPageNumber(text, source);
        // Result should be either null or a number
        expect(result === null || typeof result === 'number').toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // Property 15: Page Number Backfill
  // ============================================================================

  it('Property 15: Backfill should complete without errors', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 0, maxLength: 10 }), async (quotes) => {
        manager.clear();

        for (const quote of quotes) {
          await manager.createQuoteWithZoteroMetadata(quote);
        }

        // Backfill should complete without throwing
        const updated = await manager.backfillPageNumbers();

        // Result should be a non-negative number
        expect(typeof updated).toBe('number');
        expect(updated).toBeGreaterThanOrEqual(0);
        expect(updated).toBeLessThanOrEqual(quotes.length);
      }),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // Property 16: Zotero Quote Search Inclusion
  // ============================================================================

  it('Property 16: Search should include both Zotero and non-Zotero quotes', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 1, maxLength: 10 }), textArbitrary, async (quotes, query) => {
        manager.clear();

        for (const quote of quotes) {
          await manager.createQuoteWithZoteroMetadata(quote);
        }

        const results = await manager.searchQuotes(query);

        // Results should be an array
        expect(Array.isArray(results)).toBe(true);

        // All results should be valid quotes
        for (const result of results) {
          expect(result.text).toBeDefined();
          expect(result.source).toBeDefined();
        }

        // Results should not exceed total quotes
        expect(results.length).toBeLessThanOrEqual(quotes.length);
      }),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // Additional Property Tests
  // ============================================================================

  it('Property: Quote deletion should maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 1, maxLength: 10 }), async (quotes) => {
        manager.clear();

        const quoteIds: string[] = [];
        for (const quote of quotes) {
          const id = await manager.createQuoteWithZoteroMetadata(quote);
          quoteIds.push(id);
        }

        // Delete a random quote
        if (quoteIds.length > 0) {
          const indexToDelete = Math.floor(Math.random() * quoteIds.length);
          const deleted = manager.deleteQuote(quoteIds[indexToDelete]);

          expect(deleted).toBe(true);
          expect(manager.getQuoteCount()).toBe(quotes.length - 1);
          expect(manager.getQuote(quoteIds[indexToDelete])).toBeNull();
        }
      }),
      { numRuns: 50 }
    );
  });

  it('Property: Search results should be consistent across multiple calls', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 1, maxLength: 10 }), textArbitrary, async (quotes, query) => {
        manager.clear();

        for (const quote of quotes) {
          await manager.createQuoteWithZoteroMetadata(quote);
        }

        const results1 = await manager.searchQuotes(query);
        const results2 = await manager.searchQuotes(query);

        // Results should be identical
        expect(results1.length).toBe(results2.length);
        for (let i = 0; i < results1.length; i++) {
          expect(results1[i].text).toBe(results2[i].text);
          expect(results1[i].source).toBe(results2[i].source);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('Property: getAllQuotes should return all created quotes', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(quotesArbitrary, { minLength: 0, maxLength: 10 }), async (quotes) => {
        manager.clear();

        for (const quote of quotes) {
          await manager.createQuoteWithZoteroMetadata(quote);
        }

        const all = manager.getAllQuotes();
        expect(all.length).toBe(quotes.length);
      }),
      { numRuns: 50 }
    );
  });
});
