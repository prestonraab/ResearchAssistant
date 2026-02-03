/**
 * FuzzyMatcher - Matches Zotero highlight text against extracted document text
 * 
 * This class provides fuzzy text matching capabilities for aligning Zotero PDF highlights
 * with the extension's extracted text. It handles common differences between text extraction
 * methods including whitespace variations, Unicode normalization, and hyphenation.
 * 
 * Uses TextNormalizer for consistent text normalization across the application.
 * 
 * @see Requirements 7.1, 7.3 - Zotero PDF Integration
 */

import type { FuzzyMatchResult } from '@research-assistant/core';
import { TextNormalizer } from '../services/textNormalizer';

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
   * Normalize text for comparison
   * Delegates to TextNormalizer for consistent handling of OCR artifacts
   * 
   * @param text - Raw text to normalize
   * @returns Normalized text ready for comparison
   * 
   * @see Requirements 7.1 - Text normalization for fuzzy matching
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
   * 
   * @see Requirements 7.3 - Similarity metric for fuzzy matching
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
   * @param highlightText - Text from Zotero highlight
   * @param documentText - Extracted text from document
   * @param pageNumber - Optional page number to limit search scope (not implemented in this task)
   * @returns Match result with location and confidence
   * 
   * @see Requirements 7.2, 7.4, 7.5, 7.6, 7.7 - Sliding window matching
   */
  findMatch(
    highlightText: string,
    documentText: string,
    pageNumber?: number
  ): FuzzyMatchResult {
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
        matchedText,
      };
    }

    // Sliding window approach for fuzzy matching
    const highlightLength = normalizedHighlight.length;
    
    // Window size tolerance: ±10% of highlight length
    const minWindowSize = Math.max(1, Math.floor(highlightLength * 0.9));
    const maxWindowSize = Math.ceil(highlightLength * 1.1);

    let bestMatch: {
      similarity: number;
      startIndex: number;
      endIndex: number;
    } | null = null;

    // Slide window across document text
    for (let windowSize = minWindowSize; windowSize <= maxWindowSize; windowSize++) {
      for (let i = 0; i <= normalizedDocument.length - windowSize; i++) {
        const window = normalizedDocument.substring(i, i + windowSize);
        const similarity = this.calculateSimilarity(normalizedHighlight, window);

        if (similarity >= this.threshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = {
              similarity,
              startIndex: i,
              endIndex: i + windowSize,
            };
          }

          // Early exit if we find a very high match
          if (similarity >= 0.99) {
            break;
          }
        }
      }

      // Early exit if we found a very high match
      if (bestMatch && bestMatch.similarity >= 0.99) {
        break;
      }
    }

    // Return result based on best match found
    if (bestMatch && bestMatch.similarity >= this.threshold) {
      const { startOffset, endOffset, matchedText } = this.findOriginalPosition(
        documentText,
        normalizedDocument,
        bestMatch.startIndex,
        bestMatch.endIndex - bestMatch.startIndex
      );

      return {
        matched: true,
        startOffset,
        endOffset,
        confidence: bestMatch.similarity,
        matchedText,
      };
    }

    // No match found above threshold
    return {
      matched: false,
      confidence: bestMatch?.similarity ?? 0,
    };
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
