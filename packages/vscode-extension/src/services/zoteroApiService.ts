import * as vscode from 'vscode';
import { EmbeddingService } from '@research-assistant/core';

/**
 * ZoteroApiService - Direct Zotero API client
 * 
 * Handles all communication with Zotero's REST API without requiring an MCP server.
 * Manages API authentication, caching, and error handling.
 */

export interface ZoteroAnnotation {
  key: string;
  type: 'highlight' | 'note' | 'image';
  text: string;
  color: string;
  pageLabel?: string;
  tags?: string[];
  dateModified: string;
  itemKey?: string;
}

export interface ZoteroItem {
  key: string;
  title: string;
  itemType: string;
  creators?: Array<{ name?: string; firstName?: string; lastName?: string }>;
  date?: string;
  abstractNote?: string;
  url?: string;
  doi?: string;
  tags?: string[];
  attachments?: ZoteroAttachment[];
}

export interface ZoteroAttachment {
  key: string;
  title: string;
  itemType: string;
  contentType?: string;
  linkMode?: string;
  path?: string;
}

export interface VerificationResult {
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
}

export class ZoteroApiService {
  private apiKey: string = '';
  private userID: string = '';
  private baseUrl: string = 'https://api.zotero.org';
  private cacheMap: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private embeddingService: EmbeddingService | null = null;

  private getLogger() {
    try {
      const loggingService = require('../core/loggingService');
      return loggingService.getLogger();
    } catch (error) {
      return {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        dispose: () => {},
      };
    }
  }

  /**
   * Initialize the Zotero API service with credentials
   * @param apiKey - Zotero API key
   * @param userID - Zotero user ID
   */
  initialize(apiKey: string, userID: string): void {
    this.apiKey = apiKey;
    this.userID = userID;
    
    // Initialize EmbeddingService with OpenAI API key from settings
    try {
      const config = vscode.workspace.getConfiguration('researchAssistant');
      const openaiApiKey = config.get<string>('openaiApiKey') || process.env.OPENAI_API_KEY || '';
      
      if (openaiApiKey) {
        this.embeddingService = new EmbeddingService(openaiApiKey);
        this.getLogger().info('ZoteroApiService initialized with EmbeddingService');
      } else {
        this.getLogger().warn('ZoteroApiService initialized without EmbeddingService (OpenAI API key not configured)');
      }
    } catch (error) {
      // vscode might not be available in test environment
      this.getLogger().warn('Could not access vscode configuration, skipping EmbeddingService initialization');
    }
    
    this.getLogger().info('ZoteroApiService initialized');
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.userID;
  }

