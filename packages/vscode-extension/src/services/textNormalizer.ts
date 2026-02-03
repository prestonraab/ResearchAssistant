/**
 * Text normalization service for handling OCR artifacts and improving embedding quality
 * Addresses issues with improper OCR: excessive spaces, hyphens, and formatting artifacts
 */
export class TextNormalizer {
  /**
   * Normalize text for embedding
   * Handles OCR artifacts while preserving semantic meaning
   */
  static normalizeForEmbedding(text: string): string {
    return this.normalize(text, { aggressive: true });
  }

  /**
   * Normalize text for fuzzy matching
   * More aggressive normalization for exact/near-exact matching
   * Preserves hyphens for matching hyphenated words and number ranges
   */
  static normalizeForMatching(text: string): string {
    return this.normalize(text, { aggressive: true });
  }

  /**
   * Normalize text for display
   * Preserves more formatting while cleaning up obvious artifacts
   */
  static normalizeForDisplay(text: string): string {
    return this.normalize(text, { aggressive: false });
  }

  /**
   * Core normalization logic
   */
  private static normalize(
    text: string,
    options: { aggressive?: boolean; removeSpecialChars?: boolean } = {}
  ): string {
    const { aggressive = false, removeSpecialChars = false } = options;

    // Handle null/undefined inputs
    if (!text) {
      return '';
    }

    let normalized = text;

    // 0. Normalize Unicode (NFC form) to handle composed/decomposed characters
    normalized = normalized.normalize('NFC');

    // 1. Normalize special dash/hyphen characters to hyphen-minus first
    normalized = normalized.replace(/[\u2013\u2014\u2010\u2212]/g, '-'); // en dash, em dash, unicode hyphen, minus sign

    // 2. Fix common OCR artifacts
    normalized = this.fixOCRArtifacts(normalized);

    // 3. Normalize whitespace
    normalized = this.normalizeWhitespace(normalized);

    // 4. Handle hyphenation issues
    normalized = this.fixHyphenation(normalized);

    // 5. Normalize quotes and apostrophes
    normalized = this.normalizeQuotes(normalized);

    // 6. Remove or normalize special characters
    if (removeSpecialChars) {
      normalized = this.removeSpecialCharacters(normalized);
    } else if (aggressive) {
      normalized = this.normalizeSpecialCharacters(normalized);
    }

    // 7. Lowercase for consistency
    normalized = normalized.toLowerCase();

    // 8. Final whitespace cleanup
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Fix common OCR artifacts
   * - Double spaces and tabs
   * - Line breaks in middle of words
   * - Common OCR misreadings (0 vs O, 1 vs l, etc.)
   * - Excessive hyphens and dashes
   * - Soft hyphens
   * - Excessive spaces and line breaks (major OCR issue)
   */
  private static fixOCRArtifacts(text: string): string {
    let fixed = text;

    // Remove soft hyphens (U+00AD) - they're invisible and cause issues
    fixed = fixed.replace(/\u00AD/g, '');

    // Fix line breaks that split words (hyphens at end of line)
    fixed = fixed.replace(/(\w)-\n(\w)/g, '$1$2');
    fixed = fixed.replace(/(\w)-\r\n(\w)/g, '$1$2');

    // Fix common OCR character misreadings in specific contexts
    // Be conservative - only fix obvious cases
    fixed = fixed.replace(/\b0([A-Z])/g, 'O$1'); // 0 at start of word followed by letter
    fixed = fixed.replace(/([A-Z])0\b/g, '$1O'); // 0 at end of word preceded by letter

    // Fix excessive spaces (multiple spaces/tabs) - MAJOR OCR ISSUE
    // This is one of the most common OCR problems
    fixed = fixed.replace(/[ \t]{2,}/g, ' ');

    // Fix excessive line breaks
    fixed = fixed.replace(/\n\n\n+/g, '\n\n');

    // Fix excessive hyphens (OCR often produces multiple hyphens)
    fixed = fixed.replace(/-{2,}/g, '-');

    // Fix spaces around hyphens that should be removed
    // Pattern: word - word (with spaces) should become word-word
    fixed = fixed.replace(/(\w)\s+-\s+(\w)/g, '$1-$2');

    return fixed;
  }

  /**
   * Normalize whitespace
   */
  private static normalizeWhitespace(text: string): string {
    // Convert tabs to spaces
    let normalized = text.replace(/\t/g, ' ');

    // Normalize line endings
    normalized = normalized.replace(/\r\n/g, '\n');
    normalized = normalized.replace(/\r/g, '\n');

    // Remove spaces before punctuation
    normalized = normalized.replace(/\s+([.,!?;:])/g, '$1');

    // Ensure space after punctuation
    normalized = normalized.replace(/([.,!?;:])([^\s])/g, '$1 $2');

    return normalized;
  }

  /**
   * Fix hyphenation issues
   * - Remove hyphens that are OCR artifacts (between single letters)
   * - Preserve legitimate hyphenated words and number ranges
   */
  private static fixHyphenation(text: string): string {
    let fixed = text;

    // Only remove hyphens between single letters that are clearly OCR artifacts
    // Pattern: single letter-single letter (e.g., "a-b" is likely OCR artifact)
    // But preserve longer words like "self-aware"
    fixed = fixed.replace(/\b([a-z])-([a-z])\b/g, (match, before, after) => {
      // Keep hyphen for known hyphenated words
      const hyphenatedWords = new Set([
        'well-known', 'state-of-the-art', 'high-dimensional', 'co-expression',
        'batch-corrected', 'cross-study', 'multi-study', 'non-linear', 'semi-supervised'
      ]);

      const combined = `${before}-${after}`.toLowerCase();
      if (hyphenatedWords.has(combined)) {
        return match;
      }

      // For scientific terms, preserve hyphens
      if (/^[a-z]+-[a-z]+$/.test(combined) && combined.length > 10) {
        return match;
      }

      // Otherwise, remove hyphen (likely OCR artifact)
      return `${before}${after}`;
    });

    return fixed;
  }

  /**
   * Normalize quotes and apostrophes
   */
  private static normalizeQuotes(text: string): string {
    let normalized = text;

    // Normalize various quote characters to standard ASCII
    normalized = normalized.replace(/[""]/g, '"'); // Smart quotes to straight quotes
    normalized = normalized.replace(/['']/g, "'"); // Smart apostrophes to straight apostrophes
    normalized = normalized.replace(/[`´]/g, "'"); // Backticks and accents to apostrophe

    return normalized;
  }

  /**
   * Normalize special characters (keep some, normalize others)
   * Preserves accented characters and common punctuation
   */
  private static normalizeSpecialCharacters(text: string): string {
    let normalized = text;

    // Keep hyphens, underscores, accented characters, and common punctuation
    // Replace other special characters with space
    // \p{L} matches any Unicode letter (including accented characters)
    // Using a more permissive pattern that keeps accented characters
    normalized = normalized.replace(/[^\w\s\-_.,'";:!?()[\]{}\u0080-\uFFFF]/g, ' ');

    return normalized;
  }

  /**
   * Remove special characters entirely
   */
  private static removeSpecialCharacters(text: string): string {
    // Keep only alphanumeric and spaces
    return text.replace(/[^\w\s]/g, ' ');
  }

  /**
   * Calculate similarity between two normalized texts
   * Returns score 0-1
   */
  static calculateSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalizeForMatching(text1);
    const norm2 = this.normalizeForMatching(text2);

    if (norm1 === norm2) {
      return 1.0;
    }

    // Levenshtein distance based similarity
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   * Returns score 0-1
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
