import { LiteratureIndexer } from './literatureIndexer';
import { FuzzyQuoteMatcher } from './fuzzyQuoteMatcher';

export interface QuoteSearchResult {
  similarity: number;
  matchedText: string;
  sourceFile: string;
  startLine?: number;
  endLine?: number;
}

/**
 * HybridQuoteSearch - Combines embedding and fuzzy matching for optimal quote finding
 * 
 * Strategy:
 * 1. Run both embedding search (semantic) and fuzzy matching (exact/near-exact) in parallel
 * 2. Compare results and return whichever has higher similarity
 * 3. This ensures exact matches are found even when embeddings return semantic matches from wrong papers
 */
export class HybridQuoteSearch {
  constructor(
    private literatureIndexer: LiteratureIndexer,
    private fuzzyQuoteMatcher: FuzzyQuoteMatcher
  ) {}

  /**
   * Search for a quote using hybrid strategy
   * @param quoteText The quote to search for
   * @param topK Number of results to return
   * @returns Array of search results sorted by similarity (highest first)
   */
  async search(quoteText: string, topK: number = 5): Promise<QuoteSearchResult[]> {
    // Run embedding search
    const snippets = await this.literatureIndexer.searchSnippetsWithSimilarity(quoteText, topK);
    
    let embeddingResults: QuoteSearchResult[] = [];
    if (snippets && snippets.length > 0) {
      embeddingResults = snippets
        .filter(snippet => snippet.similarity >= 0.7)
        .map(snippet => ({
          similarity: snippet.similarity,
          matchedText: snippet.text,
          sourceFile: snippet.fileName,
          startLine: snippet.startLine,
          endLine: snippet.endLine
        }));
    }
    
    // ALWAYS run fuzzy matching - may find better exact matches
    const fuzzyResults = await this.fuzzyQuoteMatcher.searchQuote(quoteText, topK);
    
    let fuzzyAlternatives: QuoteSearchResult[] = [];
    if (fuzzyResults.length > 0) {
      fuzzyAlternatives = fuzzyResults.map(result => ({
        similarity: result.similarity,
        matchedText: result.matchedText,
        sourceFile: result.fileName,
        startLine: result.startLine,
        endLine: result.endLine
      }));
    }
    
    // Combine and sort by similarity
    const allResults = [...embeddingResults, ...fuzzyAlternatives];
    
    // Deduplicate by sourceFile and keep highest similarity
    const deduped = new Map<string, QuoteSearchResult>();
    for (const result of allResults) {
      const key = result.sourceFile;
      const existing = deduped.get(key);
      if (!existing || result.similarity > existing.similarity) {
        deduped.set(key, result);
      }
    }
    
    // Sort by similarity descending and return top K
    return Array.from(deduped.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Find the best match for a quote
   * @param quoteText The quote to search for
   * @returns The best matching result or null if no match found
   */
  async findBestMatch(quoteText: string): Promise<QuoteSearchResult | null> {
    const results = await this.search(quoteText, 5);
    return results.length > 0 ? results[0] : null;
  }
}
