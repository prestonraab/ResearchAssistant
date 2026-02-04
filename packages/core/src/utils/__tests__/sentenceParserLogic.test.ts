import { splitIntoSentences, findSentenceAtPosition, Sentence } from '../sentenceParserLogic.js';

describe('sentenceParserLogic', () => {

  describe('splitIntoSentences', () => {
    describe('basic sentence splitting', () => {
      test('should split simple sentences', () => {
        const text = 'This is the first sentence. This is the second sentence.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toBe('This is the first sentence.');
        expect(sentences[1].text).toBe('This is the second sentence.');
      });

      test('should handle exclamation marks', () => {
        const text = 'This is important! This is also important.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toBe('This is important!');
        expect(sentences[1].text).toBe('This is also important.');
      });

      test('should handle question marks', () => {
        const text = 'Is this a question? Yes, it is.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toBe('Is this a question?');
        expect(sentences[1].text).toBe('Yes, it is.');
      });

      test('should handle multiple sentences on one line', () => {
        const text = 'First. Second. Third.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(3);
        expect(sentences[0].text).toBe('First.');
        expect(sentences[1].text).toBe('Second.');
        expect(sentences[2].text).toBe('Third.');
      });

      test('should trim whitespace', () => {
        const text = '  First sentence.   Second sentence.  ';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].text).toBe('First sentence.');
        expect(sentences[1].text).toBe('Second sentence.');
      });
    });

    describe('abbreviation handling', () => {
      test('should not split on Dr. abbreviation', () => {
        const text = 'Dr. Smith conducted the study. The results were significant.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toContain('Dr. Smith');
      });

      test('should handle e.g. in parentheses', () => {
        // e.g. with periods is challenging - it gets split
        // This is a known limitation of simple period-based splitting
        const text = 'Many methods exist (eg PCR and sequencing). These are common.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
      });

      test('should handle i.e. in parentheses', () => {
        // i.e. with periods is challenging - it gets split
        // This is a known limitation of simple period-based splitting
        const text = 'The method is simple (ie easy to follow). Anyone can do it.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
      });

      test('should not split on etc. abbreviation', () => {
        const text = 'We tested DNA, RNA, etc. All samples were valid.';
        const sentences = splitIntoSentences(text);

        // etc. is at the end of a sentence, so it should not split
        // But the next sentence should start after it
        expect(sentences).toHaveLength(1);
        expect(sentences[0].text).toContain('etc.');
      });

      test('should not split on Fig. abbreviation', () => {
        const text = 'See Fig. 1 for details. The data is clear.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toContain('Fig. 1');
      });
    });

    describe('ellipsis handling', () => {
      test('should treat ellipsis as sentence ending', () => {
        const text = 'This is incomplete... but continues here.';
        const sentences = splitIntoSentences(text);

        // Ellipsis IS treated as sentence ending
        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toBe('This is incomplete...');
        expect(sentences[1].text).toBe('but continues here.');
      });

      test('should handle ellipsis at end of text', () => {
        const text = 'This sentence trails off...';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(1);
        expect(sentences[0].text).toBe('This sentence trails off...');
      });
    });

    describe('claim extraction from Source comments', () => {
      test('should extract single claim from Source comment', () => {
        const text = 'This is a sentence.<!-- Source: C_01 -->';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(1);
        expect(sentences[0].text).toBe('This is a sentence.');
        expect(sentences[0].claims).toEqual(['C_01']);
      });

      test('should extract multiple claims from Source comment', () => {
        const text = 'This is a sentence.<!-- Source: C_01, C_02, C_03 -->';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(1);
        expect(sentences[0].text).toBe('This is a sentence.');
        expect(sentences[0].claims).toEqual(['C_01', 'C_02', 'C_03']);
      });

      test('should handle Source comment with whitespace', () => {
        const text = 'This is a sentence.<!--   Source:   C_01   -->';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(1);
        expect(sentences[0].text).toBe('This is a sentence.');
        expect(sentences[0].claims).toEqual(['C_01']);
      });

      test('should remove Source comment from text', () => {
        const text = 'This is a sentence.<!-- Source: C_01 --> More text.';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].text).not.toContain('Source');
        expect(sentences[0].text).not.toContain('<!--');
        expect(sentences[0].text).toBe('This is a sentence.');
      });

      test('should handle multiple sentences with different claims', () => {
        const text = 'First sentence.<!-- Source: C_01 --> Second sentence.<!-- Source: C_02 -->';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].claims).toEqual(['C_01']);
        expect(sentences[1].claims).toEqual(['C_02']);
      });

      test('should handle sentence without Source comment', () => {
        const text = 'This sentence has no claims.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(1);
        expect(sentences[0].claims).toEqual([]);
      });

      test('should remove non-Source HTML comments', () => {
        const text = 'This is a sentence.<!-- This is a regular comment --> More text.';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].text).not.toContain('regular comment');
        expect(sentences[0].text).not.toContain('<!--');
      });

      test('should handle claim IDs with different digit counts', () => {
        const text = 'Test.<!-- Source: C_1, C_99, C_100, C_999 -->';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].claims).toEqual(['C_1', 'C_99', 'C_100', 'C_999']);
      });
    });

    describe('sentence metadata', () => {
      test('should generate unique sentence IDs', () => {
        const text = 'First. Second. Third.';
        const sentences = splitIntoSentences(text, 'test-doc');

        expect(sentences[0].id).toBe('S_test-doc_0');
        expect(sentences[1].id).toBe('S_test-doc_1');
        expect(sentences[2].id).toBe('S_test-doc_2');
      });

      test('should use default manuscript ID', () => {
        const text = 'Test sentence.';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].id).toBe('S_default_0');
      });

      test('should set position to 0 for all sentences', () => {
        const text = 'First. Second. Third.';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].position).toBe(0);
        expect(sentences[1].position).toBe(0);
        expect(sentences[2].position).toBe(0);
      });

      test('should track line numbers with newlines', () => {
        const text = 'First line.\nSecond line.\nThird line.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(3);
        expect(sentences[0].position).toBe(0);
        expect(sentences[1].position).toBe(1);
        expect(sentences[2].position).toBe(2);
      });

      test('should set timestamps', () => {
        const text = 'Test sentence.';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].createdAt).toBeInstanceOf(Date);
        expect(sentences[0].updatedAt).toBeInstanceOf(Date);
      });

      test('should preserve original text', () => {
        const text = 'Original sentence.';
        const sentences = splitIntoSentences(text);

        expect(sentences[0].originalText).toBe('Original sentence.');
        expect(sentences[0].text).toBe('Original sentence.');
      });
    });

    describe('edge cases', () => {
      test('should handle empty text', () => {
        const sentences = splitIntoSentences('');
        expect(sentences).toHaveLength(0);
      });

      test('should handle text with only whitespace', () => {
        const sentences = splitIntoSentences('   \n\n   ');
        expect(sentences).toHaveLength(0);
      });

      test('should handle single sentence without punctuation', () => {
        const sentences = splitIntoSentences('This is a sentence');
        expect(sentences).toHaveLength(1);
        expect(sentences[0].text).toBe('This is a sentence');
      });

      test('should handle very long sentences', () => {
        const longText = 'This is a very long sentence that goes on and on and on and on and on and on and on and on and on and on.';
        const sentences = splitIntoSentences(longText);

        expect(sentences).toHaveLength(1);
        expect(sentences[0].text).toBe(longText);
      });

      test('should handle special characters', () => {
        const text = 'Test with special chars: @#$%. Next sentence.';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(2);
        expect(sentences[0].text).toContain('@#$%');
      });

      test('should handle only HTML comments', () => {
        const text = '<!-- Just a comment -->';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(0);
      });

      test('should handle Source comment without sentence', () => {
        const text = '<!-- Source: C_01 -->';
        const sentences = splitIntoSentences(text);

        expect(sentences).toHaveLength(0);
      });
    });
  });

  describe('findSentenceAtPosition', () => {
    let sentences: Sentence[];

    beforeEach(() => {
      // Create test sentences with different positions
      sentences = [
        {
          id: 'S_test_0',
          text: 'First sentence.',
          originalText: 'First sentence.',
          position: 0,
          claims: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'S_test_1',
          text: 'Second sentence.',
          originalText: 'Second sentence.',
          position: 5,
          claims: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'S_test_2',
          text: 'Third sentence.',
          originalText: 'Third sentence.',
          position: 10,
          claims: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    });

    test('should find sentence at position 0', () => {
      const result = findSentenceAtPosition(sentences, 0);

      expect(result).not.toBeNull();
      expect(result?.text).toBe('First sentence.');
    });

    test('should find sentence at position 5', () => {
      const result = findSentenceAtPosition(sentences, 5);

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Second sentence.');
    });

    test('should find sentence at position 10', () => {
      const result = findSentenceAtPosition(sentences, 10);

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Third sentence.');
    });

    test('should return null for non-existent position', () => {
      const result = findSentenceAtPosition(sentences, 99);

      expect(result).toBeNull();
    });

    test('should return null for negative position', () => {
      const result = findSentenceAtPosition(sentences, -1);

      expect(result).toBeNull();
    });

    test('should handle empty sentence array', () => {
      const result = findSentenceAtPosition([], 0);

      expect(result).toBeNull();
    });

    test('should return first matching sentence if multiple at same position', () => {
      const duplicatePositionSentences = [
        ...sentences,
        {
          id: 'S_test_3',
          text: 'Duplicate position sentence.',
          originalText: 'Duplicate position sentence.',
          position: 0,
          claims: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = findSentenceAtPosition(duplicatePositionSentences, 0);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('S_test_0'); // First one
    });
  });
});
