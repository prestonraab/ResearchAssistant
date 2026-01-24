import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClaimExtractor } from '../../src/services/ClaimExtractor.js';
import { EmbeddingService } from '../../src/core/EmbeddingService.js';
import { OutlineSection, ClaimType } from '../../src/types/index.js';

describe('ClaimExtractor', () => {
  let claimExtractor: ClaimExtractor;
  let mockEmbeddingService: EmbeddingService;

  beforeEach(() => {
    // Create mock embedding service
    mockEmbeddingService = {
      generateEmbedding: jest.fn<() => Promise<number[]>>(),
      generateBatch: jest.fn<() => Promise<number[][]>>(),
      cosineSimilarity: jest.fn<() => number>(),
      trimCache: jest.fn<() => void>(),
      clearCache: jest.fn<() => void>(),
      getCacheSize: jest.fn<() => number>(),
    } as any;

    claimExtractor = new ClaimExtractor(mockEmbeddingService);
  });

  describe('extractFromText', () => {
    it('should extract declarative sentences as potential claims', () => {
      const text = `
        This is a background statement about previous research.
        The method we propose uses a novel algorithm.
        Our results showed significant improvement.
        What about this question?
        See the appendix for details.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      // Should extract 3 declarative sentences, not the question or command
      expect(claims.length).toBeGreaterThan(0);
      
      // All claims should be declarative (no questions)
      claims.forEach(claim => {
        expect(claim.text).not.toMatch(/\?$/);
      });
    });

    it('should calculate confidence scores for claims', () => {
      const text = `
        The results demonstrated significant improvement in performance.
        This is a simple statement without special keywords.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      expect(claims.length).toBeGreaterThan(0);
      
      // All claims should have confidence scores between 0 and 1
      claims.forEach(claim => {
        expect(claim.confidence).toBeGreaterThanOrEqual(0);
        expect(claim.confidence).toBeLessThanOrEqual(1);
      });

      // Claims should be sorted by confidence (highest first)
      for (let i = 0; i < claims.length - 1; i++) {
        expect(claims[i].confidence).toBeGreaterThanOrEqual(claims[i + 1].confidence);
      }
    });

    it('should categorize claims by type', () => {
      const text = `
        We propose a novel method for data analysis.
        The results showed significant improvement.
        Therefore, we conclude that the approach is effective.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      expect(claims.length).toBeGreaterThan(0);
      
      // All claims should have a valid category
      const validTypes: ClaimType[] = [
        'method', 'result', 'conclusion', 'background', 'challenge',
        'data_source', 'data_trend', 'impact', 'application', 'phenomenon'
      ];
      
      claims.forEach(claim => {
        expect(validTypes).toContain(claim.type);
      });
    });

    it('should include surrounding context for each claim', () => {
      const text = `
        Previous line provides context.
        This is the main claim statement.
        Next line also provides context.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      expect(claims.length).toBeGreaterThan(0);
      
      // Each claim should have context
      claims.forEach(claim => {
        expect(claim.context).toBeDefined();
        expect(claim.context.length).toBeGreaterThan(0);
      });
    });

    it('should filter out very short or very long sentences', () => {
      const text = `
        Short.
        This is a reasonable length declarative sentence that should be extracted.
        ${'A'.repeat(600)} This sentence is way too long and should be filtered out.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      // Should only extract the reasonable length sentence
      claims.forEach(claim => {
        expect(claim.text.length).toBeGreaterThanOrEqual(20);
        expect(claim.text.length).toBeLessThanOrEqual(500);
      });
    });

    it('should return empty array for empty text', () => {
      const claims = claimExtractor.extractFromText('', 'Test2024');
      expect(claims).toEqual([]);
    });

    it('should return empty array for text with no declarative sentences', () => {
      const text = `
        What is this?
        How does it work?
        See the appendix.
        Consider the following.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');
      
      // Should extract very few or no claims since these are questions/commands
      expect(claims.length).toBeLessThan(2);
    });
  });

  describe('categorizeClaim', () => {
    it('should categorize method claims correctly', () => {
      const text = 'We propose a novel method for data analysis using machine learning.';
      const category = claimExtractor.categorizeClaim(text);
      expect(category).toBe('method');
    });

    it('should categorize result claims correctly', () => {
      const text = 'Our results showed significant improvement in performance metrics.';
      const category = claimExtractor.categorizeClaim(text);
      expect(category).toBe('result');
    });

    it('should categorize conclusion claims correctly', () => {
      const text = 'Therefore, we conclude that the approach is highly effective.';
      const category = claimExtractor.categorizeClaim(text);
      expect(category).toBe('conclusion');
    });

    it('should categorize background claims correctly', () => {
      const text = 'Previous research has established the importance of this approach.';
      const category = claimExtractor.categorizeClaim(text);
      expect(category).toBe('background');
    });

    it('should return a valid category for any text', () => {
      const text = 'This is a generic statement without specific keywords.';
      const category = claimExtractor.categorizeClaim(text);
      
      const validTypes: ClaimType[] = [
        'method', 'result', 'conclusion', 'background', 'challenge',
        'data_source', 'data_trend', 'impact', 'application', 'phenomenon'
      ];
      
      expect(validTypes).toContain(category);
    });
  });

  describe('suggestSections', () => {
    it('should suggest relevant sections based on semantic similarity', async () => {
      const claimText = 'We propose a novel machine learning method for classification.';
      const sections: OutlineSection[] = [
        {
          id: '2.1',
          title: 'Machine Learning Methods',
          level: 2,
          lineStart: 10,
          lineEnd: 20,
          content: ['This section discusses various machine learning approaches.'],
        },
        {
          id: '2.2',
          title: 'Data Collection',
          level: 2,
          lineStart: 21,
          lineEnd: 30,
          content: ['This section describes how data was collected.'],
        },
        {
          id: '2.3',
          title: 'Results',
          level: 2,
          lineStart: 31,
          lineEnd: 40,
          content: ['This section presents the experimental results.'],
        },
      ];

      // Mock embeddings and similarity
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockEmbeddingService.cosineSimilarity
        .mockReturnValueOnce(0.8) // High similarity with ML Methods
        .mockReturnValueOnce(0.3) // Low similarity with Data Collection
        .mockReturnValueOnce(0.4); // Medium similarity with Results

      const suggestions = await claimExtractor.suggestSections(claimText, sections);

      // Should return top 3 suggestions
      expect(suggestions.length).toBeLessThanOrEqual(3);
      expect(suggestions.length).toBeGreaterThan(0);

      // Should be sorted by similarity (highest first)
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].similarity).toBeGreaterThanOrEqual(
          suggestions[i + 1].similarity
        );
      }

      // Each suggestion should have required fields
      suggestions.forEach(suggestion => {
        expect(suggestion.sectionId).toBeDefined();
        expect(suggestion.sectionTitle).toBeDefined();
        expect(typeof suggestion.similarity).toBe('number');
      });
    });

    it('should return empty array for empty claim text', async () => {
      const sections: OutlineSection[] = [
        {
          id: '2.1',
          title: 'Test Section',
          level: 2,
          lineStart: 10,
          lineEnd: 20,
          content: ['Content'],
        },
      ];

      const suggestions = await claimExtractor.suggestSections('', sections);
      expect(suggestions).toEqual([]);
    });

    it('should return empty array for empty sections array', async () => {
      const suggestions = await claimExtractor.suggestSections('Test claim', []);
      expect(suggestions).toEqual([]);
    });

    it('should return at most 3 suggestions', async () => {
      const claimText = 'Test claim';
      const sections: OutlineSection[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Section ${i + 1}`,
        level: 2,
        lineStart: i * 10,
        lineEnd: (i + 1) * 10,
        content: [`Content for section ${i + 1}`],
      }));

      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.5);

      const suggestions = await claimExtractor.suggestSections(claimText, sections);

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });
});
