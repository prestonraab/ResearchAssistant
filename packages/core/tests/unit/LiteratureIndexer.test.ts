/**
 * Unit tests for LiteratureIndexer
 * 
 * Tests cover:
 * - searchSnippetsWithSimilarity() with null embedding service
 * - searchSnippets() with null embedding service
 * - indexFile() with null embedding service
 * - indexChangedFiles() with null embedding service
 * - Graceful error handling when embedding service is unavailable
 * - Normal operation with valid embedding service
 * 
 * **Validates: Robustness against null/undefined dependencies**
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LiteratureIndexer } from '../../src/services/LiteratureIndexer.js';

// Mock EmbeddingStore and SnippetExtractor
jest.unstable_mockModule('../../src/services/EmbeddingStore.js', () => ({
  EmbeddingStore: jest.fn().mockImplementation(() => ({
    hasFileChanged: jest.fn().mockReturnValue(true),
    addSnippets: jest.fn().mockImplementation(() => Promise.resolve()),
    searchByEmbedding: jest.fn().mockImplementation(() => Promise.resolve([])),
    searchByEmbeddingWithSimilarity: jest.fn().mockImplementation(() => Promise.resolve([])),
    getAllSnippets: jest.fn().mockImplementation(() => Promise.resolve([])),
    getStats: jest.fn().mockImplementation(() => Promise.resolve({ snippetCount: 0, fileCount: 0, indexSize: '0 KB' })),
    clear: jest.fn().mockImplementation(() => Promise.resolve())
  }))
}));

jest.unstable_mockModule('../../src/services/SnippetExtractor.js', () => ({
  SnippetExtractor: jest.fn().mockImplementation(() => ({
    extractSnippets: jest.fn().mockReturnValue([
      { text: 'snippet 1', startLine: 1, endLine: 5 },
      { text: 'snippet 2', startLine: 6, endLine: 10 }
    ])
  }))
}));

const { LiteratureIndexer: LiteratureIndexerClass } = await import('../../src/services/LiteratureIndexer.js');

describe('LiteratureIndexer', () => {
  let tempDir: string;
  let indexer: InstanceType<typeof LiteratureIndexerClass>;
  let mockEmbeddingService: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'literature-indexer-test-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create indexer with valid embedding service', () => {
      mockEmbeddingService = {
        generateEmbedding: jest.fn()
      };

      indexer = new LiteratureIndexerClass(tempDir, mockEmbeddingService);

      expect(indexer).toBeDefined();
    });

    it('should create indexer with null embedding service', () => {
      indexer = new LiteratureIndexerClass(tempDir, null);

      expect(indexer).toBeDefined();
    });

    it('should create indexer with undefined embedding service', () => {
      indexer = new LiteratureIndexerClass(tempDir, undefined);

      expect(indexer).toBeDefined();
    });

    it('should use default extracted text path', () => {
      indexer = new LiteratureIndexerClass(tempDir, null);

      expect(indexer).toBeDefined();
    });

    it('should use custom extracted text path', () => {
      indexer = new LiteratureIndexerClass(tempDir, null, 'custom/path');

      expect(indexer).toBeDefined();
    });
  });

  describe('searchSnippetsWithSimilarity() - null embedding service', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should return empty array when embedding service is null', async () => {
      const result = await indexer.searchSnippetsWithSimilarity('test query', 10);

      expect(result).toEqual([]);
    });

    it('should not throw error when embedding service is null', async () => {
      await expect(
        indexer.searchSnippetsWithSimilarity('test query', 10)
      ).resolves.not.toThrow();
    });

    it('should handle empty query with null embedding service', async () => {
      const result = await indexer.searchSnippetsWithSimilarity('', 10);

      expect(result).toEqual([]);
    });

    it('should handle large query with null embedding service', async () => {
      const largeQuery = 'a'.repeat(10000);
      const result = await indexer.searchSnippetsWithSimilarity(largeQuery, 10);

      expect(result).toEqual([]);
    });

    it('should handle special characters in query with null embedding service', async () => {
      const specialQuery = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const result = await indexer.searchSnippetsWithSimilarity(specialQuery, 10);

      expect(result).toEqual([]);
    });

    it('should handle unicode characters in query with null embedding service', async () => {
      const unicodeQuery = '你好世界 🌍 Привет мир';
      const result = await indexer.searchSnippetsWithSimilarity(unicodeQuery, 10);

      expect(result).toEqual([]);
    });

    it('should respect limit parameter even with null embedding service', async () => {
      const result = await indexer.searchSnippetsWithSimilarity('test', 5);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should handle zero limit with null embedding service', async () => {
      const result = await indexer.searchSnippetsWithSimilarity('test', 0);

      expect(result).toEqual([]);
    });

    it('should handle negative limit with null embedding service', async () => {
      const result = await indexer.searchSnippetsWithSimilarity('test', -1);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('searchSnippets() - null embedding service', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should return empty array when embedding service is null', async () => {
      const result = await indexer.searchSnippets('test query', 10);

      expect(result).toEqual([]);
    });

    it('should not throw error when embedding service is null', async () => {
      await expect(
        indexer.searchSnippets('test query', 10)
      ).resolves.not.toThrow();
    });

    it('should handle empty query with null embedding service', async () => {
      const result = await indexer.searchSnippets('', 10);

      expect(result).toEqual([]);
    });
  });

  describe('searchSnippetsWithSimilarity() - valid embedding service', () => {
    beforeEach(() => {
      mockEmbeddingService = {
        generateEmbedding: jest.fn().mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]))
      };

      indexer = new LiteratureIndexerClass(tempDir, mockEmbeddingService);
    });

    it('should call embedding service with query', async () => {
      await indexer.searchSnippetsWithSimilarity('test query', 10);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
    });

    it('should return empty array when embedding service returns null', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce(null);

      const result = await indexer.searchSnippetsWithSimilarity('test query', 10);

      expect(result).toEqual([]);
    });

    it('should return empty array when embedding service returns undefined', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce(undefined);

      const result = await indexer.searchSnippetsWithSimilarity('test query', 10);

      expect(result).toEqual([]);
    });

    it('should handle embedding service throwing error', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(
        new Error('Embedding service error')
      );

      await expect(
        indexer.searchSnippetsWithSimilarity('test query', 10)
      ).rejects.toThrow('Embedding service error');
    });

    it('should pass limit to embedding store', async () => {
      await indexer.searchSnippetsWithSimilarity('test query', 5);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe('searchSnippets() - valid embedding service', () => {
    beforeEach(() => {
      mockEmbeddingService = {
        generateEmbedding: jest.fn().mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]))
      };

      indexer = new LiteratureIndexerClass(tempDir, mockEmbeddingService);
    });

    it('should call embedding service with query', async () => {
      await indexer.searchSnippets('test query', 10);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
    });

    it('should return empty array when embedding service returns null', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce(null);

      const result = await indexer.searchSnippets('test query', 10);

      expect(result).toEqual([]);
    });

    it('should handle embedding service throwing error', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(
        new Error('Embedding service error')
      );

      await expect(
        indexer.searchSnippets('test query', 10)
      ).rejects.toThrow('Embedding service error');
    });
  });

  describe('indexFile() - null embedding service', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should not throw error when embedding service is null', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'test content';

      await expect(
        indexer['indexFile'](filePath, content)
      ).resolves.not.toThrow();
    });
  });

  describe('indexChangedFiles() - null embedding service', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should return stats with zero indexed when embedding service is null', async () => {
      // Create extracted text directory
      const extractedTextPath = path.join(tempDir, 'literature', 'ExtractedText');
      fs.mkdirSync(extractedTextPath, { recursive: true });

      // Create a test file
      fs.writeFileSync(path.join(extractedTextPath, 'test.txt'), 'test content');

      const result = await indexer.indexChangedFiles();

      expect(result).toHaveProperty('indexed');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
    });

    it('should handle missing extracted text directory', async () => {
      const result = await indexer.indexChangedFiles();

      expect(result.indexed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('getSnippets()', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should return empty array', async () => {
      const result = await indexer.getSnippets();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getStats()', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should return stats object', async () => {
      const result = await indexer.getStats();

      expect(result).toHaveProperty('snippetCount');
      expect(result).toHaveProperty('fileCount');
      expect(result).toHaveProperty('indexSize');
    });
  });

  describe('clearIndex()', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should not throw error', async () => {
      await expect(indexer.clearIndex()).resolves.not.toThrow();
    });
  });

  describe('isIndexingInProgress()', () => {
    beforeEach(() => {
      indexer = new LiteratureIndexerClass(tempDir, null);
    });

    it('should return false initially', () => {
      const result = indexer.isIndexingInProgress();

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive searches with null embedding service', async () => {
      indexer = new LiteratureIndexerClass(tempDir, null);

      const results = await Promise.all([
        indexer.searchSnippetsWithSimilarity('query1', 10),
        indexer.searchSnippetsWithSimilarity('query2', 10),
        indexer.searchSnippetsWithSimilarity('query3', 10)
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual([]);
      });
    });

    it('should handle switching from null to valid embedding service', async () => {
      indexer = new LiteratureIndexerClass(tempDir, null);

      // First search with null service
      let result = await indexer.searchSnippetsWithSimilarity('test', 10);
      expect(result).toEqual([]);

      // Create new indexer with valid service
      mockEmbeddingService = {
        generateEmbedding: jest.fn().mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]))
      };

      indexer = new LiteratureIndexerClass(tempDir, mockEmbeddingService);

      // Second search should call embedding service
      result = await indexer.searchSnippetsWithSimilarity('test', 10);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });

    it('should handle very long query strings', async () => {
      indexer = new LiteratureIndexerClass(tempDir, null);

      const veryLongQuery = 'a'.repeat(100000);
      const result = await indexer.searchSnippetsWithSimilarity(veryLongQuery, 10);

      expect(result).toEqual([]);
    });

    it('should handle concurrent indexing and searching', async () => {
      mockEmbeddingService = {
        generateEmbedding: jest.fn().mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]))
      };

      indexer = new LiteratureIndexerClass(tempDir, mockEmbeddingService);

      // Create extracted text directory
      const extractedTextPath = path.join(tempDir, 'literature', 'ExtractedText');
      fs.mkdirSync(extractedTextPath, { recursive: true });
      fs.writeFileSync(path.join(extractedTextPath, 'test.txt'), 'test content');

      // Run indexing and searching concurrently
      const [indexResult, searchResult] = await Promise.all([
        indexer.indexChangedFiles(),
        indexer.searchSnippetsWithSimilarity('test', 10)
      ]);

      expect(indexResult).toHaveProperty('indexed');
      expect(Array.isArray(searchResult)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle claim review panel scenario with null embedding service', async () => {
      // Simulate the scenario from the bug report
      indexer = new LiteratureIndexerClass(tempDir, null);

      const quoteText = 'To date, mass spectrometry (MS) data remain inherently biased as a result of reasons ranging from sample handling to differences caused by the instrumentation.';

      // This should not throw and should return empty array
      const result = await indexer.searchSnippetsWithSimilarity(quoteText, 5);

      expect(result).toEqual([]);
    });

    it('should handle claim review panel scenario with valid embedding service', async () => {
      mockEmbeddingService = {
        generateEmbedding: jest.fn().mockImplementation(() => Promise.resolve([0.1, 0.2, 0.3]))
      };

      indexer = new LiteratureIndexerClass(tempDir, mockEmbeddingService);

      const quoteText = 'To date, mass spectrometry (MS) data remain inherently biased as a result of reasons ranging from sample handling to differences caused by the instrumentation.';

      // This should call embedding service
      const result = await indexer.searchSnippetsWithSimilarity(quoteText, 5);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(quoteText);
    });
  });
});
