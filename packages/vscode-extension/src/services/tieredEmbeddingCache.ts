import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../core/loggingService';

/**
 * LRU Cache implementation for in-memory caching
 * Validates: Requirements US-2 (Low Memory Footprint)
 */
class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  resize(newSize: number): void {
    this.maxSize = newSize;

    // Evict items if new size is smaller
    while (this.cache.size > newSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

/**
 * Disk-based cache for persistent storage
 */
class DiskCache<K extends string, V> {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }

  private getFilePath(key: K): string {
    // Sanitize key to be filesystem-safe
    const sanitized = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.cacheDir, `${sanitized}.json`);
  }

  async get(key: K): Promise<V | null> {
    try {
      const filePath = this.getFilePath(key);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as V;
    } catch (error) {
      const logger = getLogger();
      logger.debug(`Failed to read from disk cache for key ${key}:`, error);
      return null;
    }
  }

  async set(key: K, value: V): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      const data = JSON.stringify(value);
      fs.writeFileSync(filePath, data, 'utf-8');
    } catch (error) {
      const logger = getLogger();
      logger.debug(`Failed to write to disk cache for key ${key}:`, error);
      // Non-critical error - continue without disk cache
    }
  }

  async clear(): Promise<void> {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
    } catch (error) {
      const logger = getLogger();
      logger.debug('Failed to clear disk cache:', error);
    }
  }
}

/**
 * TieredEmbeddingCache - Three-tier caching system for embeddings
 * 
 * Tier 1: Hot cache (50 items, in-memory, fastest)
 * Tier 2: Warm cache (200 items, in-memory, fast)
 * Tier 3: Cold cache (unlimited, on-disk, slower but persistent)
 * 
 * Implements automatic promotion between tiers and memory-pressure-based trimming.
 * Validates: Requirements US-2 (Low Memory Footprint)
 */
export class TieredEmbeddingCache {
  private hotCache: LRUCache<string, number[]>;
  private warmCache: LRUCache<string, number[]>;
  private coldCache: DiskCache<string, number[]>;
  private stats = {
    hotHits: 0,
    warmHits: 0,
    coldHits: 0,
    misses: 0
  };

  constructor(cacheDir: string) {
    this.hotCache = new LRUCache(50);
    this.warmCache = new LRUCache(200);
    this.coldCache = new DiskCache(cacheDir);
  }

  /**
   * Get embedding from cache, checking tiers in order
   */
  async get(key: string): Promise<number[] | null> {
    // Check hot cache first (fastest)
    let value = this.hotCache.get(key);
    if (value) {
      this.stats.hotHits++;
      return value;
    }

    // Check warm cache
    value = this.warmCache.get(key);
    if (value) {
      this.stats.warmHits++;
      // Promote to hot cache
      this.hotCache.set(key, value);
      return value;
    }

    // Check cold cache (disk)
    value = await this.coldCache.get(key);
    if (value) {
      this.stats.coldHits++;
      // Promote to warm cache
      this.warmCache.set(key, value);
      return value;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set embedding in cache (writes to both hot and cold)
   */
  async set(key: string, value: number[]): Promise<void> {
    // Always write to hot cache
    this.hotCache.set(key, value);
    
    // Also write to disk cache for persistence
    await this.coldCache.set(key, value);
  }

  /**
   * Trim caches based on memory pressure
   * level: 'light' (75%), 'moderate' (50%), 'aggressive' (25%)
   */
  trim(level: 'light' | 'moderate' | 'aggressive'): void {
    const logger = getLogger();
    
    switch (level) {
      case 'light':
        // Keep 75% of hot cache
        this.hotCache.resize(Math.ceil(50 * 0.75));
        logger.debug('Light cache trim: hot cache resized to 38 items');
        break;
      case 'moderate':
        // Keep 50% of hot cache, 50% of warm cache
        this.hotCache.resize(Math.ceil(50 * 0.5));
        this.warmCache.resize(Math.ceil(200 * 0.5));
        logger.debug('Moderate cache trim: hot cache resized to 25 items, warm cache resized to 100 items');
        break;
      case 'aggressive':
        // Clear hot cache, keep 25% of warm cache
        this.hotCache.clear();
        this.warmCache.resize(Math.ceil(200 * 0.25));
        logger.debug('Aggressive cache trim: hot cache cleared, warm cache resized to 50 items');
        break;
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    const logger = getLogger();
    this.hotCache.clear();
    this.warmCache.clear();
    await this.coldCache.clear();
    logger.debug('All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hotSize: number;
    warmSize: number;
    hitRate: number;
    totalRequests: number;
    hotHits: number;
    warmHits: number;
    coldHits: number;
    misses: number;
  } {
    const totalRequests = this.stats.hotHits + this.stats.warmHits + this.stats.coldHits + this.stats.misses;
    const hitRate = totalRequests > 0 ? ((totalRequests - this.stats.misses) / totalRequests) * 100 : 0;

    return {
      hotSize: this.hotCache.size(),
      warmSize: this.warmCache.size(),
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      hotHits: this.stats.hotHits,
      warmHits: this.stats.warmHits,
      coldHits: this.stats.coldHits,
      misses: this.stats.misses
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hotHits: 0,
      warmHits: 0,
      coldHits: 0,
      misses: 0
    };
  }
}
