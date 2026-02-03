/**
 * Unit tests for FuzzyMatcher class
 * 
 * Tests the text normalization and similarity calculation functionality
 * used for matching Zotero highlights against extracted document text.
 * 
 * @see Requirements 7.1, 7.3 - Zotero PDF Integration
 */

import { FuzzyMatcher, MATCH_THRESHOLD } from '../fuzzyMatcher';

describe('FuzzyMatcher', () => {
  let matcher: FuzzyMatcher;

  beforeEach(() => {
    matcher = new FuzzyMatcher();
  });

  describe('normalizeText', () => {
    describe('whitespace handling', () => {
      test('should collapse multiple spaces to single space', () => {
        const input = 'hello    world';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });

      test('should trim leading and trailing whitespace', () => {
        const input = '   hello world   ';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });

      test('should normalize tabs to spaces', () => {
        const input = 'hello\tworld';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });

      test('should collapse mixed whitespace characters', () => {
        const input = 'hello  \t  \t  world';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });
    });

    describe('line break handling', () => {
      test('should convert Unix line breaks to spaces', () => {
        const input = 'hello\nworld';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });

      test('should convert Windows line breaks to spaces', () => {
        const input = 'hello\r\nworld';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });

      test('should convert old Mac line breaks to spaces', () => {
        const input = 'hello\rworld';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });

      test('should handle multiple consecutive line breaks', () => {
        const input = 'hello\n\n\nworld';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hello world');
      });
    });

    describe('Unicode normalization', () => {
      test('should normalize composed and decomposed characters to same form', () => {
        // é as single codepoint (U+00E9)
        const composed = 'caf\u00E9';
        // é as e + combining acute accent (U+0065 U+0301)
        const decomposed = 'cafe\u0301';
        
        const normalizedComposed = matcher.normalizeText(composed);
        const normalizedDecomposed = matcher.normalizeText(decomposed);
        
        expect(normalizedComposed).toBe(normalizedDecomposed);
      });

      test('should handle various accented characters', () => {
        const input = 'naïve résumé';
        const result = matcher.normalizeText(input);
        expect(result).toBe('naïve résumé');
      });
    });

    describe('hyphenation handling', () => {
      test('should remove soft hyphens', () => {
        // Soft hyphen is U+00AD
        const input = 'hyphen\u00ADated';
        const result = matcher.normalizeText(input);
        expect(result).toBe('hyphenated');
      });

      test('should normalize en dash to hyphen-minus', () => {
        // En dash is U+2013
        const input = 'pages 1\u20135';
        const result = matcher.normalizeText(input);
        expect(result).toBe('pages 1-5');
      });

      test('should normalize em dash to hyphen-minus', () => {
        // Em dash is U+2014
        const input = 'word\u2014another';
        const result = matcher.normalizeText(input);
        expect(result).toBe('word-another');
      });

      test('should normalize Unicode hyphen to hyphen-minus', () => {
        // Unicode hyphen is U+2010
        const input = 'self\u2010aware';
        const result = matcher.normalizeText(input);
        expect(result).toBe('self-aware');
      });

      test('should normalize minus sign to hyphen-minus', () => {
        // Minus sign is U+2212
        const input = '5\u22123';
        const result = matcher.normalizeText(input);
        expect(result).toBe('5-3');
      });
    });

    describe('edge cases', () => {
      test('should return empty string for null input', () => {
        const result = matcher.normalizeText(null as unknown as string);
        expect(result).toBe('');
      });

      test('should return empty string for undefined input', () => {
        const result = matcher.normalizeText(undefined as unknown as string);
        expect(result).toBe('');
      });

      test('should return empty string for empty input', () => {
        const result = matcher.normalizeText('');
        expect(result).toBe('');
      });

      test('should return empty string for whitespace-only input', () => {
        const result = matcher.normalizeText('   \t\n  ');
        expect(result).toBe('');
      });

      test('should handle very long text', () => {
        const input = 'word '.repeat(10000);
        const result = matcher.normalizeText(input);
        expect(result).toBe('word '.repeat(9999) + 'word');
      });
    });
  });

  describe('calculateSimilarity', () => {
    describe('identical strings', () => {
      test('should return 1.0 for identical strings', () => {
        const result = matcher.calculateSimilarity('hello world', 'hello world');
        expect(result).toBe(1.0);
      });

      test('should return 1.0 for empty strings', () => {
        const result = matcher.calculateSimilarity('', '');
        expect(result).toBe(1.0);
      });
    });

    describe('completely different strings', () => {
      test('should return 0.0 when one string is empty', () => {
        expect(matcher.calculateSimilarity('hello', '')).toBe(0.0);
        expect(matcher.calculateSimilarity('', 'hello')).toBe(0.0);
      });

      test('should return low similarity for completely different strings', () => {
        const result = matcher.calculateSimilarity('abc', 'xyz');
        expect(result).toBeLessThan(0.5);
      });
    });

    describe('similar strings', () => {
      test('should return high similarity for strings with minor differences', () => {
        // One character difference in 11 characters = ~91% similarity
        const result = matcher.calculateSimilarity('hello world', 'hello worlt');
        expect(result).toBeGreaterThan(0.9);
      });

      test('should return high similarity for strings with OCR-like errors', () => {
        // Common OCR errors: 'l' vs '1', 'O' vs '0'
        const result = matcher.calculateSimilarity('hello', 'he11o');
        expect(result).toBeGreaterThan(0.5);
      });

      test('should return high similarity for strings with extra spaces', () => {
        // After normalization, these would be identical
        // But calculateSimilarity works on raw strings
        const result = matcher.calculateSimilarity('hello world', 'hello  world');
        expect(result).toBeGreaterThan(0.9);
      });
    });

    describe('Levenshtein distance properties', () => {
      test('should be symmetric', () => {
        const sim1 = matcher.calculateSimilarity('hello', 'hallo');
        const sim2 = matcher.calculateSimilarity('hallo', 'hello');
        expect(sim1).toBe(sim2);
      });

      test('should handle single character insertion', () => {
        // 'hello' vs 'helloo' - 1 insertion in 6 chars = ~83% similarity
        const result = matcher.calculateSimilarity('hello', 'helloo');
        expect(result).toBeCloseTo(5 / 6, 2);
      });

      test('should handle single character deletion', () => {
        // 'hello' vs 'helo' - 1 deletion in 5 chars = 80% similarity
        const result = matcher.calculateSimilarity('hello', 'helo');
        expect(result).toBeCloseTo(4 / 5, 2);
      });

      test('should handle single character substitution', () => {
        // 'hello' vs 'hallo' - 1 substitution in 5 chars = 80% similarity
        const result = matcher.calculateSimilarity('hello', 'hallo');
        expect(result).toBeCloseTo(4 / 5, 2);
      });
    });

    describe('edge cases', () => {
      test('should handle null inputs', () => {
        expect(matcher.calculateSimilarity(null as unknown as string, 'hello')).toBe(0.0);
        expect(matcher.calculateSimilarity('hello', null as unknown as string)).toBe(0.0);
      });

      test('should handle undefined inputs', () => {
        expect(matcher.calculateSimilarity(undefined as unknown as string, 'hello')).toBe(0.0);
        expect(matcher.calculateSimilarity('hello', undefined as unknown as string)).toBe(0.0);
      });

      test('should handle very long strings', () => {
        const str1 = 'a'.repeat(1000);
        const str2 = 'a'.repeat(1000);
        const result = matcher.calculateSimilarity(str1, str2);
        expect(result).toBe(1.0);
      });

      test('should handle strings of very different lengths', () => {
        const result = matcher.calculateSimilarity('a', 'abcdefghij');
        // Distance is 9 (9 insertions), max length is 10
        // Similarity = 1 - 9/10 = 0.1
        expect(result).toBeCloseTo(0.1, 2);
      });
    });
  });

  describe('findMatch', () => {
    describe('exact matches', () => {
      test('should find exact match with confidence 1.0', () => {
        const highlight = 'hello world';
        const document = 'This is hello world in a document.';
        
        const result = matcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchedText).toContain('hello world');
      });

      test('should return correct offsets for exact match', () => {
        const highlight = 'world';
        const document = 'hello world';
        
        const result = matcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(true);
        expect(result.startOffset).toBeDefined();
        expect(result.endOffset).toBeDefined();
        expect(document.substring(result.startOffset!, result.endOffset!)).toBe('world');
      });
    });

    describe('fuzzy matches', () => {
      test('should find match with minor differences', () => {
        const highlight = 'hello world';
        const document = 'This is hello worlt in a document.';
        
        const result = matcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(true);
        expect(result.confidence).toBeGreaterThan(MATCH_THRESHOLD);
      });

      test('should find match despite whitespace differences', () => {
        const highlight = 'hello world';
        const document = 'This is hello  world in a document.';
        
        const result = matcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(true);
        expect(result.confidence).toBeGreaterThan(MATCH_THRESHOLD);
      });

      test('should find match despite line break differences', () => {
        const highlight = 'hello world';
        const document = 'This is hello\nworld in a document.';
        
        const result = matcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(true);
      });
    });

    describe('no match scenarios', () => {
      test('should return matched=false when no match above threshold', () => {
        const highlight = 'completely different text';
        const document = 'This document has nothing similar.';
        
        const result = matcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(false);
        expect(result.confidence).toBeLessThan(MATCH_THRESHOLD);
      });

      test('should return matched=false for empty highlight', () => {
        const result = matcher.findMatch('', 'some document text');
        
        expect(result.matched).toBe(false);
        expect(result.confidence).toBe(0);
      });

      test('should return matched=false for empty document', () => {
        const result = matcher.findMatch('some highlight', '');
        
        expect(result.matched).toBe(false);
        expect(result.confidence).toBe(0);
      });
    });

    describe('threshold behavior', () => {
      test('should use default threshold of 0.85', () => {
        const defaultMatcher = new FuzzyMatcher();
        // Create a string that would have ~84% similarity (below threshold)
        const highlight = 'abcdefghij';
        const document = 'abcdefghXX'; // 2 differences in 10 chars = 80% similarity
        
        const result = defaultMatcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(false);
      });

      test('should respect custom threshold', () => {
        const lowThresholdMatcher = new FuzzyMatcher(0.7);
        const highlight = 'abcdefghij';
        const document = 'abcdefghXX'; // 80% similarity
        
        const result = lowThresholdMatcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(true);
      });
    });

    describe('best match selection', () => {
      test('should select the best match when multiple candidates exist', () => {
        const highlight = 'hello world';
        const document = 'hello worlt is here and hello world is also here';
        
        const result = matcher.findMatch(highlight, document);
        
        expect(result.matched).toBe(true);
        expect(result.confidence).toBe(1.0); // Should find the exact match
      });
    });
  });

  describe('MATCH_THRESHOLD constant', () => {
    test('should be 0.85 (85%)', () => {
      expect(MATCH_THRESHOLD).toBe(0.85);
    });
  });
});
