/**
 * SentenceParser - Parses manuscript text into sentences
 * Preserves sentence boundaries, line numbers, and handles edge cases
 */

export interface Sentence {
  id: string;
  text: string;
  originalText: string;
  position: number; // Line number in manuscript
  outlineSection?: string;
  claims: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SentenceParser {
  private sentenceCache: Map<string, Sentence[]> = new Map();

  /**
   * Parse manuscript text into sentences
   * Handles abbreviations, numbers, and preserves formatting
   */
  parseSentences(text: string, manuscriptId: string = 'default'): Sentence[] {
    // Check cache first
    if (this.sentenceCache.has(manuscriptId)) {
      return this.sentenceCache.get(manuscriptId)!;
    }

    const sentences: Sentence[] = [];
    const lines = text.split('\n');

    let currentSentence = '';
    let lineNumber = 0;
    let sentenceIndex = 0;

    // Common abbreviations to avoid splitting on
    const abbreviations = new Set([
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
      'Inc', 'Ltd', 'Co', 'Corp', 'Dept',
      'e.g', 'i.e', 'etc', 'vs', 'vol', 'pp',
      'Fig', 'Eq', 'Ref', 'No', 'St', 'Ave', 'Blvd'
    ]);

    for (const line of lines) {
      if (line.trim().length === 0) {
        lineNumber++;
        continue;
      }

      // Split by sentence-ending punctuation, but preserve abbreviations
      const parts = this.splitBySentenceEnding(line, abbreviations);

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();

        if (part.length === 0) {
          continue;
        }

        currentSentence += (currentSentence ? ' ' : '') + part;

        // Check if this part ends with sentence-ending punctuation
        if (this.endsWithSentencePunctuation(part)) {
          const sentenceText = currentSentence.trim();

          if (sentenceText.length > 0) {
            const sentence: Sentence = {
              id: `S_${manuscriptId}_${sentenceIndex}`,
              text: sentenceText,
              originalText: sentenceText,
              position: lineNumber,
              claims: [],
              createdAt: new Date(),
              updatedAt: new Date()
            };

            sentences.push(sentence);
            sentenceIndex++;
            currentSentence = '';
          }
        }
      }

      lineNumber++;
    }

    // Add any remaining text as final sentence
    if (currentSentence.trim().length > 0) {
      const sentenceText = currentSentence.trim();
      const sentence: Sentence = {
        id: `S_${manuscriptId}_${sentenceIndex}`,
        text: sentenceText,
        originalText: sentenceText,
        position: lineNumber,
        claims: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      sentences.push(sentence);
    }

    // Cache the result
    this.sentenceCache.set(manuscriptId, sentences);

    return sentences;
  }

  /**
   * Split text by sentence-ending punctuation
   * Respects abbreviations and common patterns
   */
  private splitBySentenceEnding(text: string, abbreviations: Set<string>): string[] {
    const parts: string[] = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      current += char;

      // Check for sentence-ending punctuation
      if (char === '.' || char === '!' || char === '?') {
        // Check for ellipsis (three dots)
        if (char === '.' && text[i + 1] === '.' && text[i + 2] === '.') {
          current += text[i + 1] + text[i + 2];
          i += 2; // Skip the next two dots
          parts.push(current);
          current = '';
          continue;
        }

        // Look ahead for abbreviations
        const beforePunct = current.slice(0, -1).trim();
        const lastWord = beforePunct.split(/\s+/).pop() || '';

        // Check if this is an abbreviation
        if (char === '.' && abbreviations.has(lastWord)) {
          continue; // Don't split on abbreviation
        }

        // Valid sentence ending
        parts.push(current);
        current = '';
      }
    }

    if (current.length > 0) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Check if text ends with sentence-ending punctuation
   */
  private endsWithSentencePunctuation(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?');
  }

  /**
   * Clear cache for a specific manuscript or all
   */
  clearCache(manuscriptId?: string): void {
    if (manuscriptId) {
      this.sentenceCache.delete(manuscriptId);
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
