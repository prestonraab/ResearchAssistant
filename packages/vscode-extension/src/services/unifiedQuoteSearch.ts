import * as fs from 'fs';
import * as path from 'path';
import { LiteratureIndexer } from './literatureIndexer';
import { TextNormalizer } from '@research-assistant/core';
import { FuzzyMatcher } from '../core/fuzzyMatcher';
import { TrigramIndex, NgramMatch } from './trigramIndex';
import { getOperationTracker } from './operationTracker';

export interface QuoteSearchResult {
  similarity: number;
  matchedText: string;
  sourceFile: string;
  startLine?: number;
  endLine?: number;
  method: 'embedding' | 'fuzzy' | 'exact' | 'trigram';
}

/**
 * Unified Quote Search Service
 * 
 * Consolidates embedding-based and fuzzy matching approaches into a single service.
 * Uses trigram index for fast pre-filtering before expensive fuzzy matching.
 * 
 * Strategy (inspired by bioinformatics BLAST and RAG hybrid search):
 * 1. Normalize query text to handle OCR artifacts
 * 2. Run embedding search (semantic matching) - fast, uses pre-computed embeddings
 * 3. Use trigram index to find candidate documents (O(1) lookup vs O(n) scan)
 * 4. Run fuzzy matching only on candidate regions (10-100x faster)
 * 5. Combine and deduplicate results, preferring exact matches
 */
export class UnifiedQuoteSearch {
  private extractedTextPath: string;
  private fuzzyMatcher: FuzzyMatcher;
  private trigramIndex: TrigramIndex;
  private indexInitialized: boolean = false;

  constructor(
    private literatureIndexer: LiteratureIndexer,
    workspaceRoot: string,
    extractedTextPath: string = 'literature/ExtractedText'
  ) {
    this.extractedTextPath = path.join(workspaceRoot, extractedTextPath);
    this.fuzzyMatcher = new FuzzyMatcher(0.7); // Use 0.7 threshold for search results
    this.trigramIndex = new TrigramIndex(this.extractedTextPath);
  }

  /**
   * Initialize the trigram index (call once at startup or lazily)
   */
  async initializeIndex(): Promise<void> {
    if (this.indexInitialized) return;
    
    console.log('[UnifiedQuoteSearch] Initializing trigram index...');
    const stats = await this.trigramIndex.buildIndex();
    console.log(`[UnifiedQuoteSearch] Ngram index ready: ${stats.indexed} docs, ${stats.ngrams} ngrams`);
    this.indexInitialized = true;
  }

  /**
   * Search for a quote using unified strategy
   * @param quoteText The quote to search for
   * @param topK Number of results to return
   * @param signal Optional AbortSignal for cancellation
   * @returns Array of search results sorted by similarity (highest first)
   */
  async search(quoteText: string, topK: number = 5, signal?: AbortSignal): Promise<QuoteSearchResult[]> {
    const tracker = getOperationTracker();
    const operationId = `search-${Date.now()}`;
    tracker.startOperation('UnifiedQuoteSearch', operationId, `Searching for: "${quoteText.substring(0, 30)}..."`);
    
    try {
      // Check cancellation early
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      
      // Normalize query for better matching
      const normalizedQuery = TextNormalizer.normalizeForEmbedding(quoteText);

      // Run embedding search first (faster)
      const embeddingResults = await this.searchByEmbedding(normalizedQuery, topK);
      
      // Check cancellation after embedding search
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      
      // If we found a very high confidence match (>= 0.95), skip expensive fuzzy search
      if (embeddingResults.length > 0 && embeddingResults[0].similarity >= 0.95) {
        console.log('[UnifiedQuoteSearch] High confidence embedding match found, skipping fuzzy search');
        tracker.endOperation('UnifiedQuoteSearch', operationId);
        return embeddingResults;
      }
      
      // Yield to event loop before fuzzy search
      await new Promise(resolve => setImmediate(resolve));
      
      // Check cancellation before fuzzy search
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      
      // Run fuzzy search (slower, more thorough)
      const fuzzyResults = await this.searchByFuzzyMatching(quoteText, topK, signal);

      // Combine results with deduplication
      const results = this.combineResults(embeddingResults, fuzzyResults, topK);
      tracker.endOperation('UnifiedQuoteSearch', operationId);
      return results;
    } catch (error) {
      tracker.endOperation('UnifiedQuoteSearch', operationId);
      throw error;
    }
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
   * Search using fuzzy matching with trigram pre-filtering
   * 
   * Uses trigram index to find candidate documents first (O(1) lookup),
   * then runs expensive fuzzy matching only on candidate regions.
   * This is inspired by BLAST's seed-and-extend approach in bioinformatics.
   * 
   * Speedup: 10-100x compared to scanning all files
   */
  private async searchByFuzzyMatching(quote: string, topK: number, signal?: AbortSignal): Promise<QuoteSearchResult[]> {
    // Check cancellation early
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }
    
    // Ensure trigram index is built
    await this.initializeIndex();
    
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }
    
