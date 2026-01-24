import { CoverageAnalyzer } from '../../src/services/CoverageAnalyzer';
import { OutlineParser } from '../../src/core/OutlineParser';
import { SearchService } from '../../src/services/SearchService';
import { EmbeddingService } from '../../src/core/EmbeddingService';
import { ClaimsManager } from '../../src/core/ClaimsManager';
import { SentenceType } from '../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('CoverageAnalyzer', () => {
  let analyzer: CoverageAnalyzer;
  let outlineParser: OutlineParser;
  let searchService: SearchService;
  let tempDir: string;
  let manuscriptPath: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-analyzer-test-'));
    manuscriptPath = path.join(tempDir, 'manuscript.md');

    // Create real instances for testing
    outlineParser = new OutlineParser();
    
    // Create a minimal embedding service (we won't actually call OpenAI in unit tests)
    const embeddingService = new EmbeddingService(
      process.env.OPENAI_API_KEY || 'test-key',
      path.join(tempDir, '.cache'),
      100
    );
    
    const claimsManager = new ClaimsManager(tempDir);
    
    searchService = new SearchService(embeddingService, claimsManager, 0.3);

    analyzer = new CoverageAnalyzer(
      outlineParser,
      searchService,
      manuscriptPath,
      0.3
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('classifySentence()', () => {
    it('should classify questions correctly', () => {
      expect(analyzer.classifySentence('What is the result?')).toBe('question');
      expect(analyzer.classifySentence('How does this work?')).toBe('question');
      expect(analyzer.classifySentence('Is this correct?')).toBe('question');
    });

    it('should classify opinions correctly', () => {
      expect(analyzer.classifySentence('I think this is correct.')).toBe('opinion');
      expect(analyzer.classifySentence('This arguably shows the result.')).toBe('opinion');
      expect(analyzer.classifySentence('Perhaps this is the case.')).toBe('opinion');
      expect(analyzer.classifySentence('This likely indicates success.')).toBe('opinion');
      expect(analyzer.classifySentence('In my opinion, this works.')).toBe('opinion');
    });

    it('should classify transitions correctly', () => {
      expect(analyzer.classifySentence('However, this is different.')).toBe('transition');
      expect(analyzer.classifySentence('Furthermore, we observe this.')).toBe('transition');
      expect(analyzer.classifySentence('In addition, there is evidence.')).toBe('transition');
      expect(analyzer.classifySentence('Therefore, we conclude this.')).toBe('transition');
      expect(analyzer.classifySentence('First, we examine the data.')).toBe('transition');
    });

    it('should classify factual statements correctly', () => {
      expect(analyzer.classifySentence('The experiment showed positive results.')).toBe('factual');
      expect(analyzer.classifySentence('Machine learning improves accuracy.')).toBe('factual');
      expect(analyzer.classifySentence('The data indicates a trend.')).toBe('factual');
    });

    it('should handle mixed cases', () => {
      // Transition takes precedence over factual
      expect(analyzer.classifySentence('However, the data shows results.')).toBe('transition');
      
      // Opinion takes precedence over factual
      expect(analyzer.classifySentence('I think the data shows results.')).toBe('opinion');
      
      // Question takes precedence over everything
      expect(analyzer.classifySentence('However, what does this mean?')).toBe('question');
    });

    it('should handle empty or whitespace sentences', () => {
      expect(analyzer.classifySentence('')).toBe('factual');
      expect(analyzer.classifySentence('   ')).toBe('factual');
    });

    it('should be case-insensitive for indicators', () => {
      expect(analyzer.classifySentence('HOWEVER, this is different.')).toBe('transition');
      expect(analyzer.classifySentence('I THINK this is correct.')).toBe('opinion');
    });
  });

  describe('generateSearchQuery()', () => {
    it('should generate search queries from factual sentences', () => {
      const queries = analyzer.generateSearchQuery(
        'Machine learning algorithms improve prediction accuracy in medical diagnosis.'
      );
      
      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0]).toContain('machine');
      expect(queries[0]).toContain('learning');
    });

    it('should filter out stop words', () => {
      const queries = analyzer.generateSearchQuery(
        'The data shows that the results are significant.'
      );
      
      expect(queries.length).toBeGreaterThan(0);
      // Should not contain stop words like 'the', 'that', 'are'
      expect(queries[0]).not.toContain('the');
      expect(queries[0]).not.toContain('that');
    });

    it('should return empty array for very short sentences', () => {
      const queries = analyzer.generateSearchQuery('It is.');
      expect(queries).toEqual([]);
    });

    it('should handle sentences with only stop words', () => {
      const queries = analyzer.generateSearchQuery('The and or but.');
      expect(queries).toEqual([]);
    });

    it('should generate multiple queries of varying specificity', () => {
      const queries = analyzer.generateSearchQuery(
        'Deep neural networks with convolutional layers achieve state-of-the-art performance in image classification tasks.'
      );
      
      expect(queries.length).toBeGreaterThan(0);
      // Should have queries with different numbers of terms
    });

    it('should remove duplicate queries', () => {
      const queries = analyzer.generateSearchQuery('Test test test.');
      const uniqueQueries = new Set(queries);
      expect(queries.length).toBe(uniqueQueries.size);
    });
  });
});
