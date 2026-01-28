import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Cache entry for claim-quote confidence assessment
 */
export interface ConfidenceCacheEntry {
  hash: string;
  claimText: string;
  quoteText: string;
  confidence: number;
  timestamp: number;
}

/**
 * Claim-Quote Confidence Cache
 * 
 * Caches LLM confidence assessments for claim-quote pairs.
 * - Uses SHA-256 hash of "claim_text:quote_text" as key
 * - Stores confidence score (0-1) from LLM
 * - Size-bounded with LRU eviction (default 1000 entries)
 * - Persists to disk across sessions
 */
export class ClaimQuoteConfidenceCache {
  private cache: Map<string, ConfidenceCacheEntry>;
  private maxSize: number;
  private cacheFilePath: string;
  private initialized: boolean = false;

  constructor(workspaceRoot: string, maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.cacheFilePath = path.join(workspaceRoot, '.cache', 'claim-quote-confidence.json');
  }

  /**
   * Initialize cache by loading from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.cacheFilePath);
      await fs.mkdir(cacheDir, { recursive: true });

      // Load existing cache if it exists
      try {
        const data = await fs.readFile(this.cacheFilePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Restore Map from serialized object
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([key, value]) => {
            this.cache.set(key, value as ConfidenceCacheEntry);
          });
        }
        
        console.log(`[ClaimQuoteConfidenceCache] Loaded ${this.cache.size} entries from cache`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error('[ClaimQuoteConfidenceCache] Error loading cache:', error);
        }
        // Cache file doesn't exist yet, that's fine
        console.log('[ClaimQuoteConfidenceCache] No existing cache file, starting fresh');
      }

      this.initialized = true;
    } catch (error) {
      console.error('[ClaimQuoteConfidenceCache] Failed to initialize:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Generate hash key for claim-quote pair
   */
  private hashPair(claimText: string, quoteText: string): string {
    return crypto.createHash('sha256').update(`${claimText}:${quoteText}`).digest('hex');
  }

  /**
   * Get confidence score from cache
   */
  get(claimText: string, quoteText: string): ConfidenceCacheEntry | undefined {
    const key = this.hashPair(claimText, quoteText);
    return this.cache.get(key);
  }

  /**
   * Store confidence score in cache
   */
  set(claimText: string, quoteText: string, confidence: number): void {
    const key = this.hashPair(claimText, quoteText);
    
    const entry: ConfidenceCacheEntry = {
      hash: key,
      claimText: claimText.substring(0, 100), // Store truncated for debugging
      quoteText: quoteText.substring(0, 100),
      confidence,
      timestamp: Date.now()
    };
    
    this.cache.set(key, entry);
    
    // Evict oldest entries if cache is full
    if (this.cache.size > this.maxSize) {
      this.evictOldest();
    }
    
    // Persist to disk (async, don't wait)
    this.persist().catch(error => {
      console.error('[ClaimQuoteConfidenceCache] Failed to persist:', error);
    });
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    // Convert to array and sort by timestamp
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(this.maxSize * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    console.log(`[ClaimQuoteConfidenceCache] Evicted ${toRemove} oldest entries`);
  }

  /**
   * Persist cache to disk
   */
  private async persist(): Promise<void> {
    try {
      // Convert Map to plain object for JSON serialization
      const obj: Record<string, ConfidenceCacheEntry> = {};
      this.cache.forEach((value, key) => {
        obj[key] = value;
      });
      
      const data = JSON.stringify(obj, null, 2);
      await fs.writeFile(this.cacheFilePath, data, 'utf-8');
    } catch (error) {
      console.error('[ClaimQuoteConfidenceCache] Failed to persist cache:', error);
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.persist().catch(error => {
      console.error('[ClaimQuoteConfidenceCache] Failed to persist after clear:', error);
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // Could track this if needed
    };
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    await this.persist();
    this.cache.clear();
  }
}
