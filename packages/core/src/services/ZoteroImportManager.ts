import type {
  ZoteroAnnotation,
  ZoteroImportResult,
  ZoteroImportOptions,
  SourcedQuote,
  FuzzyMatchResult,
} from '../types/index.js';
import { QuoteManager } from '../managers/QuoteManager.js';

/**
 * Interface for MCP client that provides Zotero API access
 * This is implemented by the VS Code extension's MCP client
 */
export interface ZoteroMCPClient {
  /**
   * Check if Zotero is available and functional
   * @returns True if Zotero MCP client is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get annotations (highlights) from a Zotero PDF item
   * @param itemKey - The Zotero item key for the PDF
   * @returns Array of annotations
   */
  getAnnotations(itemKey: string): Promise<ZoteroAnnotation[]>;

  /**
   * Get a Zotero item by key
   * @param itemKey - The Zotero item key
   * @returns Item metadata or null if not found
   */
  getItem(itemKey: string): Promise<{ title: string; key: string } | null>;
}

/**
 * Interface for fuzzy matching service
 * Used to match Zotero highlight text against extracted document text
 */
export interface FuzzyMatcherService {
  /**
   * Find the best match for highlight text in document text
   * @param highlightText - Text from Zotero highlight
   * @param documentText - Extracted text from document
   * @param pageNumber - Optional page number to limit search scope
   * @returns Match result with location and confidence
   */
  findMatch(
    highlightText: string,
    documentText: string,
    pageNumber?: number
  ): FuzzyMatchResult;
}

/**
 * ZoteroImportManager orchestrates the import of Zotero highlights as quotes.
 *
 * Responsibilities:
 * - Check Zotero availability via MCP client
 * - Retrieve highlights from Zotero API
 * - Filter annotations by type "highlight"
 * - Extract metadata (text, page number, color, annotation key)
 * - Coordinate fuzzy matching of highlight text
 * - Create quote records with Zotero metadata
 * - Handle import errors and provide user feedback
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 6.1**
 *
 * @example
 * ```typescript
 * const manager = new ZoteroImportManager(mcpClient, fuzzyMatcher, quoteManager);
 *
 * // Check if Zotero is available
 * const available = await manager.isZoteroAvailable();
 *
 * // Import highlights from a paper
 * const result = await manager.importHighlights('paper_123', 'ABC123XYZ');
 * console.log(`Imported ${result.imported} highlights`);
 * ```
 */
export class ZoteroImportManager {
  private mcpClient: ZoteroMCPClient;
  private fuzzyMatcher: FuzzyMatcherService;
  private quoteManager: QuoteManager;

  constructor(
    mcpClient: ZoteroMCPClient,
    fuzzyMatcher: FuzzyMatcherService,
    quoteManager: QuoteManager
  ) {
    this.mcpClient = mcpClient;
    this.fuzzyMatcher = fuzzyMatcher;
    this.quoteManager = quoteManager;
  }

  /**
   * Check if Zotero is available
   *
   * Verifies that the Zotero MCP client is functional and can communicate
   * with Zotero. This is called before attempting any import operations.
   *
   * @returns True if Zotero MCP client is available and functional
   *
   * **Validates: Requirements 6.1**
   */
  async isZoteroAvailable(): Promise<boolean> {
    try {
      return await this.mcpClient.isAvailable();
    } catch (error) {
      return false;
    }
  }

