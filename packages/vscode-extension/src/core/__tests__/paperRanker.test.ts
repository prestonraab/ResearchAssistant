import { PaperRanker, PaperMetadata, RankedPaper } from '../paperRanker';
import { EmbeddingService } from '@research-assistant/core';
import { OutlineSection } from '../outlineParser';

describe('PaperRanker', () => {
  let embeddingService: EmbeddingService;
  let paperRanker: PaperRanker;

  beforeEach(() => {
    embeddingService = new EmbeddingService(100);
    paperRanker = new PaperRanker(embeddingService);
  });

  // Helper function to create test papers
  const createPaper = (
    itemKey: string,
    title: string,
    abstract: string,
    citationCount?: number,
    pageCount?: number,
    wordCount?: number
  ): PaperMetadata => ({
    itemKey,
    title,
    authors: ['Author'],
    year: 2020,
    abstract,
    citationCount,
    pageCount,
    wordCount,
    tags: []
  });

  // Helper function to create test section
  const createSection = (
    title: string,
    content: string[]
  ): OutlineSection => ({
    id: 'test-section',
    level: 2,
    title,
    content,
    parent: null,
    children: [],
    lineStart: 1,
    lineEnd: 10
  });

  describe('rankPapers', () => {
    it('should rank papers by semantic similarity to section content', async () => {
      const section = createSection(
        'Machine Learning Applications',
        ['Deep learning for image classification', 'Neural networks in computer vision']
      );

      const papers = [
        createPaper('p1', 'Deep Learning for Images', 'Neural networks for image classification using CNNs'),
        createPaper('p2', 'Database Systems', 'Relational database management and SQL optimization'),
        createPaper('p3', 'Computer Vision Methods', 'Image recognition using deep learning techniques')
      ];

      const ranked = await paperRanker.rankPapers(papers, section);

      // Papers about ML/CV should rank higher than database paper
      expect(ranked[0].paper.itemKey).not.toBe('p2');
      expect(ranked[2].paper.itemKey).toBe('p2');
      
      // All papers should have relevance scores
      ranked.forEach(rp => {
        expect(rp.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(rp.semanticSimilarity).toBeGreaterThanOrEqual(0);
      });
    });

    it('should boost ranking for highly-cited papers', async () => {
      const section = createSection('Research Methods', ['Methodology and approaches']);

      const papers = [
        createPaper('p1', 'Method A', 'A research method', 10), // Low citations
        createPaper('p2', 'Method B', 'A research method', 500), // High citations
        createPaper('p3', 'Method C', 'A research method', 100) // Medium citations
      ];

      const ranked = await paperRanker.rankPapers(papers, section);

      // Paper with more citations should have higher citation boost
      const p1 = ranked.find(r => r.paper.itemKey === 'p1')!;
      const p2 = ranked.find(r => r.paper.itemKey === 'p2')!;
      const p3 = ranked.find(r => r.paper.itemKey === 'p3')!;

      expect(p2.citationBoost).toBeGreaterThan(p3.citationBoost);
      expect(p3.citationBoost).toBeGreaterThan(p1.citationBoost);
    });

    it('should boost papers cited by multiple papers in collection', async () => {
      const section = createSection('Research', ['Methods']);

      const papers = [
        createPaper('p1', 'Foundation Paper', 'Important foundational work'),
        createPaper('p2', 'Recent Paper', 'Recent work building on foundations')
      ];

      // p1 is cited by 3 papers in the collection
      const citedByMap = new Map<string, Set<string>>();
      citedByMap.set('p1', new Set(['citing1', 'citing2', 'citing3']));
      citedByMap.set('p2', new Set()); // Not cited

      const ranked = await paperRanker.rankPapers(papers, section, citedByMap);

      const p1 = ranked.find(r => r.paper.itemKey === 'p1')!;
      const p2 = ranked.find(r => r.paper.itemKey === 'p2')!;

      // p1 should have higher citation boost due to being cited by collection papers
      expect(p1.citationBoost).toBeGreaterThan(p2.citationBoost);
    });

    it('should calculate estimated reading time for all papers', async () => {
      const section = createSection('Test', ['Content']);

      const papers = [
        createPaper('p1', 'Paper 1', 'Abstract', undefined, undefined, 5000), // 5000 words
        createPaper('p2', 'Paper 2', 'Abstract', undefined, 10), // 10 pages
        createPaper('p3', 'Paper 3', 'Abstract') // No length info
      ];

      const ranked = await paperRanker.rankPapers(papers, section);

      // All papers should have reading time estimates
      ranked.forEach(rp => {
        expect(rp.estimatedReadingTime).toBeGreaterThan(0);
        expect(typeof rp.estimatedReadingTime).toBe('number');
      });
    });

    it('should return papers sorted by relevance score descending', async () => {
      const section = createSection('Topic', ['Content']);

      const papers = [
        createPaper('p1', 'Paper 1', 'Abstract 1'),
        createPaper('p2', 'Paper 2', 'Abstract 2'),
        createPaper('p3', 'Paper 3', 'Abstract 3')
      ];

      const ranked = await paperRanker.rankPapers(papers, section);

      // Verify descending order
      for (let i = 0; i < ranked.length - 1; i++) {
        expect(ranked[i].relevanceScore).toBeGreaterThanOrEqual(ranked[i + 1].relevanceScore);
      }
    });

    it('should handle empty paper list', async () => {
      const section = createSection('Topic', ['Content']);
      const ranked = await paperRanker.rankPapers([], section);
      
      expect(ranked).toEqual([]);
    });

    it('should handle section with no content', async () => {
      const section = createSection('Title Only', []);
      const papers = [createPaper('p1', 'Paper', 'Abstract')];

      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked).toHaveLength(1);
      expect(ranked[0].relevanceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle papers with no abstract', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [
        createPaper('p1', 'Paper with long descriptive title about machine learning', '')
      ];

      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked).toHaveLength(1);
      expect(ranked[0].semanticSimilarity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateReadingTime', () => {
    it('should calculate reading time from word count', () => {
      const paper = createPaper('p1', 'Paper', 'Abstract', undefined, undefined, 4000);
      const time = paperRanker.calculateReadingTime(paper);

      // 4000 words at 200 wpm = 20 minutes
      expect(time).toBe(20);
    });

    it('should calculate reading time from page count when word count unavailable', () => {
      const paper = createPaper('p1', 'Paper', 'Abstract', undefined, 10);
      const time = paperRanker.calculateReadingTime(paper);

      // 10 pages * 500 words/page = 5000 words at 200 wpm = 25 minutes
      expect(time).toBe(25);
    });

    it('should estimate reading time from abstract when no length info available', () => {
      const longAbstract = 'word '.repeat(300); // 300 words
      const paper = createPaper('p1', 'Paper', longAbstract);
      const time = paperRanker.calculateReadingTime(paper);

      // Should estimate based on abstract being ~3% of paper
      expect(time).toBeGreaterThan(0);
    });

    it('should have minimum reading time estimate', () => {
      const paper = createPaper('p1', 'Short', 'Brief');
      const time = paperRanker.calculateReadingTime(paper);

      // Should have reasonable minimum (at least a few minutes)
      expect(time).toBeGreaterThan(5);
    });

    it('should round up reading time to nearest minute', () => {
      const paper = createPaper('p1', 'Paper', 'Abstract', undefined, undefined, 250);
      const time = paperRanker.calculateReadingTime(paper);

      // 250 words at 200 wpm = 1.25 minutes, should round up to 2
      expect(time).toBe(2);
    });

    it('should handle very long papers', () => {
      const paper = createPaper('p1', 'Long Paper', 'Abstract', undefined, undefined, 50000);
      const time = paperRanker.calculateReadingTime(paper);

      // 50000 words at 200 wpm = 250 minutes
      expect(time).toBe(250);
    });
  });

  describe('filterByRelevance', () => {
    it('should filter papers below relevance threshold', async () => {
      const section = createSection('Machine Learning', ['Deep learning']);
      
      const papers = [
        createPaper('p1', 'Deep Learning', 'Neural networks and deep learning'),
        createPaper('p2', 'Unrelated Topic', 'Something completely different')
      ];

      const ranked = await paperRanker.rankPapers(papers, section);
      const filtered = paperRanker.filterByRelevance(ranked, 0.3);

      // Should filter out low-relevance papers
      expect(filtered.length).toBeLessThanOrEqual(ranked.length);
      filtered.forEach(rp => {
        expect(rp.relevanceScore).toBeGreaterThanOrEqual(0.3);
      });
    });

    it('should use default threshold of 0.3', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [createPaper('p1', 'Paper', 'Abstract')];
      
      const ranked = await paperRanker.rankPapers(papers, section);
      const filtered = paperRanker.filterByRelevance(ranked);

      filtered.forEach(rp => {
        expect(rp.relevanceScore).toBeGreaterThanOrEqual(0.3);
      });
    });

    it('should return empty array if no papers meet threshold', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [createPaper('p1', 'Paper', 'Abstract')];
      
      const ranked = await paperRanker.rankPapers(papers, section);
      const filtered = paperRanker.filterByRelevance(ranked, 2.0); // Impossibly high threshold

      expect(filtered).toEqual([]);
    });
  });

  describe('groupByReadingTime', () => {
    it('should group papers by reading time ranges', async () => {
      const section = createSection('Topic', ['Content']);
      
      const papers = [
        createPaper('p1', 'Quick', 'Abstract', undefined, undefined, 2000), // ~10 min
        createPaper('p2', 'Short', 'Abstract', undefined, undefined, 4000), // ~20 min
        createPaper('p3', 'Medium', 'Abstract', undefined, undefined, 8000), // ~40 min
        createPaper('p4', 'Long', 'Abstract', undefined, undefined, 15000) // ~75 min
      ];

      const ranked = await paperRanker.rankPapers(papers, section);
      const grouped = paperRanker.groupByReadingTime(ranked);

      // Should have multiple groups
      expect(grouped.size).toBeGreaterThan(0);

      // Each group should have papers
      for (const [label, papers] of grouped.entries()) {
        expect(papers.length).toBeGreaterThan(0);
        expect(typeof label).toBe('string');
      }
    });

    it('should correctly categorize quick reads', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [
        createPaper('p1', 'Quick', 'Abstract', undefined, undefined, 2000) // ~10 min
      ];

      const ranked = await paperRanker.rankPapers(papers, section);
      const grouped = paperRanker.groupByReadingTime(ranked);

      const quickReads = grouped.get('Quick read (< 15 min)');
      expect(quickReads).toBeDefined();
      expect(quickReads!.length).toBe(1);
    });

    it('should handle empty paper list', () => {
      const grouped = paperRanker.groupByReadingTime([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should use default configuration values', () => {
      const config = paperRanker.getConfig();

      expect(config.citationBoostFactor).toBe(0.1);
      expect(config.citationThreshold).toBe(50);
      expect(config.wordsPerMinute).toBe(200);
      expect(config.defaultPageWordCount).toBe(500);
    });

    it('should allow custom configuration', () => {
      const customRanker = new PaperRanker(embeddingService, {
        citationBoostFactor: 0.2,
        wordsPerMinute: 250
      });

      const config = customRanker.getConfig();
      expect(config.citationBoostFactor).toBe(0.2);
      expect(config.wordsPerMinute).toBe(250);
      expect(config.citationThreshold).toBe(50); // Default value
    });

    it('should allow updating configuration', () => {
      paperRanker.updateConfig({ wordsPerMinute: 300 });
      
      const config = paperRanker.getConfig();
      expect(config.wordsPerMinute).toBe(300);
    });

    it('should affect reading time calculation when config updated', () => {
      const paper = createPaper('p1', 'Paper', 'Abstract', undefined, undefined, 6000);
      
      // Default: 6000 words at 200 wpm = 30 minutes
      let time = paperRanker.calculateReadingTime(paper);
      expect(time).toBe(30);

      // Update to 300 wpm: 6000 words at 300 wpm = 20 minutes
      paperRanker.updateConfig({ wordsPerMinute: 300 });
      time = paperRanker.calculateReadingTime(paper);
      expect(time).toBe(20);
    });
  });

  describe('edge cases', () => {
    it('should handle papers with zero citations', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [createPaper('p1', 'Paper', 'Abstract', 0)];

      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked[0].citationBoost).toBeGreaterThanOrEqual(0);
    });

    it('should handle papers with undefined citation count', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [createPaper('p1', 'Paper', 'Abstract', undefined)];

      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked[0].citationBoost).toBeGreaterThanOrEqual(0);
    });

    it('should handle very high citation counts', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [createPaper('p1', 'Highly Cited', 'Abstract', 10000)];

      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked[0].citationBoost).toBeGreaterThan(0);
      expect(ranked[0].citationBoost).toBeLessThan(1); // Should be reasonable
    });

    it('should handle empty cited-by set', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = [createPaper('p1', 'Paper', 'Abstract')];
      
      const citedByMap = new Map<string, Set<string>>();
      citedByMap.set('p1', new Set());

      const ranked = await paperRanker.rankPapers(papers, section, citedByMap);

      expect(ranked[0].citationBoost).toBeGreaterThanOrEqual(0);
    });

    it('should handle section with very long content', async () => {
      const longContent = Array(100).fill('Content line with various words');
      const section = createSection('Topic', longContent);
      const papers = [createPaper('p1', 'Paper', 'Abstract')];

      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked).toHaveLength(1);
      expect(ranked[0].relevanceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle papers with very long abstracts', async () => {
      const longAbstract = 'word '.repeat(1000);
      const section = createSection('Topic', ['Content']);
      const papers = [createPaper('p1', 'Paper', longAbstract)];

      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked).toHaveLength(1);
      expect(ranked[0].semanticSimilarity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('integration with EmbeddingService', () => {
    it('should use embedding service for semantic similarity', async () => {
      const section = createSection('Machine Learning', ['Neural networks']);
      const papers = [
        createPaper('p1', 'ML Paper', 'Machine learning and neural networks'),
        createPaper('p2', 'Other Paper', 'Completely different topic')
      ];

      const ranked = await paperRanker.rankPapers(papers, section);

      // Paper about ML should have higher semantic similarity
      expect(ranked[0].paper.itemKey).toBe('p1');
      expect(ranked[0].semanticSimilarity).toBeGreaterThan(ranked[1].semanticSimilarity);
    });

    it('should batch generate embeddings for efficiency', async () => {
      const section = createSection('Topic', ['Content']);
      const papers = Array(10).fill(null).map((_, i) => 
        createPaper(`p${i}`, `Paper ${i}`, `Abstract ${i}`)
      );

      // Should not throw and should complete efficiently
      const ranked = await paperRanker.rankPapers(papers, section);

      expect(ranked).toHaveLength(10);
    });
  });
});
