import * as https from 'https';
import * as http from 'http';
import * as vscode from 'vscode';

export interface ZoteroItem {
  id: string;
  itemKey: string;
  title: string;
  authors: string[];
  year?: number;
  abstract?: string;
  url?: string;
  doi?: string;
}

/**
 * Direct Zotero API service - bypasses MCP to avoid token overhead
 * Uses Zotero's public API for semantic search and item retrieval
 */
export class ZoteroDirectService {
  private apiKey: string;
  private userId: string;
  private baseUrl = 'https://api.zotero.org';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
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
    if (cached) {
      console.log('[ZoteroDirectService] Returning cached results for query:', query);
      return cached;
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
    if (cached) {
      return cached;
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

      return items.map(item => this.parseZoteroItem(item)).filter(Boolean) as ZoteroItem[];
    } catch (error) {
      console.error('Failed to get recent items:', error);
      return [];
    }
  }

  /**
   * Parse Zotero API response into ZoteroItem
   */
  private parseZoteroItem(item: any): ZoteroItem | null {
    try {
      const data = item.data || item;
      
      if (!data.title) {
        return null;
      }

      // Extract authors from creators array
      const authors: string[] = [];
      if (data.creators && Array.isArray(data.creators)) {
        data.creators.forEach((creator: any) => {
          if (creator.lastName) {
            authors.push(creator.lastName);
          }
        });
      }

      return {
        id: item.key || data.key || '',
        itemKey: item.key || data.key || '',
        title: data.title || '',
        authors: authors.length > 0 ? authors : ['Unknown'],
        year: data.date ? parseInt(data.date.split('-')[0]) : undefined,
        abstract: data.abstractNote || data.abstract || undefined,
        url: data.url || undefined,
        doi: data.DOI || data.doi || undefined
      };
    } catch (error) {
      console.error('Failed to parse Zotero item:', error);
      return null;
    }
  }

  /**
   * Make HTTP request to Zotero API
   */
  private makeRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const options: any = {
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
  private getFromCache(key: string): any | null {
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
  private setCache(key: string, data: any): void {
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
