import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

// Type definitions for MCP responses
export interface ZoteroItem {
  itemKey: string;
  title: string;
  authors: string[];
  year: number;
  abstract?: string;
  doi?: string;
  url?: string;
}

export interface ZoteroMetadata {
  itemKey: string;
  title: string;
  authors: string[];
  year: number;
  abstract?: string;
  doi?: string;
  url?: string;
  venue?: string;
  citationCount?: number;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  parentCollection?: string;
}

export interface VerificationResult {
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
}

export interface QuoteMatch {
  quote: string;
  source: string;
  similarity: number;
  context: string;
}

export interface VerificationReport {
  totalQuotes: number;
  verified: number;
  failed: number;
  failures: Array<{
    quote: string;
    source: string;
    closestMatch: string;
    similarity: number;
  }>;
}

export interface MCPConfig {
  mcpServers?: {
    zotero?: {
      command: string;
      args?: string[];
      disabled?: boolean;
    };
    citation?: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      disabled?: boolean;
    };
    docling?: {
      command: string;
      args?: string[];
      disabled?: boolean;
    };
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class MCPClientManager {
  private config: MCPConfig | null = null;
  private connected: Map<string, boolean> = new Map();
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  // Grouped API access
  public readonly zotero = {
    semanticSearch: (query: string, limit?: number) => this.zoteroSemanticSearch(query, limit),
    getItemMetadata: (itemKey: string) => this.getItemMetadata(itemKey),
    getItemFulltext: (itemKey: string) => this.getItemFulltext(itemKey),
    getCollections: () => this.getCollections(),
    getCollectionItems: (collectionKey: string, limit?: number) => this.getCollectionItems(collectionKey, limit),
    getRecent: (limit?: number) => this.getRecent(limit),
    getItemChildren: (itemKey: string) => this.getItemChildren(itemKey),
  };

  public readonly citation = {
    verifyQuote: (quote: string, authorYear: string) => this.verifyQuote(quote, authorYear),
    searchQuotes: (searchTerm: string, authorFilter?: string) => this.searchQuotes(searchTerm, authorFilter),
    verifyAllQuotes: () => this.verifyAllQuotes(),
  };

  public readonly docling = {
    convertDocument: (source: string) => this.convertDocument(source),
    exportToMarkdown: (documentKey: string, maxSize?: number) => this.exportToMarkdown(documentKey, maxSize),
  };

  constructor() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return;
      }

      const configPath = path.join(workspaceFolders[0].uri.fsPath, '.kiro', 'settings', 'mcp.json');
      const content = await fs.readFile(configPath, 'utf-8');
      // Remove comments from JSON (JSONC support)
      const cleanedContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      this.config = JSON.parse(cleanedContent);
      
