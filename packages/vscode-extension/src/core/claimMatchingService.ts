import { ClaimsManager } from './claimsManagerWrapper';
import type { EmbeddingService } from '@research-assistant/core';

/**
 * ClaimMatchingService - Finds similar claims for sentences
 * Uses semantic similarity to rank and limit results
 */

export interface SimilarClaim {
  claimId: string;
  text: string;
  category: string;
  source: string;
  similarity: number;
}

export class ClaimMatchingService {
  private readonly MAX_RESULTS = 20;
  private readonly SIMILARITY_THRESHOLD = 0.5;

  constructor(
    private claimsManager: ClaimsManager,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Find similar claims for a sentence
   * Returns top 20 results sorted by semantic similarity
   */
  async findSimilarClaims(sentenceText: string, threshold: number = this.SIMILARITY_THRESHOLD): Promise<SimilarClaim[]> {
    try {
      // Get embedding for the sentence
      const sentenceEmbedding = await this.embeddingService.generateEmbedding(sentenceText);

      if (!sentenceEmbedding) {
        return [];
      }

      // Get all claims
      const claims = this.claimsManager.getClaims();

      // Calculate similarity for each claim
      const similarities: Array<{ claim: any; similarity: number }> = [];

      for (const claim of claims) {
        try {
          const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);

          if (claimEmbedding) {
            const similarity = this.cosineSimilarity(sentenceEmbedding, claimEmbedding);

            if (similarity >= threshold) {
              similarities.push({ claim, similarity });
            }
          }
        } catch (error) {
          // Skip claims that fail embedding
          continue;
        }
      }

      // Sort by similarity (highest first)
      similarities.sort((a, b) => b.similarity - a.similarity);

      // Limit to top results
      const topResults = similarities.slice(0, this.MAX_RESULTS);

      // Convert to SimilarClaim format
      return topResults.map(({ claim, similarity }) => ({
        claimId: claim.id || `claim_${Date.now()}`,
        text: claim.text || '',
        category: claim.category || 'Unknown',
        source: claim.primaryQuote?.source || '',
        similarity: similarity != null ? similarity : 0
      }));
    } catch (error) {
      console.error('Error finding similar claims:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find similar claims with custom threshold
   */
  async findSimilarClaimsWithThreshold(
    sentenceText: string,
    threshold: number
  ): Promise<SimilarClaim[]> {
    return this.findSimilarClaims(sentenceText, threshold);
  }

  /**
   * Get top N similar claims
   */
  async getTopSimilarClaims(sentenceText: string, topN: number = 5): Promise<SimilarClaim[]> {
    const allSimilar = await this.findSimilarClaims(sentenceText, 0); // No threshold
    return allSimilar.slice(0, topN);
  }

  /**
   * Check if a claim is similar to a sentence
   */
  async isSimilar(sentenceText: string, claimId: string, threshold: number = this.SIMILARITY_THRESHOLD): Promise<boolean> {
    const claim = this.claimsManager.getClaim(claimId);

    if (!claim) {
      return false;
    }

    try {
      const sentenceEmbedding = await this.embeddingService.generateEmbedding(sentenceText);
      const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);

      if (!sentenceEmbedding || !claimEmbedding) {
        return false;
      }

      const similarity = this.cosineSimilarity(sentenceEmbedding, claimEmbedding);
      return similarity >= threshold;
    } catch (error) {
      console.error('Error checking similarity:', error);
      return false;
    }
  }

  /**
   * Batch find similar claims for multiple sentences
   */
  async batchFindSimilarClaims(
    sentences: string[],
    threshold: number = this.SIMILARITY_THRESHOLD
  ): Promise<Map<string, SimilarClaim[]>> {
    const results = new Map<string, SimilarClaim[]>();

    for (let i = 0; i < sentences.length; i++) {
      const similar = await this.findSimilarClaims(sentences[i], threshold);
      results.set(`sentence_${i}`, similar);
    }

    return results;
  }

  /**
   * Get similarity score between sentence and claim
   */
  async getSimilarityScore(sentenceText: string, claimId: string): Promise<number> {
    const claim = this.claimsManager.getClaim(claimId);

    if (!claim) {
      return 0;
    }

    try {
      const sentenceEmbedding = await this.embeddingService.generateEmbedding(sentenceText);
      const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);

      if (!sentenceEmbedding || !claimEmbedding) {
        return 0;
      }

      return this.cosineSimilarity(sentenceEmbedding, claimEmbedding);
    } catch (error) {
      console.error('Error calculating similarity score:', error);
      return 0;
    }
  }
}
