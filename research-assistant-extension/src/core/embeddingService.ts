import * as crypto from 'crypto';
import { getPerformanceMonitor } from './performanceMonitor';

export interface EmbeddingVector {
  text: string;
  vector: number[];
  metadata: Record<string, any>;
}

interface CacheEntry {
  vector: number[];
  timestamp: number;
  accessCount: number;
}

/**
 * EmbeddingService generates and compares text embeddings for semantic similarity.
 * 
 * This implementation uses a simple TF-IDF-like approach with word vectors.
 * For production use, this should be replaced with a proper embedding model
 * like transformers.js (all-MiniLM-L6-v2) or an API-based solution.
 */
export class EmbeddingService {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number;
  private vocabulary: Map<string, number> = new Map();
  private idfScores: Map<string, number> = new Map();
  private documentCount: number = 0;
  private performanceMonitor = getPerformanceMonitor();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(maxCacheSize: number = 1000) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Generate an embedding vector for the given text.
   * Uses TF-IDF weighted word vectors as a simple baseline.
   * 
   * @param text The text to embed
   * @returns A normalized embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return this.performanceMonitor.measureAsync('embedding.generate', async () => {
      // Check cache first
      const cached = this.getCachedEmbedding(text);
      if (cached) {
        this.cacheHits++;
        return cached;
      }

      this.cacheMisses++;

      // Generate new embedding
      const vector = this.computeEmbedding(text);
      
      // Cache the result
      this.cacheEmbedding(text, vector);
      
      return vector;
    });
  }

  /**
   * Generate embeddings for multiple texts in batch.
   * More efficient than calling generateEmbedding multiple times.
   * 
   * @param texts Array of texts to embed
   * @returns Array of embedding vectors
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    // Update vocabulary and IDF scores from all texts first
    this.updateVocabularyFromBatch(texts);
    
    // Generate embeddings
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  /**
   * Calculate cosine similarity between two vectors.
   * Returns a value between -1 and 1, where 1 means identical direction.
   * 
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Cosine similarity score
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      // Handle NaN values
      const v1 = isNaN(vec1[i]) ? 0 : vec1[i];
      const v2 = isNaN(vec2[i]) ? 0 : vec2[i];
      
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0 || isNaN(norm1) || isNaN(norm2)) {
      return 0;
    }

    const similarity = dotProduct / (norm1 * norm2);
    
    // Handle NaN result
    if (isNaN(similarity)) {
      return 0;
    }

    return similarity;
  }

  /**
   * Find the most similar vectors to a query vector.
   * 
   * @param query Query vector
   * @param candidates Array of candidate vectors with metadata
   * @param topK Number of top results to return
   * @returns Top K most similar vectors, sorted by similarity (descending)
   */
  findMostSimilar(
    query: number[],
    candidates: EmbeddingVector[],
    topK: number
  ): EmbeddingVector[] {
    // Calculate similarities
    const similarities = candidates.map(candidate => ({
      vector: candidate,
      similarity: this.cosineSimilarity(query, candidate.vector)
    }));

    // Sort by similarity (descending) and take top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, topK).map(s => s.vector);
  }

  /**
   * Cache an embedding vector for a text.
   * Implements LRU eviction when cache is full.
   * 
   * @param text The text
   * @param vector The embedding vector
   */
  cacheEmbedding(text: string, vector: number[]): void {
    const key = this.getCacheKey(text);
    
    // If cache is full, evict least recently used entry
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      vector,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * Get a cached embedding vector for a text.
   * 
   * @param text The text
   * @returns The cached vector, or null if not found
   */
  getCachedEmbedding(text: string): number[] | null {
    const key = this.getCacheKey(text);
    const entry = this.cache.get(key);
    
    if (entry) {
      // Update access statistics
      entry.timestamp = Date.now();
      entry.accessCount++;
      return entry.vector;
    }
    
    return null;
  }

  /**
   * Clear the embedding cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate
    };
  }

  // Private helper methods

  private getCacheKey(text: string): string {
    // Use MD5 hash of text as cache key
    return crypto.createHash('md5').update(text).digest('hex');
  }

  private evictLRU(): void {
    // Find entry with oldest timestamp and lowest access count
    let oldestKey: string | null = null;
    let oldestScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Score combines recency and frequency
      // Lower score = more likely to evict
      const score = entry.timestamp + (entry.accessCount * 1000000);
      
      if (score < oldestScore) {
        oldestScore = score;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private computeEmbedding(text: string): number[] {
    // Tokenize and normalize text
    const tokens = this.tokenize(text);
    
    // Calculate term frequencies
    const termFreq = new Map<string, number>();
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    // Update vocabulary
    for (const token of tokens) {
      if (!this.vocabulary.has(token)) {
        this.vocabulary.set(token, this.vocabulary.size);
      }
    }

    // Create TF-IDF weighted vector
    const vectorSize = 384; // Standard embedding size
    const vector = new Array(vectorSize).fill(0);

    for (const [token, freq] of termFreq.entries()) {
      const tf = freq / tokens.length;
      const idf = this.getIDF(token);
      const tfidf = tf * idf;

      // Hash token to vector positions
      const positions = this.hashToPositions(token, vectorSize, 3);
      for (const pos of positions) {
        vector[pos] += tfidf;
      }
    }

    // Normalize vector
    return this.normalizeVector(vector);
  }

  private tokenize(text: string): string[] {
    // Simple tokenization: lowercase, remove punctuation, split on whitespace
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0 && token.length > 2); // Remove empty and very short tokens
  }

  private getIDF(token: string): number {
    // Return cached IDF if available
    if (this.idfScores.has(token)) {
      return this.idfScores.get(token)!;
    }

    // Default IDF for unknown tokens
    // In a real implementation, this would be computed from a corpus
    return 1.0;
  }

  private updateVocabularyFromBatch(texts: string[]): void {
    // Count document frequencies for IDF calculation
    const docFreq = new Map<string, number>();
    
    for (const text of texts) {
      const tokens = new Set(this.tokenize(text));
      for (const token of tokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    // Update IDF scores
    this.documentCount += texts.length;
    for (const [token, freq] of docFreq.entries()) {
      const idf = Math.log((this.documentCount + 1) / (freq + 1));
      this.idfScores.set(token, idf);
    }
  }

  private hashToPositions(token: string, vectorSize: number, numPositions: number): number[] {
    // Hash token to multiple positions in the vector
    const positions: number[] = [];
    
    for (let i = 0; i < numPositions; i++) {
      const hash = crypto.createHash('md5')
        .update(token + i.toString())
        .digest();
      
      // Convert first 4 bytes to integer and mod by vector size
      const value = hash.readUInt32BE(0);
      positions.push(value % vectorSize);
    }
    
    return positions;
  }

  private normalizeVector(vector: number[]): number[] {
    // L2 normalization
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (norm === 0) {
      return vector;
    }
    
    return vector.map(val => val / norm);
  }
}
