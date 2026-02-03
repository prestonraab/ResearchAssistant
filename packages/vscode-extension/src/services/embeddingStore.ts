import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EmbeddingQuantizer } from './embeddingQuantizer';

export interface EmbeddedSnippet {
  id: string;
  filePath: string;
  fileName: string;
  text: string;
  embedding: number[];
  startLine: number;
  endLine: number;
  timestamp: number;
}

export interface EmbeddedSnippetWithSimilarity extends EmbeddedSnippet {
  similarity: number;
}

export interface QuantizedSnippet {
  id: string;
  filePath: string;
  fileName: string;
  text: string;
  embedding: Int8Array; // Quantized to int8
  embeddingMetadata: { min: number; max: number }; // For dequantization
  startLine: number;
  endLine: number;
  timestamp: number;
}

export interface EmbeddingIndex {
  version: number;
  createdAt: number;
  updatedAt: number;
  snippets: QuantizedSnippet[]; // Stored as quantized
  fileHashes: Map<string, string>; // filePath -> hash for change detection
}

/**
 * Manages persistent storage of embeddings for literature snippets
 * Stores embeddings on disk to avoid re-computing on every startup
 * Detects file changes and only re-embeds modified files
 * Uses lazy loading to keep memory usage low
 */
export class EmbeddingStore {
  private indexPath: string;
  private index: EmbeddingIndex;
  private readonly INDEX_VERSION = 1;
  private cachedSnippets: Map<string, EmbeddedSnippet> = new Map(); // LRU cache for frequently accessed snippets
  private readonly CACHE_SIZE = 100; // Keep only 100 snippets in memory

  constructor(workspaceRoot: string) {
    this.indexPath = path.join(workspaceRoot, '.kiro', 'embedding-index.json');
    this.index = this.loadIndex();
  }

  /**
   * Load index from disk or create new one
   */
  private loadIndex(): EmbeddingIndex {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Validate version
        if (parsed.version !== this.INDEX_VERSION) {
          console.log('[EmbeddingStore] Index version mismatch, creating new index');
          return this.createNewIndex();
        }

        // Convert fileHashes back to Map
        parsed.fileHashes = new Map(parsed.fileHashes || []);
        
        // Migrate old snippets without metadata
        let needsSave = false;
        parsed.snippets = parsed.snippets.map((snippet: QuantizedSnippet) => {
          if (!snippet.embeddingMetadata || typeof snippet.embeddingMetadata.min !== 'number' || typeof snippet.embeddingMetadata.max !== 'number') {
            console.log('[EmbeddingStore] Migrating snippet without valid metadata:', snippet.id);
            needsSave = true;
            // Reconstruct metadata from quantized values
            const quantized = new Int8Array(snippet.embedding);
            if (quantized.length === 0) {
              return {
                ...snippet,
                embeddingMetadata: { min: 0, max: 0 }
              };
            }
            let min = quantized[0];
            let max = quantized[0];
            for (let i = 1; i < quantized.length; i++) {
              if (quantized[i] < min) min = quantized[i];
              if (quantized[i] > max) max = quantized[i];
            }
            return {
              ...snippet,
              embeddingMetadata: { min, max }
            };
          }
          return snippet;
        });
        
        console.log('[EmbeddingStore] Loaded index with', parsed.snippets.length, 'snippets');
        
        // Save migrated index after returning (async)
        if (needsSave) {
          console.log('[EmbeddingStore] Will save migrated index with reconstructed metadata');
          setImmediate(() => {
            try {
              const dir = path.dirname(this.indexPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              const data = {
                ...parsed,
                fileHashes: Array.from(parsed.fileHashes.entries())
              };
              fs.writeFileSync(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
              console.log('[EmbeddingStore] Saved migrated index to disk');
            } catch (error) {
              console.error('[EmbeddingStore] Failed to save migrated index:', error);
            }
          });
        }
        
        return parsed;
      }
    } catch (error) {
      console.error('[EmbeddingStore] Failed to load index:', error);
    }

    return this.createNewIndex();
  }

  /**
   * Create new empty index
   */
  private createNewIndex(): EmbeddingIndex {
    return {
      version: this.INDEX_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snippets: [],
      fileHashes: new Map()
    };
  }