      // Initialize connection status
      this.connected.set('zotero', false);
      this.connected.set('citation', false);
      this.connected.set('docling', false);
    } catch (error) {
      console.warn('MCP configuration not found or invalid:', error);
      this.config = null;
    }
  }

  isConnected(server: 'zotero' | 'citation' | 'docling'): boolean {
    return this.connected.get(server) || false;
  }

  async reconnect(server: string): Promise<void> {
    console.log(`Attempting to reconnect to ${server} MCP server...`);
    
    // Check if server is disabled in config
    if (this.config?.mcpServers?.[server as keyof typeof this.config.mcpServers]?.disabled) {
      console.log(`${server} MCP server is disabled in configuration`);
      this.connected.set(server, false);
      return;
    }

    // Simulate connection attempt with retry logic
    try {
      await this.withRetry(async () => {
        // Placeholder for actual MCP connection logic
        // In a real implementation, this would establish a connection to the MCP server
        const isAvailable = await this.checkServerAvailability(server);
        if (!isAvailable) {
          throw new Error(`${server} MCP server not available`);
        }
        this.connected.set(server, true);
      });
      console.log(`Successfully connected to ${server} MCP server`);
    } catch (error) {
      console.error(`Failed to connect to ${server} MCP server:`, error);
      this.connected.set(server, false);
      throw error;
    }
  }

  private async checkServerAvailability(server: string): Promise<boolean> {
    // Placeholder for actual server availability check
    // In a real implementation, this would ping the MCP server
    return false; // Default to offline mode for now
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const opts = { ...this.DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | null = null;
    let delay = opts.initialDelay;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await this.withTimeout(operation(), this.DEFAULT_TIMEOUT);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < opts.maxRetries) {
          console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
          delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      ),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCacheKey(prefix: string, ...args: any[]): string {
    return `${prefix}:${args.join(':')}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  // Zotero MCP methods
  async zoteroSemanticSearch(query: string, limit: number = 10): Promise<ZoteroItem[]> {
    const cacheKey = this.getCacheKey('zotero:search', query, limit);
    const cached = this.getFromCache<ZoteroItem[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('zotero')) {
      console.warn('Zotero MCP not connected, returning cached results or empty array');
      const emptyResult: ZoteroItem[] = [];
      this.setCache(cacheKey, emptyResult);
      return emptyResult;
    }
    
    try {
      const results = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_zotero_zotero_semantic_search
        return [] as ZoteroItem[];
      });
      
      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Zotero semantic search failed:', error);
      const fallback = cached || [];
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async getItemMetadata(itemKey: string): Promise<ZoteroMetadata | null> {
    const cacheKey = this.getCacheKey('zotero:metadata', itemKey);
    const cached = this.getFromCache<ZoteroMetadata>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('zotero')) {
      console.warn('Zotero MCP not connected, returning cached metadata');
      this.setCache(cacheKey, null);
      return null;
    }
    
    try {
      const metadata = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_zotero_zotero_get_item_metadata
        return null as ZoteroMetadata | null;
      });
      
      if (metadata) {
        this.setCache(cacheKey, metadata);
      }
      return metadata;
    } catch (error) {
      console.error('Get item metadata failed:', error);
      return cached;
    }
  }

  async getItemFulltext(itemKey: string): Promise<string> {
    const cacheKey = this.getCacheKey('zotero:fulltext', itemKey);
    const cached = this.getFromCache<string>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('zotero')) {
      console.warn('Zotero MCP not connected, returning cached fulltext');
      this.setCache(cacheKey, '');
      return '';
    }
    
    try {
      const fulltext = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_zotero_zotero_get_item_fulltext
        return '';
      });
      
      if (fulltext) {
        this.setCache(cacheKey, fulltext);
      }
      return fulltext;
    } catch (error) {
      console.error('Get item fulltext failed:', error);
      const fallback = cached || '';
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async getCollections(): Promise<ZoteroCollection[]> {
    const cacheKey = this.getCacheKey('zotero:collections');
    const cached = this.getFromCache<ZoteroCollection[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('zotero')) {
      console.warn('Zotero MCP not connected, returning cached collections');
      const emptyResult: ZoteroCollection[] = [];
      this.setCache(cacheKey, emptyResult);
      return emptyResult;
    }
    
    try {
      const collections = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_zotero_zotero_get_collections
        return [] as ZoteroCollection[];
      });
      
      this.setCache(cacheKey, collections);
      return collections;
    } catch (error) {
      console.error('Get collections failed:', error);
      const fallback = cached || [];
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async getCollectionItems(collectionKey: string, limit?: number): Promise<any[]> {
    const cacheKey = this.getCacheKey('zotero:collection-items', collectionKey, limit || 'all');
    const cached = this.getFromCache<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('zotero')) {
      console.warn('Zotero MCP not connected, returning cached collection items');
      const emptyResult: any[] = [];
      this.setCache(cacheKey, emptyResult);
      return emptyResult;
    }
    
    try {
      const items = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_zotero_zotero_get_collection_items
        return [] as any[];
      });
      
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.error('Get collection items failed:', error);
      const fallback = cached || [];
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async getRecent(limit: number = 10): Promise<any[]> {
    const cacheKey = this.getCacheKey('zotero:recent', limit);
    const cached = this.getFromCache<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('zotero')) {
      console.warn('Zotero MCP not connected, returning cached recent items');
      const emptyResult: any[] = [];
      this.setCache(cacheKey, emptyResult);
      return emptyResult;
    }
    
    try {
      const items = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_zotero_zotero_get_recent
        return [] as any[];
      });
      
      this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.error('Get recent items failed:', error);
      const fallback = cached || [];
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async getItemChildren(itemKey: string): Promise<any[]> {
    const cacheKey = this.getCacheKey('zotero:children', itemKey);
    const cached = this.getFromCache<any[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('zotero')) {
      console.warn('Zotero MCP not connected, returning cached item children');
      const emptyResult: any[] = [];
      this.setCache(cacheKey, emptyResult);
      return emptyResult;
    }
    
    try {
      const children = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_zotero_zotero_get_item_children
        return [] as any[];
      });
      
      this.setCache(cacheKey, children);
      return children;
    } catch (error) {
      console.error('Get item children failed:', error);
      const fallback = cached || [];
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  // Citation MCP methods
  async verifyQuote(quote: string, authorYear: string): Promise<VerificationResult> {
    const cacheKey = this.getCacheKey('citation:verify', quote, authorYear);
    const cached = this.getFromCache<VerificationResult>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('citation')) {
      console.warn('Citation MCP not connected, returning cached result or unverified');
      const defaultResult = { verified: false, similarity: 0 };
      this.setCache(cacheKey, defaultResult);
      return defaultResult;
    }
    
    try {
      const result = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_citation_verify_quote
        return { verified: false, similarity: 0 } as VerificationResult;
      });
      
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Verify quote failed:', error);
      const fallback = cached || { verified: false, similarity: 0 };
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async searchQuotes(searchTerm: string, authorFilter?: string): Promise<QuoteMatch[]> {
    const cacheKey = this.getCacheKey('citation:search', searchTerm, authorFilter || '');
    const cached = this.getFromCache<QuoteMatch[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('citation')) {
      console.warn('Citation MCP not connected, returning cached results');
      const emptyResult: QuoteMatch[] = [];
      this.setCache(cacheKey, emptyResult);
      return emptyResult;
    }
    
    try {
      const results = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_citation_search_quotes
        return [] as QuoteMatch[];
      });
      
      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Search quotes failed:', error);
      const fallback = cached || [];
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async verifyAllQuotes(): Promise<VerificationReport> {
    if (!this.isConnected('citation')) {
      console.warn('Citation MCP not connected');
      throw new Error('Citation MCP not available for batch verification');
    }
    
    try {
      const report = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_citation_verify_all_quotes
        return {
          totalQuotes: 0,
          verified: 0,
          failed: 0,
          failures: [],
        } as VerificationReport;
      }, { maxRetries: 1 }); // Fewer retries for batch operations
      
      return report;
    } catch (error) {
      console.error('Verify all quotes failed:', error);
      throw error;
    }
  }

  // Docling MCP methods
  async convertDocument(source: string): Promise<string> {
    const cacheKey = this.getCacheKey('docling:convert', source);
    const cached = this.getFromCache<string>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('docling')) {
      console.warn('Docling MCP not connected, returning cached document key');
      this.setCache(cacheKey, '');
      return '';
    }
    
    try {
      const documentKey = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_docling_convert_document_into_docling_document
        return '';
      }, { maxRetries: 2 }); // Fewer retries for expensive operations
      
      if (documentKey) {
        this.setCache(cacheKey, documentKey);
      }
      return documentKey;
    } catch (error) {
      console.error('Convert document failed:', error);
      const fallback = cached || '';
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  async exportToMarkdown(documentKey: string, maxSize?: number): Promise<string> {
    const cacheKey = this.getCacheKey('docling:export', documentKey, maxSize || 'full');
    const cached = this.getFromCache<string>(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConnected('docling')) {
      console.warn('Docling MCP not connected, returning cached markdown');
      return cached || '';
    }
    
    try {
      const markdown = await this.withRetry(async () => {
        // Placeholder for actual MCP call
        // In real implementation: call mcp_docling_export_docling_document_to_markdown
        return '';
      });
      
      if (markdown) {
        this.setCache(cacheKey, markdown);
      }
      return markdown;
    } catch (error) {
      console.error('Export to markdown failed:', error);
      return cached || '';
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  dispose(): void {
    // Cleanup MCP connections
    this.connected.clear();
    this.cache.clear();
  }
}
