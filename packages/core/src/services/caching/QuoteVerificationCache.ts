import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Entry in the quote verification cache
 */
export interface QuoteVerificationEntry {
  quoteHash: string;      // SHA-256 hash of quote text + source
  source: string;         // Source identifier (e.g., "Johnson2007")
  verified: boolean;      // Whether quote was verified
  similarity: number;     // Similarity score (0-1)
  closestMatch?: string;  // Closest matching text if not verified (truncated to 500 chars)
  lastVerified: Date;     // Last verification timestamp
  accessCount: number;    // Access count for LRU eviction
}

/**
 * Serializable cache structure
 */
interface CacheData {
  version: string;
  lastUpdated: string;
  maxEntries: number;
  entries: Array<{
    quoteHash: string;
    source: string;
    verified: boolean;
    similarity: number;
    closestMatch?: string;
    lastVerified: string;
    accessCount: number;
  }>;
}

/**
 * Quote Verification Cache
 * 
 * Caches verification results for quotes using SHA-256 hashes.
 * - Handles quote changes gracefully (hash changes = new verification needed)
 * - Size-bounded with LRU eviction (default 200 entries)
 * - Persists to disk across sessions
 * - Fast O(1) lookup
 */
export class QuoteVerificationCache {
  private cache: Map<string, QuoteVerificationEntry>;
  private maxEntries: number;
  private cachePath: string;
  private isDirty: boolean = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 2000;
  private readonly CACHE_VERSION = '1.0.0';

  constructor(workspaceRoot: string, maxEntries: number = 200) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.cachePath = path.join(workspaceRoot, '.cache', 'quote-verification.json');
  }

  /**
   * Initialize cache by loading from disk
   */
  async initialize(): Promise<void> {
    try {
      await this.loadFromDisk();
      console.log(`[QuoteVerificationCache] Loaded ${this.cache.size} entries from cache`);
    } catch (error) {
      console.warn('[QuoteVerificationCache] Failed to load cache, starting fresh:', error);
      this.cache.clear();
    }
  }

  /**
   * Hash quote text and source for cache key
   */
  private hashQuote(text: string, source: string): string {
    return crypto
      .createHash('sha256')
      .update(`${text}:${source}`)
      .digest('hex');
  }

  /**
   * Get cached verification result
   */
  get(quoteText: string, source: string): QuoteVerificationEntry | null {
    const hash = this.hashQuote(quoteText, source);
    const entry = this.cache.get(hash);
    
    if (entry) {
      // Update access count for LRU
      entry.accessCount++;
      this.isDirty = true;
      this.scheduleSave();
      return entry;
    }
    
    return null;
  }

  /**
   * Store verification result in cache
   */
  set(quoteText: string, source: string, verified: boolean, similarity: number, closestMatch?: string): void {
    const hash = this.hashQuote(quoteText, source);
    
    // Evict LRU entry if at capacity and this is a new entry
    if (this.cache.size >= this.maxEntries && !this.cache.has(hash)) {
      this.evictLRU();
    }
    
    // Truncate closestMatch to save space (keep first 500 chars)
    const truncatedMatch = closestMatch && closestMatch.length > 500 
      ? closestMatch.substring(0, 500) + '...' 
      : closestMatch;
    
    this.cache.set(hash, {
      quoteHash: hash,
      source,
      verified,
      similarity,
      closestMatch: truncatedMatch,
      lastVerified: new Date(),
      accessCount: 1
    });
    
    this.isDirty = true;
    this.scheduleSave();
  }

  /**
   * Check if a quote is in the cache
   */
  has(quoteText: string, source: string): boolean {
    const hash = this.hashQuote(quoteText, source);
    return this.cache.has(hash);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    utilizationPercent: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const entry of this.cache.values()) {
      const date = new Date(entry.lastVerified);
      if (!oldest || date < oldest) {
        oldest = date;
      }
      if (!newest || date > newest) {
        newest = date;
      }
    }

    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      utilizationPercent: (this.cache.size / this.maxEntries) * 100,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.isDirty = true;
    this.scheduleSave();
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let minAccess = Infinity;
    let lruKey: string | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
      console.log(`[QuoteVerificationCache] Evicted LRU entry (access count: ${minAccess})`);
    }
  }

  /**
   * Schedule a save operation (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveToDisk().catch(error => {
        console.error('[QuoteVerificationCache] Failed to save cache:', error);
      });
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Load cache from disk
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      const cacheData: CacheData = JSON.parse(data);

      // Validate version
      if (cacheData.version !== this.CACHE_VERSION) {
        console.warn(`[QuoteVerificationCache] Cache version mismatch (${cacheData.version} vs ${this.CACHE_VERSION}), clearing cache`);
        this.cache.clear();
        return;
      }

      // Load entries
      this.cache.clear();
      for (const entry of cacheData.entries) {
        this.cache.set(entry.quoteHash, {
          ...entry,
          lastVerified: new Date(entry.lastVerified),
          closestMatch: entry.closestMatch
        });
      }

      console.log(`[QuoteVerificationCache] Loaded ${this.cache.size} entries from ${this.cachePath}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, that's okay
        console.log('[QuoteVerificationCache] No cache file found, starting fresh');
      } else {
        throw error;
      }
    }
  }

  /**
   * Save cache to disk
   */
  async saveToDisk(): Promise<void> {
    if (!this.isDirty) {
      return;
    }

    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.cachePath);
      await fs.mkdir(cacheDir, { recursive: true });

      // Serialize cache
      const cacheData: CacheData = {
        version: this.CACHE_VERSION,
        lastUpdated: new Date().toISOString(),
        maxEntries: this.maxEntries,
        entries: Array.from(this.cache.values()).map(entry => ({
          quoteHash: entry.quoteHash,
          source: entry.source,
          verified: entry.verified,
          similarity: entry.similarity,
          closestMatch: entry.closestMatch,
          lastVerified: entry.lastVerified.toISOString(),
          accessCount: entry.accessCount
        }))
      };

      // Write to disk
      await fs.writeFile(this.cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
      
      this.isDirty = false;
      console.log(`[QuoteVerificationCache] Saved ${this.cache.size} entries to ${this.cachePath}`);
    } catch (error) {
      console.error('[QuoteVerificationCache] Failed to save cache:', error);
      throw error;
    }
  }

  /**
   * Force immediate save (for shutdown)
   */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveToDisk();
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    await this.flush();
    this.cache.clear();
  }
}
