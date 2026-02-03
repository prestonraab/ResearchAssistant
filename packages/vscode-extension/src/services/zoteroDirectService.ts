import * as https from 'https';
import * as http from 'http';
import * as vscode from 'vscode';
import type { ZoteroItemResponse, ZoteroCreator, HttpResponse } from '../types';
import type { ZoteroItem } from '@research-assistant/core';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Direct Zotero API service - bypasses MCP to avoid token overhead
 * Uses Zotero's public API for semantic search and item retrieval
 */
export class ZoteroDirectService {
  private apiKey: string;
  private userId: string;
  private baseUrl = 'https://api.zotero.org';
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey?: string, userId?: string) {
    // Try to get from parameters first, then from VS Code settings, then from environment
    this.apiKey = apiKey || this.getSettingValue('zoteroApiKey') || process.env.ZOTERO_API_KEY || '';
    this.userId = userId || this.getSettingValue('zoteroUserId') || process.env.ZOTERO_USER_ID || '';
  }

  /**
   * Get setting value from VS Code configuration
   */
  private getSettingValue(key: string): string {
    try {
      const config = vscode.workspace.getConfiguration('researchAssistant');
      return config.get<string>(key) || '';
    } catch (error) {
      // If vscode is not available, return empty string
      return '';
    }
  }

  /**
   * Search Zotero library for items matching a query
   * Uses Zotero's search API with keyword matching
   */
  async semanticSearch(query: string, limit: number = 5): Promise<ZoteroItem[]> {
    if (!this.userId) {
      console.warn('[ZoteroDirectService] User ID not configured');
      return [];
    }

    const cacheKey = `search:${query}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      console.log('[ZoteroDirectService] Returning cached results for query:', query);
      return cached as ZoteroItem[];
    }

    try {
      // Search user's library for items matching the query
      const url = `${this.baseUrl}/users/${this.userId}/items/top?q=${encodeURIComponent(query)}&limit=${limit}&format=json`;
      
      console.log('[ZoteroDirectService] Searching Zotero with URL:', url.replace(this.userId, '***'));
      
      const items = await this.makeRequest(url);
      
      console.log('[ZoteroDirectService] Zotero API response:', { 
        isArray: Array.isArray(items), 
        count: Array.isArray(items) ? items.length : 'N/A',
        type: typeof items
      });
      
      if (!Array.isArray(items)) {
        console.warn('[ZoteroDirectService] Response is not an array:', items);
        return [];
      }

      const results = items.map(item => this.parseZoteroItem(item)).filter(Boolean) as ZoteroItem[];
      
      console.log('[ZoteroDirectService] Parsed results:', results.length, 'items');
      
      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('[ZoteroDirectService] Search failed:', error);
      return [];
    }
  }

  /**
   * Get item metadata from Zotero
   */
  async getItemMetadata(itemKey: string): Promise<ZoteroItem | null> {
    if (!this.userId) {
      return null;
    }

    const cacheKey = `item:${itemKey}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && typeof cached === 'object' && 'key' in cached) {
      return cached as ZoteroItem;
    }

    try {
      const url = `${this.baseUrl}/users/${this.userId}/items/${itemKey}?format=json`;
      const item = await this.makeRequest(url);
      
      const parsed = this.parseZoteroItem(item);
      if (parsed) {
        this.setCache(cacheKey, parsed);
      }
      return parsed || null;
    } catch (error) {
      console.error('Failed to get item metadata:', error);
      return null;
    }
  }

  /**
   * Get recent items from library
   */
  async getRecentItems(limit: number = 10): Promise<ZoteroItem[]> {
    if (!this.userId) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/users/${this.userId}/items/top?limit=${limit}&sort=dateAdded&direction=desc&format=json`;
      
      const items = await this.makeRequest(url);
      
      if (!Array.isArray(items)) {
        return [];
      }

      return items.map(item => this.parseZoteroItem(item)).filter((item): item is ZoteroItem => item !== null);
    } catch (error) {
      console.error('Failed to get recent items:', error);
      return [];
    }
  }

  /**
   * Get collections from library
   */
  async getCollections(): Promise<Array<{ key: string; name: string; parentCollection?: string }>> {
    if (!this.userId) {
      return [];
    }

    const cacheKey = 'collections';
    const cached = this.getFromCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached as Array<{ key: string; name: string; parentCollection?: string }>;
    }

    try {
      const url = `${this.baseUrl}/users/${this.userId}/collections?format=json`;
      const collections = await this.makeRequest(url);
      
      if (!Array.isArray(collections)) {
        return [];
      }

      const results = collections.map((col: any) => ({
        key: col.key || col.data?.key || '',
        name: col.data?.name || col.name || 'Unnamed Collection',
        parentCollection: col.data?.parentCollection || col.parentCollection
      }));

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Failed to get collections:', error);
      return [];
    }
  }

  /**
   * Get items from a specific collection
   */
  async getCollectionItems(collectionKey: string, limit?: number): Promise<ZoteroItem[]> {
    if (!this.userId) {
      return [];
    }

    const cacheKey = `collection:${collectionKey}:${limit || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached as ZoteroItem[];
    }

    try {
      const limitParam = limit ? `&limit=${limit}` : '';
      const url = `${this.baseUrl}/users/${this.userId}/collections/${collectionKey}/items/top?format=json${limitParam}`;
      
      const items = await this.makeRequest(url);
      
      if (!Array.isArray(items)) {
        return [];
      }

      const results = items.map(item => this.parseZoteroItem(item)).filter((item): item is ZoteroItem => item !== null);
      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Failed to get collection items:', error);
      return [];
    }
  }

  /**
   * Get children (attachments, notes) of an item
   */
  async getItemChildren(itemKey: string): Promise<Array<{
    key: string;
    itemType: string;
    contentType?: string;
    filename?: string;
    title?: string;
    data: Record<string, unknown>;
  }>> {
    if (!this.userId) {
      return [];
    }

    const cacheKey = `children:${itemKey}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached as Array<{
        key: string;
        itemType: string;
        contentType?: string;
        filename?: string;
        title?: string;
        data: Record<string, unknown>;
      }>;
    }

    try {
      const url = `${this.baseUrl}/users/${this.userId}/items/${itemKey}/children?format=json`;
      
      const children = await this.makeRequest(url);
      
      if (!Array.isArray(children)) {
        return [];
      }

      // Parse children to extract useful info
      const results = children.map((child: any) => {
        const data = (child.data || child) as Record<string, unknown>;
        return {
          key: child.key || data.key || '',
          itemType: (data.itemType as string) || '',
          contentType: (data.contentType as string) || undefined,
          filename: (data.filename as string) || undefined,
          title: (data.title as string) || undefined,
          data: data
        };
      });

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Failed to get item children:', error);
      return [];
    }
  }

  /**
   * Get item fulltext (if available)
   */
  async getItemFulltext(itemKey: string): Promise<string> {
    if (!this.userId) {
      return '';
    }

    const cacheKey = `fulltext:${itemKey}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && typeof cached === 'string') {
      return cached;
    }

    try {
      const url = `${this.baseUrl}/users/${this.userId}/items/${itemKey}/fulltext?format=json`;
      
      const response = await this.makeRequest(url);
      
      const fulltext = (response as Record<string, unknown>)?.content || '';
      
      if (fulltext) {
        this.setCache(cacheKey, fulltext);
      }
      
      return fulltext as string;
    } catch (error) {
      console.error('Failed to get item fulltext:', error);
      return '';
    }
  }

  /**
   * Parse Zotero API response into ZoteroItem
   */
  private parseZoteroItem(item: any): ZoteroItem | null {
    try {
      const data = (item.data || item) as Record<string, unknown>;
      
      if (!data.title) {
        return null;
      }

      // Extract creators array
      const creators = data.creators as any[] | undefined;
      const creatorArray = creators && Array.isArray(creators) 
        ? creators.map((creator: any) => ({
            name: creator.name,
            firstName: creator.firstName,
            lastName: creator.lastName,
            creatorType: creator.creatorType
          }))
        : undefined;

      const dateStr = data.date as string | undefined;
      const year = dateStr ? parseInt(dateStr.split('-')[0]) : undefined;

      return {
        key: item.key || (data.key as string) || '',
        title: (data.title as string) || '',
        itemType: (data.itemType as string) || 'journalArticle',
        creators: creatorArray,
        date: dateStr,
        abstractNote: (data.abstractNote as string) || (data.abstract as string),
        url: (data.url as string),
        doi: (data.DOI as string) || (data.doi as string),
        tags: (data.tags as string[]),
        attachments: undefined
      };
    } catch (error) {
      console.error('Failed to parse Zotero item:', error);
      return null;
    }
  }

  /**
   * Make HTTP request to Zotero API
   */
  private makeRequest(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const options: Record<string, Record<string, string>> = {
        headers: {
          'User-Agent': 'VSCode-Research-Assistant'
        }
      };

      if (this.apiKey) {
        options.headers['Zotero-API-Key'] = this.apiKey;
      }

      protocol.get(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } else if (res.statusCode === 404) {
              resolve(null);
            } else {
              reject(new Error(`Zotero API error: ${res.statusCode}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): unknown {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
