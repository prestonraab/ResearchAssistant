import * as vscode from 'vscode';
import * as https from 'https';
import { TextNormalizer } from './textNormalizer';

/**
 * Service for generating embeddings using OpenAI API
 * Caches embeddings in memory to avoid redundant API calls
 * Normalizes text before embedding to handle OCR artifacts
 */
export class EmbeddingService {
  private apiKey: string;
  private model: string;
  private cache: Map<string, number[]> = new Map();
  private readonly CACHE_SIZE = 1000;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || this.getSettingValue('openaiApiKey') || process.env.OPENAI_API_KEY || '';
    this.model = model || this.getSettingValue('embeddingModel') || 'text-embedding-3-small';
  }

  /**
   * Get setting value from VS Code configuration
   */
  private getSettingValue(key: string): string {
    try {
      const config = vscode.workspace.getConfiguration('researchAssistant');
      return config.get<string>(key) || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate embedding for text
   * Normalizes text before embedding to improve quality
   */
  async embed(text: string): Promise<number[] | null> {
    if (!this.apiKey) {
      console.warn('[EmbeddingService] OpenAI API key not configured');
      return null;
    }

    // Normalize text to handle OCR artifacts
    const normalizedText = TextNormalizer.normalizeForEmbedding(text);

    // Check cache first (using normalized text as key)
    const cached = this.cache.get(normalizedText);
    if (cached) {
      return cached;
    }

    try {
      const embedding = await this.callOpenAIAPI(normalizedText);
      
      // Cache result
      if (this.cache.size >= this.CACHE_SIZE) {
        // Remove oldest entry (simple FIFO)
        const firstKey = this.cache.keys().next().value as string;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }
      this.cache.set(normalizedText, embedding);

      return embedding;
    } catch (error) {
      console.error('[EmbeddingService] Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    const results: (number[] | null)[] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }

    return results;
  }

  /**
   * Call OpenAI embedding API
   */
  private callOpenAIAPI(text: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        input: text,
        model: this.model
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/embeddings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.apiKey}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              const embedding = response.data[0].embedding;
              resolve(embedding);
            } else {
              reject(new Error(`OpenAI API error: ${res.statusCode} ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.CACHE_SIZE };
  }
}
