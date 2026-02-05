/**
 * FuzzyMatcher - Matches Zotero highlight text against extracted document text
 * 
 * This class provides fuzzy text matching capabilities for aligning Zotero PDF highlights
 * with the extension's extracted text. It handles common differences between text extraction
 * methods including whitespace variations, Unicode normalization, and hyphenation.
 * 
 * Uses TextNormalizer for consistent text normalization across the application.
 */

import { TextNormalizer } from './text-normalizer.js';

export interface FuzzyMatchResult {
  matched: boolean;
  startOffset?: number;
  endOffset?: number;
  confidence: number;
  matchedText?: string;
}

/**
 * Minimum similarity threshold for accepting a match (85%)
 * Matches below this threshold are considered unmatched
 */
export const MATCH_THRESHOLD = 0.85;

/**
 * FuzzyMatcher class for matching Zotero highlights to extracted document text
 * 
 * Responsibilities:
 * - Use TextNormalizer for consistent text normalization
 * - Find best matching substring using sliding window
 * - Calculate similarity scores using Levenshtein distance
 * - Return match location and confidence
 */
export class FuzzyMatcher {
  private readonly threshold: number;

  /**
   * Create a new FuzzyMatcher instance
   * @param threshold - Minimum similarity threshold for accepting matches (default: 0.85)
   */
  constructor(threshold: number = MATCH_THRESHOLD) {
    this.threshold = threshold;
  }

  /**
   * Check if text looks like a malformed table or non-quote content
   * Returns true if the text should be filtered out
   */
  private isTableOrNoise(text: string): boolean {
    // Count pipe characters (table separators)
    const pipeCount = (text.match(/\|/g) || []).length;
    
    // If more than 10 pipes, it's likely a table
    if (pipeCount > 10) {
      return true;
    }
    
    // Check ratio of pipes to text length
    if (pipeCount > 0 && pipeCount / text.length > 0.02) {
      return true;
    }
    
    // Check for table header patterns
    if (/\|\s*[-:]+\s*\|/.test(text)) {
      return true;
    }
    
    return false;
  }

