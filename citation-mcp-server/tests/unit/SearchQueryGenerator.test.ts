import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SearchQueryGenerator } from '../../src/services/SearchQueryGenerator.js';
import { OutlineParser } from '../../src/core/OutlineParser.js';
import { OutlineSection } from '../../src/types/index.js';

describe('SearchQueryGenerator', () => {
  let searchQueryGenerator: SearchQueryGenerator;
  let mockOutlineParser: OutlineParser;

  beforeEach(() => {
    // Create mock outline parser
    mockOutlineParser = {
      parse: jest.fn<() => Promise<OutlineSection[]>>(),
      getSectionAtPosition: jest.fn<() => OutlineSection | null>(),
      getSectionById: jest.fn<() => OutlineSection | null>(),
      getSections: jest.fn<() => OutlineSection[]>(),
      getFilePath: jest.fn<() => string | null>(),
    } as any;

    searchQueryGenerator = new SearchQueryGenerator(mockOutlineParser);
  });

  describe('generateQueriesForSection', () => {
    it('should generate 2-5 unique queries for a section', async () => {
      const section: OutlineSection = {
        id: '2.1',
        title: 'Machine Learning Methods',
        level: 2,
        lineStart: 10,
        lineEnd: 20,
        content: [
          'What are the most effective machine learning algorithms for classification?',
          'This section explores various approaches to supervised learning.',
          'Deep learning techniques have shown promising results in recent years.',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('2.1');

      // Should return 2-5 queries
      expect(queries.length).toBeGreaterThanOrEqual(2);
      expect(queries.length).toBeLessThanOrEqual(5);

      // All queries should be unique
      const uniqueQueries = new Set(queries);
      expect(uniqueQueries.size).toBe(queries.length);

      // All queries should be non-empty strings
      queries.forEach(query => {
        expect(typeof query).toBe('string');
        expect(query.length).toBeGreaterThan(0);
      });
    });

    it('should extract key terms from section title', async () => {
      const section: OutlineSection = {
        id: '3.2',
        title: '3.2 Neural Network Architecture Design',
        level: 2,
        lineStart: 30,
        lineEnd: 40,
        content: ['Content about neural networks.'],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('3.2');

      // Should include terms from the title
      const allQueriesText = queries.join(' ').toLowerCase();
      expect(allQueriesText).toMatch(/neural|network|architecture|design/);
    });

    it('should convert questions to search queries', async () => {
      const section: OutlineSection = {
        id: '4.1',
        title: 'Research Questions',
        level: 2,
        lineStart: 40,
        lineEnd: 50,
        content: [
          'What are the main challenges in deep learning optimization?',
          'How do different activation functions affect model performance?',
          'Why is batch normalization important for training stability?',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('4.1');

      // Should have extracted queries from questions
      expect(queries.length).toBeGreaterThanOrEqual(2);

      // Queries should contain key terms from the questions
      const allQueriesText = queries.join(' ').toLowerCase();
      expect(allQueriesText).toMatch(/deep|learning|optimization|activation|functions|batch|normalization/);
    });

    it('should extract domain-specific terminology', async () => {
      const section: OutlineSection = {
        id: '5.1',
        title: 'Methodology',
        level: 2,
        lineStart: 50,
        lineEnd: 60,
        content: [
          'We use convolutional neural networks for image classification.',
          'The gradient descent algorithm optimizes the loss function.',
          'Cross-validation ensures model generalization performance.',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('5.1');

      // Should extract domain-specific terms
      const allQueriesText = queries.join(' ').toLowerCase();
      expect(allQueriesText).toMatch(/convolutional|neural|networks|gradient|descent|algorithm|cross-validation/);
    });

    it('should ensure all queries are unique', async () => {
      const section: OutlineSection = {
        id: '6.1',
        title: 'Machine Learning Machine Learning',
        level: 2,
        lineStart: 60,
        lineEnd: 70,
        content: [
          'Machine learning is important.',
          'Machine learning techniques are useful.',
          'Machine learning applications are widespread.',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('6.1');

      // All queries should be unique (no duplicates)
      const uniqueQueries = new Set(queries);
      expect(uniqueQueries.size).toBe(queries.length);
    });

    it('should handle sections with minimal content', async () => {
      const section: OutlineSection = {
        id: '7.1',
        title: 'Introduction',
        level: 2,
        lineStart: 70,
        lineEnd: 75,
        content: ['Brief overview.'],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('7.1');

      // Should still generate at least 2 queries
      expect(queries.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle sections with only questions', async () => {
      const section: OutlineSection = {
        id: '8.1',
        title: 'Open Questions',
        level: 2,
        lineStart: 80,
        lineEnd: 90,
        content: [
          'What is the best approach?',
          'How can we improve performance?',
          'Why does this method work?',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('8.1');

      // Should convert questions to queries
      expect(queries.length).toBeGreaterThanOrEqual(2);
      expect(queries.length).toBeLessThanOrEqual(5);

      // Queries should not contain question marks
      queries.forEach(query => {
        expect(query).not.toMatch(/\?/);
      });
    });

    it('should throw error for non-existent section', async () => {
      mockOutlineParser.getSectionById.mockReturnValue(null);

      await expect(
        searchQueryGenerator.generateQueriesForSection('nonexistent')
      ).rejects.toThrow('Section not found: nonexistent');
    });

    it('should handle sections with technical terms and acronyms', async () => {
      const section: OutlineSection = {
        id: '9.1',
        title: 'CNN and RNN Architectures',
        level: 2,
        lineStart: 90,
        lineEnd: 100,
        content: [
          'Convolutional Neural Networks (CNN) are effective for image processing.',
          'Recurrent Neural Networks (RNN) handle sequential data well.',
          'LSTM and GRU are popular RNN variants.',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('9.1');

      // Should extract technical terms
      expect(queries.length).toBeGreaterThanOrEqual(2);
      
      const allQueriesText = queries.join(' ').toLowerCase();
      expect(allQueriesText).toMatch(/cnn|rnn|convolutional|recurrent|neural|networks|lstm|gru/);
    });

    it('should handle sections with hyphenated terms', async () => {
      const section: OutlineSection = {
        id: '10.1',
        title: 'State-of-the-Art Methods',
        level: 2,
        lineStart: 100,
        lineEnd: 110,
        content: [
          'State-of-the-art deep learning models achieve high accuracy.',
          'Cross-validation and fine-tuning improve performance.',
          'Multi-task learning enables knowledge transfer.',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('10.1');

      // Should handle hyphenated terms
      expect(queries.length).toBeGreaterThanOrEqual(2);
      
      const allQueriesText = queries.join(' ').toLowerCase();
      expect(allQueriesText).toMatch(/state-of-the-art|cross-validation|fine-tuning|multi-task/);
    });

    it('should prioritize longer, more specific phrases', async () => {
      const section: OutlineSection = {
        id: '11.1',
        title: 'Advanced Techniques',
        level: 2,
        lineStart: 110,
        lineEnd: 120,
        content: [
          'Transfer learning with pre-trained models accelerates development.',
          'Attention mechanisms improve sequence-to-sequence models.',
          'Regularization techniques prevent overfitting in neural networks.',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('11.1');

      // Should generate meaningful queries
      expect(queries.length).toBeGreaterThanOrEqual(2);
      
      // Queries should contain meaningful terms (not just stop words)
      queries.forEach(query => {
        const words = query.split(' ');
        expect(words.length).toBeGreaterThan(0);
        // Should not be just stop words
        expect(query).not.toMatch(/^(the|a|an|and|or|but|in|on|at|to|for)$/);
      });
    });

    it('should handle empty content array', async () => {
      const section: OutlineSection = {
        id: '12.1',
        title: 'Empty Section',
        level: 2,
        lineStart: 120,
        lineEnd: 125,
        content: [],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('12.1');

      // Should still generate queries from the title
      expect(queries.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit queries to maximum of 5', async () => {
      const section: OutlineSection = {
        id: '13.1',
        title: 'Comprehensive Overview of Machine Learning Techniques',
        level: 2,
        lineStart: 130,
        lineEnd: 150,
        content: [
          'What are supervised learning algorithms?',
          'How does unsupervised learning work?',
          'What is reinforcement learning?',
          'Deep learning has revolutionized artificial intelligence.',
          'Neural networks are the foundation of modern AI systems.',
          'Convolutional networks excel at image recognition tasks.',
          'Recurrent networks handle sequential data effectively.',
          'Transformer architectures have improved natural language processing.',
          'Attention mechanisms enable better context understanding.',
          'Transfer learning reduces training time significantly.',
        ],
      };

      mockOutlineParser.getSectionById.mockReturnValue(section);

      const queries = await searchQueryGenerator.generateQueriesForSection('13.1');

      // Should not exceed 5 queries
      expect(queries.length).toBeLessThanOrEqual(5);
      expect(queries.length).toBeGreaterThanOrEqual(2);
    });
  });
});