  /**
   * Test connection to Zotero API
   * @throws Error with specific message about what's wrong
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        throw new Error('Zotero API key not configured. Set researchAssistant.zoteroApiKey in VS Code settings.');
      }
      if (!this.userID) {
        throw new Error('Zotero user ID not configured. Set researchAssistant.zoteroUserId in VS Code settings.');
      }

      const response = await this.makeRequest(`/users/${this.userID}/items?limit=1`);
      
      if (response.status === 401) {
        throw new Error('Zotero API authentication failed. Check your API key and user ID.');
      }
      if (response.status === 403) {
        throw new Error('Zotero API access denied. Check that your API key has read permissions.');
      }
      if (response.status === 404) {
        throw new Error('Zotero user not found. Check your user ID.');
      }
      if (response.status !== 200) {
        throw new Error(`Zotero API error: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.getLogger().error('Zotero API connection test failed:', message);
      throw error;
    }
  }

  /**
   * Get all items for the user
   */
  async getItems(limit: number = 100, start: number = 0): Promise<ZoteroItem[]> {
    try {
      const cacheKey = `items_${limit}_${start}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached as ZoteroItem[];
      }

      const response = await this.makeRequest(
        `/users/${this.userID}/items?limit=${limit}&start=${start}&format=json`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }

      const items = (Array.isArray(response.data) ? response.data : []) as ZoteroItem[];
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      this.getLogger().error('Failed to get Zotero items:', error);
      throw error;
    }
  }

  /**
   * Get items from a specific collection
   * @param collectionKey - The Zotero collection key
   * @param limit - Maximum number of items to return (optional)
   * @returns Array of ZoteroItems from the collection
   */
  async getCollectionItems(collectionKey: string, limit?: number): Promise<ZoteroItem[]> {
    try {
      // Validate parameters
      if (!collectionKey || collectionKey.trim().length === 0) {
        throw new Error('Collection key cannot be empty');
      }

      // Check configuration
      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured. Set API key and user ID in settings.');
      }

      // Build cache key
      const cacheKey = `collection_items_${collectionKey}_${limit || 'all'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached as ZoteroItem[];
      }

      // Build API endpoint with optional limit
      let endpoint = `/users/${this.userID}/collections/${collectionKey}/items?format=json`;
      if (limit !== undefined && limit > 0) {
        endpoint += `&limit=${limit}`;
      }

      // Make API request
      const response = await this.makeRequest(endpoint);

      if (response.status === 404) {
        throw new Error(`Collection not found: ${collectionKey}`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to fetch collection items: ${response.status}`);
      }

      const items = (Array.isArray(response.data) ? response.data : []) as ZoteroItem[];
      this.setCache(cacheKey, items);
      
      this.getLogger().info(`Fetched ${items.length} items from collection ${collectionKey}`);
      return items;
    } catch (error) {
      this.getLogger().error(`Failed to get items from collection ${collectionKey}:`, error);
      throw error;
    }
  }

  /**
   * Get recently modified items
   * @param limit - Maximum number of items to return (default: 50)
   * @returns Array of ZoteroItems sorted by date modified (most recent first)
   */
  async getRecentItems(limit: number = 50): Promise<ZoteroItem[]> {
    try {
      // Check configuration
      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured. Set API key and user ID in settings.');
      }

      // Validate limit parameter
      if (limit <= 0) {
        throw new Error('Limit must be a positive number');
      }

      // Build cache key
      const cacheKey = `recent_items_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached as ZoteroItem[];
      }

      // Build API endpoint with sort parameters
      const endpoint = `/users/${this.userID}/items?format=json&limit=${limit}&sort=dateModified&direction=desc`;

      // Make API request
      const response = await this.makeRequest(endpoint);

      if (response.status !== 200) {
        throw new Error(`Failed to fetch recent items: ${response.status}`);
      }

      const items = (Array.isArray(response.data) ? response.data : []) as ZoteroItem[];
      this.setCache(cacheKey, items);
      
      this.getLogger().info(`Fetched ${items.length} recent items`);
      return items;
    } catch (error) {
      this.getLogger().error('Failed to get recent items:', error);
      throw error;
    }
  }

  /**
   * Get a specific item by key
   */
  async getItem(itemKey: string): Promise<ZoteroItem> {
    try {
      const cacheKey = `item_${itemKey}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && typeof cached === 'object' && 'key' in cached) {
        return cached as ZoteroItem;
      }

      const response = await this.makeRequest(
        `/users/${this.userID}/items/${itemKey}?format=json`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to fetch item: ${response.status}`);
      }

      const item = response.data as ZoteroItem;
      this.setCache(cacheKey, item);
      return item;
    } catch (error) {
      this.getLogger().error(`Failed to get Zotero item ${itemKey}:`, error);
      throw error;
    }
  }

  /**
   * Get annotations (highlights, notes) for an item
   */
  async getAnnotations(itemKey: string): Promise<ZoteroAnnotation[]> {
    try {
      const cacheKey = `annotations_${itemKey}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached as ZoteroAnnotation[];
      }

      // Get child items (annotations are stored as child items)
      const response = await this.makeRequest(
        `/users/${this.userID}/items/${itemKey}/children?format=json&itemType=annotation`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to fetch annotations: ${response.status}`);
      }

      const annotations = (Array.isArray(response.data) ? response.data : []).map((item: any) => ({
        key: item.key,
        type: item.data.annotationType || 'note',
        text: item.data.annotationText || item.data.text || '',
        color: item.data.annotationColor || '#FFFF00',
        pageLabel: item.data.annotationPageLabel,
        tags: item.data.tags || [],
        dateModified: item.data.dateModified,
        itemKey: itemKey
      }));

      this.setCache(cacheKey, annotations);
      return annotations;
    } catch (error) {
      this.getLogger().error(`Failed to get annotations for ${itemKey}:`, error);
      return [];
    }
  }

  /**
   * Get highlights only (filter annotations by type)
   */
  async getHighlights(itemKey: string): Promise<ZoteroAnnotation[]> {
    try {
      const annotations = await this.getAnnotations(itemKey);
      return annotations.filter(a => a.type === 'highlight');
    } catch (error) {
      this.getLogger().error(`Failed to get highlights for ${itemKey}:`, error);
      return [];
    }
  }

  /**
   * Get PDF attachments for an item
   */
  async getPdfAttachments(itemKey: string): Promise<ZoteroAttachment[]> {
    try {
      const response = await this.makeRequest(
        `/users/${this.userID}/items/${itemKey}/children?format=json&itemType=attachment`
      );

      if (response.status !== 200) {
        return [];
      }

      const attachments = (Array.isArray(response.data) ? response.data : [])
        .filter((item: any) => item.data.contentType === 'application/pdf')
        .map((item: any) => ({
          key: item.key,
          title: item.data.title,
          itemType: item.data.itemType,
          contentType: item.data.contentType,
          linkMode: item.data.linkMode,
          path: item.data.path
        }));

      return attachments;
    } catch (error) {
      this.getLogger().error(`Failed to get PDF attachments for ${itemKey}:`, error);
      return [];
    }
  }

  /**
   * Get child items (attachments) for an item
   * @param itemKey - The Zotero item key
   * @returns Array of ZoteroAttachments (typed attachments only)
   */
  async getItemChildren(itemKey: string): Promise<ZoteroAttachment[]> {
    try {
      // Check configuration
      if (!this.isConfigured()) {
        this.getLogger().warn('Zotero API not configured');
        return [];
      }

      // Validate parameter
      if (!itemKey || itemKey.trim().length === 0) {
        throw new Error('Item key cannot be empty');
      }

      // Check cache first
      const cacheKey = `item_children_${itemKey}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached as ZoteroAttachment[];
      }

      // Fetch all children
      const response = await this.makeRequest(
        `/users/${this.userID}/items/${itemKey}/children?format=json`
      );

      if (response.status !== 200) {
        this.getLogger().warn(`Failed to fetch item children for ${itemKey}: ${response.status}`);
        return [];
      }

      // Filter for attachment items only and map to ZoteroAttachment interface
      const attachments = (Array.isArray(response.data) ? response.data : [])
        .filter((item: any) => {
          const data = item.data || item;
          return data.itemType === 'attachment';
        })
        .map((item: any) => {
          const data = item.data || item;
          return {
            key: item.key || data.key,
            title: data.title || '',
            itemType: data.itemType,
            contentType: data.contentType,
            linkMode: data.linkMode,
            path: data.path
          };
        });

      // Cache results
      this.setCache(cacheKey, attachments);
      
      this.getLogger().info(`Fetched ${attachments.length} attachments for item ${itemKey}`);
      return attachments;
    } catch (error) {
      this.getLogger().error(`Failed to get item children for ${itemKey}:`, error);
      return [];
    }
  }

  /**
   * Perform semantic search on Zotero items using embeddings
   * @param query - Search query string
   * @param limit - Maximum number of results to return (default: 10)
   * @returns Array of ZoteroItems sorted by relevance score
   */
  async semanticSearch(query: string, limit: number = 10): Promise<ZoteroItem[]> {
    try {
      // Check configuration
      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured. Set API key and user ID in settings.');
      }

      // Validate parameters
      if (!query || query.trim().length === 0) {
        throw new Error('Search query cannot be empty');
      }

      // Check cache first
      const cacheKey = `semantic_search_${query}_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        this.getLogger().info('Returning cached semantic search results');
        return cached as ZoteroItem[];
      }

      // Check if EmbeddingService is available
      if (!this.embeddingService) {
        this.getLogger().warn('EmbeddingService not available, falling back to empty results');
        return [];
      }

      // 1. Generate embedding for query
      this.getLogger().info(`Generating embedding for query: "${query}"`);
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // 2. Fetch items from Zotero API (fetch more than needed for better filtering)
      this.getLogger().info(`Fetching items from Zotero (limit: ${limit * 3})`);
      const items = await this.getItems(limit * 3);

      if (items.length === 0) {
        this.getLogger().info('No items found in Zotero library');
        return [];
      }

      // 3. Generate embeddings for items and compute similarity scores
      this.getLogger().info(`Computing similarity scores for ${items.length} items`);
      const itemsWithScores = await Promise.all(
        items.map(async (item) => {
          try {
            // Combine title and abstract for better semantic matching
            const itemText = this.getItemText(item);
            
            // Generate embedding for item
            const itemEmbedding = await this.embeddingService!.generateEmbedding(itemText);
            
            // Compute cosine similarity
            const similarity = this.cosineSimilarity(queryEmbedding, itemEmbedding);
            
            return {
              item,
              similarity
            };
          } catch (error) {
            this.getLogger().error(`Failed to process item ${item.key}:`, error);
            return {
              item,
              similarity: 0
            };
          }
        })
      );

      // 4. Filter by relevance threshold and sort by similarity score
      const relevanceThreshold = 0.3;
      const results = itemsWithScores
        .filter(result => result.similarity > relevanceThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(result => result.item);

      this.getLogger().info(`Semantic search returned ${results.length} results`);

      // 5. Cache results
      this.setCache(cacheKey, results);

      return results;
    } catch (error) {
      this.getLogger().error('Semantic search failed:', error);
      
      // Return cached results if available
      const cacheKey = `semantic_search_${query}_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        this.getLogger().info('Returning cached results after error');
        return cached as ZoteroItem[];
      }
      
      // Return empty array as fallback
      return [];
    }
  }

  /**
   * Extract text from item for embedding generation
   * @param item - Zotero item
   * @returns Combined text from title and abstract
   */
  private getItemText(item: ZoteroItem): string {
    const title = item.title || '';
    const abstract = item.abstractNote || '';
    return `${title} ${abstract}`.trim();
  }

  /**
   * Compute cosine similarity between two embedding vectors
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score between 0 and 1
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding vectors must have the same length');
    }

    // Compute dot product
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    
    // Compute magnitudes
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    
    // Return cosine similarity
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Make an HTTP request to the Zotero API
   */
  private async makeRequest(
    endpoint: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<{ status: number; data: unknown }> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers: Record<string, string> = {
        'Zotero-API-Version': '3',
        'Accept': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      try {
        const response = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let data: unknown;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        return {
          status: response.status,
          data,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      this.getLogger().error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Get from cache if not expired
   */
  private getFromCache(key: string): unknown | null {
    const entry = this.cacheMap.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cacheMap.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, data: unknown): void {
    this.cacheMap.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cacheMap.clear();
  }

  /**
   * Create a new item in Zotero library
   * @param itemData - Item data following Zotero's item template format
   * @returns The created item's key
   */
  async createItem(itemData: {
    itemType: string;
    title: string;
    creators?: Array<{ creatorType: string; firstName?: string; lastName?: string; name?: string }>;
    abstractNote?: string;
    date?: string;
    DOI?: string;
    url?: string;
    publicationTitle?: string;
    [key: string]: any;
  }): Promise<string> {
    try {
      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured. Set API key and user ID in settings.');
      }

      // Prepare the item payload - don't duplicate itemType
      const payload = [itemData];

      // Make POST request to create item
      const response = await this.makeRequest(
        `/users/${this.userID}/items`,
        {
          method: 'POST',
          body: payload
        }
      );

      if (response.status === 200 || response.status === 201) {
        // Extract the created item key from response
        const responseData = response.data as any;
        const createdItems = responseData?.successful || responseData;
        if (createdItems && createdItems['0']) {
          const itemKey = createdItems['0'].key;
          this.getLogger().info(`Created Zotero item: ${itemKey}`);
          
          // Clear cache to force refresh
          this.clearCache();
          
          return itemKey;
        }
      }

      throw new Error(`Failed to create item: ${response.status}`);
    } catch (error) {
      this.getLogger().error('Failed to create Zotero item:', error);
      throw error;
    }
  }
}
