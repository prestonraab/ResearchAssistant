import * as fs from 'fs';
import * as path from 'path';
import { LiteratureIndexer } from './literatureIndexer';
import { TextNormalizer } from './textNormalizer';
import { FuzzyMatcher } from '../core/fuzzyMatcher';

export interface QuoteSearchResult {
  similarity: number;
  matchedText: string;
  sourceFile: string;
  startLine?: number;
  endLine?: number;
  method: 'embedding' | 'fuzzy' | 'exact';
}

/**
 * Unified Quote Search Service
 * 
 * Consolidates embedding-based and fuzzy matching approaches into a single service.
 * Handles OCR normalization to improve matching quality.
 * 
 * Strategy:
 * 1. Normalize query text to handle OCR artifacts
 * 2. Run embedding search (semantic matching)
 * 3. Run fuzzy matching (exact/near-exact matching)
 * 4. Combine and deduplicate results, preferring exact matches
 */
export class UnifiedQuoteSearch {
  private extractedTextPath: string;
  private fuzzyMatcher: FuzzyMatcher;

  constructor(
    private literatureIndexer: LiteratureIndexer,
    workspaceRoot: string,
    extractedTextPath: string = 'literature/ExtractedText'
  ) {
    this.extractedTextPath = path.join(workspaceRoot, extractedTextPath);
    this.fuzzyMatcher = new FuzzyMatcher(0.7); // Use 0.7 threshold for search results
  }

  /**
   * Search for a quote using unified strategy
   * @param quoteText The quote to search for
   * @param topK Number of results to return
   * @returns Array of search results sorted by similarity (highest first)
   */
  async search(quoteText: string, topK: number = 5): Promise<QuoteSearchResult[]> {
    // Normalize query for better matching
    const normalizedQuery = TextNormalizer.normalizeForEmbedding(quoteText);

    // Run both search methods in parallel
    const [embeddingResults, fuzzyResults] = await Promise.all([
      this.searchByEmbedding(normalizedQuery, topK),
      this.searchByFuzzyMatching(quoteText, topK)
    ]);

    // Combine results with deduplication
    return this.combineResults(embeddingResults, fuzzyResults, topK);
  }

  /**
   * Search using embeddings (semantic matching)
   */
  private async searchByEmbedding(query: string, topK: number): Promise<QuoteSearchResult[]> {
    try {
      const snippets = await this.literatureIndexer.searchSnippetsWithSimilarity(query, topK);

      if (!snippets || snippets.length === 0) {
        return [];
      }

      return snippets
        .filter(snippet => snippet.similarity >= 0.7)
        .map(snippet => ({
          similarity: snippet.similarity,
          matchedText: snippet.text,
          sourceFile: snippet.fileName,
          startLine: snippet.startLine,
          endLine: snippet.endLine,
          method: 'embedding' as const
        }));
    } catch (error) {
      console.warn('[UnifiedQuoteSearch] Embedding search failed:', error);
      return [];
    }
  }

  /**
   * Search using fuzzy matching (exact/near-exact matching)
   * Uses FuzzyMatcher for consistent matching logic
   */
  private async searchByFuzzyMatching(quote: string, topK: number): Promise<QuoteSearchResult[]> {
    if (!fs.existsSync(this.extractedTextPath)) {
      console.warn('[UnifiedQuoteSearch] Extracted text directory not found:', this.extractedTextPath);
      return [];
    }

    const files = fs.readdirSync(this.extractedTextPath)
      .filter(f => f.endsWith('.txt'))
      .map(f => path.join(this.extractedTextPath, f));

    const results: QuoteSearchResult[] = [];

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Use FuzzyMatcher to find the best match
        const matchResult = this.fuzzyMatcher.findMatch(quote, content);

        if (matchResult.matched && matchResult.confidence !== undefined) {
          // Find line numbers for the match
          const { startLine, endLine } = this.findLineNumbers(
            matchResult.startOffset || 0,
            matchResult.endOffset || 0,
            lines
          );

          results.push({
            sourceFile: path.basename(filePath),
            similarity: matchResult.confidence,
            matchedText: matchResult.matchedText || quote,
            startLine,
            endLine,
            method: matchResult.confidence === 1.0 ? 'exact' : 'fuzzy'
          });
        }
      } catch (error) {
        console.warn(`[UnifiedQuoteSearch] Error processing file ${filePath}:`, error);
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * Find line numbers for a character offset range
   */
  private findLineNumbers(
    startOffset: number,
    endOffset: number,
    lines: string[]
  ): { startLine: number; endLine: number } {
    let charCount = 0;
    let startLine = 0;
    let endLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline

      if (charCount <= startOffset && charCount + lineLength > startOffset) {
        startLine = i + 1;
      }
      if (charCount <= endOffset && charCount + lineLength >= endOffset) {
        endLine = i + 1;
        break;
      }

      charCount += lineLength;
    }

    return { startLine, endLine };
  }

  /**
   * Combine embedding and fuzzy results with intelligent deduplication
   */
  private combineResults(
    embeddingResults: QuoteSearchResult[],
    fuzzyResults: QuoteSearchResult[],
    topK: number
  ): QuoteSearchResult[] {
    // Create a map to track best result per source file
    const resultMap = new Map<string, QuoteSearchResult>();

    // Add fuzzy results first (prefer exact matches)
    for (const result of fuzzyResults) {
      const key = result.sourceFile;
      const existing = resultMap.get(key);

      // Prefer exact/fuzzy matches over embeddings
      if (!existing || result.method !== 'embedding') {
        resultMap.set(key, result);
      }
    }

    // Add embedding results only if no fuzzy match exists for that file
    for (const result of embeddingResults) {
      const key = result.sourceFile;
      if (!resultMap.has(key)) {
        resultMap.set(key, result);
      }
    }

    // Sort by similarity and return top K
    return Array.from(resultMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Search for a quote in a specific file (optimized for re-checking existing sources)
   */
  async searchInFile(quote: string, fileName: string): Promise<QuoteSearchResult | null> {
    const filePath = path.join(this.extractedTextPath, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn('[UnifiedQuoteSearch] File not found:', filePath);
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Use FuzzyMatcher to find the best match
      const matchResult = this.fuzzyMatcher.findMatch(quote, content);

      if (matchResult.matched && matchResult.confidence !== undefined) {
        // Find line numbers for the match
        const { startLine, endLine } = this.findLineNumbers(
          matchResult.startOffset || 0,
          matchResult.endOffset || 0,
          lines
        );

        return {
          sourceFile: path.basename(filePath),
          similarity: matchResult.confidence,
          matchedText: matchResult.matchedText || quote,
          startLine,
          endLine,
          method: matchResult.confidence === 1.0 ? 'exact' : 'fuzzy'
        };
      }

      return null;
    } catch (error) {
      console.warn(`[UnifiedQuoteSearch] Error processing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Find the best match for a quote
   */
  async findBestMatch(quoteText: string): Promise<QuoteSearchResult | null> {
    const results = await this.search(quoteText, 5);
    return results.length > 0 ? results[0] : null;
  }
}
