import OpenAI from 'openai';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for generating and caching text embeddings using OpenAI API.
 * 
 * This service provides:
 * - Text embedding generation using OpenAI's embedding models
 * - Two-tier caching (in-memory LRU + persistent disk cache)
 * - Batch embedding generation for efficiency
 * - Cosine similarity calculation for semantic comparison
 * 
 * **Requirements:**
 * - 1.2: Core library has zero dependencies on MCP SDK or VS Code API
 * - 1.3: Core library exports all shared classes and types
 * - 4.1: Extension uses OpenAI API for embeddings (not TF-IDF)
 * 
 * **Cache Strategy:**
 * - In-memory cache uses LRU (Least Recently Used) eviction
 * - Disk cache persists embeddings across sessions
 * - Cache keys are MD5 hashes of input text
 * 
 * @example
 * ```typescript
 * const service = new EmbeddingService(
 *   process.env.OPENAI_API_KEY!,
 *   '.cache/embeddings',
 *   1000,
 *   'text-embedding-3-small'
 * );
 * 
 * // Generate single embedding
 * const embedding = await service.generateEmbedding('research question');
 * 
 * // Generate batch
 * const embeddings = await service.generateBatch(['text1', 'text2']);
 * 
 * // Calculate similarity
 * const similarity = service.cosineSimilarity(embedding1, embedding2);
 * ```
 */
export class EmbeddingService {
  private openai: OpenAI;
  private cache: Map<string, number[]>;
  private cacheDir: string;
  private maxCacheSize: number;
  private model: string;

  /**
   * Creates a new EmbeddingService instance.
   * 
   * @param apiKey - OpenAI API key for authentication
   * @param cacheDir - Directory path for persistent disk cache (default: '.cache/embeddings')
   * @param maxCacheSize - Maximum number of embeddings to keep in memory (default: 1000)
   * @param model - OpenAI embedding model to use (default: 'text-embedding-3-small')
   * 
   * @throws {Error} If cache directory cannot be created
   * 
   * @remarks
   * The constructor automatically:
   * - Creates the cache directory if it doesn't exist
   * - Loads existing embeddings from disk cache (up to maxCacheSize)
   * - Initializes the OpenAI client with the provided API key
   */
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
   * Generates an embedding vector for a single text string.
   * 
   * This method implements a two-tier caching strategy:
   * 1. Check in-memory cache (fast)
   * 2. Check disk cache (medium)
   * 3. Call OpenAI API (slow)
   * 
   * Cache hits update LRU ordering by moving the entry to the end.
   * 
   * @param text - The text to generate an embedding for
   * @returns Promise resolving to the embedding vector (array of numbers)
   * 
   * @throws {Error} If the OpenAI API call fails
   * 
   * @remarks
   * - Automatically caches the result in both memory and disk
   * - Trims the cache if it exceeds maxCacheSize after adding new entry
   * - Uses MD5 hash of text as cache key
   * 
   * **Requirement 13.1:** Generate vector representation of text
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
   * Generates embeddings for multiple texts in a single batch operation.
   * 
   * This method is more efficient than calling generateEmbedding() multiple times
   * because it:
   * - Makes a single API call for all uncached texts
   * - Reduces network latency
   * - Uses fewer API tokens
   * 
   * @param texts - Array of text strings to generate embeddings for
   * @returns Promise resolving to array of embedding vectors (in same order as input)
   * 
   * @throws {Error} If the OpenAI API call fails
   * 
   * @remarks
   * - Checks cache for each text individually
   * - Only generates embeddings for uncached texts
   * - Maintains input order in output array
   * - Updates LRU ordering for cache hits
   * - Trims cache if needed after adding new entries
   * 
   * **Requirement 13.4:** Support batch embedding generation for efficiency
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
   * Calculates the cosine similarity between two embedding vectors.
   * 
   * Cosine similarity measures the cosine of the angle between two vectors,
   * producing a value between -1 and 1:
   * - 1: Vectors point in the same direction (identical meaning)
   * - 0: Vectors are orthogonal (unrelated)
   * - -1: Vectors point in opposite directions (opposite meaning)
   * 
   * @param vec1 - First embedding vector
   * @param vec2 - Second embedding vector
   * @returns Similarity score between -1 and 1
   * 
   * @throws {Error} If vectors have different lengths
   * 
   * @remarks
   * Formula: similarity = (vec1 · vec2) / (||vec1|| * ||vec2||)
   * where · is dot product and || || is magnitude
   * 
   * **Requirement 13.3:** Use cosine similarity for semantic comparison
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
   * Trims the in-memory cache to the specified maximum size using LRU eviction.
   * 
   * This method removes the least recently used entries from the cache,
   * keeping only the most recent maxSize entries. The disk cache is not affected.
   * 
   * @param maxSize - Maximum number of entries to keep in memory
   * 
   * @remarks
   * - Uses Map iteration order (insertion order) to determine LRU
   * - Entries at the beginning of the Map are oldest
   * - Entries at the end are most recently used
   * - Called automatically when cache exceeds maxCacheSize
   * 
   * **Requirement 13.5:** Trim cache when memory usage exceeds thresholds
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
   * Clears all cached embeddings from memory.
   * 
   * This method only clears the in-memory cache. The disk cache is not affected.
   * Useful for testing or when you want to force regeneration of embeddings.
   * 
   * @remarks
   * After calling this method, subsequent calls to generateEmbedding() will
   * still check the disk cache before calling the OpenAI API.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Returns the current number of embeddings in the in-memory cache.
   * 
   * @returns Number of cached embeddings
   * 
   * @remarks
   * This only counts in-memory cache entries. The disk cache may contain
   * additional embeddings that are not currently loaded in memory.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Generates a cache key from text using MD5 hash.
   * 
   * @param text - The text to generate a cache key for
   * @returns MD5 hash of the text (32-character hex string)
   * 
   * @remarks
   * MD5 is used because:
   * - Fast computation
   * - Fixed-length output (good for filenames)
   * - Collision probability is negligible for this use case
   * - Not used for security, so MD5 weaknesses don't matter
   * 
   * **Requirement 13.2:** Cache embeddings to avoid redundant computation
   */
  private getCacheKey(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Loads embeddings from disk cache into memory on initialization.
   * 
   * This method is called automatically by the constructor. It loads up to
   * maxCacheSize embeddings from the disk cache directory.
   * 
   * @remarks
   * - Only loads .json files from the cache directory
   * - Stops loading after reaching maxCacheSize
   * - Silently ignores errors (logs to console)
   * - Does not guarantee which embeddings are loaded if more than maxCacheSize exist
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
   * Loads a single embedding from the disk cache.
   * 
   * @param cacheKey - The cache key (MD5 hash) to load
   * @returns The embedding vector, or null if not found or invalid
   * 
   * @remarks
   * - Returns null if file doesn't exist
   * - Returns null if file cannot be parsed as JSON
   * - Silently handles errors (returns null)
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
   * Saves an embedding to the disk cache.
   * 
   * @param cacheKey - The cache key (MD5 hash) to save under
   * @param embedding - The embedding vector to save
   * 
   * @remarks
   * - Creates a JSON file named {cacheKey}.json in the cache directory
   * - Silently handles errors (logs to console)
   * - Does not throw errors to avoid disrupting the main flow
   */
  private saveToDiskCache(cacheKey: string, embedding: number[]): void {
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      fs.writeFileSync(cachePath, JSON.stringify(embedding));
    } catch (error) {
      console.error('Failed to save to disk cache:', error);
    }
  }
}