    // Use trigram index to find candidate documents
    // Require 30% of query's rare trigrams to be present
    const candidates = await this.trigramIndex.findCandidates(quote, 0.3);
    
    if (candidates.length === 0) {
      console.log('[UnifiedQuoteSearch] No trigram candidates found, falling back to top files');
      // Fall back to checking a few files if no trigram matches
      return this.searchByFuzzyMatchingFallback(quote, topK, 5, signal);
    }

    console.log(`[UnifiedQuoteSearch] Trigram pre-filter: ${candidates.length} candidate docs (vs scanning all files)`);

    const results: QuoteSearchResult[] = [];
    let candidatesProcessed = 0;

    // Only process top candidates (sorted by trigram overlap)
    const maxCandidates = Math.min(candidates.length, 10);
    
    for (const candidate of candidates.slice(0, maxCandidates)) {
      // Check cancellation before each candidate
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      
      try {
        // Get document content from trigram index cache
        const content = this.trigramIndex.getDocumentContent(candidate.fileName);
        if (!content) continue;
        
        const lines = content.split('\n');

        // If we have candidate regions, search within them first
        if (candidate.candidateRegions.length > 0) {
          for (const region of candidate.candidateRegions) {
            const regionText = region.text;
            // Use async version to yield to event loop for large regions
            const matchResult = await this.fuzzyMatcher.findMatchAsync(quote, regionText);

            if (matchResult.matched && matchResult.confidence !== undefined) {
              // Adjust line numbers to absolute positions
              const relativeLines = regionText.split('\n');
              const { startLine: relStart, endLine: relEnd } = this.findLineNumbers(
                matchResult.startOffset || 0,
                matchResult.endOffset || 0,
                relativeLines
              );

              results.push({
                sourceFile: candidate.fileName,
                similarity: matchResult.confidence,
                matchedText: matchResult.matchedText || quote,
                startLine: region.startLine + relStart - 1,
                endLine: region.startLine + relEnd - 1,
                method: matchResult.confidence === 1.0 ? 'exact' : 'trigram'
              });

              // Early exit if we found an exact match
              if (matchResult.confidence === 1.0) {
                console.log('[UnifiedQuoteSearch] Found exact match via trigram, stopping early');
                results.sort((a, b) => b.similarity - a.similarity);
                return results.slice(0, topK);
              }
            }
          }
        }

        // If no region matches, try full document (but this should be rare)
        if (results.filter(r => r.sourceFile === candidate.fileName).length === 0) {
          // Use async version to yield to event loop for large documents
          const matchResult = await this.fuzzyMatcher.findMatchAsync(quote, content);

          if (matchResult.matched && matchResult.confidence !== undefined) {
            const { startLine, endLine } = this.findLineNumbers(
              matchResult.startOffset || 0,
              matchResult.endOffset || 0,
              lines
            );

            results.push({
              sourceFile: candidate.fileName,
              similarity: matchResult.confidence,
              matchedText: matchResult.matchedText || quote,
              startLine,
              endLine,
              method: matchResult.confidence === 1.0 ? 'exact' : 'fuzzy'
            });

            if (matchResult.confidence === 1.0) {
              console.log('[UnifiedQuoteSearch] Found exact match, stopping early');
              break;
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        console.warn(`[UnifiedQuoteSearch] Error processing candidate ${candidate.fileName}:`, error);
      }
      
      candidatesProcessed++;
      
      // Yield every 3 candidates
      if (candidatesProcessed % 3 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * Fallback fuzzy search when trigram index has no matches
   * Only checks a limited number of files
   */
  private async searchByFuzzyMatchingFallback(quote: string, topK: number, maxFiles: number, signal?: AbortSignal): Promise<QuoteSearchResult[]> {
    if (!fs.existsSync(this.extractedTextPath)) {
      return [];
    }

    const files = fs.readdirSync(this.extractedTextPath)
      .filter(f => f.endsWith('.txt'))
      .slice(0, maxFiles);

    const results: QuoteSearchResult[] = [];

    for (const fileName of files) {
      // Check cancellation before each file
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      
      const filePath = path.join(this.extractedTextPath, fileName);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        // Use async version to yield to event loop
        const matchResult = await this.fuzzyMatcher.findMatchAsync(quote, content);

        if (matchResult.matched && matchResult.confidence !== undefined) {
          const { startLine, endLine } = this.findLineNumbers(
            matchResult.startOffset || 0,
            matchResult.endOffset || 0,
            lines
          );

          results.push({
            sourceFile: fileName,
            similarity: matchResult.confidence,
            matchedText: matchResult.matchedText || quote,
            startLine,
            endLine,
            method: matchResult.confidence === 1.0 ? 'exact' : 'fuzzy'
          });
        }
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        console.warn(`[UnifiedQuoteSearch] Fallback error for ${fileName}:`, error);
      }
      
      await new Promise(resolve => setImmediate(resolve));
    }

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

    // Add fuzzy/trigram results first (prefer exact matches)
    for (const result of fuzzyResults) {
      const key = result.sourceFile;
      const existing = resultMap.get(key);

      // Prefer exact/fuzzy/trigram matches over embeddings
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
