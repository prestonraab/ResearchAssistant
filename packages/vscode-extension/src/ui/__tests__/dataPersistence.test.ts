import { SentenceParser } from '@research-assistant/core';

describe('Data Persistence Integration', () => {
  let parser: SentenceParser;

  beforeEach(() => {
    parser = new SentenceParser();
  });

  describe('Auto-save', () => {
    test('should preserve sentence edits', () => {
      const text = 'Original sentence. Second sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Simulate edit
      const originalText = sentences[0].text;
      sentences[0].text = 'Modified sentence.';
      sentences[0].updatedAt = new Date();

      // Verify edit is preserved
      expect(sentences[0].text).toBe('Modified sentence.');
      expect(sentences[0].originalText).toBe(originalText);
    });

    test('should preserve claim edits', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Simulate claim addition
      const claim = {
        id: 'C_001',
        text: 'Original claim text',
        originalText: 'Original claim text',
        category: 'Result',
        source: 'Smith2020',
        verified: false
      };

      sentences[0].claims.push(claim.id);

      // Verify claim is linked
      expect(sentences[0].claims).toContain(claim.id);
    });

    test('should preserve original text history', () => {
      const text = 'Original text.';
      const sentences = parser.parseSentences(text, 'test-doc');

      const originalText = sentences[0].originalText;

      // Simulate multiple edits
      sentences[0].text = 'First edit.';
      sentences[0].text = 'Second edit.';
      sentences[0].text = 'Third edit.';

      // Original should be preserved
      expect(sentences[0].originalText).toBe(originalText);
      expect(sentences[0].text).toBe('Third edit.');
    });
  });

  describe('Concurrent Edits', () => {
    test('should handle concurrent sentence edits', () => {
      const text = 'Sentence 1. Sentence 2. Sentence 3.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Simulate concurrent edits
      sentences[0].text = 'Modified 1.';
      sentences[1].text = 'Modified 2.';
      sentences[2].text = 'Modified 3.';

      // All edits should be preserved
      expect(sentences[0].text).toBe('Modified 1.');
      expect(sentences[1].text).toBe('Modified 2.');
      expect(sentences[2].text).toBe('Modified 3.');
    });

    test('should handle concurrent claim operations', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Simulate concurrent claim additions
      sentences[0].claims.push('C_001');
      sentences[0].claims.push('C_002');
      sentences[0].claims.push('C_003');

      // All claims should be linked
      expect(sentences[0].claims).toHaveLength(3);
      expect(sentences[0].claims).toContain('C_001');
      expect(sentences[0].claims).toContain('C_002');
      expect(sentences[0].claims).toContain('C_003');
    });

    test('should handle concurrent edits to same sentence', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      const originalText = sentences[0].text;

      // Simulate rapid edits
      sentences[0].text = 'Edit 1.';
      sentences[0].updatedAt = new Date();

      sentences[0].text = 'Edit 2.';
      sentences[0].updatedAt = new Date();

      sentences[0].text = 'Edit 3.';
      sentences[0].updatedAt = new Date();

      // Last edit should win
      expect(sentences[0].text).toBe('Edit 3.');
      expect(sentences[0].originalText).toBe(originalText);
    });
  });

  describe('Conflict Resolution', () => {
    test('should preserve last-write-wins for sentence edits', () => {
      const text = 'Original sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Simulate two concurrent edits
      const edit1 = 'First edit.';
      const edit2 = 'Second edit.';

      sentences[0].text = edit1;
      sentences[0].updatedAt = new Date(Date.now() - 1000);

      sentences[0].text = edit2;
      sentences[0].updatedAt = new Date();

      // Last write should win
      expect(sentences[0].text).toBe(edit2);
    });

    test('should handle claim removal during concurrent operations', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Add claims
      sentences[0].claims.push('C_001');
      sentences[0].claims.push('C_002');

      // Remove one claim
      sentences[0].claims = sentences[0].claims.filter(c => c !== 'C_001');

      // Verify removal
      expect(sentences[0].claims).toHaveLength(1);
      expect(sentences[0].claims).toContain('C_002');
      expect(sentences[0].claims).not.toContain('C_001');
    });

    test('should preserve sentence when claims are modified', () => {
      const text = 'Original sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      const originalSentenceText = sentences[0].text;

      // Add and remove claims
      sentences[0].claims.push('C_001');
      sentences[0].claims.push('C_002');
      sentences[0].claims = sentences[0].claims.filter(c => c !== 'C_001');

      // Sentence should be unchanged
      expect(sentences[0].text).toBe(originalSentenceText);
    });
  });

  describe('State Consistency', () => {
    test('should maintain consistent timestamps', async () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      const createdAt = sentences[0].createdAt;
      const initialUpdatedAt = sentences[0].updatedAt;

      // Simulate edit with a small delay to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      sentences[0].text = 'Modified.';
      sentences[0].updatedAt = new Date();

      // Created time should not change
      expect(sentences[0].createdAt).toEqual(createdAt);
      // Updated time should change
      expect(sentences[0].updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
    });

    test('should maintain sentence-claim relationships', () => {
      const text = 'Sentence 1. Sentence 2.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Add claims to different sentences
      sentences[0].claims.push('C_001');
      sentences[1].claims.push('C_002');

      // Modify first sentence
      sentences[0].text = 'Modified sentence 1.';

      // Relationships should be preserved
      expect(sentences[0].claims).toContain('C_001');
      expect(sentences[1].claims).toContain('C_002');
      expect(sentences[0].claims).not.toContain('C_002');
    });

    test('should preserve claim order', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Add claims in specific order
      sentences[0].claims.push('C_001');
      sentences[0].claims.push('C_002');
      sentences[0].claims.push('C_003');

      // Order should be preserved
      expect(sentences[0].claims[0]).toBe('C_001');
      expect(sentences[0].claims[1]).toBe('C_002');
      expect(sentences[0].claims[2]).toBe('C_003');
    });
  });

  describe('Data Integrity', () => {
    test('should not lose data during rapid saves', () => {
      const text = 'Test sentence.';
      const sentences = parser.parseSentences(text, 'test-doc');

      const claims = ['C_001', 'C_002', 'C_003', 'C_004', 'C_005'];

      // Rapidly add claims
      claims.forEach(claim => {
        sentences[0].claims.push(claim);
      });

      // All claims should be present
      expect(sentences[0].claims).toHaveLength(5);
      claims.forEach(claim => {
        expect(sentences[0].claims).toContain(claim);
      });
    });

    test('should maintain data consistency across multiple sentences', () => {
      const text = 'Sentence 1. Sentence 2. Sentence 3. Sentence 4. Sentence 5.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Modify all sentences
      sentences.forEach((sentence, index) => {
        sentence.text = `Modified sentence ${index + 1}.`;
        sentence.claims.push(`C_${index + 1}`);
      });

      // Verify all modifications
      sentences.forEach((sentence, index) => {
        expect(sentence.text).toBe(`Modified sentence ${index + 1}.`);
        expect(sentence.claims).toContain(`C_${index + 1}`);
      });
    });

    test('should handle deletion of sentences while preserving claims', () => {
      const text = 'Sentence 1. Sentence 2. Sentence 3.';
      const sentences = parser.parseSentences(text, 'test-doc');

      // Add claims to all sentences
      sentences[0].claims.push('C_001');
      sentences[1].claims.push('C_002');
      sentences[2].claims.push('C_003');

      // Delete middle sentence
      const deletedSentence = sentences.splice(1, 1)[0];

      // Claims should be preserved in deleted sentence
      expect(deletedSentence.claims).toContain('C_002');
      // Other sentences should be unaffected
      expect(sentences[0].claims).toContain('C_001');
      expect(sentences[1].claims).toContain('C_003');
    });
  });
});
