import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EmbeddingQuantizer } from './EmbeddingQuantizer.js';

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
  snippets: any[]; // Stored as quantized
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
  private cachedSnippets: Map<string, EmbeddedSnippet> = new Map();
  private readonly CACHE_SIZE = 100;

  constructor(workspaceRoot: string) {
    this.indexPath = path.join(workspaceRoot, '.cache', 'embedding-index.json');
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
        parsed.snippets = parsed.snippets.map((snippet: any) => {
          if (!snippet.embeddingMetadata || typeof snippet.embeddingMetadata.min !== 'number' || typeof snippet.embeddingMetadata.max !== 'number') {
            console.log('[EmbeddingStore] Migrating snippet without valid metadata:', snippet.id);
            needsSave = true;
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
        
        if (needsSave) {
          console.log('[EmbeddingStore] Will save migrated index');
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

  private createNewIndex(): EmbeddingIndex {
    return {
      version: this.INDEX_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snippets: [],
      fileHashes: new Map()
    };
  }

  private saveIndex(): void {
    try {
      const dir = path.dirname(this.indexPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

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

  private computeFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  hasFileChanged(filePath: string, content: string): boolean {
    const currentHash = this.computeFileHash(content);
    const storedHash = this.index.fileHashes.get(filePath);
    return storedHash !== currentHash;
  }

  addSnippets(snippets: EmbeddedSnippet[], filePath: string, content: string): void {
    this.index.snippets = this.index.snippets.filter(s => s.filePath !== filePath);

    const quantizedSnippets = snippets.map(snippet => {
      const quantized = EmbeddingQuantizer.quantize(snippet.embedding);
      
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
        embedding: Array.from(quantized),
        embeddingMetadata: { min, max },
        startLine: snippet.startLine,
        endLine: snippet.endLine,
        timestamp: snippet.timestamp
      };
    });

    this.index.snippets.push(...quantizedSnippets);
    const hash = this.computeFileHash(content);
    this.index.fileHashes.set(filePath, hash);
    this.index.updatedAt = Date.now();
    this.saveIndex();

    console.log(`[EmbeddingStore] Added ${snippets.length} quantized snippets from ${path.basename(filePath)}`);
  }

  getAllSnippets(): EmbeddedSnippet[] {
    return this.index.snippets;
  }

  getSnippetsFromFile(filePath: string): EmbeddedSnippet[] {
    return this.index.snippets.filter(s => s.filePath === filePath);
  }

  searchByEmbedding(queryEmbedding: number[], limit: number = 10): EmbeddedSnippet[] {
    console.log('[EmbeddingStore] searchByEmbedding called with', this.index.snippets.length, 'total snippets');
    
    if (this.index.snippets.length === 0) {
      console.warn('[EmbeddingStore] No snippets in store');
      return [];
    }

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
            timestamp: s.snippet.timestamp
          };
        }

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

        this.cachedSnippets.set(result.id, result);
        
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

  clear(): void {
    this.index = this.createNewIndex();
    this.cachedSnippets.clear();
    this.saveIndex();
    console.log('[EmbeddingStore] Cleared all embeddings');
  }

  getStats(): { snippetCount: number; fileCount: number; indexSize: string; cacheSize: number } {
    const fileCount = this.index.fileHashes.size;
    const snippetCount = this.index.snippets.length;
    const cacheSize = this.cachedSnippets.size;
    const indexSize = (JSON.stringify(this.index).length / 1024 / 1024).toFixed(2);

    return { snippetCount, fileCount, indexSize: `${indexSize}MB`, cacheSize };
  }
}
