import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { LocalIndex } from 'vectra';

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

// Legacy interfaces kept for compatibility
export interface QuantizedSnippet {
  id: string;
  filePath: string;
  fileName: string;
  text: string;
  embedding: Int8Array;
  embeddingMetadata: { min: number; max: number };
  startLine: number;
  endLine: number;
  timestamp: number;
}

export interface EmbeddingIndex {
  version: number;
  createdAt: number;
  updatedAt: number;
  snippets: any[];
  fileHashes: Map<string, string>;
}

/**
 * Manages persistent storage of embeddings for literature snippets
 * Uses Vectra for fast vector similarity search (<2ms queries)
 * 
 * Vectra stores vectors in memory but persists to disk as JSON files.
 * Much faster than brute-force search due to optimized cosine similarity.
 */
export class EmbeddingStore {
  private indexPath: string;
  private vectraIndex: LocalIndex;
  private fileHashesPath: string;
  private fileHashes: Map<string, string> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(workspaceRoot: string) {
    this.indexPath = path.join(workspaceRoot, '.cache', 'vectra-index');
    this.fileHashesPath = path.join(workspaceRoot, '.cache', 'file-hashes.json');
    this.vectraIndex = new LocalIndex(this.indexPath);
    this.loadFileHashes();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    this.initPromise = this.initialize();
    await this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      if (!(await this.vectraIndex.isIndexCreated())) {
        console.log('[EmbeddingStore] Creating new vectra index');
        await this.vectraIndex.createIndex({
          version: 1,
          metadata_config: { indexed: ['filePath', 'fileName'] }
        });
      }
      this.initialized = true;
      console.log('[EmbeddingStore] Vectra index initialized');
    } catch (error) {
      console.error('[EmbeddingStore] Failed to initialize vectra index:', error);
      throw error;
    }
  }

  private loadFileHashes(): void {
    try {
      if (fs.existsSync(this.fileHashesPath)) {
        const data = fs.readFileSync(this.fileHashesPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.fileHashes = new Map(parsed);
        console.log('[EmbeddingStore] Loaded', this.fileHashes.size, 'file hashes');
      }
    } catch (error) {
      console.error('[EmbeddingStore] Failed to load file hashes:', error);
      this.fileHashes = new Map();
    }
  }

  private saveFileHashes(): void {
    try {
      const dir = path.dirname(this.fileHashesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.fileHashesPath,
        JSON.stringify(Array.from(this.fileHashes.entries())),
        'utf-8'
      );
    } catch (error) {
      console.error('[EmbeddingStore] Failed to save file hashes:', error);
    }
  }

  private computeFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  hasFileChanged(filePath: string, content: string): boolean {
    const currentHash = this.computeFileHash(content);
    const storedHash = this.fileHashes.get(filePath);
    return storedHash !== currentHash;
  }

  async addSnippets(snippets: EmbeddedSnippet[], filePath: string, content: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const existingItems = await this.vectraIndex.listItemsByMetadata({ filePath: { $eq: filePath } });
      for (const item of existingItems) {
        await this.vectraIndex.deleteItem(item.id);
      }
    } catch (error) {
      console.log('[EmbeddingStore] No existing items to delete for', path.basename(filePath));
    }

    for (const snippet of snippets) {
      await this.vectraIndex.insertItem({
        id: snippet.id,
        vector: snippet.embedding,
        metadata: {
          filePath: snippet.filePath,
          fileName: snippet.fileName,
          text: snippet.text,
          startLine: snippet.startLine,
          endLine: snippet.endLine,
          timestamp: snippet.timestamp
        }
      });
    }

    const hash = this.computeFileHash(content);
    this.fileHashes.set(filePath, hash);
    this.saveFileHashes();

    console.log(`[EmbeddingStore] Added ${snippets.length} snippets from ${path.basename(filePath)}`);
  }

  async getAllSnippets(): Promise<EmbeddedSnippet[]> {
    await this.ensureInitialized();

    try {
      const items = await this.vectraIndex.listItems();
      return items.map(item => ({
        id: item.id,
        filePath: item.metadata.filePath as string,
        fileName: item.metadata.fileName as string,
        text: item.metadata.text as string,
        embedding: item.vector,
        startLine: item.metadata.startLine as number,
        endLine: item.metadata.endLine as number,
        timestamp: item.metadata.timestamp as number
      }));
    } catch (error) {
      console.error('[EmbeddingStore] Failed to get all snippets:', error);
      return [];
    }
  }

  async getSnippetsFromFile(filePath: string): Promise<EmbeddedSnippet[]> {
    await this.ensureInitialized();

    try {
      const items = await this.vectraIndex.listItemsByMetadata({ filePath: { $eq: filePath } });
      return items.map(item => ({
        id: item.id,
        filePath: item.metadata.filePath as string,
        fileName: item.metadata.fileName as string,
        text: item.metadata.text as string,
        embedding: item.vector,
        startLine: item.metadata.startLine as number,
        endLine: item.metadata.endLine as number,
        timestamp: item.metadata.timestamp as number
      }));
    } catch (error) {
      console.error('[EmbeddingStore] Failed to get snippets from file:', error);
      return [];
    }
  }

  async searchByEmbedding(queryEmbedding: number[], limit: number = 10): Promise<EmbeddedSnippet[]> {
    const results = await this.searchByEmbeddingWithSimilarity(queryEmbedding, limit);
    return results.map(({ similarity, ...snippet }) => snippet);
  }

  async searchByEmbeddingWithSimilarity(queryEmbedding: number[], limit: number = 10): Promise<EmbeddedSnippetWithSimilarity[]> {
    const startTime = performance.now();
    await this.ensureInitialized();

    try {
      const results = await this.vectraIndex.queryItems(queryEmbedding, '', limit);
      
      const snippets: EmbeddedSnippetWithSimilarity[] = results.map(result => ({
        id: result.item.id,
        filePath: result.item.metadata.filePath as string,
        fileName: result.item.metadata.fileName as string,
        text: result.item.metadata.text as string,
        embedding: result.item.vector,
        startLine: result.item.metadata.startLine as number,
        endLine: result.item.metadata.endLine as number,
        timestamp: result.item.metadata.timestamp as number,
        similarity: result.score
      }));

      const duration = performance.now() - startTime;
      console.log(`[EmbeddingStore] Vectra search completed in ${duration.toFixed(2)}ms, returning ${snippets.length} results`);

      return snippets;
    } catch (error) {
      console.error('[EmbeddingStore] Search failed:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      if (fs.existsSync(this.indexPath)) {
        fs.rmSync(this.indexPath, { recursive: true, force: true });
      }
      
      this.fileHashes.clear();
      this.saveFileHashes();
      
      this.initialized = false;
      this.initPromise = null;
      this.vectraIndex = new LocalIndex(this.indexPath);
      
      console.log('[EmbeddingStore] Cleared all embeddings');
    } catch (error) {
      console.error('[EmbeddingStore] Failed to clear:', error);
    }
  }

  async getStats(): Promise<{ snippetCount: number; fileCount: number; indexSize: string; cacheSize?: number }> {
    await this.ensureInitialized();

    try {
      const items = await this.vectraIndex.listItems();
      const snippetCount = items.length;
      const fileCount = this.fileHashes.size;
      
      let indexSize = '0.00';
      if (fs.existsSync(this.indexPath)) {
        const indexJsonPath = path.join(this.indexPath, 'index.json');
        if (fs.existsSync(indexJsonPath)) {
          const stats = fs.statSync(indexJsonPath);
          indexSize = (stats.size / 1024 / 1024).toFixed(2);
        }
      }

      return { 
        snippetCount, 
        fileCount, 
        indexSize: `${indexSize}MB`,
        cacheSize: 0
      };
    } catch (error) {
      console.error('[EmbeddingStore] Failed to get stats:', error);
      return { snippetCount: 0, fileCount: 0, indexSize: '0.00MB', cacheSize: 0 };
    }
  }
}
