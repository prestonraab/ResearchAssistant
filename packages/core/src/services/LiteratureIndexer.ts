import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingStore, EmbeddedSnippet } from './EmbeddingStore.js';
import { SnippetExtractor } from './SnippetExtractor.js';
import { EmbeddingService } from './EmbeddingService.js';

/**
 * Orchestrates indexing of literature files
 * Manages when and how papers are embedded and stored
 */
export class LiteratureIndexer {
  private embeddingStore: EmbeddingStore;
  private snippetExtractor: SnippetExtractor;
  private embeddingService: EmbeddingService;
  private extractedTextPath: string;
  private isIndexing: boolean = false;

  constructor(
    workspaceRoot: string,
    embeddingService: EmbeddingService | null = null,
    extractedTextPath: string = 'literature/ExtractedText'
  ) {
    this.embeddingStore = new EmbeddingStore(workspaceRoot);
    this.snippetExtractor = new SnippetExtractor();
    this.embeddingService = embeddingService as EmbeddingService; // Will be null if not provided
    this.extractedTextPath = path.join(workspaceRoot, extractedTextPath);
  }

  /**
   * Index all literature files that have changed
   */
  async indexChangedFiles(): Promise<{ indexed: number; skipped: number; errors: number }> {
    if (this.isIndexing) {
      console.log('[LiteratureIndexer] Indexing already in progress');
      return { indexed: 0, skipped: 0, errors: 0 };
    }

    this.isIndexing = true;
    const stats = { indexed: 0, skipped: 0, errors: 0 };

    try {
      if (!fs.existsSync(this.extractedTextPath)) {
        console.log('[LiteratureIndexer] Extracted text directory not found:', this.extractedTextPath);
        return stats;
      }

      const files = fs.readdirSync(this.extractedTextPath)
        .filter(f => f.endsWith('.txt'))
        .map(f => path.join(this.extractedTextPath, f));

      console.log(`[LiteratureIndexer] Found ${files.length} text files to check`);

      // Extract snippets in parallel for all files
      const filesToIndex: Array<{ filePath: string; content: string }> = [];
      
      const extractionPromises = files.map(async (filePath) => {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');

          if (!this.embeddingStore.hasFileChanged(filePath, content)) {
            console.log(`[LiteratureIndexer] Skipping unchanged file: ${path.basename(filePath)}`);
            stats.skipped++;
            return;
          }

          filesToIndex.push({ filePath, content });
        } catch (error) {
          console.error(`[LiteratureIndexer] Error reading file ${filePath}:`, error);
          stats.errors++;
        }
      });

      await Promise.all(extractionPromises);

      // Embed files sequentially (one paper at a time)
      for (const { filePath, content } of filesToIndex) {
        try {
          console.log(`[LiteratureIndexer] Embedding ${path.basename(filePath)}`);
          await this.indexFile(filePath, content);
          stats.indexed++;
        } catch (error) {
          console.error(`[LiteratureIndexer] Error indexing file ${filePath}:`, error);
          stats.errors++;
        }
      }

      console.log('[LiteratureIndexer] Indexing complete:', stats);
    } finally {
      this.isIndexing = false;
    }

    return stats;
  }

  private async indexFile(filePath: string, content: string): Promise<void> {
    const snippets = this.snippetExtractor.extractSnippets(content, path.basename(filePath));

    if (snippets.length === 0) {
      return;
    }

    if (!this.embeddingService) {
      console.warn('[LiteratureIndexer] Embedding service is not available, skipping indexing');
      return;
    }

    try {
      // Extract all snippet texts for batch embedding
      const snippetTexts = snippets.map(s => s.text);
      
      const embeddings = await this.embeddingService.generateBatch(snippetTexts);
      
      const embeddedSnippets: EmbeddedSnippet[] = [];
      
      for (let i = 0; i < snippets.length; i++) {
        const embedding = embeddings[i];
        
        if (!embedding || embedding.length === 0) {
          console.warn(`[LiteratureIndexer] Failed to embed snippet ${i + 1}`);
          continue;
        }

        embeddedSnippets.push({
          id: `${path.basename(filePath)}_${i}`,
          filePath,
          fileName: path.basename(filePath),
          text: snippets[i].text,
          embedding,
          startLine: snippets[i].startLine,
          endLine: snippets[i].endLine,
          timestamp: Date.now()
        });
      }

      await this.embeddingStore.addSnippets(embeddedSnippets, filePath, content);
      console.log(`[LiteratureIndexer] Finished embedding ${path.basename(filePath)}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[LiteratureIndexer] Error embedding file: ${errorMsg}`);
      
      // If it's an API key error, log it prominently
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('API key')) {
        console.error('[LiteratureIndexer] ⚠️  OpenAI API key error - check your configuration in VS Code settings');
      }
    }
  }

  async searchSnippets(query: string, limit: number = 10): Promise<EmbeddedSnippet[]> {
    console.log('[LiteratureIndexer] searchSnippets called with query:', query.substring(0, 50));
    
    if (!this.embeddingService) {
      console.warn('[LiteratureIndexer] Embedding service is not available');
      return [];
    }
    
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.warn('[LiteratureIndexer] Failed to embed query');
      return [];
    }

    console.log('[LiteratureIndexer] Query embedding generated, searching store');
    
    const results = await this.embeddingStore.searchByEmbedding(queryEmbedding, limit);
    console.log('[LiteratureIndexer] Search returned', results.length, 'results');
    
    return results;
  }

  async searchSnippetsWithSimilarity(query: string, limit: number = 10): Promise<import('./EmbeddingStore.js').EmbeddedSnippetWithSimilarity[]> {
    console.log('[LiteratureIndexer] searchSnippetsWithSimilarity called with query:', query.substring(0, 50));
    
    if (!this.embeddingService) {
      console.warn('[LiteratureIndexer] Embedding service is not available');
      return [];
    }
    
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.warn('[LiteratureIndexer] Failed to embed query');
      return [];
    }

    console.log('[LiteratureIndexer] Query embedding generated, searching store');
    
    const results = await this.embeddingStore.searchByEmbeddingWithSimilarity(queryEmbedding, limit);
    console.log('[LiteratureIndexer] Search returned', results.length, 'results with similarity scores');
    
    return results;
  }

  async getSnippets(): Promise<EmbeddedSnippet[]> {
    return this.embeddingStore.getAllSnippets();
  }

  async getStats(): Promise<{ snippetCount: number; fileCount: number; indexSize: string }> {
    return this.embeddingStore.getStats();
  }

  async clearIndex(): Promise<void> {
    await this.embeddingStore.clear();
    console.log('[LiteratureIndexer] Cleared all embeddings');
  }

  isIndexingInProgress(): boolean {
    return this.isIndexing;
  }
}