  /**
   * Save index to disk
   */
  private saveIndex(): void {
    try {
      const dir = path.dirname(this.indexPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert Map to array for JSON serialization
      const data = {
        ...this.index,
        fileHashes: Array.from(this.index.fileHashes.entries())
      };

      fs.writeFileSync(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('[EmbeddingStore] Index saved to disk');
    } catch (error) {
      console.error('[EmbeddingStore] Failed to save index:', error);
    }
  }

  /**
   * Compute hash of file content for change detection
   */
  private computeFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if file has changed since last embedding
   */
  hasFileChanged(filePath: string, content: string): boolean {
    const currentHash = this.computeFileHash(content);
    const storedHash = this.index.fileHashes.get(filePath);
    return storedHash !== currentHash;
  }

  /**
   * Add embedded snippets to index
   * Quantizes embeddings before storing
   */
  addSnippets(snippets: EmbeddedSnippet[], filePath: string, content: string): void {
    // Remove old snippets from this file
    this.index.snippets = this.index.snippets.filter(s => s.filePath !== filePath);

    // Quantize and add new snippets
    const quantizedSnippets = snippets.map(snippet => {
      const quantized = EmbeddingQuantizer.quantize(snippet.embedding);
      
      // Find min/max for metadata
      let min = snippet.embedding[0];
      let max = snippet.embedding[0];
      for (let i = 1; i < snippet.embedding.length; i++) {
        if (snippet.embedding[i] < min) min = snippet.embedding[i];
        if (snippet.embedding[i] > max) max = snippet.embedding[i];
      }

      return {
        id: snippet.id,
        filePath: snippet.filePath,
        fileName: snippet.fileName,
        text: snippet.text,
        embedding: Array.from(quantized), // Store as array for JSON serialization
        embeddingMetadata: { min, max },
        startLine: snippet.startLine,
        endLine: snippet.endLine,
        timestamp: snippet.timestamp
      };
    });

    this.index.snippets.push(...quantizedSnippets);

    // Update file hash
    const hash = this.computeFileHash(content);
    this.index.fileHashes.set(filePath, hash);

    // Update timestamp
    this.index.updatedAt = Date.now();

    // Save to disk
    this.saveIndex();

    console.log(`[EmbeddingStore] Added ${snippets.length} quantized snippets from ${path.basename(filePath)}`);
  }

  /**
   * Get all snippets (loads from disk, not cached)
   */
  getAllSnippets(): EmbeddedSnippet[] {
    return this.index.snippets;
  }

  /**
   * Get snippets from specific file
   */
  getSnippetsFromFile(filePath: string): EmbeddedSnippet[] {
    return this.index.snippets.filter(s => s.filePath === filePath);
  }

  /**
   * Search snippets by embedding similarity
   * Uses lazy loading to minimize memory usage
   * Dequantizes embeddings on-the-fly for comparison
   */
  searchByEmbedding(queryEmbedding: number[], limit: number = 10): EmbeddedSnippet[] {
    console.log('[EmbeddingStore] searchByEmbedding called with', this.index.snippets.length, 'total snippets');
    
    if (this.index.snippets.length === 0) {
      console.warn('[EmbeddingStore] No snippets in store');
      return [];
    }

    // Compute cosine similarity with all snippets
    // Dequantizes on-the-fly to avoid loading all embeddings into memory
    const similarities = this.index.snippets.map(snippet => {
      // Validate metadata exists before using
      if (!snippet.embeddingMetadata || typeof snippet.embeddingMetadata.min !== 'number' || typeof snippet.embeddingMetadata.max !== 'number') {
        console.warn('[EmbeddingStore] Invalid embedding metadata for snippet', snippet.id, '- skipping');
        return {
          snippet,
          similarity: 0
        };
      }

      const quantized = new Int8Array(snippet.embedding);
      const similarity = EmbeddingQuantizer.cosineSimilarityQuantized(
        queryEmbedding,
        quantized,
        snippet.embeddingMetadata
      );

      return {
        snippet,
        similarity
      };
    });

    // Sort by similarity and return top results
    const results = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => {
        // Validate metadata before dequantizing
        if (!s.snippet.embeddingMetadata || typeof s.snippet.embeddingMetadata.min !== 'number' || typeof s.snippet.embeddingMetadata.max !== 'number') {
          console.warn('[EmbeddingStore] Cannot dequantize snippet', s.snippet.id, '- invalid metadata');
          // Return snippet with empty embedding as fallback
          return {
            id: s.snippet.id,
            filePath: s.snippet.filePath,
            fileName: s.snippet.fileName,
            text: s.snippet.text,
            embedding: [],
            startLine: s.snippet.startLine,
            endLine: s.snippet.endLine,
            timestamp: s.snippet.timestamp
          };
        }

        // Dequantize for return
        const dequantized = EmbeddingQuantizer.dequantize(
          new Int8Array(s.snippet.embedding),
          s.snippet.embeddingMetadata
        );

        const result: EmbeddedSnippet = {
          id: s.snippet.id,
          filePath: s.snippet.filePath,
          fileName: s.snippet.fileName,
          text: s.snippet.text,
          embedding: dequantized,
          startLine: s.snippet.startLine,
          endLine: s.snippet.endLine,
          timestamp: s.snippet.timestamp
        };

        // Add to cache
        this.cachedSnippets.set(result.id, result);
        
        // Evict oldest if cache is full
        if (this.cachedSnippets.size > this.CACHE_SIZE) {
          const firstKey = this.cachedSnippets.keys().next().value as string;
          if (firstKey) {
            this.cachedSnippets.delete(firstKey);
          }
        }
        
        return result;
      });
    
    console.log('[EmbeddingStore] Returning', results.length, 'results (cache size:', this.cachedSnippets.size + ')');
    
    return results;
  }

  /**
   * Search by embedding and return results with similarity scores
   * Useful when you need to filter by similarity threshold
   */
  searchByEmbeddingWithSimilarity(queryEmbedding: number[], limit: number = 10): EmbeddedSnippetWithSimilarity[] {
    console.log('[EmbeddingStore] searchByEmbeddingWithSimilarity called with', this.index.snippets.length, 'total snippets');
    
    if (this.index.snippets.length === 0) {
      console.warn('[EmbeddingStore] No snippets in store');
      return [];
    }

    // Compute cosine similarity with all snippets
    const similarities = this.index.snippets.map(snippet => {
      if (!snippet.embeddingMetadata || typeof snippet.embeddingMetadata.min !== 'number' || typeof snippet.embeddingMetadata.max !== 'number') {
        console.warn('[EmbeddingStore] Invalid embedding metadata for snippet', snippet.id, '- skipping');
        return {
          snippet,
          similarity: 0
        };
      }

      const quantized = new Int8Array(snippet.embedding);
      const similarity = EmbeddingQuantizer.cosineSimilarityQuantized(
        queryEmbedding,
        quantized,
        snippet.embeddingMetadata
      );

      return {
        snippet,
        similarity
      };
    });

    // Sort by similarity and return top results with similarity scores
    const results = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => {
        if (!s.snippet.embeddingMetadata || typeof s.snippet.embeddingMetadata.min !== 'number' || typeof s.snippet.embeddingMetadata.max !== 'number') {
          console.warn('[EmbeddingStore] Cannot dequantize snippet', s.snippet.id, '- invalid metadata');
          return {
            id: s.snippet.id,
            filePath: s.snippet.filePath,
            fileName: s.snippet.fileName,
            text: s.snippet.text,
            embedding: [],
            startLine: s.snippet.startLine,
            endLine: s.snippet.endLine,
            timestamp: s.snippet.timestamp,
            similarity: s.similarity
          };
        }

        const dequantized = EmbeddingQuantizer.dequantize(
          new Int8Array(s.snippet.embedding),
          s.snippet.embeddingMetadata
        );

        return {
          id: s.snippet.id,
          filePath: s.snippet.filePath,
          fileName: s.snippet.fileName,
          text: s.snippet.text,
          embedding: dequantized,
          startLine: s.snippet.startLine,
          endLine: s.snippet.endLine,
          timestamp: s.snippet.timestamp,
          similarity: s.similarity
        };
      });
    
    console.log('[EmbeddingStore] Returning', results.length, 'results with similarity scores');
    
    return results;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.index = this.createNewIndex();
    this.cachedSnippets.clear();
    this.saveIndex();
    console.log('[EmbeddingStore] Cleared all embeddings');
  }

  /**
   * Get statistics
   */
  getStats(): { snippetCount: number; fileCount: number; indexSize: string; cacheSize: number } {
    const fileCount = this.index.fileHashes.size;
    const snippetCount = this.index.snippets.length;
    const cacheSize = this.cachedSnippets.size;
    
    // Estimate size in MB
    const indexSize = (JSON.stringify(this.index).length / 1024 / 1024).toFixed(2);

    return { snippetCount, fileCount, indexSize: `${indexSize}MB`, cacheSize };
  }
}