  /**
   * Import all highlights from a paper's PDF attachment
   *
   * Retrieves all annotations of type "highlight" from the Zotero API for
   * the specified PDF item, then processes each highlight by:
   * 1. Extracting metadata (text, page number, color, annotation key)
   * 2. Attempting fuzzy matching against the paper's extracted text
   * 3. Creating quote records with Zotero metadata
   *
   * @param paperId - The paper identifier in the local system
   * @param itemKey - The Zotero item key for the PDF attachment
   * @param options - Optional import configuration
   * @returns Import result with counts and created quote IDs
   *
   * @throws Error if Zotero API returns an error
   *
   * **Validates: Requirements 1.1, 1.2, 1.6, 1.7, 1.8**
   *
   * @example
   * ```typescript
   * const result = await manager.importHighlights('paper_123', 'ABC123XYZ', {
   *   paperId: 'paper_123',
   *   itemKey: 'ABC123XYZ',
   *   skipExisting: true,
   *   matchThreshold: 0.85
   * });
   *
   * console.log(`Imported: ${result.imported}`);
   * console.log(`Matched: ${result.matched}`);
   * console.log(`Unmatched: ${result.unmatched}`);
   * ```
   */
  async importHighlights(
    paperId: string,
    itemKey: string,
    options?: Partial<ZoteroImportOptions>
  ): Promise<ZoteroImportResult> {
    const result: ZoteroImportResult = {
      totalHighlights: 0,
      imported: 0,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: [],
      quoteIds: [],
    };

    try {
      // Check if Zotero is available
      const available = await this.isZoteroAvailable();
      if (!available) {
        result.errors.push('Zotero is not available. Please ensure Zotero is running and the MCP client is configured.');
        return result;
      }

      // Retrieve annotations from Zotero API
      let annotations: ZoteroAnnotation[];
      try {
        annotations = await this.mcpClient.getAnnotations(itemKey);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to retrieve annotations from Zotero: ${errorMsg}`);
        return result;
      }

      // Filter annotations by type "highlight"
      const highlights = annotations.filter(ann => ann.type === 'highlight');
      result.totalHighlights = highlights.length;

      // Process each highlight
      for (const highlight of highlights) {
        try {
          const quoteId = await this.importSingleHighlight(highlight, paperId);

          if (quoteId) {
            result.imported++;
            result.quoteIds.push(quoteId);

            // Track whether this was a matched or unmatched import
            // This is determined by checking if the quote has a match confidence
            const quote = this.quoteManager.getQuote(quoteId);
            if (quote?.zoteroMetadata?.matchConfidence !== undefined && quote.zoteroMetadata.matchConfidence > 0) {
              result.matched++;
            } else if (quote?.startOffset !== undefined && quote?.endOffset !== undefined) {
              // If we have offsets but no match confidence, it's a successful match
              result.matched++;
            } else {
              result.unmatched++;
            }
          } else {
            result.skipped++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to import highlight: ${errorMsg}`);
        }
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Unexpected error during import: ${errorMsg}`);
      return result;
    }
  }

  /**
   * Import a single highlight
   *
   * Processes a single Zotero annotation by:
   * 1. Extracting metadata (text, page number, color, annotation key)
   * 2. Attempting fuzzy matching against the paper's extracted text
   * 3. Creating a quote record with Zotero metadata
   *
   * On successful fuzzy match:
   * - Creates quote with matched text and location offsets
   * - Stores both original and matched text
   * - Sets match confidence score
   *
   * On failed fuzzy match:
   * - Creates quote with original highlight text
   * - Marks with warning (no location offsets)
   * - Stores original text for reference
   *
   * @param highlight - The Zotero annotation data
   * @param paperId - The paper identifier
   * @param documentText - Optional extracted text from the paper for fuzzy matching
   * @returns Created quote ID or null if failed
   *
   * **Validates: Requirements 1.3, 1.4, 1.5**
   *
   * @example
   * ```typescript
   * const highlight: ZoteroAnnotation = {
   *   key: 'ABC123',
   *   type: 'highlight',
   *   text: 'RNA-seq is widely used',
   *   color: '#ffff00',
   *   pageNumber: 5,
   *   position: { pageIndex: 4, rects: [[100, 200, 300, 220]] },
   *   dateModified: '2024-01-15T10:30:00Z',
   *   parentItemKey: 'ITEM123'
   * };
   *
   * const quoteId = await manager.importSingleHighlight(highlight, 'paper_123');
   * ```
   */
  async importSingleHighlight(
    highlight: ZoteroAnnotation,
    paperId: string,
    documentText?: string
  ): Promise<string | null> {
    try {
      // Extract metadata from highlight
      const {
        key: annotationKey,
        text: highlightText,
        color: highlightColor,
        pageNumber,
        parentItemKey: itemKey,
        dateModified,
      } = highlight;

      // Validate required fields
      if (!annotationKey || !highlightText || !highlightColor) {
        throw new Error('Missing required highlight metadata');
      }

      // Initialize quote data with original text
      let quoteText = highlightText;
      let startOffset: number | undefined;
      let endOffset: number | undefined;
      let matchConfidence: number | undefined;
      let originalText: string | undefined;

      // Attempt fuzzy matching if document text is provided
      if (documentText) {
        const matchResult = this.fuzzyMatcher.findMatch(
          highlightText,
          documentText,
          pageNumber
        );

        if (matchResult.matched && matchResult.matchedText) {
          // Successful match: use matched text and offsets
          quoteText = matchResult.matchedText;
          startOffset = matchResult.startOffset;
          endOffset = matchResult.endOffset;
          matchConfidence = matchResult.confidence;

          // Store original text if it differs from matched text
          if (matchResult.matchedText !== highlightText) {
            originalText = highlightText;
          }
        } else {
          // Failed match: use original text but don't set offsets
          // This creates a quote with a warning (no location offsets)
          quoteText = highlightText;
          // startOffset and endOffset remain undefined to indicate unmatched
        }
      }

      // Create quote with Zotero metadata
      const quote: SourcedQuote = {
        text: quoteText,
        source: paperId,
        pageNumber,
        verified: false,
        startOffset,
        endOffset,
        zoteroMetadata: {
          annotationKey,
          highlightColor,
          importedAt: dateModified,
          fromZotero: true,
          itemKey,
          matchConfidence,
          originalText,
        },
      };

      // Create the quote
      const quoteId = await this.quoteManager.createQuoteWithZoteroMetadata(quote);

      return quoteId;
    } catch (error) {
      // Log error but don't throw - allow import to continue with other highlights
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error importing single highlight: ${errorMsg}`);
      return null;
    }
  }
}
