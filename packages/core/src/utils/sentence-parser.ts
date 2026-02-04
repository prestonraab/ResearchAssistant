/**
 * SentenceParser - Parses manuscript text into sentences
 * Preserves sentence boundaries, line numbers, and handles edge cases
 */

import { splitIntoSentences, findSentenceAtPosition, Sentence } from './sentenceParserLogic.js';

export { Sentence } from './sentenceParserLogic.js';

export class SentenceParser {
  private sentenceCache: Map<string, Sentence[]> = new Map();

  /**
   * Parse manuscript text into sentences
   * Handles abbreviations, numbers, preserves formatting, and extracts claim associations from Source comments
   */
  parseSentences(text: string, manuscriptId: string = 'default'): Sentence[] {
    // Create cache key from both manuscriptId and text content
    const cacheKey = `${manuscriptId}:${text}`;
    
    // Check cache first
    const cached = this.sentenceCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Use pure logic function
    const sentences = splitIntoSentences(text, manuscriptId);
    
    // Cache the result
    this.sentenceCache.set(cacheKey, sentences);

    return sentences;
  }

  /**
   * Clear cache for a specific manuscript or all
   */
  clearCache(manuscriptId?: string): void {
    if (manuscriptId) {
      // Clear all entries that start with this manuscriptId
      for (const key of this.sentenceCache.keys()) {
        if (key.startsWith(`${manuscriptId}:`)) {
          this.sentenceCache.delete(key);
        }
      }
    } else {
      this.sentenceCache.clear();
    }
  }

  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.sentenceCache.size;
  }
}
