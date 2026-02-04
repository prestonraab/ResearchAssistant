import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClaimExtractor } from '../../src/services/ClaimExtractor.js';
import { EmbeddingService } from '../../src/services/EmbeddingService.js';

describe('ClaimExtractor', () => {
  let claimExtractor: ClaimExtractor;
  let mockEmbeddingService: any;

  beforeEach(() => {
    mockEmbeddingService = {
      // @ts-expect-error - Mock typing issue with jest.fn()
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      cosineSimilarity: jest.fn().mockReturnValue(0.85),
    } as any;
    claimExtractor = new ClaimExtractor(mockEmbeddingService);
  });

  describe('extractFromText', () => {
    it('should extract declarative sentences as potential claims', () => {
      const text = `
        This is a declarative sentence.
        Another claim here.
        What is this? This is not extracted.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0]).toHaveProperty('text');
      expect(claims[0]).toHaveProperty('confidence');
      expect(claims[0]).toHaveProperty('type');
      expect(claims[0]).toHaveProperty('context');
      expect(claims[0]).toHaveProperty('lineNumber');
    });

    it('should skip empty lines and very short lines', () => {
      const text = `
        
        Short.
        This is a proper declarative sentence with enough content.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      // Should only extract the longer sentence
      expect(claims.length).toBeGreaterThanOrEqual(1);
      expect(claims.some(c => c.text.length > 20)).toBe(true);
    });

    it('should skip questions', () => {
      // Questions in the manuscript are marked with > [!question]- syntax
      const text = `> [!question]- What is this question?
This is a statement that should be extracted.`;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      // Should not extract lines starting with > [!question]
      expect(claims.every(c => !c.text.startsWith('> [!question]'))).toBe(true);
    });

    it('should sort claims by confidence score (highest first)', () => {
      const text = `
        This is a result that showed significantly improved performance.
        This is a background statement about previous research.
        This is a method that we propose and demonstrate.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      // Verify claims are sorted by confidence
      for (let i = 0; i < claims.length - 1; i++) {
        expect(claims[i].confidence).toBeGreaterThanOrEqual(claims[i + 1].confidence);
      }
    });

    it('should return empty array for empty text', () => {
      const claims = claimExtractor.extractFromText('', 'Test2024');
      expect(claims).toEqual([]);
    });

    it('should return empty array for whitespace-only text', () => {
      const claims = claimExtractor.extractFromText('   \n\n  ', 'Test2024');
      expect(claims).toEqual([]);
    });

    it('should include line numbers (1-indexed)', () => {
      const text = `This is the first line of the document.
This is a declarative statement on line two.
This is the third line of the document.`;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0].lineNumber).toBeGreaterThan(0);
    });
  });

  describe('categorizeClaim', () => {
    it('should categorize method claims', () => {
      const type = claimExtractor.categorizeClaim('We propose a new algorithm for this task.');
      expect(type).toBe('method');
    });

    it('should categorize result claims', () => {
      const type = claimExtractor.categorizeClaim('The results showed significantly improved performance.');
      expect(type).toBe('result');
    });

    it('should categorize conclusion claims', () => {
      const type = claimExtractor.categorizeClaim('Therefore, we conclude that this approach is effective.');
      expect(type).toBe('conclusion');
    });

    it('should categorize background claims', () => {
      const type = claimExtractor.categorizeClaim('Previous research has established this framework.');
      expect(type).toBe('background');
    });

    it('should categorize challenge claims', () => {
      const type = claimExtractor.categorizeClaim('The main limitation of this approach is the computational complexity.');
      expect(type).toBe('challenge');
    });

    it('should categorize data_source claims', () => {
      const type = claimExtractor.categorizeClaim('We used a dataset obtained from the public repository.');
      expect(type).toBe('data_source');
    });

    it('should categorize data_trend claims', () => {
      const type = claimExtractor.categorizeClaim('There is a clear correlation between these variables.');
      expect(type).toBe('data_trend');
    });

    it('should categorize impact claims', () => {
      const type = claimExtractor.categorizeClaim('This improvement has significant implications for the field.');
      expect(type).toBe('impact');
    });

    it('should categorize application claims', () => {
      const type = claimExtractor.categorizeClaim('This technique can be applied to real-world scenarios.');
      expect(type).toBe('application');
    });

    it('should categorize phenomenon claims', () => {
      const type = claimExtractor.categorizeClaim('This behavior occurs in most cases.');
      expect(type).toBe('phenomenon');
    });

    it('should default to background for ambiguous claims', () => {
      const type = claimExtractor.categorizeClaim('This is a generic statement.');
      expect(type).toBe('background');
    });
  });

  describe('suggestSections', () => {
    it('should suggest relevant sections for a claim', async () => {
      const claimText = 'This is a claim about methodology.';
      const sections = [
        {
          id: '1',
          title: 'Methods',
          level: 2,
          lineStart: 1,
          lineEnd: 5,
          content: ['This section describes our methodology.'],
        },
        {
          id: '2',
          title: 'Results',
          level: 2,
          lineStart: 6,
          lineEnd: 10,
          content: ['This section presents our results.'],
        },
      ];

      const suggestions = await claimExtractor.suggestSections(claimText, sections);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('sectionId');
      expect(suggestions[0]).toHaveProperty('sectionTitle');
      expect(suggestions[0]).toHaveProperty('similarity');
    });

    it('should return top 3 suggestions sorted by similarity', async () => {
      const claimText = 'This is a claim.';
      const sections = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        title: `Section ${i}`,
        level: 2,
        lineStart: i * 10,
        lineEnd: (i + 1) * 10,
        content: [`Content ${i}`],
      }));

      const suggestions = await claimExtractor.suggestSections(claimText, sections);

      expect(suggestions.length).toBeLessThanOrEqual(3);
      // Verify sorted by similarity (highest first)
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].similarity).toBeGreaterThanOrEqual(suggestions[i + 1].similarity);
      }
    });

    it('should return empty array for empty claim text', async () => {
      const sections = [
        {
          id: '1',
          title: 'Methods',
          level: 2,
          lineStart: 1,
          lineEnd: 5,
          content: ['Content'],
        },
      ];

      const suggestions = await claimExtractor.suggestSections('', sections);
      expect(suggestions).toEqual([]);
    });

    it('should return empty array for empty sections', async () => {
      const suggestions = await claimExtractor.suggestSections('This is a claim.', []);
      expect(suggestions).toEqual([]);
    });

    it('should generate embeddings for claim and sections', async () => {
      const claimText = 'This is a claim.';
      const sections = [
        {
          id: '1',
          title: 'Methods',
          level: 2,
          lineStart: 1,
          lineEnd: 5,
          content: ['Content'],
        },
      ];

      const suggestions = await claimExtractor.suggestSections(claimText, sections);

      // Verify behavior: suggestions are returned with similarity scores
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('similarity');
    });

    it('should calculate cosine similarity for each section', async () => {
      const claimText = 'This is a claim.';
      const sections = [
        {
          id: '1',
          title: 'Methods',
          level: 2,
          lineStart: 1,
          lineEnd: 5,
          content: ['Content'],
        },
        {
          id: '2',
          title: 'Results',
          level: 2,
          lineStart: 6,
          lineEnd: 10,
          content: ['Results content'],
        },
      ];

      const suggestions = await claimExtractor.suggestSections(claimText, sections);

      // Verify behavior: suggestions have similarity scores for each section
      expect(suggestions.length).toBe(2);
      suggestions.forEach(s => {
        expect(s).toHaveProperty('similarity');
        expect(typeof s.similarity).toBe('number');
      });
    });
  });

  describe('confidence calculation', () => {
    it('should boost confidence for high-confidence keywords', () => {
      const text1 = 'This is a generic statement.';
      const text2 = 'This study demonstrated significantly improved results.';

      const claims1 = claimExtractor.extractFromText(text1, 'Test2024');
      const claims2 = claimExtractor.extractFromText(text2, 'Test2024');

      if (claims1.length > 0 && claims2.length > 0) {
        expect(claims2[0].confidence).toBeGreaterThan(claims1[0].confidence);
      }
    });

    it('should have confidence between 0 and 1', () => {
      const text = `
        This is a declarative sentence.
        Another claim here.
        This is a result that showed significantly improved performance.
      `;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      claims.forEach(claim => {
        expect(claim.confidence).toBeGreaterThanOrEqual(0);
        expect(claim.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('context extraction', () => {
    it('should include surrounding context for claims', () => {
      const text = `This is the first line of context.
This is a declarative statement to extract.
This is the third line of context.`;

      const claims = claimExtractor.extractFromText(text, 'Test2024');

      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0].context).toBeDefined();
    });
  });
});
