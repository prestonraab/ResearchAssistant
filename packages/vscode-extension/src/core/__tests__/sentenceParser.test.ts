import { SentenceParser } from '../sentenceParser';

describe('SentenceParser', () => {
  let parser: SentenceParser;

  beforeEach(() => {
    parser = new SentenceParser();
  });

  describe('parseSentences', () => {
    it('should parse simple sentences', () => {
      const text = 'This is the first sentence. This is the second sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is the first sentence.');
      expect(sentences[1].text).toBe('This is the second sentence.');
    });

    it('should handle multiple lines', () => {
      const text = 'First line.\nSecond line.\nThird line.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(3);
      expect(sentences[0].position).toBe(0);
      expect(sentences[1].position).toBe(1);
      expect(sentences[2].position).toBe(2);
    });

    it('should preserve original text', () => {
      const text = 'Original sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].originalText).toBe('Original sentence.');
      expect(sentences[0].text).toBe('Original sentence.');
    });

    it('should handle abbreviations', () => {
      const text = 'Dr. Smith conducted the study. The results were significant.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toContain('Dr. Smith');
    });

    it('should handle exclamation marks', () => {
      const text = 'This is important! This is also important.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is important!');
    });

    it('should handle question marks', () => {
      const text = 'Is this a question? Yes, it is.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('Is this a question?');
    });

    it('should skip empty lines', () => {
      const text = 'First sentence.\n\nSecond sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
    });

    it('should generate unique sentence IDs', () => {
      const text = 'First. Second. Third.';
      const sentences = parser.parseSentences(text, 'test-doc');

      expect(sentences[0].id).toBe('S_test-doc_0');
      expect(sentences[1].id).toBe('S_test-doc_1');
      expect(sentences[2].id).toBe('S_test-doc_2');
    });

    it('should initialize claims array', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].claims).toEqual([]);
    });

    it('should set timestamps', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].createdAt).toBeInstanceOf(Date);
      expect(sentences[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should handle ellipsis', () => {
      const text = 'This is incomplete... but continues here.';
      const sentences = parser.parseSentences(text);

      // Ellipsis is treated as sentence ending, so we get 2 sentences
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is incomplete...');
      expect(sentences[1].text).toBe('but continues here.');
    });

    it('should handle multiple sentences on one line', () => {
      const text = 'First. Second. Third.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(3);
    });

    it('should trim whitespace', () => {
      const text = '  First sentence.   Second sentence.  ';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].text).toBe('First sentence.');
      expect(sentences[1].text).toBe('Second sentence.');
    });
  });

  describe('cache management', () => {
    it('should cache parsed sentences', () => {
      const text = 'Test sentence.';
      const result1 = parser.parseSentences(text, 'cache-test');
      const result2 = parser.parseSentences(text, 'cache-test');

      expect(result1).toBe(result2); // Same reference
    });

    it('should clear specific cache', () => {
      const text = 'Test sentence.';
      parser.parseSentences(text, 'doc1');
      parser.parseSentences(text, 'doc2');

      parser.clearCache('doc1');

      expect(parser.getCacheSize()).toBe(1);
    });

    it('should clear all cache', () => {
      parser.parseSentences('Test 1.', 'doc1');
      parser.parseSentences('Test 2.', 'doc2');

      parser.clearCache();

      expect(parser.getCacheSize()).toBe(0);
    });

    it('should report cache size', () => {
      parser.parseSentences('Test 1.', 'doc1');
      parser.parseSentences('Test 2.', 'doc2');

      expect(parser.getCacheSize()).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const sentences = parser.parseSentences('');
      expect(sentences).toHaveLength(0);
    });

    it('should handle text with only whitespace', () => {
      const sentences = parser.parseSentences('   \n\n   ');
      expect(sentences).toHaveLength(0);
    });

    it('should handle single sentence without punctuation', () => {
      const sentences = parser.parseSentences('This is a sentence');
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('This is a sentence');
    });

    it('should handle very long sentences', () => {
      const longText = 'This is a very long sentence that goes on and on and on and on and on and on and on and on and on and on.';
      const sentences = parser.parseSentences(longText);

      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe(longText);
    });

    it('should handle special characters', () => {
      const text = 'Test with special chars: @#$%. Next sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
    });
  });
});
