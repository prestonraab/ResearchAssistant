/**
 * Unified ZoteroClient - Merges functionality from extension's ZoteroApiService and MCP server's ZoteroService
 * 
 * Provides a consistent API for Zotero interactions across both the VSCode extension and MCP server.
 * Handles authentication, caching, and error handling for all Zotero operations.
 */

import type { ZoteroAnnotation } from '../types/index.js';

export interface ZoteroItem {
  key: string;
  title: string;
  itemType: string;
  creators?: Array<{ name?: string; firstName?: string; lastName?: string; creatorType?: string }>;
  date?: string;
  abstractNote?: string;
  url?: string;
  doi?: string;
  DOI?: string;
  tags?: string[];
  attachments?: ZoteroAttachment[];
  publicationTitle?: string;
}

export interface ZoteroAttachment {
  key: string;
  title: string;
  itemType: string;
  contentType?: string;
  linkMode?: string;
  path?: string;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  numItems?: number;
  id?: string;
  type?: 'user' | 'group';
  parentCollection?: string;
}

export interface QueryOptions {
  limit?: number;
  start?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface Library {
  id: string;
  name: string;
  type: 'user' | 'group';
}

export interface VerificationResult {
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
}

/**
 * Unified ZoteroClient for both extension and MCP server
 * Supports all operations from both ZoteroApiService and ZoteroService
 */
export class ZoteroClient {
  private apiKey: string = '';
  private userID: string = '';
  private baseUrl: string = 'https://api.zotero.org';
  private cacheMap: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds

  /**
   * Initialize the Zotero client with credentials
   * @param apiKey - Zotero API key
   * @param userID - Zotero user ID
   */
  initialize(apiKey: string, userID: string): void {
    this.apiKey = apiKey;
    this.userID = userID;
  }

  /**
   * Check if the client is properly configured
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
        throw new Error('Zotero API key not configured.');
      }
      if (!this.userID) {
        throw new Error('Zotero user ID not configured.');
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
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest(
        `/users/${this.userID}/items?limit=${limit}&start=${start}&format=json`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to fetch items: ${response.status}`);
      }

      const items = response.data as ZoteroItem[];
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
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
      if (!collectionKey || collectionKey.trim().length === 0) {
        throw new Error('Collection key cannot be empty');
      }

      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured. Set API key and user ID.');
      }

      const cacheKey = `collection_items_${collectionKey}_${limit || 'all'}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let endpoint = `/users/${this.userID}/collections/${collectionKey}/items?format=json`;
      if (limit !== undefined && limit > 0) {
        endpoint += `&limit=${limit}`;
      }

      const response = await this.makeRequest(endpoint);

      if (response.status === 404) {
        throw new Error(`Collection not found: ${collectionKey}`);
      }

      if (response.status !== 200) {
        throw new Error(`Failed to fetch collection items: ${response.status}`);
      }

      const items = response.data as ZoteroItem[];
      this.setCache(cacheKey, items);
      
      return items;
    } catch (error) {
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
      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured. Set API key and user ID.');
      }

      if (limit <= 0) {
        throw new Error('Limit must be a positive number');
      }

      const cacheKey = `recent_items_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const endpoint = `/users/${this.userID}/items?format=json&limit=${limit}&sort=dateModified&direction=desc`;

      const response = await this.makeRequest(endpoint);

      if (response.status !== 200) {
        throw new Error(`Failed to fetch recent items: ${response.status}`);
      }

      const items = response.data as ZoteroItem[];
      this.setCache(cacheKey, items);
      
      return items;
    } catch (error) {
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
      if (cached) {
        return cached;
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
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest(
        `/users/${this.userID}/items/${itemKey}/children?format=json&itemType=annotation`
      );

      if (response.status !== 200) {
        throw new Error(`Failed to fetch annotations: ${response.status}`);
      }

      const annotations = (response.data as any[]).map(item => ({
        key: item.key,
        type: item.data.annotationType || 'note',
        text: item.data.annotationText || item.data.text || '',
        color: item.data.annotationColor || '#FFFF00',
        pageLabel: item.data.annotationPageLabel,
        tags: item.data.tags || [],
        dateModified: item.data.dateModified,
        itemKey: itemKey
      })) as any;

      this.setCache(cacheKey, annotations);
      return annotations;
    } catch (error) {
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

      const attachments = (response.data as any[])
        .filter(item => item.data.contentType === 'application/pdf')
        .map(item => ({
          key: item.key,
          title: item.data.title,
          itemType: item.data.itemType,
          contentType: item.data.contentType,
          linkMode: item.data.linkMode,
          path: item.data.path
        }));

      return attachments;
    } catch (error) {
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
      if (!this.isConfigured()) {
        return [];
      }

      if (!itemKey || itemKey.trim().length === 0) {
        throw new Error('Item key cannot be empty');
      }

      const cacheKey = `item_children_${itemKey}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest(
        `/users/${this.userID}/items/${itemKey}/children?format=json`
      );

      if (response.status !== 200) {
        return [];
      }

      const attachments = (response.data as any[])
        .filter(item => {
          const data = item.data || item;
          return data.itemType === 'attachment';
        })
        .map(item => {
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

      this.setCache(cacheKey, attachments);
      
      return attachments;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all collections for the user
   */
  async getCollections(): Promise<ZoteroCollection[]> {
    try {
      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured.');
      }

      const cacheKey = 'collections';
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest(`/users/${this.userID}/collections?format=json`);

      if (response.status !== 200) {
        throw new Error(`Failed to fetch collections: ${response.status}`);
      }

      const collections = (response.data as any[]).map(coll => ({
        key: coll.key,
        name: coll.data.name,
        numItems: coll.meta?.numItems || 0
      }));

      this.setCache(cacheKey, collections);
      return collections;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a collection by name
   */
  async getCollectionByName(name: string): Promise<ZoteroCollection | null> {
    try {
      const collections = await this.getCollections();
      return collections.find(c => c.name === name) || null;
    } catch (error) {
      return null;
    }
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
    collections?: string[];
    [key: string]: any;
  }): Promise<string> {
    try {
      if (!this.isConfigured()) {
        throw new Error('Zotero API not configured. Set API key and user ID.');
      }

      const payload = [itemData];

      const response = await this.makeRequest(
        `/users/${this.userID}/items`,
        {
          method: 'POST',
          body: payload
        }
      );

      if (response.status === 200 || response.status === 201) {
        const createdItems = response.data?.successful || response.data;
        if (createdItems && createdItems['0']) {
          const itemKey = createdItems['0'].key;
          
          // Clear cache to force refresh
          this.clearCache();
          
          return itemKey;
        }
      }

      throw new Error(`Failed to create item: ${response.status}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Make an HTTP request to the Zotero API
   */
  private async makeRequest(
    endpoint: string,
    options: { method?: string; body?: any } = {}
  ): Promise<{ status: number; data: any }> {
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

        let data: any;
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
      throw error;
    }
  }

  /**
   * Get from cache if not expired
   */
  private getFromCache(key: string): any | null {
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
  private setCache(key: string, data: any): void {
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
}
