import OpenAI from 'openai';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for generating and caching text embeddings using OpenAI API
 * Implements Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */
export class EmbeddingService {
  private openai: OpenAI;
  private cache: Map<string, number[]>;
  private cacheDir: string;
  private maxCacheSize: number;
  private model: string;

  constructor(
    apiKey: string,
    cacheDir: string = '.cache/embeddings',
    maxCacheSize: number = 1000,
    model: string = 'text-embedding-3-small'
  ) {
    this.openai = new OpenAI({ apiKey });
    this.cache = new Map();
    this.cacheDir = cacheDir;
    this.maxCacheSize = maxCacheSize;
    this.model = model;

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Load cache from disk
    this.loadCacheFromDisk();
  }

  /**
   * Generate embedding for a single text
   * Requirement 13.1: Generate vector representation of text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.getCacheKey(text);

    // Check in-memory cache
    if (this.cache.has(cacheKey)) {
      // LRU: Move to end by deleting and re-adding
      const embedding = this.cache.get(cacheKey)!;
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, embedding);
      return embedding;
    }

    // Check disk cache
    const diskCached = this.loadFromDiskCache(cacheKey);
    if (diskCached) {
      this.cache.set(cacheKey, diskCached);
      return diskCached;
    }

    // Generate new embedding
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      this.cache.set(cacheKey, embedding);
      this.saveToDiskCache(cacheKey, embedding);

      // Trim cache if needed
      if (this.cache.size > this.maxCacheSize) {
        this.trimCache(this.maxCacheSize);
      }

      return embedding;
    } catch (error) {
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Requirement 13.4: Support batch embedding generation for efficiency
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const cacheKey = this.getCacheKey(text);

      if (this.cache.has(cacheKey)) {
        // LRU: Move to end by deleting and re-adding
        const embedding = this.cache.get(cacheKey)!;
        this.cache.delete(cacheKey);
        this.cache.set(cacheKey, embedding);
        results[i] = embedding;
      } else {
        const diskCached = this.loadFromDiskCache(cacheKey);
        if (diskCached) {
          this.cache.set(cacheKey, diskCached);
          results[i] = diskCached;
        } else {
          uncachedTexts.push(text);
          uncachedIndices.push(i);
        }
      }
    }

    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: uncachedTexts,
        });

        // Store results in correct positions
        for (let i = 0; i < uncachedTexts.length; i++) {
          const embedding = response.data[i].embedding;
          const originalIndex = uncachedIndices[i];
          const cacheKey = this.getCacheKey(uncachedTexts[i]);

          results[originalIndex] = embedding;
          this.cache.set(cacheKey, embedding);
          this.saveToDiskCache(cacheKey, embedding);
        }

        // Trim cache if needed
        if (this.cache.size > this.maxCacheSize) {
          this.trimCache(this.maxCacheSize);
        }
      } catch (error) {
        throw new Error(
          `Failed to generate batch embeddings: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Requirement 13.3: Use cosine similarity for semantic comparison
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Trim cache to specified size using LRU eviction
   * Requirement 13.5: Trim cache when memory usage exceeds thresholds
   */
  trimCache(maxSize: number): void {
    if (this.cache.size <= maxSize) {
      return;
    }

    // Convert to array and keep only the most recent entries
    const entries = Array.from(this.cache.entries());
    const toKeep = entries.slice(-maxSize);

    this.cache.clear();
    for (const [key, value] of toKeep) {
      this.cache.set(key, value);
    }
  }

  /**
   * Generate cache key from text using MD5 hash
   * Requirement 13.2: Cache embeddings to avoid redundant computation
   */
  private getCacheKey(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Load cache from disk on initialization
   */
  private loadCacheFromDisk(): void {
    if (!fs.existsSync(this.cacheDir)) {
      return;
    }

    try {
      const files = fs.readdirSync(this.cacheDir);
      let loadedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json') && loadedCount < this.maxCacheSize) {
          const cacheKey = file.replace('.json', '');
          const embedding = this.loadFromDiskCache(cacheKey);
          if (embedding) {
            this.cache.set(cacheKey, embedding);
            loadedCount++;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load cache from disk:', error);
    }
  }

  /**
   * Load a single embedding from disk cache
   */
  private loadFromDiskCache(cacheKey: string): number[] | null {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save embedding to disk cache
   */
  private saveToDiskCache(cacheKey: string, embedding: number[]): void {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      fs.writeFileSync(cachePath, JSON.stringify(embedding));
    } catch (error) {
      console.error('Failed to save to disk cache:', error);
    }
  }

  /**
   * Clear all caches (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