  /**
   * Clean extracted text by removing markdown tables and excessive formatting
   * Keeps the core text readable while removing noise
   */
  private cleanExtractedText(text: string): string {
    // Remove markdown table rows (lines with | separators)
    let cleaned = text.replace(/^\s*\|[\s\S]*?\|\s*$/gm, '');
    
    // Remove excessive whitespace and newlines
    cleaned = cleaned.replace(/\n\s*\n+/g, '\n');
    
    // Trim to reasonable length (max 500 chars for display)
    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 500).trim() + '...';
    }
    
    return cleaned.trim();
  }

  /**
   * Normalize text for comparison
   * Delegates to TextNormalizer for consistent handling of OCR artifacts
   * 
   * @param text - Raw text to normalize
   * @returns Normalized text ready for comparison
   */
  normalizeText(text: string): string {
    return TextNormalizer.normalizeForMatching(text);
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   * 
   * The similarity score is calculated as:
   * 1 - (levenshteinDistance / maxLength)
   * 
   * This produces a value between 0 and 1, where:
   * - 1.0 = identical strings
   * - 0.0 = completely different strings (edit distance equals max length)
   * 
   * The algorithm accounts for:
   * - Minor OCR differences (single character substitutions)
   * - Hyphenation variations (insertions/deletions)
   * - Line break differences (handled by normalization)
   * 
   * @param str1 - First string to compare
   * @param str2 - Second string to compare
   * @returns Similarity score between 0 and 1
   */
  calculateSimilarity(str1: string, str2: string): number {
    return TextNormalizer.calculateSimilarity(str1, str2);
  }

  /**
   * Find the best match for highlight text in document text
   * 
   * Uses a sliding window approach to find the substring in documentText
   * that best matches the highlightText. The window size is based on the
   * highlight text length with a tolerance of ±10%.
   * 
   * OPTIMIZED: Uses n-gram pre-filtering for large documents to avoid O(D*Q²) complexity
   * 
   * @param highlightText - Text from Zotero highlight
   * @param documentText - Extracted text from document
   * @param pageNumber - Optional page number to limit search scope (not implemented in this task)
   * @returns Match result with location and confidence
   */
  findMatch(
    highlightText: string,
    documentText: string,
    pageNumber?: number
  ): FuzzyMatchResult {
    // Filter out table-like input that shouldn't be matched
    if (this.isTableOrNoise(highlightText)) {
      return {
        matched: false,
        confidence: 0,
      };
    }

    // Normalize both texts for comparison
    const normalizedHighlight = this.normalizeText(highlightText);
    const normalizedDocument = this.normalizeText(documentText);

    // Handle edge cases
    if (!normalizedHighlight || !normalizedDocument) {
      return {
        matched: false,
        confidence: 0,
      };
    }

    // Check for exact match first (optimization)
    const exactIndex = normalizedDocument.indexOf(normalizedHighlight);
    if (exactIndex !== -1) {
      // Find the corresponding position in the original document text
      const { startOffset, endOffset, matchedText } = this.findOriginalPosition(
        documentText,
        normalizedDocument,
        exactIndex,
        normalizedHighlight.length
      );

      return {
        matched: true,
        startOffset,
        endOffset,
        confidence: 1.0,
        matchedText: this.cleanExtractedText(matchedText),
      };
    }

    // For large documents, use fast n-gram based search
    if (normalizedDocument.length > 3000) {
      return this.findMatchFast(normalizedHighlight, normalizedDocument, documentText);
    }

    // For small documents, use original sliding window (still fast enough)
    return this.findMatchSlidingWindow(normalizedHighlight, normalizedDocument, documentText);
  }

  /**
   * Fast approximate matching using n-gram overlap
   * O(D + Q) instead of O(D * Q²) - much faster for large documents
   */
  private findMatchFast(
    normalizedHighlight: string,
    normalizedDocument: string,
    originalDocument: string
  ): FuzzyMatchResult {
    const NGRAM_SIZE = 4;
    const highlightNgrams = new Set<string>();
    
    // Extract n-grams from highlight
    for (let i = 0; i <= normalizedHighlight.length - NGRAM_SIZE; i++) {
      highlightNgrams.add(normalizedHighlight.substring(i, i + NGRAM_SIZE));
    }
    
    if (highlightNgrams.size === 0) {
      return { matched: false, confidence: 0 };
    }

    // Find candidate regions using n-gram density
    const windowSize = normalizedHighlight.length;
    const regionScores: Array<{ start: number; score: number }> = [];
    
    // Slide a window and count n-gram matches
    const STEP = Math.max(1, Math.floor(windowSize / 4)); // Check every quarter window
    
    for (let i = 0; i <= normalizedDocument.length - windowSize; i += STEP) {
      let matchCount = 0;
      const end = Math.min(i + windowSize, normalizedDocument.length);
      
      for (let j = i; j <= end - NGRAM_SIZE; j++) {
        if (highlightNgrams.has(normalizedDocument.substring(j, j + NGRAM_SIZE))) {
          matchCount++;
        }
      }
      
      const score = matchCount / highlightNgrams.size;
      if (score >= 0.3) { // At least 30% n-gram overlap
        regionScores.push({ start: i, score });
      }
    }

    // Sort by score and check top candidates with full Levenshtein
    regionScores.sort((a, b) => b.score - a.score);
    
    let bestMatch: { similarity: number; startIndex: number; endIndex: number } | null = null;
    
    // Only check top 10 candidates
    for (const region of regionScores.slice(0, 10)) {
      // Check a range around the candidate position
      const searchStart = Math.max(0, region.start - Math.floor(windowSize * 0.1));
      const searchEnd = Math.min(normalizedDocument.length, region.start + Math.ceil(windowSize * 1.2));
      
      // Try a few window sizes
      for (const ws of [windowSize, Math.floor(windowSize * 0.95), Math.ceil(windowSize * 1.05)]) {
        for (let pos = searchStart; pos <= searchEnd - ws; pos += Math.max(1, Math.floor(ws / 10))) {
          const window = normalizedDocument.substring(pos, pos + ws);
          const similarity = this.calculateSimilarity(normalizedHighlight, window);
          
          if (similarity >= this.threshold && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { similarity, startIndex: pos, endIndex: pos + ws };
            
            if (similarity >= 0.99) {
              // Found excellent match, stop searching
              const { startOffset, endOffset, matchedText } = this.findOriginalPosition(
                originalDocument, normalizedDocument, bestMatch.startIndex, 
                bestMatch.endIndex - bestMatch.startIndex
              );
              return { matched: true, startOffset, endOffset, confidence: similarity, matchedText: this.cleanExtractedText(matchedText) };
            }
          }
        }
      }
    }

    if (bestMatch && bestMatch.similarity >= this.threshold) {
      const { startOffset, endOffset, matchedText } = this.findOriginalPosition(
        originalDocument, normalizedDocument, bestMatch.startIndex,
        bestMatch.endIndex - bestMatch.startIndex
      );
      return { matched: true, startOffset, endOffset, confidence: bestMatch.similarity, matchedText: this.cleanExtractedText(matchedText) };
    }

    return { matched: false, confidence: bestMatch?.similarity ?? 0 };
  }

  /**
   * Original sliding window approach - used for small documents
   */
  private findMatchSlidingWindow(
    normalizedHighlight: string,
    normalizedDocument: string,
    originalDocument: string
  ): FuzzyMatchResult {
    const highlightLength = normalizedHighlight.length;
    const minWindowSize = Math.max(1, Math.floor(highlightLength * 0.9));
    const maxWindowSize = Math.ceil(highlightLength * 1.1);

    let bestMatch: { similarity: number; startIndex: number; endIndex: number } | null = null;

    for (let windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize++) {
      for (let i = 0; i <= normalizedDocument.length - windowSize; i++) {
        const window = normalizedDocument.substring(i, i + windowSize);
        const similarity = this.calculateSimilarity(normalizedHighlight, window);

        if (similarity >= this.threshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { similarity, startIndex: i, endIndex: i + windowSize };
          }
          if (similarity >= 0.99) break;
        }
      }
      if (bestMatch && bestMatch.similarity >= 0.99) break;
    }

    if (bestMatch && bestMatch.similarity >= this.threshold) {
      const { startOffset, endOffset, matchedText } = this.findOriginalPosition(
        originalDocument, normalizedDocument, bestMatch.startIndex,
        bestMatch.endIndex - bestMatch.startIndex
      );
      return { matched: true, startOffset, endOffset, confidence: bestMatch.similarity, matchedText: this.cleanExtractedText(matchedText) };
    }

    return { matched: false, confidence: bestMatch?.similarity ?? 0 };
  }

  /**
   * Async version of findMatch - delegates to sync version since it's now fast enough
   * Kept for backward compatibility with vscode-extension
   */
  async findMatchAsync(
    highlightText: string,
    documentText: string,
    pageNumber?: number
  ): Promise<FuzzyMatchResult> {
    return this.findMatch(highlightText, documentText, pageNumber);
  }

  /**
   * Find the position in the original document text corresponding to a position
   * in the normalized text
   * 
   * This is necessary because normalization changes the text length and positions.
   * We need to map back to the original text to provide accurate offsets.
   * 
   * @param originalText - The original document text
   * @param normalizedText - The normalized document text
   * @param normalizedStart - Start position in normalized text
   * @param normalizedLength - Length in normalized text
   * @returns Object with startOffset, endOffset, and matchedText from original
   */
  private findOriginalPosition(
    originalText: string,
    normalizedText: string,
    normalizedStart: number,
    normalizedLength: number
  ): { startOffset: number; endOffset: number; matchedText: string } {
    // Build a mapping from normalized positions to original positions
    // We track the normalized position as we iterate through the original text
    
    let normalizedPos = 0;
    let originalStart = -1;
    let originalEnd = originalText.length;
    let lastNonWhitespaceOriginalPos = 0;
    let prevWasWhitespace = true; // Start as true to handle leading whitespace

    for (let i = 0; i < originalText.length; i++) {
      const char = originalText[i];
      
      // Determine what this character becomes after normalization
      // Check if it's a character that gets removed (soft hyphen)
      if (char === '\u00AD') {
        continue; // Soft hyphen is removed
      }
      
      // Check if it's whitespace (space, tab, newline, etc.)
      const isWhitespace = /\s/.test(char);
      
      if (isWhitespace) {
        // Whitespace is collapsed - only count it if previous wasn't whitespace
        if (!prevWasWhitespace && normalizedPos > 0) {
          // This whitespace contributes a single space to normalized text
          if (normalizedPos === normalizedStart) {
            originalStart = i;
          }
          normalizedPos++;
          if (normalizedPos === normalizedStart + normalizedLength) {
            originalEnd = i + 1;
            break;
          }
        }
        prevWasWhitespace = true;
      } else {
        // Non-whitespace character
        // Check if we've reached the start position
        if (originalStart === -1 && normalizedPos === normalizedStart) {
          originalStart = i;
        }
        
        normalizedPos++;
        lastNonWhitespaceOriginalPos = i + 1;
        
        // Check if we've reached the end position
        if (normalizedPos === normalizedStart + normalizedLength) {
          originalEnd = i + 1;
          break;
        }
        
        prevWasWhitespace = false;
      }
    }

    // Handle case where start wasn't found (shouldn't happen with valid input)
    if (originalStart === -1) {
      originalStart = 0;
    }

    // Extract the matched text from the original
    const matchedText = originalText.substring(originalStart, originalEnd);

    return {
      startOffset: originalStart,
      endOffset: originalEnd,
      matchedText,
    };
  }
}
