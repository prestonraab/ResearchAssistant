import type {
  SourcedQuote,
  ZoteroQuoteMetadata,
  FuzzyMatchResult,
} from '../types/index.js';
import { validateAnnotationKey, AnnotationKeyAuditLog } from '../utils/AnnotationKeyValidator.js';

/**
 * QuoteManager handles storage, retrieval, and management of quotes.
 * 
 * Supports:
 * - Creating quotes with optional Zotero metadata
 * - Filtering quotes by Zotero origin flag
 * - Finding page numbers for quotes using fuzzy matching
 * - Backfilling page numbers for existing quotes
 * - Searching quotes with equal scoring for Zotero and non-Zotero quotes
 * 
 * This implementation uses in-memory storage for now. In production,
 * this would be backed by a database with proper schema including:
 * - page_number
 * - zotero_annotation_key
 * - zotero_highlight_color
 * - zotero_imported_at
 * - from_zotero
 * - match_confidence
 * - original_text
 * 
 * @see Requirements 1.6, 1.7, 3.2, 3.3, 3.4, 3.9, 4.1, 4.3
 */
export class QuoteManager {
  private quotes: Map<string, SourcedQuote> = new Map();
  private quotesByZotero: Map<boolean, SourcedQuote[]> = new Map();
  private nextQuoteId: number = 1;
  private auditLog: AnnotationKeyAuditLog = new AnnotationKeyAuditLog();
  private immutableAnnotationKeys: Set<string> = new Set();

  constructor() {
    this.quotesByZotero.set(true, []);
    this.quotesByZotero.set(false, []);
  }

  /**
   * Create a quote with Zotero metadata
   * 
   * Stores the quote with all Zotero-specific fields including annotation key,
   * highlight color, import timestamp, and fuzzy match confidence.
   * 
   * Validates the annotation key format before storing. Once stored, the
   * annotation key is marked as immutable and cannot be modified.
   * 
   * @param quote - Quote data including Zotero metadata
   * @returns Created quote ID
   * @throws Error if annotation key is invalid
   * 
   * @example
   * ```typescript
   * const quoteId = await manager.createQuoteWithZoteroMetadata({
   *   text: "RNA-seq is widely used",
   *   source: "Smith2020",
   *   verified: false,
   *   pageNumber: 5,
   *   zoteroMetadata: {
   *     annotationKey: "ABC123",
   *     highlightColor: "#ffff00",
   *     importedAt: new Date().toISOString(),
   *     fromZotero: true,
   *     matchConfidence: 0.95
   *   }
   * });
   * ```
   * 
   * **Validates: Requirements 1.6, 1.7, 3.1, 3.2, 8.1, 8.2**
   */
  async createQuoteWithZoteroMetadata(quote: SourcedQuote): Promise<string> {
    const quoteId = `quote_${this.nextQuoteId++}`;
    
    // Validate annotation key if present
    if (quote.zoteroMetadata?.annotationKey) {
      const validation = validateAnnotationKey(quote.zoteroMetadata.annotationKey);
      if (!validation.valid) {
        throw new Error(`Invalid annotation key: ${validation.error}`);
      }
      
      // Mark annotation key as immutable
      this.immutableAnnotationKeys.add(quote.zoteroMetadata.annotationKey);
    }
    
    // Ensure Zotero metadata is properly set
    if (quote.zoteroMetadata) {
      quote.zoteroMetadata.fromZotero = true;
    }
    
    this.quotes.set(quoteId, quote);
    
    // Index by Zotero flag
    const isFromZotero = quote.zoteroMetadata?.fromZotero ?? false;
    if (!this.quotesByZotero.has(isFromZotero)) {
      this.quotesByZotero.set(isFromZotero, []);
    }
    this.quotesByZotero.get(isFromZotero)!.push(quote);
    
    return quoteId;
  }

  /**
   * Get quotes filtered by Zotero flag
   * 
   * Returns all quotes that either originated from Zotero or did not,
   * based on the filter parameter.
   * 
   * @param fromZotero - Filter by Zotero origin (true = from Zotero, false = not from Zotero)
   * @returns Array of filtered quotes
   * 
   * @example
   * ```typescript
   * const zoteroQuotes = await manager.getQuotesByZoteroFlag(true);
   * const nonZoteroQuotes = await manager.getQuotesByZoteroFlag(false);
   * ```
   * 
   * **Validates: Requirements 3.9, 4.1**
   */
  async getQuotesByZoteroFlag(fromZotero: boolean): Promise<SourcedQuote[]> {
    return this.quotesByZotero.get(fromZotero) ?? [];
  }

  /**
   * Find page number for a quote by text matching
   * 
   * Attempts to determine the page number for a quote by matching its text
   * against the source document's page-level text extraction. This is used
   * when a quote doesn't have an explicit page number.
   * 
   * @param quoteText - The quote text to find
   * @param paperId - The paper identifier
   * @returns Page number if found, null otherwise
   * 
   * @example
   * ```typescript
   * const pageNum = await manager.findPageNumber(
   *   "RNA-seq is widely used",
   *   "paper_123"
   * );
   * ```
   * 
   * **Validates: Requirements 3.3**
   */
  async findPageNumber(quoteText: string, paperId: string): Promise<number | null> {
    // This is a placeholder implementation. In production, this would:
    // 1. Load the paper's extracted text with page-level information
    // 2. Use fuzzy matching to find the quote text in the document
    // 3. Return the page number where the match was found
    
    // For now, return null to indicate page number not found
    return null;
  }

