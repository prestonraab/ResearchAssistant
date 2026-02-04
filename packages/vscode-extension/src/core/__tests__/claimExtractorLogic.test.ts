import { describe, test, expect } from '@jest/globals';
import {
  parseClaimsFromMarkdown,
  validateClaimStructure,
  splitIntoSentences,
  isDeclarative,
  calculateConfidence,
  categorizeClaim,
  countKeywordMatches,
  getContext,
  formatCategory,
  type ParsedClaim,
} from '../claimExtractorLogic';
import { setupTest } from '../../__tests__/helpers';

/**
 * Tests for pure claim extraction logic
 * Zero mocks - tests use real inputs and outputs
 * 
 * **Validates: Requirements 1.1, 1.2**
 */
describe('ClaimExtractorLogic', () => {
  setupTest();

  describe('splitIntoSentences', () => {
    test('should split text on sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const sentences = splitIntoSentences(text);

      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('First sentence.');
      expect(sentences[1]).toBe('Second sentence!');
      expect(sentences[2]).toBe('Third sentence?');
    });

    test('should handle text with multiple spaces', () => {
      const text = 'First sentence.   Second sentence.';
      const sentences = splitIntoSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('First sentence.');
      expect(sentences[1]).toBe('Second sentence.');
    });

    test('should return empty array for empty text', () => {
      const sentences = splitIntoSentences('');
      expect(sentences).toEqual([]);
    });

    test('should handle text with line breaks', () => {
      const text = 'First sentence.\nSecond sentence.';
      const sentences = splitIntoSentences(text);

      expect(sentences).toHaveLength(2);
    });
  });

  describe('isDeclarative', () => {
    test('should return true for declarative sentences', () => {
      expect(isDeclarative('This is a statement.')).toBe(true);
      expect(isDeclarative('We propose a new method.')).toBe(true);
      expect(isDeclarative('The results show improvement.')).toBe(true);
    });

    test('should return false for questions', () => {
      expect(isDeclarative('What is the result?')).toBe(false);
      expect(isDeclarative('How does this work?')).toBe(false);
    });

    test('should return false for commands', () => {
      expect(isDeclarative('See the appendix for details.')).toBe(false);
      expect(isDeclarative('Refer to Figure 1.')).toBe(false);
      expect(isDeclarative('Consider the following example.')).toBe(false);
      expect(isDeclarative('Note that this is important.')).toBe(false);
    });

    test('should handle sentences with trailing whitespace', () => {
      expect(isDeclarative('  This is a statement.  ')).toBe(true);
      expect(isDeclarative('  What is this?  ')).toBe(false);
    });
  });

  describe('countKeywordMatches', () => {
    test('should count matching keywords', () => {
      const text = 'we propose a new method and approach';
      const keywords = ['propose', 'method', 'approach'];
      
      expect(countKeywordMatches(text, keywords)).toBe(3);
    });

    test('should return 0 for no matches', () => {
      const text = 'this is some text';
      const keywords = ['propose', 'method'];
      
      expect(countKeywordMatches(text, keywords)).toBe(0);
    });

    test('should handle empty keyword list', () => {
      const text = 'some text';
      expect(countKeywordMatches(text, [])).toBe(0);
    });

    test('should handle empty text', () => {
      const keywords = ['propose', 'method'];
      expect(countKeywordMatches('', keywords)).toBe(0);
    });
  });

  describe('calculateConfidence', () => {
    test('should return score between 0 and 1', () => {
      const sentences = [
        'This is a test sentence.',
        'We propose a new method.',
        'Our results show improvement.',
      ];

      for (const sentence of sentences) {
        const confidence = calculateConfidence(sentence);
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      }
    });

    test('should give higher confidence to method keywords', () => {
      const methodSentence = 'We propose a novel algorithm for data processing.';
      const genericSentence = 'This is a generic sentence about something.';

      const methodConfidence = calculateConfidence(methodSentence);
      const genericConfidence = calculateConfidence(genericSentence);

      expect(methodConfidence).toBeGreaterThan(genericConfidence);
    });

    test('should give higher confidence to result keywords', () => {
      const resultSentence = 'Our experiments demonstrate significant improvement in performance.';
      const genericSentence = 'This is a background statement.';

      const resultConfidence = calculateConfidence(resultSentence);
      const genericConfidence = calculateConfidence(genericSentence);

      expect(resultConfidence).toBeGreaterThan(genericConfidence);
    });

    test('should boost confidence for statistics', () => {
      const statSentence = 'Our method achieves 95% accuracy on the test set.';
      const noStatSentence = 'Our method achieves good accuracy on the test set.';

      const statConfidence = calculateConfidence(statSentence);
      const noStatConfidence = calculateConfidence(noStatSentence);

      expect(statConfidence).toBeGreaterThan(noStatConfidence);
    });

    test('should penalize vague language', () => {
      const specificSentence = 'We propose a new method that achieves 95% accuracy.';
      const vagueSentence = 'We might propose some method that could possibly work.';

      const specificConfidence = calculateConfidence(specificSentence);
      const vagueConfidence = calculateConfidence(vagueSentence);

      expect(specificConfidence).toBeGreaterThan(vagueConfidence);
    });

    test('should penalize very short sentences', () => {
      const longSentence = 'This is a reasonably long sentence with enough content to be meaningful.';
      const shortSentence = 'This is short.';

      const longConfidence = calculateConfidence(longSentence);
      const shortConfidence = calculateConfidence(shortSentence);

      expect(longConfidence).toBeGreaterThan(shortConfidence);
    });
  });

  describe('categorizeClaim', () => {
    test('should categorize method claims', () => {
      const methodTexts = [
        'We propose a new algorithm for data processing.',
        'Our approach uses a novel technique for optimization.',
        'The method implements a hierarchical framework.',
      ];

      for (const text of methodTexts) {
        expect(categorizeClaim(text)).toBe('method');
      }
    });

    test('should categorize result claims', () => {
      const resultTexts = [
        'Our results show a 25% improvement in accuracy.',
        'We found that the performance increased significantly.',
        'The experiments demonstrate substantial enhancement.',
      ];

      for (const text of resultTexts) {
        expect(categorizeClaim(text)).toBe('result');
      }
    });

    test('should categorize conclusion claims', () => {
      const conclusionTexts = [
        'We conclude that the approach is effective overall.',
        'Therefore, the analysis reveals important implications for future work.',
        'In summary, these findings indicate the significance of the research.',
      ];

      for (const text of conclusionTexts) {
        expect(categorizeClaim(text)).toBe('conclusion');
      }
    });

    test('should categorize challenge claims', () => {
      const challengeTexts = [
        'However, the main challenge remains unresolved.',
        'Despite these results, significant limitations exist.',
        'The problem of scalability is still an open question.',
      ];

      for (const text of challengeTexts) {
        expect(categorizeClaim(text)).toBe('challenge');
      }
    });

    test('should categorize data source claims', () => {
      const dataSourceTexts = [
        'We collected data from multiple repositories.',
        'The dataset contains 10,000 samples from various sources.',
        'We used data from the national survey database.',
      ];

      for (const text of dataSourceTexts) {
        expect(categorizeClaim(text)).toBe('data_source');
      }
    });

    test('should categorize data trend claims', () => {
      const dataTrendTexts = [
        'The trend shows a steady increase over time.',
        'We observe a declining pattern in the data.',
        'The temporal evolution reveals significant growth.',
      ];

      for (const text of dataTrendTexts) {
        expect(categorizeClaim(text)).toBe('data_trend');
      }
    });

    test('should categorize impact claims', () => {
      const impactTexts = [
        'This has a significant impact on performance.',
        'The change leads to improved outcomes.',
        'The effect influences the overall results.',
      ];

      for (const text of impactTexts) {
        expect(categorizeClaim(text)).toBe('impact');
      }
    });

    test('should categorize application claims', () => {
      const applicationTexts = [
        'This tool can be used for real-world applications in various domains.',
        'The software is suitable for practical deployment in production environments.',
        'The solution enables efficient processing and facilitates daily operations.',
      ];

      for (const text of applicationTexts) {
        expect(categorizeClaim(text)).toBe('application');
      }
    });

    test('should categorize phenomenon claims', () => {
      const phenomenonTexts = [
        'We observe an interesting phenomenon in the data.',
        'This behavior occurs consistently across experiments.',
        'The characteristic appears in multiple scenarios.',
      ];

      for (const text of phenomenonTexts) {
        expect(categorizeClaim(text)).toBe('phenomenon');
      }
    });

    test('should default to background for ambiguous claims', () => {
      const ambiguousTexts = [
        'This is a general statement.',
        'Something happens in this context.',
        'There are various factors to consider.',
      ];

      for (const text of ambiguousTexts) {
        expect(categorizeClaim(text)).toBe('background');
      }
    });
  });

  describe('getContext', () => {
    test('should return context from surrounding sentences', () => {
      const sentences = ['First sentence.', 'Second sentence.', 'Third sentence.'];
      const context = getContext(sentences, 1);

      expect(context).toContain('First sentence.');
      expect(context).toContain('Third sentence.');
    });

    test('should handle first sentence (no previous context)', () => {
      const sentences = ['First sentence.', 'Second sentence.'];
      const context = getContext(sentences, 0);

      expect(context).not.toContain('First sentence.');
      expect(context).toContain('Second sentence.');
    });

    test('should handle last sentence (no next context)', () => {
      const sentences = ['First sentence.', 'Second sentence.'];
      const context = getContext(sentences, 1);

      expect(context).toContain('First sentence.');
      expect(context).not.toContain('Second sentence.');
    });

    test('should return empty string for single sentence', () => {
      const sentences = ['Only sentence.'];
      const context = getContext(sentences, 0);

      expect(context).toBe('');
    });
  });

  describe('parseClaimsFromMarkdown', () => {
    test('should extract potential claims from text', () => {
      const text = `
        This is a background sentence.
        We propose a new method for text analysis.
        Our results show a 25% improvement in accuracy.
      `;

      const claims = parseClaimsFromMarkdown(text);

      expect(claims.length).toBeGreaterThan(0);
      expect(claims.some(c => c.text.includes('propose'))).toBe(true);
      expect(claims.some(c => c.text.includes('results'))).toBe(true);
    });

    test('should skip questions', () => {
      const text = `
        This is a statement.
        What is the best approach?
        We found significant results.
      `;

      const claims = parseClaimsFromMarkdown(text);

      expect(claims.some(c => c.text.includes('What is'))).toBe(false);
    });

    test('should skip commands', () => {
      const text = `
        We propose a new method.
        See Figure 1 for details.
        Our results show improvement.
      `;

      const claims = parseClaimsFromMarkdown(text);

      expect(claims.some(c => c.text.startsWith('See '))).toBe(false);
    });

    test('should skip very short sentences', () => {
      const text = `
        Short.
        This is a proper length sentence that should be extracted.
        OK.
      `;

      const claims = parseClaimsFromMarkdown(text);

      expect(claims.some(c => c.text === 'Short.')).toBe(false);
      expect(claims.some(c => c.text === 'OK.')).toBe(false);
    });

    test('should skip very long sentences', () => {
      const text = `
        This is a reasonable sentence.
        ${'This is an extremely long sentence that goes on and on. '.repeat(20)}
        Another reasonable sentence.
      `;

      const claims = parseClaimsFromMarkdown(text);

      const longClaim = claims.find(c => c.text.length > 500);
      expect(longClaim).toBeUndefined();
    });

    test('should filter by confidence threshold', () => {
      const text = `
        We propose a new method with 95% accuracy.
        This might be something vague.
      `;

      const claims = parseClaimsFromMarkdown(text);

      // All returned claims should have confidence >= 0.3
      for (const claim of claims) {
        expect(claim.confidence).toBeGreaterThanOrEqual(0.3);
      }
    });

    test('should include line numbers', () => {
      const text = `
        First sentence here.
        We propose a new method.
        Our results show improvement.
      `;

      const claims = parseClaimsFromMarkdown(text);

      for (const claim of claims) {
        expect(claim.lineNumber).toBeGreaterThan(0);
      }
    });

    test('should include context', () => {
      const text = `
        This is the previous sentence.
        We propose a new method for analysis.
        This is the next sentence.
      `;

      const claims = parseClaimsFromMarkdown(text);

      const methodClaim = claims.find(c => c.text.includes('propose'));
      expect(methodClaim).toBeDefined();
      if (methodClaim) {
        expect(methodClaim.context.length).toBeGreaterThan(0);
      }
    });

    test('should categorize claims', () => {
      const text = `
        We propose a new algorithm.
        Our results show 95% accuracy.
        We conclude that the approach is effective.
      `;

      const claims = parseClaimsFromMarkdown(text);

      expect(claims.some(c => c.type === 'method')).toBe(true);
      expect(claims.some(c => c.type === 'result')).toBe(true);
      expect(claims.some(c => c.type === 'conclusion')).toBe(true);
    });

    test('should sort by confidence descending', () => {
      const text = `
        This is a vague statement that might be something.
        We demonstrate significant improvement with 90% accuracy.
        Another generic sentence here.
        Our results show that the method is effective.
      `;

      const claims = parseClaimsFromMarkdown(text);

      // Claims should be sorted by confidence (descending)
      for (let i = 0; i < claims.length - 1; i++) {
        expect(claims[i].confidence).toBeGreaterThanOrEqual(claims[i + 1].confidence);
      }
    });

    test('should return empty array for empty text', () => {
      const claims = parseClaimsFromMarkdown('');
      expect(claims).toEqual([]);
    });

    test('should return empty array for text with no valid sentences', () => {
      const text = 'Short. OK. Hi.';
      const claims = parseClaimsFromMarkdown(text);
      expect(claims).toEqual([]);
    });
  });

  describe('validateClaimStructure', () => {
    test('should validate a valid claim', () => {
      const claim: ParsedClaim = {
        text: 'We propose a new method for analysis.',
        context: 'Previous work. ... Future work.',
        confidence: 0.75,
        type: 'method',
        lineNumber: 42,
      };

      const result = validateClaimStructure(claim);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject claim with empty text', () => {
      const claim: ParsedClaim = {
        text: '',
        context: '',
        confidence: 0.5,
        type: 'method',
        lineNumber: 1,
      };

      const result = validateClaimStructure(claim);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Claim text is required');
    });

    test('should reject claim with text too short', () => {
      const claim: ParsedClaim = {
        text: 'Short',
        context: '',
        confidence: 0.5,
        type: 'method',
        lineNumber: 1,
      };

      const result = validateClaimStructure(claim);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });

    test('should reject claim with text too long', () => {
      const claim: ParsedClaim = {
        text: 'x'.repeat(1001),
        context: '',
        confidence: 0.5,
        type: 'method',
        lineNumber: 1,
      };

      const result = validateClaimStructure(claim);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    test('should reject claim with invalid confidence', () => {
      const claim: ParsedClaim = {
        text: 'Valid text here.',
        context: '',
        confidence: 1.5,
        type: 'method',
        lineNumber: 1,
      };

      const result = validateClaimStructure(claim);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Confidence score'))).toBe(true);
    });

    test('should warn about low confidence', () => {
      const claim: ParsedClaim = {
        text: 'Valid text here.',
        context: '',
        confidence: 0.2,
        type: 'method',
        lineNumber: 1,
      };

      const result = validateClaimStructure(claim);

      expect(result.warnings.some(w => w.includes('Low confidence'))).toBe(true);
    });

    test('should reject claim with invalid line number', () => {
      const claim: ParsedClaim = {
        text: 'Valid text here.',
        context: '',
        confidence: 0.5,
        type: 'method',
        lineNumber: 0,
      };

      const result = validateClaimStructure(claim);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Line number'))).toBe(true);
    });

    test('should warn about question marks in text', () => {
      const claim: ParsedClaim = {
        text: 'Is this a valid claim?',
        context: '',
        confidence: 0.5,
        type: 'method',
        lineNumber: 1,
      };

      const result = validateClaimStructure(claim);

      expect(result.warnings.some(w => w.includes('question mark'))).toBe(true);
    });

    test('should accept claim with empty context', () => {
      const claim: ParsedClaim = {
        text: 'Valid text here.',
        context: '',
        confidence: 0.5,
        type: 'method',
        lineNumber: 1,
      };

      const result = validateClaimStructure(claim);

      // Empty context is acceptable (e.g., first or last sentence)
      expect(result.isValid).toBe(true);
    });
  });

  describe('formatCategory', () => {
    test('should format all category types correctly', () => {
      const categories: Array<ParsedClaim['type']> = [
        'method',
        'result',
        'conclusion',
        'background',
        'challenge',
        'data_source',
        'data_trend',
        'impact',
        'application',
        'phenomenon',
      ];

      const expectedFormats = [
        'Method',
        'Result',
        'Conclusion',
        'Background',
        'Challenge',
        'Data Source',
        'Data Trend',
        'Impact',
        'Application',
        'Phenomenon',
      ];

      for (let i = 0; i < categories.length; i++) {
        expect(formatCategory(categories[i])).toBe(expectedFormats[i]);
      }
    });
  });
});
