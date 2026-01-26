import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SynthesisEngine } from '../../src/services/SynthesisEngine.js';
import { EmbeddingService } from '../../src/core/EmbeddingService.js';
import { Claim, SynthesisOptions } from '../../src/types/index.js';

describe('SynthesisEngine', () => {
  let synthesisEngine: SynthesisEngine;
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

    synthesisEngine = new SynthesisEngine(mockEmbeddingService);
  });

  describe('groupClaimsByTheme', () => {
    it('should group similar claims together', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Machine learning improves classification accuracy.',
          category: 'Result',
          source: 'Smith2020',
          verified: true,
          primaryQuote: 'Quote 1',
          supportingQuotes: [],
          sections: ['2.1'],
        },
        {
          id: 'C_02',
          text: 'Deep learning achieves better performance.',
          category: 'Result',
          source: 'Jones2021',
          verified: true,
          primaryQuote: 'Quote 2',
          supportingQuotes: [],
          sections: ['2.1'],
        },
        {
          id: 'C_03',
          text: 'Data collection is important for research.',
          category: 'Background',
          source: 'Brown2019',
          verified: true,
          primaryQuote: 'Quote 3',
          supportingQuotes: [],
          sections: ['2.2'],
        },
      ];

      // Mock embeddings
      mockEmbeddingService.generateBatch.mockResolvedValue([
        [0.1, 0.2, 0.3], // C_01
        [0.1, 0.2, 0.35], // C_02 - similar to C_01
        [0.8, 0.1, 0.1], // C_03 - different
      ]);

      // Mock similarity calculations
      mockEmbeddingService.cosineSimilarity
        .mockReturnValueOnce(0.95) // C_01 vs C_02 - high similarity
        .mockReturnValueOnce(0.3) // C_01 vs C_03 - low similarity
        .mockReturnValueOnce(0.3); // C_02 vs C_03 - low similarity

      const themeMap = await synthesisEngine.groupClaimsByTheme(claims, 0.6);

      // Should create clusters
      expect(themeMap.size).toBeGreaterThan(0);

      // Each cluster should have a theme label
      for (const [theme, clusterClaims] of themeMap.entries()) {
        expect(theme).toBeDefined();
        expect(theme.length).toBeGreaterThan(0);
        expect(clusterClaims.length).toBeGreaterThan(0);
      }
    });

    it('should return empty map for empty claims array', async () => {
      const themeMap = await synthesisEngine.groupClaimsByTheme([]);
      expect(themeMap.size).toBe(0);
    });

    it('should generate theme labels based on common keywords', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Machine learning improves classification accuracy.',
          category: 'Result',
          source: 'Smith2020',
          verified: true,
          primaryQuote: 'Quote 1',
          supportingQuotes: [],
          sections: ['2.1'],
        },
        {
          id: 'C_02',
          text: 'Machine learning techniques are widely used.',
          category: 'Background',
          source: 'Jones2021',
          verified: true,
          primaryQuote: 'Quote 2',
          supportingQuotes: [],
          sections: ['2.1'],
        },
      ];

      mockEmbeddingService.generateBatch.mockResolvedValue([
        [0.1, 0.2, 0.3],
        [0.1, 0.2, 0.35],
      ]);

      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.8);

      const themeMap = await synthesisEngine.groupClaimsByTheme(claims, 0.6);

      // Should have at least one theme
      expect(themeMap.size).toBeGreaterThan(0);

      // Theme labels should be meaningful (not empty)
      for (const theme of themeMap.keys()) {
        expect(theme.length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateParagraph', () => {
    const testClaims: Claim[] = [
      {
        id: 'C_01',
        text: 'Machine learning improves classification accuracy.',
        category: 'Result',
        source: 'Smith2020',
        verified: true,
        primaryQuote: 'Quote 1',
        supportingQuotes: [],
        sections: ['2.1'],
      },
      {
        id: 'C_02',
        text: 'Deep learning achieves better performance.',
        category: 'Result',
        source: 'Jones2021',
        verified: true,
        primaryQuote: 'Quote 2',
        supportingQuotes: [],
        sections: ['2.1'],
      },
    ];

    it('should generate narrative style paragraph', async () => {
      const options: SynthesisOptions = {
        claims: testClaims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000,
      };

      const paragraph = await synthesisEngine.generateParagraph(options);

      expect(paragraph.length).toBeGreaterThan(0);
      expect(paragraph).toContain('(Smith2020)');
      expect(paragraph).toContain('(Jones2021)');
    });

    it('should generate analytical style paragraph', async () => {
      const options: SynthesisOptions = {
        claims: testClaims,
        style: 'analytical',
        includeCitations: true,
        maxLength: 1000,
      };

      const paragraph = await synthesisEngine.generateParagraph(options);

      expect(paragraph.length).toBeGreaterThan(0);
      expect(paragraph).toContain('(Smith2020)');
      expect(paragraph).toContain('(Jones2021)');
    });

    it('should generate descriptive style paragraph', async () => {
      const options: SynthesisOptions = {
        claims: testClaims,
        style: 'descriptive',
        includeCitations: true,
        maxLength: 1000,
      };

      const paragraph = await synthesisEngine.generateParagraph(options);

      expect(paragraph.length).toBeGreaterThan(0);
      expect(paragraph).toContain('(Smith2020)');
      expect(paragraph).toContain('(Jones2021)');
    });

    it('should omit citations when includeCitations is false', async () => {
      const options: SynthesisOptions = {
        claims: testClaims,
        style: 'narrative',
        includeCitations: false,
        maxLength: 1000,
      };

      const paragraph = await synthesisEngine.generateParagraph(options);

      expect(paragraph.length).toBeGreaterThan(0);
      expect(paragraph).not.toContain('(Smith2020)');
      expect(paragraph).not.toContain('(Jones2021)');
    });

    it('should truncate paragraph if exceeds maxLength', async () => {
      const options: SynthesisOptions = {
        claims: testClaims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 50,
      };

      const paragraph = await synthesisEngine.generateParagraph(options);

      expect(paragraph.length).toBeLessThanOrEqual(50);
      expect(paragraph).toMatch(/\.\.\.$/); // Should end with ellipsis
    });

    it('should return empty string for empty claims array', async () => {
      const options: SynthesisOptions = {
        claims: [],
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000,
      };

      const paragraph = await synthesisEngine.generateParagraph(options);

      expect(paragraph).toBe('');
    });

    it('should sort claims by year for logical flow', async () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Recent findings show improvement.',
          category: 'Result',
          source: 'Smith2023',
          verified: true,
          primaryQuote: 'Quote 1',
          supportingQuotes: [],
          sections: ['2.1'],
        },
        {
          id: 'C_02',
          text: 'Earlier work established the foundation.',
          category: 'Background',
          source: 'Jones2019',
          verified: true,
          primaryQuote: 'Quote 2',
          supportingQuotes: [],
          sections: ['2.1'],
        },
      ];

      const options: SynthesisOptions = {
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000,
      };

      const paragraph = await synthesisEngine.generateParagraph(options);

      // Earlier work (2019) should appear before recent findings (2023)
      const jones2019Index = paragraph.indexOf('(Jones2019)');
      const smith2023Index = paragraph.indexOf('(Smith2023)');

      expect(jones2019Index).toBeLessThan(smith2023Index);
    });
  });

  describe('generateTransitions', () => {
    it('should generate transitions for multiple claims', () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'First claim.',
          category: 'Result',
          source: 'Smith2020',
          verified: true,
          primaryQuote: 'Quote 1',
          supportingQuotes: [],
          sections: ['2.1'],
        },
        {
          id: 'C_02',
          text: 'Second claim.',
          category: 'Result',
          source: 'Jones2021',
          verified: true,
          primaryQuote: 'Quote 2',
          supportingQuotes: [],
          sections: ['2.1'],
        },
        {
          id: 'C_03',
          text: 'Third claim.',
          category: 'Background',
          source: 'Brown2019',
          verified: true,
          primaryQuote: 'Quote 3',
          supportingQuotes: [],
          sections: ['2.2'],
        },
      ];

      const transitions = synthesisEngine.generateTransitions(claims);

      // Should generate n-1 transitions for n claims
      expect(transitions.length).toBe(claims.length - 1);

      // Each transition should be a non-empty string
      transitions.forEach(transition => {
        expect(transition.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for single claim', () => {
      const claims: Claim[] = [
        {
          id: 'C_01',
          text: 'Single claim.',
          category: 'Result',
          source: 'Smith2020',
          verified: true,
          primaryQuote: 'Quote 1',
          supportingQuotes: [],
          sections: ['2.1'],
        },
      ];

      const transitions = synthesisEngine.generateTransitions(claims);

      expect(transitions).toEqual([]);
    });

    it('should return empty array for empty claims array', () => {
      const transitions = synthesisEngine.generateTransitions([]);

      expect(transitions).toEqual([]);
    });
  });
});
