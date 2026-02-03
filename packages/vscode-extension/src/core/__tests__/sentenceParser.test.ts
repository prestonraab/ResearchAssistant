import { SentenceParser } from '@research-assistant/core';
import { setupTest } from '../../__tests__/helpers';

describe('SentenceParser', () => {
  setupTest();
  
  let parser: SentenceParser;

  beforeEach(() => {
    parser = new SentenceParser();
  });

  describe('parseSentences', () => {
    test('should parse simple sentences', () => {
      const text = 'This is the first sentence. This is the second sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is the first sentence.');
      expect(sentences[1].text).toBe('This is the second sentence.');
    });

    test('should handle multiple lines', () => {
      const text = 'First line.\nSecond line.\nThird line.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(3);
      expect(sentences[0].position).toBe(0);
      expect(sentences[1].position).toBe(1);
      expect(sentences[2].position).toBe(2);
    });

    test('should preserve original text', () => {
      const text = 'Original sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].originalText).toBe('Original sentence.');
      expect(sentences[0].text).toBe('Original sentence.');
    });

    test('should handle abbreviations', () => {
      const text = 'Dr. Smith conducted the study. The results were significant.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toContain('Dr. Smith');
    });

    test('should handle exclamation marks', () => {
      const text = 'This is important! This is also important.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is important!');
    });

    test('should handle question marks', () => {
      const text = 'Is this a question? Yes, it is.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('Is this a question?');
    });

    test('should skip empty lines', () => {
      const text = 'First sentence.\n\nSecond sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
    });

    test('should generate unique sentence IDs', () => {
      const text = 'First. Second. Third.';
      const sentences = parser.parseSentences(text, 'test-doc');

      expect(sentences[0].id).toBe('S_test-doc_0');
      expect(sentences[1].id).toBe('S_test-doc_1');
      expect(sentences[2].id).toBe('S_test-doc_2');
    });

    test('should initialize claims array', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].claims).toEqual([]);
    });

    test('should set timestamps', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].createdAt).toBeInstanceOf(Date);
      expect(sentences[0].updatedAt).toBeInstanceOf(Date);
    });

    test('should handle ellipsis', () => {
      const text = 'This is incomplete... but continues here.';
      const sentences = parser.parseSentences(text);

      // Ellipsis is treated as sentence ending, so we get 2 sentences
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toBe('This is incomplete...');
      expect(sentences[1].text).toBe('but continues here.');
    });

    test('should handle multiple sentences on one line', () => {
      const text = 'First. Second. Third.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(3);
    });

    test('should trim whitespace', () => {
      const text = '  First sentence.   Second sentence.  ';
      const sentences = parser.parseSentences(text);

      expect(sentences[0].text).toBe('First sentence.');
      expect(sentences[1].text).toBe('Second sentence.');
    });
  });

  describe('cache management', () => {
    test('should cache parsed sentences', () => {
      const text = 'Test sentence.';
      const result1 = parser.parseSentences(text, 'cache-test');
      const result2 = parser.parseSentences(text, 'cache-test');

      expect(result1).toBe(result2); // Same reference
    });

    test('should clear specific cache', () => {
      const text = 'Test sentence.';
      parser.parseSentences(text, 'doc1');
      parser.parseSentences(text, 'doc2');

      parser.clearCache('doc1');

      expect(parser.getCacheSize()).toBe(1);
    });

    test('should clear all cache', () => {
      parser.parseSentences('Test 1.', 'doc1');
      parser.parseSentences('Test 2.', 'doc2');

      parser.clearCache();

      expect(parser.getCacheSize()).toBe(0);
    });

    test('should report cache size', () => {
      parser.parseSentences('Test 1.', 'doc1');
      parser.parseSentences('Test 2.', 'doc2');

      expect(parser.getCacheSize()).toBe(2);
    });
  });

  describe('edge cases', () => {
    test('should handle empty text', () => {
      const sentences = parser.parseSentences('');
      expect(sentences).toHaveLength(0);
    });

    test('should handle text with only whitespace', () => {
      const sentences = parser.parseSentences('   \n\n   ');
      expect(sentences).toHaveLength(0);
    });

    test('should handle single sentence without punctuation', () => {
      const sentences = parser.parseSentences('This is a sentence');
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe('This is a sentence');
    });

    test('should handle very long sentences', () => {
      const longText = 'This is a very long sentence that goes on and on and on and on and on and on and on and on and on and on.';
      const sentences = parser.parseSentences(longText);

      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toBe(longText);
    });

    test('should handle special characters', () => {
      const text = 'Test with special chars: @#$%. Next sentence.';
      const sentences = parser.parseSentences(text);

      expect(sentences).toHaveLength(2);
    });
  });
});
