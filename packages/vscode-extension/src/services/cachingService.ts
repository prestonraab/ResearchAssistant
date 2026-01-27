/**
 * CachingService - Optimized caching with LRU eviction and memory management
 */
export class CachingService<T> {
  private cache: Map<string, { value: T; timestamp: number; accessCount: number }> = new Map();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000, ttl: number = 3600000) {
    // Default: 1000 items, 1 hour TTL
    this.maxSize = maxSize;
    this.ttl = ttl;

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access count and timestamp for LRU
    entry.accessCount++;
    entry.timestamp = Date.now();

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // Remove old entry if exists
    this.cache.delete(key);

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0
    });

    // Evict if over capacity
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsageMB: number;
  } {
    let totalAccess = 0;
    this.cache.forEach(entry => {
      totalAccess += entry.accessCount;
    });

    const hitRate = totalAccess > 0 ? (totalAccess / (totalAccess + 1)) * 100 : 0;

    // Rough estimate of memory usage
    const memoryUsageMB = (this.cache.size * 1024) / 1024 / 1024; // Rough estimate

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate),
      memoryUsageMB: Math.round(memoryUsageMB * 100) / 100
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruAccessCount = Infinity;
    let lruTimestamp = Infinity;

    this.cache.forEach((entry, key) => {
      // Prefer evicting entries with low access count and old timestamp
      const score = entry.accessCount * 1000 + entry.timestamp;

      if (score < lruAccessCount * 1000 + lruTimestamp) {
        lruKey = key;
        lruAccessCount = entry.accessCount;
        lruTimestamp = entry.timestamp;
      }
    });

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Start cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000); // Run every 5 minutes
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Trim cache to a percentage of max size
   */
  trim(percentage: number = 50): void {
    const targetSize = Math.floor(this.maxSize * (percentage / 100));

    while (this.cache.size > targetSize) {
      this.evictLRU();
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Sentence parsing cache - caches parsed sentences to avoid re-parsing
 */
export class SentenceParsingCache {
  private cache: CachingService<any[]>;

  constructor(maxSize: number = 100) {
    this.cache = new CachingService(maxSize, 3600000); // 1 hour TTL
  }

  /**
   * Get cached parsed sentences
   */
  getParsedSentences(manuscriptPath: string): any[] | undefined {
    return this.cache.get(`sentences:${manuscriptPath}`);
  }

  /**
   * Cache parsed sentences
   */
  cacheParsedSentences(manuscriptPath: string, sentences: any[]): void {
    this.cache.set(`sentences:${manuscriptPath}`, sentences);
  }

  /**
   * Invalidate cache for manuscript
   */
  invalidate(manuscriptPath: string): void {
    this.cache.delete(`sentences:${manuscriptPath}`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.cache.dispose();
  }
}

/**
 * Claim similarity cache - caches similarity scores to avoid recalculation
 */
export class ClaimSimilarityCache {
  private cache: CachingService<number>;

  constructor(maxSize: number = 5000) {
    this.cache = new CachingService(maxSize, 1800000); // 30 minutes TTL
  }

  /**
   * Get cached similarity score
   */
  getSimilarity(sentenceId: string, claimId: string): number | undefined {
    return this.cache.get(`${sentenceId}:${claimId}`);
  }

  /**
   * Cache similarity score
   */
  cacheSimilarity(sentenceId: string, claimId: string, similarity: number): void {
    this.cache.set(`${sentenceId}:${claimId}`, similarity);
  }

  /**
   * Invalidate cache for sentence
   */
  invalidateSentence(sentenceId: string): void {
    // This is a simplified approach - in production, you might want to track all keys
    this.cache.clear();
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.cache.dispose();
  }
}