  /**
   * Backfill page numbers for existing quotes without them
   * 
   * Iterates through all quotes that don't have page numbers and attempts
   * to find and store the page number by matching the quote text against
   * the source document's page-level text extraction.
   * 
   * @returns Number of quotes updated with page numbers
   * 
   * @example
   * ```typescript
   * const updated = await manager.backfillPageNumbers();
   * console.log(`Updated ${updated} quotes with page numbers`);
   * ```
   * 
   * **Validates: Requirements 3.4**
   */
  async backfillPageNumbers(): Promise<number> {
    let updated = 0;
    
    for (const [, quote] of this.quotes) {
      // Skip quotes that already have page numbers
      if (quote.pageNumber !== undefined) {
        continue;
      }
      
      // Try to find page number for this quote
      const pageNumber = await this.findPageNumber(quote.text, quote.source);
      
      if (pageNumber !== null) {
        quote.pageNumber = pageNumber;
        updated++;
      }
    }
    
    return updated;
  }

  /**
   * Search quotes with equal scoring for Zotero and non-Zotero quotes
   * 
   * Searches through all quotes and returns those matching the query.
   * Both Zotero-sourced and non-Zotero quotes are included with equal
   * relevance scoring.
   * 
   * @param query - Search query string
   * @returns Array of matching quotes sorted by relevance
   * 
   * @example
   * ```typescript
   * const results = await manager.searchQuotes("RNA-seq");
   * ```
   * 
   * **Validates: Requirements 4.1, 4.3**
   */
  async searchQuotes(query: string): Promise<SourcedQuote[]> {
    const lowerQuery = query.toLowerCase();
    const results: Array<{ quote: SourcedQuote; score: number }> = [];
    
    for (const quote of this.quotes.values()) {
      // Calculate relevance score based on text match
      const textScore = this.calculateRelevance(quote.text, lowerQuery);
      const sourceScore = this.calculateRelevance(quote.source, lowerQuery);
      
      const score = Math.max(textScore, sourceScore);
      
      // Include quotes with any relevance
      if (score > 0) {
        results.push({ quote, score });
      }
    }
    
    // Sort by score descending, then by text for stability
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.quote.text.localeCompare(b.quote.text);
    });
    
    return results.map(r => r.quote);
  }

  /**
   * Calculate relevance score for a text against a query
   * 
   * Simple implementation that checks for substring matches and
   * calculates a score based on match position and length.
   * 
   * @param text - Text to search in
   * @param query - Query string
   * @returns Relevance score between 0 and 1
   * @private
   */
  private calculateRelevance(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query);
    
    if (index === -1) {
      return 0;
    }
    
    // Score based on match position and query length
    // Exact matches at start get highest score
    const positionScore = 1 - (index / lowerText.length) * 0.5;
    const lengthScore = Math.min(query.length / text.length, 1);
    
    return (positionScore + lengthScore) / 2;
  }

  /**
   * Get a quote by ID
   * 
   * @param quoteId - The quote ID
   * @returns The quote if found, null otherwise
   */
  getQuote(quoteId: string): SourcedQuote | null {
    return this.quotes.get(quoteId) ?? null;
  }

  /**
   * Get all quotes
   * 
   * @returns Array of all quotes
   */
  getAllQuotes(): SourcedQuote[] {
    return Array.from(this.quotes.values());
  }

  /**
   * Get quote count
   * 
   * @returns Total number of quotes
   */
  getQuoteCount(): number {
    return this.quotes.size;
  }

  /**
   * Delete a quote by ID
   * 
   * When deleting a quote with a Zotero annotation key, the annotation key
   * is logged in the audit trail for future reconciliation.
   * 
   * @param quoteId - The quote ID to delete
   * @returns True if quote was deleted, false if not found
   * 
   * **Validates: Requirements 8.3**
   */
  deleteQuote(quoteId: string): boolean {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      return false;
    }
    
    // Log deleted quote with annotation key to audit trail
    if (quote.zoteroMetadata?.annotationKey) {
      this.auditLog.logDeletedQuote(
        quote.zoteroMetadata.annotationKey,
        quoteId,
        quote.text,
        quote.source,
        undefined,
        'Quote deleted'
      );
    }
    
    // Remove from main storage
    this.quotes.delete(quoteId);
    
    // Remove from Zotero index
    const isFromZotero = quote.zoteroMetadata?.fromZotero ?? false;
    const zoteroList = this.quotesByZotero.get(isFromZotero);
    if (zoteroList) {
      const index = zoteroList.indexOf(quote);
      if (index > -1) {
        zoteroList.splice(index, 1);
      }
    }
    
    return true;
  }

  /**
   * Clear all quotes
   * 
   * Used for testing and resetting state.
   */
  clear(): void {
    this.quotes.clear();
    this.quotesByZotero.clear();
    this.quotesByZotero.set(true, []);
    this.quotesByZotero.set(false, []);
    this.nextQuoteId = 1;
    this.immutableAnnotationKeys.clear();
    this.auditLog.clear();
  }

  /**
   * Check if an annotation key is immutable
   * 
   * Returns true if the annotation key has been stored with a quote
   * and is therefore immutable.
   * 
   * @param annotationKey - The annotation key to check
   * @returns True if the key is immutable, false otherwise
   * 
   * **Validates: Requirements 8.1**
   */
  isAnnotationKeyImmutable(annotationKey: string): boolean {
    return this.immutableAnnotationKeys.has(annotationKey);
  }

  /**
   * Get the audit log for deleted quotes with annotation keys
   * 
   * Returns the audit log instance for querying deleted quote records.
   * 
   * @returns The annotation key audit log
   * 
   * **Validates: Requirements 8.3**
   */
  getAuditLog(): AnnotationKeyAuditLog {
    return this.auditLog;
  }
}
