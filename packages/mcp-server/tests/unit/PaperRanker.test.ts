import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PaperRanker } from '../../src/services/PaperRanker.js';
import { EmbeddingService } from '../../src/core/EmbeddingService.js';
import { OutlineParser } from '../../src/core/OutlineParser.js';
import { PaperMetadata, OutlineSection } from '../../src/types/index.js';

describe('PaperRanker', () => {
  let paperRanker: PaperRanker;
  let embeddingService: EmbeddingService;
  let outlineParser: OutlineParser;

  beforeEach(() => {
    // Create real instances with test configuration
    const apiKey = process.env.OPENAI_API_KEY || 'test-key';
    embeddingService = new EmbeddingService(apiKey, '.cache/test-embeddings');
    outlineParser = new OutlineParser('test-workspace');

    paperRanker = new PaperRanker(
      embeddingService,
      outlineParser,
      50, // citationBoostThreshold
      0.1, // citationBoostFactor
      200, // wordsPerMinute
      500 // wordsPerPage
    );
  });

  describe('calculateReadingTime', () => {
    it('should use word count if available', () => {
      const paper: PaperMetadata = {
        itemKey: 'test1',
        title: 'Test Paper',
        authors: ['Author'],
        year: 2020,
        abstract: 'Abstract',
        wordCount: 4000,
      };

      const readingTime = paperRanker.calculateReadingTime(paper);
      
      // 4000 words / 200 words per minute = 20 minutes
      expect(readingTime).toBe(20);
    });

    it('should estimate from page count if word count not available', () => {
      const paper: PaperMetadata = {
        itemKey: 'test2',
        title: 'Test Paper',
        authors: ['Author'],
        year: 2020,
        abstract: 'Abstract',
        pageCount: 10,
      };

      const readingTime = paperRanker.calculateReadingTime(paper);
      
      // 10 pages * 500 words/page = 5000 words / 200 words per minute = 25 minutes
      expect(readingTime).toBe(25);
    });

    it('should estimate from abstract if neither word count nor page count available', () => {
      const paper: PaperMetadata = {
        itemKey: 'test3',
        title: 'Test Paper',
        authors: ['Author'],
        year: 2020,
        abstract: 'This is a test abstract with twenty words in it to test the estimation logic here.',
      };

      const readingTime = paperRanker.calculateReadingTime(paper);
      
      // Abstract has ~20 words, estimate paper is 200 words (20 * 10)
      // 200 words / 200 words per minute = 1 minute
      expect(readingTime).toBe(1);
    });

    it('should use default estimate if only title available', () => {
      const paper: PaperMetadata = {
        itemKey: 'test4',
        title: 'Test Paper',
        authors: ['Author'],
        year: 2020,
        abstract: '',
      };

      const readingTime = paperRanker.calculateReadingTime(paper);
      
      // Default estimate: 5000 words / 200 words per minute = 25 minutes
      expect(readingTime).toBe(25);
    });

    it('should handle papers with missing metadata', () => {
      const paper: PaperMetadata = {
        itemKey: 'test5',
        title: 'Test Paper',
        authors: ['Author'],
        year: 2020,
        abstract: '',
      };

      const readingTime = paperRanker.calculateReadingTime(paper);
      
      // Should return a reasonable default
      expect(readingTime).toBeGreaterThan(0);
    });

    it('should ensure reading time is proportional to word count', () => {
      const paper1: PaperMetadata = {
        itemKey: 'test6',
        title: 'Short Paper',
        authors: ['Author'],
        year: 2020,
        abstract: 'Abstract',
        wordCount: 2000,
      };

      const paper2: PaperMetadata = {
        itemKey: 'test7',
        title: 'Long Paper',
        authors: ['Author'],
        year: 2020,
        abstract: 'Abstract',
        wordCount: 8000,
      };

      const time1 = paperRanker.calculateReadingTime(paper1);
      const time2 = paperRanker.calculateReadingTime(paper2);
      
      // Paper 2 has 4x the words, so should take 4x the time
      expect(time2).toBe(time1 * 4);
    });
  });

  describe('rankPapersForQuery', () => {
    it('should return empty array for empty query', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'test1',
          title: 'Test Paper',
          authors: ['Author'],
          year: 2020,
          abstract: 'Abstract',
        },
      ];

      const result = await paperRanker.rankPapersForQuery('', papers);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty papers list', async () => {
      const result = await paperRanker.rankPapersForQuery('test query', []);
      expect(result).toEqual([]);
    });

    it('should rank papers by semantic similarity', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'Paper 1',
          authors: ['Author 1'],
          year: 2020,
          abstract: 'Machine learning algorithms',
          wordCount: 5000,
        },
        {
          itemKey: 'paper2',
          title: 'Paper 2',
          authors: ['Author 2'],
          year: 2021,
          abstract: 'Deep learning networks',
          wordCount: 6000,
        },
      ];

      // Mock embeddings
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.9), // High similarity to query
        new Array(1536).fill(0.5), // Lower similarity to query
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity')
        .mockReturnValueOnce(0.9) // Paper 1
        .mockReturnValueOnce(0.5); // Paper 2

      const result = await paperRanker.rankPapersForQuery('machine learning', papers);

      expect(result).toHaveLength(2);
      expect(result[0].paper.itemKey).toBe('paper1'); // Higher similarity
      expect(result[1].paper.itemKey).toBe('paper2'); // Lower similarity
      expect(result[0].semanticSimilarity).toBe(0.9);
      expect(result[1].semanticSimilarity).toBe(0.5);
    });

    it('should apply citation boost for highly-cited papers', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'Low Citations',
          authors: ['Author 1'],
          year: 2020,
          abstract: 'Abstract 1',
          citationCount: 10,
          wordCount: 5000,
        },
        {
          itemKey: 'paper2',
          title: 'High Citations',
          authors: ['Author 2'],
          year: 2021,
          abstract: 'Abstract 2',
          citationCount: 100,
          wordCount: 5000,
        },
      ];

      // Mock equal semantic similarity
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.5),
        new Array(1536).fill(0.5),
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity')
        .mockReturnValueOnce(0.8)
        .mockReturnValueOnce(0.8);

      const result = await paperRanker.rankPapersForQuery('test query', papers);

      expect(result).toHaveLength(2);
      // Paper 2 should rank higher due to citation boost
      expect(result[0].paper.itemKey).toBe('paper2');
      expect(result[0].citationBoost).toBeGreaterThan(0);
      expect(result[1].citationBoost).toBe(0);
      expect(result[0].relevanceScore).toBeGreaterThan(result[1].relevanceScore);
    });

    it('should include all required fields in ranked papers', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'Test Paper',
          authors: ['Author'],
          year: 2020,
          abstract: 'Test abstract',
          citationCount: 75,
          wordCount: 4000,
        },
      ];

      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.5)
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      const result = await paperRanker.rankPapersForQuery('test query', papers);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('paper');
      expect(result[0]).toHaveProperty('relevanceScore');
      expect(result[0]).toHaveProperty('semanticSimilarity');
      expect(result[0]).toHaveProperty('citationBoost');
      expect(result[0]).toHaveProperty('estimatedReadingTime');
      expect(result[0].estimatedReadingTime).toBe(20); // 4000 words / 200 wpm
    });

    it('should sort papers by descending relevance score', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'Paper 1',
          authors: ['Author 1'],
          year: 2020,
          abstract: 'Abstract 1',
          wordCount: 5000,
        },
        {
          itemKey: 'paper2',
          title: 'Paper 2',
          authors: ['Author 2'],
          year: 2021,
          abstract: 'Abstract 2',
          wordCount: 5000,
        },
        {
          itemKey: 'paper3',
          title: 'Paper 3',
          authors: ['Author 3'],
          year: 2022,
          abstract: 'Abstract 3',
          wordCount: 5000,
        },
      ];

      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.5),
        new Array(1536).fill(0.9),
        new Array(1536).fill(0.7),
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity')
        .mockReturnValueOnce(0.5) // Paper 1
        .mockReturnValueOnce(0.9) // Paper 2
        .mockReturnValueOnce(0.7); // Paper 3

      const result = await paperRanker.rankPapersForQuery('test query', papers);

      expect(result).toHaveLength(3);
      expect(result[0].paper.itemKey).toBe('paper2'); // Highest similarity
      expect(result[1].paper.itemKey).toBe('paper3'); // Middle similarity
      expect(result[2].paper.itemKey).toBe('paper1'); // Lowest similarity
      expect(result[0].relevanceScore).toBeGreaterThanOrEqual(result[1].relevanceScore);
      expect(result[1].relevanceScore).toBeGreaterThanOrEqual(result[2].relevanceScore);
    });
  });

  describe('rankPapersForSection', () => {
    it('should throw error if section not found', async () => {
      jest.spyOn(outlineParser, 'getSectionById').mockReturnValue(null);

      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'Test Paper',
          authors: ['Author'],
          year: 2020,
          abstract: 'Abstract',
        },
      ];

      await expect(
        paperRanker.rankPapersForSection('nonexistent', papers)
      ).rejects.toThrow('Section not found: nonexistent');
    });

    it('should return empty array for empty papers list', async () => {
      const result = await paperRanker.rankPapersForSection('section1', []);
      expect(result).toEqual([]);
    });

    it('should rank papers using section content', async () => {
      const section: OutlineSection = {
        id: 'section1',
        title: 'Machine Learning Methods',
        level: 2,
        lineStart: 1,
        lineEnd: 10,
        content: ['This section discusses machine learning algorithms.'],
      };

      jest.spyOn(outlineParser, 'getSectionById').mockReturnValue(section);

      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'ML Paper',
          authors: ['Author'],
          year: 2020,
          abstract: 'Machine learning algorithms',
          wordCount: 5000,
        },
      ];

      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.9)
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.85);

      const result = await paperRanker.rankPapersForSection('section1', papers);

      expect(result).toHaveLength(1);
      expect(result[0].paper.itemKey).toBe('paper1');
      expect(result[0].semanticSimilarity).toBe(0.85);
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Machine Learning Methods')
      );
    });
  });

  describe('citation boost calculation', () => {
    it('should not boost papers below threshold', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'Low Citations',
          authors: ['Author'],
          year: 2020,
          abstract: 'Abstract',
          citationCount: 49, // Below threshold of 50
          wordCount: 5000,
        },
      ];

      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.5)
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.8);

      const result = await paperRanker.rankPapersForQuery('test', papers);

      expect(result[0].citationBoost).toBe(0);
    });

    it('should boost papers at threshold', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'At Threshold',
          authors: ['Author'],
          year: 2020,
          abstract: 'Abstract',
          citationCount: 50, // At threshold
          wordCount: 5000,
        },
      ];

      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.5)
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.8);

      const result = await paperRanker.rankPapersForQuery('test', papers);

      expect(result[0].citationBoost).toBe(0); // log10(1) = 0
    });

    it('should boost papers above threshold', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'High Citations',
          authors: ['Author'],
          year: 2020,
          abstract: 'Abstract',
          citationCount: 500, // 10x threshold
          wordCount: 5000,
        },
      ];

      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.5)
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.8);

      const result = await paperRanker.rankPapersForQuery('test', papers);

      // log10(500/50) = log10(10) = 1, boost = 0.1 * 1 = 0.1
      expect(result[0].citationBoost).toBeCloseTo(0.1, 2);
    });

    it('should handle papers with no citation count', async () => {
      const papers: PaperMetadata[] = [
        {
          itemKey: 'paper1',
          title: 'No Citations',
          authors: ['Author'],
          year: 2020,
          abstract: 'Abstract',
          wordCount: 5000,
        },
      ];

      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.5)
      );
      jest.spyOn(embeddingService, 'generateBatch').mockResolvedValue([
        new Array(1536).fill(0.5)
      ]);
      jest.spyOn(embeddingService, 'cosineSimilarity').mockReturnValue(0.8);

      const result = await paperRanker.rankPapersForQuery('test', papers);

      expect(result[0].citationBoost).toBe(0);
    });
  });
});
