import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ClaimExtractor, PotentialClaim } from '../claimExtractor';
import type { OutlineSection } from '@research-assistant/core';

// Create a mock embedding service
const mockEmbeddingService: any = {
  generateEmbedding: jest.fn<() => Promise<number[]>>().mockResolvedValue(new Array(1536).fill(0).map(() => Math.random())),
  generateBatch: jest.fn<() => Promise<number[][]>>().mockResolvedValue([
    new Array(1536).fill(0).map(() => Math.random()),
    new Array(1536).fill(0).map(() => Math.random())
  ]),
  cosineSimilarity: jest.fn((a: number[], b: number[]) => {
    return 0.5 + Math.random() * 0.3;
  })
};

describe('ClaimExtractor', () => {
  let extractor: ClaimExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new ClaimExtractor(mockEmbeddingService);
  });

  describe('extractFromText', () => {
    test('should identify declarative sentences as potential claims', () => {
      const text = `
        This is a background sentence. 
        We propose a new method for text analysis.
        Our results show a 25% improvement in accuracy.
        What about this question?
        See the appendix for details.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Should extract declarative sentences, not questions or commands
      expect(claims.length).toBeGreaterThan(0);
      expect(claims.some(c => c.text.includes('question'))).toBe(false);
      expect(claims.some(c => c.text.includes('See the appendix'))).toBe(false);
    });

    test('should prioritize sentences with method keywords', () => {
      const text = `
        This is a generic sentence about something.
        We propose a novel algorithm for data processing.
        The weather is nice today.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Method sentence should have higher confidence
      const methodClaim = claims.find(c => c.text.includes('algorithm'));
      const genericClaim = claims.find(c => c.text.includes('generic'));

      if (methodClaim && genericClaim) {
        expect(methodClaim.confidence).toBeGreaterThan(genericClaim.confidence);
      }
    });

    test('should prioritize sentences with result keywords', () => {
      const text = `
        This is a background statement.
        Our experiments demonstrate a significant improvement in performance.
        Some other sentence without keywords.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Result sentence should have higher confidence
      const resultClaim = claims.find(c => c.text.includes('demonstrate'));
      expect(resultClaim).toBeDefined();
      if (resultClaim) {
        expect(resultClaim.confidence).toBeGreaterThan(0.5);
      }
    });

    test('should prioritize sentences with conclusion keywords', () => {
      const text = `
        This is a regular sentence.
        We conclude that the approach is effective for large-scale applications.
        Another sentence here.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      const conclusionClaim = claims.find(c => c.text.includes('conclude'));
      expect(conclusionClaim).toBeDefined();
      if (conclusionClaim) {
        expect(conclusionClaim.confidence).toBeGreaterThan(0.5);
      }
    });

    test('should assign confidence scores to potential claims', () => {
      const text = `
        We propose a new method that achieves 95% accuracy.
        This is a vague statement that might be something.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // All claims should have confidence scores between 0 and 1
      for (const claim of claims) {
        expect(claim.confidence).toBeGreaterThanOrEqual(0);
        expect(claim.confidence).toBeLessThanOrEqual(1);
      }

      // Specific claim with method and result keywords should have higher confidence
      const specificClaim = claims.find(c => c.text.includes('95%'));
      const vagueClaim = claims.find(c => c.text.includes('might be'));

      if (specificClaim && vagueClaim) {
        expect(specificClaim.confidence).toBeGreaterThan(vagueClaim.confidence);
      }
    });

    test('should skip very short sentences', () => {
      const text = `
        Short.
        This is a proper length sentence that should be extracted as a potential claim.
        OK.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Should not include very short sentences
      expect(claims.some(c => c.text === 'Short.')).toBe(false);
      expect(claims.some(c => c.text === 'OK.')).toBe(false);
      expect(claims.some(c => c.text.includes('proper length'))).toBe(true);
    });

    test('should skip very long sentences', () => {
      const text = `
        This is a reasonable sentence.
        ${'This is an extremely long sentence that goes on and on and on '.repeat(20)}
        Another reasonable sentence.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Should not include extremely long sentences (> 500 chars)
      const longClaim = claims.find(c => c.text.length > 500);
      expect(longClaim).toBeUndefined();
    });

    test('should include context from surrounding sentences', () => {
      const text = `
        This is the previous sentence.
        We propose a new method for analysis.
        This is the next sentence.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      const methodClaim = claims.find(c => c.text.includes('propose'));
      expect(methodClaim).toBeDefined();
      if (methodClaim) {
        expect(methodClaim.context).toContain('previous');
        expect(methodClaim.context).toContain('next');
      }
    });

    test('should include line numbers', () => {
      const text = `
        First sentence here.
        Second sentence here.
        We propose a new method.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // All claims should have line numbers
      for (const claim of claims) {
        expect(claim.lineNumber).toBeGreaterThan(0);
      }
    });

    test('should filter out questions', () => {
      const text = `
        This is a statement.
        What is the best approach?
        How can we improve this?
        We found significant results.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Should not include questions
      expect(claims.some(c => c.text.includes('What is'))).toBe(false);
      expect(claims.some(c => c.text.includes('How can'))).toBe(false);
    });

    test('should filter out commands', () => {
      const text = `
        We propose a new method.
        See Figure 1 for details.
        Refer to the appendix.
        Consider the following example.
        Our results show improvement.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Should not include commands
      expect(claims.some(c => c.text.startsWith('See '))).toBe(false);
      expect(claims.some(c => c.text.startsWith('Refer '))).toBe(false);
      expect(claims.some(c => c.text.startsWith('Consider '))).toBe(false);
    });

    test('should boost confidence for sentences with statistics', () => {
      const text = `
        This is a regular sentence.
        Our method achieves 95% accuracy on the test set.
        The performance improved by 3.5 times.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      const statClaim1 = claims.find(c => c.text.includes('95%'));
      const statClaim2 = claims.find(c => c.text.includes('3.5 times'));

      expect(statClaim1).toBeDefined();
      expect(statClaim2).toBeDefined();
      
      if (statClaim1) {
        expect(statClaim1.confidence).toBeGreaterThan(0.6);
      }
      if (statClaim2) {
        expect(statClaim2.confidence).toBeGreaterThan(0.6);
      }
    });

    test('should return claims sorted by confidence', () => {
      const text = `
        This is a vague statement that might be something.
        We demonstrate significant improvement with 90% accuracy.
        Another generic sentence here.
        Our results show that the method is effective.
      `;

      const claims = extractor.extractFromText(text, 'Smith2023');

      // Claims should be sorted by confidence (descending)
      for (let i = 0; i < claims.length - 1; i++) {
        expect(claims[i].confidence).toBeGreaterThanOrEqual(claims[i + 1].confidence);
      }
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
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('method');
      }
    });

    test('should categorize result claims', () => {
      const resultTexts = [
        'Our results show a 25% improvement in accuracy.',
        'We found that the performance increased significantly.',
        'The experiments demonstrate substantial enhancement.',
      ];

      for (const text of resultTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('result');
      }
    });

    test('should categorize conclusion claims', () => {
      const conclusionTexts = [
        'We conclude that the approach is effective overall.',
        'Therefore, the analysis reveals important implications for future work.',
        'In summary, these findings indicate the significance of the research.',
      ];

      for (const text of conclusionTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('conclusion');
      }
    });

    test('should categorize challenge claims', () => {
      const challengeTexts = [
        'However, the main challenge remains unresolved.',
        'Despite these results, significant limitations exist.',
        'The problem of scalability is still an open question.',
      ];

      for (const text of challengeTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('challenge');
      }
    });

    test('should categorize data source claims', () => {
      const dataSourceTexts = [
        'We collected data from multiple repositories.',
        'The dataset contains 10,000 samples from various sources.',
        'We used data from the national survey database.',
      ];

      for (const text of dataSourceTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('data_source');
      }
    });

    test('should categorize data trend claims', () => {
      const dataTrendTexts = [
        'The trend shows a steady increase over time.',
        'We observe a declining pattern in the data.',
        'The temporal evolution reveals significant growth.',
      ];

      for (const text of dataTrendTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('data_trend');
      }
    });

    test('should categorize impact claims', () => {
      const impactTexts = [
        'This has a significant impact on performance.',
        'The change leads to improved outcomes.',
        'The effect influences the overall results.',
      ];

      for (const text of impactTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('impact');
      }
    });

    test('should categorize application claims', () => {
      const applicationTexts = [
        'This tool can be used for real-world applications in various domains.',
        'The software is suitable for practical deployment in production environments.',
        'The solution enables efficient processing and facilitates daily operations.',
      ];

      for (const text of applicationTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('application');
      }
    });

    test('should categorize phenomenon claims', () => {
      const phenomenonTexts = [
        'We observe an interesting phenomenon in the data.',
        'This behavior occurs consistently across experiments.',
        'The characteristic appears in multiple scenarios.',
      ];

      for (const text of phenomenonTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('phenomenon');
      }
    });

    test('should default to background for ambiguous claims', () => {
      const ambiguousTexts = [
        'This is a general statement.',
        'Something happens in this context.',
        'There are various factors to consider.',
      ];

      for (const text of ambiguousTexts) {
        const category = extractor.categorizeClaim(text);
        expect(category).toBe('background');
      }
    });

    test('should handle mixed keywords by choosing dominant category', () => {
      // Text with both method and result keywords, but more result keywords
      const text = 'Our method demonstrates significant improvement and achieves better results.';
      const category = extractor.categorizeClaim(text);
      
      // Should categorize based on dominant keywords
      expect(['method', 'result']).toContain(category);
    });
  });

  describe('suggestSections', () => {
    let mockSections: OutlineSection[];

    beforeEach(() => {
      mockSections = [
        {
          id: 'methods-1',
          level: 2,
          title: 'Methods and Approaches',
          content: ['How do we process data?', 'What algorithms are used?'],
          lineStart: 1,
          lineEnd: 5,
        },
        {
          id: 'results-1',
          level: 2,
          title: 'Results and Findings',
          content: ['What are the outcomes?', 'Performance metrics'],
          lineStart: 6,
          lineEnd: 10,
        },
        {
          id: 'discussion-1',
          level: 2,
          title: 'Discussion',
          content: ['Implications of findings', 'Future work'],
          lineStart: 11,
          lineEnd: 15,
        },
      ];
    });

    test('should suggest 1-3 relevant sections for a claim', async () => {
      const claim = 'We propose a new algorithm for data processing.';
      const suggestions = await extractor.suggestSections(claim, mockSections);

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    test('should suggest method section for method claims', async () => {
      const claim = 'We propose a new algorithm for data processing.';
      const suggestions = await extractor.suggestSections(claim, mockSections);

      // Should suggest the methods section
      expect(suggestions.some(s => s.title.includes('Methods'))).toBe(true);
    });

    test('should suggest result section for result claims', async () => {
      const claim = 'Our experiments show 95% accuracy on the test set.';
      const suggestions = await extractor.suggestSections(claim, mockSections);

      // Should suggest the results section
      expect(suggestions.some(s => s.title.includes('Results'))).toBe(true);
    });

    test('should return empty array for empty sections list', async () => {
      const claim = 'We propose a new method.';
      const suggestions = await extractor.suggestSections(claim, []);

      expect(suggestions).toEqual([]);
    });

    test('should return at least one section if available', async () => {
      const claim = 'Some unrelated claim about weather.';
      const suggestions = await extractor.suggestSections(claim, mockSections);

      // Should return at least one section even if similarity is low
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });

    test('should rank sections by semantic similarity', async () => {
      const claim = 'We propose a novel algorithm for efficient data processing.';
      const suggestions = await extractor.suggestSections(claim, mockSections);

      // First suggestion should be most relevant (methods section)
      if (suggestions.length > 0) {
        expect(suggestions[0].title).toContain('Methods');
      }
    });
  });

  describe('formatForDatabase', () => {
    test('should format potential claim for database insertion', () => {
      const potentialClaim: PotentialClaim = {
        text: 'We propose a new method for analysis.',
        context: 'Previous work has limitations. ... Future work will extend this.',
        confidence: 0.85,
        type: 'method',
        lineNumber: 42,
      };

      const metadata = {
        claimId: 'C_01',
        source: 'Smith2023',
        sourceId: 1,
        sections: ['methods-1', 'discussion-1'],
      };

      const formatted = extractor.formatForDatabase(potentialClaim, metadata);

      expect(formatted.id).toBe('C_01');
      expect(formatted.text).toBe(potentialClaim.text);
      expect(formatted.category).toBe('Method');
      expect(formatted.source).toBe('Smith2023');
      expect(formatted.sourceId).toBe(1);
      expect(formatted.context).toBe(potentialClaim.context);
      expect(formatted.primaryQuote).toBe(potentialClaim.text);
      expect(formatted.supportingQuotes).toEqual([]);
      expect(formatted.sections).toEqual(['methods-1', 'discussion-1']);
      expect(formatted.verified).toBe(false);
      expect(formatted.createdAt).toBeInstanceOf(Date);
      expect(formatted.modifiedAt).toBeInstanceOf(Date);
    });

    test('should format category names correctly', () => {
      const categories: Array<PotentialClaim['type']> = [
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
        const potentialClaim: PotentialClaim = {
          text: 'Test claim',
          context: '',
          confidence: 0.5,
          type: categories[i],
          lineNumber: 1,
        };

        const formatted = extractor.formatForDatabase(potentialClaim, {
          claimId: 'C_01',
          source: 'Test',
          sourceId: 1,
          sections: [],
        });

        expect(formatted.category).toBe(expectedFormats[i]);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty text', () => {
      const claims = extractor.extractFromText('', 'Smith2023');
      expect(claims).toEqual([]);
    });

    test('should handle text with only whitespace', () => {
      const claims = extractor.extractFromText('   \n\n   \t\t   ', 'Smith2023');
      expect(claims).toEqual([]);
    });

    test('should handle text with no valid sentences', () => {
      const text = 'Short. OK. Hi. Bye.';
      const claims = extractor.extractFromText(text, 'Smith2023');
      expect(claims).toEqual([]);
    });

    test('should handle text with special characters', () => {
      const text = 'We propose a method using α-diversity and β-coefficients for analysis.';
      const claims = extractor.extractFromText(text, 'Smith2023');
      
      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0].text).toContain('α-diversity');
    });

    test('should handle text with multiple consecutive spaces', () => {
      const text = 'We    propose    a    new    method    for    analysis.';
      const claims = extractor.extractFromText(text, 'Smith2023');
      
      expect(claims.length).toBeGreaterThan(0);
    });

    test('should handle text with line breaks', () => {
      const text = 'We propose\na new method\nfor analysis.';
      const claims = extractor.extractFromText(text, 'Smith2023');
      
      expect(claims.length).toBeGreaterThan(0);
    });
  });
});
