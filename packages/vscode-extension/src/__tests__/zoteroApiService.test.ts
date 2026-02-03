import { jest } from '@jest/globals';
import { ZoteroApiService, ZoteroItem } from '../services/zoteroApiService';
import { EmbeddingService } from '@research-assistant/core';
import { setupTest, createMockZoteroItem } from './helpers';

// Mock EmbeddingService
jest.mock('@research-assistant/core', () => ({
  EmbeddingService: jest.fn().mockImplementation(() => ({
    generateEmbedding: jest.fn(),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('ZoteroApiService', () => {
  setupTest();

  let service: ZoteroApiService;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;

  beforeEach(() => {
    service = new ZoteroApiService();
    service.initialize('test-api-key', 'test-user-id');
    
    // Manually set the embedding service to bypass vscode config issues
    mockEmbeddingService = {
      generateEmbedding: jest.fn(),
    } as any;
    (service as any).embeddingService = mockEmbeddingService;
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('getCollectionItems', () => {
    const mockCollectionItems: ZoteroItem[] = [
      {
        key: 'item1',
        title: 'Paper 1 in Collection',
        itemType: 'journalArticle',
        abstractNote: 'First paper abstract',
        creators: [{ firstName: 'Alice', lastName: 'Smith' }],
      },
      {
        key: 'item2',
        title: 'Paper 2 in Collection',
        itemType: 'journalArticle',
        abstractNote: 'Second paper abstract',
        creators: [{ firstName: 'Bob', lastName: 'Jones' }],
      },
    ];

    it('should fetch items from a specific collection', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockCollectionItems,
      } as Response);

      const results = await service.getCollectionItems('ABC123');

      expect(results).toEqual(mockCollectionItems);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/collections/ABC123/items'),
        expect.any(Object)
      );
    });

    it('should respect the limit parameter when provided', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [mockCollectionItems[0]],
      } as Response);

      const results = await service.getCollectionItems('ABC123', 1);

      expect(results.length).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=1'),
        expect.any(Object)
      );
    });

    it('should not add limit parameter when not provided', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockCollectionItems,
      } as Response);

      await service.getCollectionItems('ABC123');

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(fetchCall[0]).toContain('/collections/ABC123/items');
      expect(fetchCall[0]).not.toContain('limit=');
    });

    it('should throw error when collection key is empty', async () => {
      await expect(service.getCollectionItems('')).rejects.toThrow('Collection key cannot be empty');
    });

    it('should throw error when collection key is only whitespace', async () => {
      await expect(service.getCollectionItems('   ')).rejects.toThrow('Collection key cannot be empty');
    });

    it('should throw error when service is not configured', async () => {
      const unconfiguredService = new ZoteroApiService();
      await expect(unconfiguredService.getCollectionItems('ABC123')).rejects.toThrow('Zotero API not configured');
    });

    it('should throw error when collection is not found', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Not found' }),
      } as Response);

      await expect(service.getCollectionItems('INVALID')).rejects.toThrow('Collection not found: INVALID');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Server error' }),
      } as Response);

      await expect(service.getCollectionItems('ABC123')).rejects.toThrow('Failed to fetch collection items: 500');
    });

    it('should cache collection items', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockCollectionItems,
      } as Response);

      // First call
      const results1 = await service.getCollectionItems('ABC123');
      
      // Clear mock call history
      (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();

      // Second call with same collection key
      const results2 = await service.getCollectionItems('ABC123');

      // Should return cached results without calling API
      expect(global.fetch).not.toHaveBeenCalled();
      expect(results2).toEqual(results1);
    });

    it('should use different cache keys for different limits', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockCollectionItems,
      } as Response);

      // First call with limit
      await service.getCollectionItems('ABC123', 10);
      
      // Clear mock call history
      (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();

      // Second call without limit (different cache key)
      await service.getCollectionItems('ABC123');

      // Should make a new API call since cache key is different
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Network error'));

      await expect(service.getCollectionItems('ABC123')).rejects.toThrow();
    });
  });

  describe('getRecentItems', () => {
    const mockRecentItems: ZoteroItem[] = [
      {
        key: 'item1',
        title: 'Most Recent Paper',
        itemType: 'journalArticle',
        abstractNote: 'Recently modified paper',
        creators: [{ firstName: 'Alice', lastName: 'Smith' }],
        date: '2024-01-15',
      },
      {
        key: 'item2',
        title: 'Second Recent Paper',
        itemType: 'journalArticle',
        abstractNote: 'Another recent paper',
        creators: [{ firstName: 'Bob', lastName: 'Jones' }],
        date: '2024-01-14',
      },
    ];

    it('should fetch recent items with default limit', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockRecentItems,
      } as Response);

      const results = await service.getRecentItems();

      expect(results).toEqual(mockRecentItems);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=dateModified'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('direction=desc'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      );
    });

    it('should respect custom limit parameter', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [mockRecentItems[0]],
      } as Response);

      const results = await service.getRecentItems(10);

      expect(results.length).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('should throw error when service is not configured', async () => {
      const unconfiguredService = new ZoteroApiService();
      await expect(unconfiguredService.getRecentItems()).rejects.toThrow('Zotero API not configured');
    });

    it('should throw error when limit is zero', async () => {
      await expect(service.getRecentItems(0)).rejects.toThrow('Limit must be a positive number');
    });

    it('should throw error when limit is negative', async () => {
      await expect(service.getRecentItems(-5)).rejects.toThrow('Limit must be a positive number');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Server error' }),
      } as Response);

      await expect(service.getRecentItems()).rejects.toThrow('Failed to fetch recent items: 500');
    });

    it('should cache recent items', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockRecentItems,
      } as Response);

      // First call
      const results1 = await service.getRecentItems();
      
      // Clear mock call history
      (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();

      // Second call with same limit
      const results2 = await service.getRecentItems();

      // Should return cached results without calling API
      expect(global.fetch).not.toHaveBeenCalled();
      expect(results2).toEqual(results1);
    });

    it('should use different cache keys for different limits', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockRecentItems,
      } as Response);

      // First call with default limit
      await service.getRecentItems();
      
      // Clear mock call history
      (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();

      // Second call with different limit (different cache key)
      await service.getRecentItems(10);

      // Should make a new API call since cache key is different
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Network error'));

      await expect(service.getRecentItems()).rejects.toThrow();
    });

    it('should include correct API parameters in request', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockRecentItems,
      } as Response);

      await service.getRecentItems(25);

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toContain('format=json');
      expect(url).toContain('limit=25');
      expect(url).toContain('sort=dateModified');
      expect(url).toContain('direction=desc');
    });
  });

  describe('semanticSearch', () => {
    describe('Basic functionality', () => {
    it('should return empty array when not configured', async () => {
      const unconfiguredService = new ZoteroApiService();
      const results = await unconfiguredService.semanticSearch('test query');
      expect(results).toEqual([]);
    });

    it('should return empty array when query is empty', async () => {
      const results = await service.semanticSearch('');
      expect(results).toEqual([]);
    });

    it('should return empty array when query is only whitespace', async () => {
      const results = await service.semanticSearch('   ');
      expect(results).toEqual([]);
    });

    it('should return empty array when EmbeddingService is not available', async () => {
      const serviceWithoutEmbedding = new ZoteroApiService();
      serviceWithoutEmbedding.initialize('test-api-key', 'test-user-id');
      (serviceWithoutEmbedding as any).embeddingService = null;
      
      const results = await serviceWithoutEmbedding.semanticSearch('test query');
      expect(results).toEqual([]);
    });
  });

  describe('Semantic search with embeddings', () => {
    const mockItems: ZoteroItem[] = [
      {
        key: 'item1',
        title: 'Machine Learning Basics',
        itemType: 'journalArticle',
        abstractNote: 'An introduction to machine learning algorithms',
        creators: [{ firstName: 'John', lastName: 'Doe' }],
      },
      {
        key: 'item2',
        title: 'Deep Learning Networks',
        itemType: 'journalArticle',
        abstractNote: 'Neural networks and deep learning techniques',
        creators: [{ firstName: 'Jane', lastName: 'Smith' }],
      },
      {
        key: 'item3',
        title: 'Quantum Computing',
        itemType: 'journalArticle',
        abstractNote: 'Introduction to quantum algorithms',
        creators: [{ firstName: 'Bob', lastName: 'Johnson' }],
      },
    ];

    beforeEach(() => {
      // Mock fetch to return items
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockItems,
      } as Response);

      // Mock embedding generation
      mockEmbeddingService.generateEmbedding.mockImplementation(async (text: string) => {
        // Return different embeddings based on text content
        if (text.includes('machine learning') || text.includes('Machine Learning')) {
          return [1.0, 0.8, 0.2, 0.1]; // High similarity to ML query
        } else if (text.includes('deep learning') || text.includes('Deep Learning')) {
          return [0.9, 0.9, 0.3, 0.1]; // Medium-high similarity to ML query
        } else if (text.includes('quantum') || text.includes('Quantum')) {
          return [0.1, 0.2, 0.9, 0.8]; // Low similarity to ML query
        } else {
          return [0.8, 0.7, 0.3, 0.2]; // Default for query
        }
      });
    });

    it('should generate embeddings for query and items', async () => {
      await service.semanticSearch('machine learning', 5);

      // Should generate embedding for query + 3 items
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(4);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('machine learning');
    });

    it('should compute similarity scores and sort results', async () => {
      const results = await service.semanticSearch('machine learning', 5);

      // Should return items sorted by relevance
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
      
      // First result should be most relevant (Machine Learning Basics)
      expect(results[0].key).toBe('item1');
    });

    it('should filter out items below relevance threshold', async () => {
      // Mock embeddings with very low similarity
      mockEmbeddingService.generateEmbedding.mockImplementation(async (text: string) => {
        if (text === 'test query') {
          return [1.0, 0.0, 0.0, 0.0]; // Query embedding
        } else {
          return [0.0, 1.0, 0.0, 0.0]; // Orthogonal embeddings (similarity = 0)
        }
      });

      const results = await service.semanticSearch('test query', 5);

      // Should filter out all items due to low similarity
      expect(results).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      const results = await service.semanticSearch('machine learning', 1);

      // Should return at most 1 result
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should cache search results', async () => {
      // First search
      const results1 = await service.semanticSearch('machine learning', 5);
      
      // Clear mock call history
      mockEmbeddingService.generateEmbedding.mockClear();
      (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();

      // Second search with same query
      const results2 = await service.semanticSearch('machine learning', 5);

      // Should return cached results without calling API or generating embeddings
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(results2).toEqual(results1);
    });

    it('should handle errors gracefully and return empty array', async () => {
      // Mock embedding service to throw error
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('API error'));

      const results = await service.semanticSearch('test query', 5);

      // Should return empty array on error
      expect(results).toEqual([]);
    });

    it('should return cached results on error if available', async () => {
      // First successful search
      await service.semanticSearch('machine learning', 5);

      // Mock error for second call
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('API error'));

      // Second search should return cached results despite error
      const results = await service.semanticSearch('machine learning', 5);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Cosine similarity computation', () => {
    it('should compute correct cosine similarity for identical vectors', async () => {
      // Mock to return identical embeddings
      mockEmbeddingService.generateEmbedding.mockResolvedValue([1.0, 0.0, 0.0]);

      // Mock fetch to return one item
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [{
          key: 'item1',
          title: 'Test',
          itemType: 'journalArticle',
        }],
      } as Response);

      const results = await service.semanticSearch('test', 5);

      // Identical vectors should have similarity = 1.0
      // Since we filter by threshold 0.3, this should pass
      expect(results.length).toBe(1);
    });

    it('should compute correct cosine similarity for orthogonal vectors', async () => {
      let callCount = 0;
      mockEmbeddingService.generateEmbedding.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [1.0, 0.0, 0.0]; // Query
        } else {
          return [0.0, 1.0, 0.0]; // Orthogonal to query
        }
      });

      // Mock fetch to return one item
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [{
          key: 'item1',
          title: 'Test',
          itemType: 'journalArticle',
        }],
      } as Response);

      const results = await service.semanticSearch('test', 5);

      // Orthogonal vectors should have similarity = 0, filtered out by threshold
      expect(results.length).toBe(0);
    });
  });

  describe('Item text extraction', () => {
    it('should combine title and abstract for embedding', async () => {
      const mockItem: ZoteroItem = {
        key: 'item1',
        title: 'Test Title',
        itemType: 'journalArticle',
        abstractNote: 'Test Abstract',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [mockItem],
      } as Response);

      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5, 0.5]);

      await service.semanticSearch('test', 5);

      // Should call with combined title and abstract
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Test Title')
      );
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Test Abstract')
      );
    });

    it('should handle items without abstract', async () => {
      const mockItem: ZoteroItem = {
        key: 'item1',
        title: 'Test Title',
        itemType: 'journalArticle',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [mockItem],
      } as Response);

      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5, 0.5]);

      await service.semanticSearch('test', 5);

      // Should still work with just title
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test');
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('Test Title');
    });
  });

  describe('API integration', () => {
    it('should fetch items from Zotero API', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5, 0.5]);

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      } as Response);

      await service.semanticSearch('test', 5);

      // Should call Zotero API
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect(fetchCall[0]).toContain('api.zotero.org');
      expect(fetchCall[0]).toContain('test-user-id');
    });

    it('should return empty array when no items in library', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5, 0.5]);

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      } as Response);

      const results = await service.semanticSearch('test', 5);

      expect(results).toEqual([]);
    });
  });
  });

  describe('getItemChildren', () => {
    const mockChildren = [
      {
        key: 'attach1',
        data: {
          key: 'attach1',
          itemType: 'attachment',
          title: 'Paper.pdf',
          contentType: 'application/pdf',
          linkMode: 'imported_file',
          path: '/path/to/paper.pdf'
        }
      },
      {
        key: 'attach2',
        data: {
          key: 'attach2',
          itemType: 'attachment',
          title: 'Supplementary.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          linkMode: 'imported_file',
          path: '/path/to/supplementary.docx'
        }
      },
      {
        key: 'note1',
        data: {
          key: 'note1',
          itemType: 'note',
          note: 'This is a note'
        }
      }
    ];

    it('should fetch and return typed attachments only', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockChildren,
      } as Response);

      const results = await service.getItemChildren('item123');

      // Should filter out notes and return only attachments
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        key: 'attach1',
        title: 'Paper.pdf',
        itemType: 'attachment',
        contentType: 'application/pdf',
        linkMode: 'imported_file',
        path: '/path/to/paper.pdf'
      });
      expect(results[1]).toEqual({
        key: 'attach2',
        title: 'Supplementary.docx',
        itemType: 'attachment',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        linkMode: 'imported_file',
        path: '/path/to/supplementary.docx'
      });
    });

    it('should return empty array when service is not configured', async () => {
      const unconfiguredService = new ZoteroApiService();
      const results = await unconfiguredService.getItemChildren('item123');
      expect(results).toEqual([]);
    });

    it('should throw error when item key is empty', async () => {
      await expect(service.getItemChildren('')).rejects.toThrow('Item key cannot be empty');
    });

    it('should throw error when item key is only whitespace', async () => {
      await expect(service.getItemChildren('   ')).rejects.toThrow('Item key cannot be empty');
    });

    it('should return empty array on API failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Server error' }),
      } as Response);

      const results = await service.getItemChildren('item123');
      expect(results).toEqual([]);
    });

    it('should return empty array when item has no children', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      } as Response);

      const results = await service.getItemChildren('item123');
      expect(results).toEqual([]);
    });

    it('should cache item children', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockChildren,
      } as Response);

      // First call
      const results1 = await service.getItemChildren('item123');
      
      // Clear mock call history
      (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();

      // Second call with same item key
      const results2 = await service.getItemChildren('item123');

      // Should return cached results without calling API
      expect(global.fetch).not.toHaveBeenCalled();
      expect(results2).toEqual(results1);
    });

    it('should handle children with missing data fields gracefully', async () => {
      const incompleteChildren = [
        {
          key: 'attach1',
          data: {
            itemType: 'attachment',
            // Missing title, contentType, etc.
          }
        }
      ];

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => incompleteChildren,
      } as Response);

      const results = await service.getItemChildren('item123');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        key: 'attach1',
        title: '',
        itemType: 'attachment',
        contentType: undefined,
        linkMode: undefined,
        path: undefined
      });
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Network error'));

      const results = await service.getItemChildren('item123');
      expect(results).toEqual([]);
    });

    it('should call correct API endpoint', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      } as Response);

      await service.getItemChildren('item123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/test-user-id/items/item123/children'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('format=json'),
        expect.any(Object)
      );
    });
  });
});
