import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { Claim, EmbeddingService } from '@research-assistant/core';

export interface SupportValidation {
  claimId: string;
  similarity: number;
  supported: boolean;
  suggestedQuotes?: string[];
  analysis?: string;
}

/**
 * ClaimSupportValidator analyzes whether quotes actually support their claims
 * using semantic similarity between claim text and quote text.
 * 
 * Validates Requirements: 46.1, 46.2, 46.3, 46.4, 46.5
 */
export class ClaimSupportValidator {
  private embeddingService: EmbeddingService;
  private readonly WEAK_SUPPORT_THRESHOLD = 0.6;
  private readonly STRONG_SUPPORT_THRESHOLD = 0.75;
  private extractedTextPath: string;

  constructor(
    embeddingService: EmbeddingService,
    extractedTextPath: string
  ) {
    this.embeddingService = embeddingService;
    this.extractedTextPath = extractedTextPath;
  }

  /**
   * Validate whether a claim's quote actually supports the claim text.
   * Requirement 46.1: Provide "Validate Support" action
   * Requirement 46.2: Analyze semantic similarity between claim text and quote
   * 
   * @param claim The claim to validate
   * @returns Validation result with similarity score and support status
   */
  async validateSupport(claim: Claim): Promise<SupportValidation> {
    try {
      // Get the quote text and source from primaryQuote
      const quoteText = claim.primaryQuote?.text || '';
      const source = claim.primaryQuote?.source || '';
      
      // Calculate similarity between claim text and primary quote
      const similarity = await this.analyzeSimilarity(claim.text, quoteText);
      
      // Determine if claim is supported
      const supported = similarity >= this.WEAK_SUPPORT_THRESHOLD;
      
      // If weakly supported, try to find better quotes
      let suggestedQuotes: string[] | undefined;
      if (similarity < this.STRONG_SUPPORT_THRESHOLD) {
        suggestedQuotes = await this.findBetterQuotes(claim.text, source);
      }
      
      // Generate analysis text
      const analysis = this.generateAnalysis(similarity, supported);
      
      return {
        claimId: claim.id,
        similarity,
        supported,
        suggestedQuotes,
        analysis
      };
    } catch (error) {
      console.error(`Error validating support for claim ${claim.id}:`, error);
      return {
        claimId: claim.id,
        similarity: 0,
        supported: false,
        analysis: `Error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Analyze semantic similarity between claim text and quote.
   * Requirement 46.2: Analyze semantic similarity
   * 
   * @param claimText The claim statement
   * @param quote The supporting quote
   * @returns Similarity score between 0 and 1
   */
  async analyzeSimilarity(claimText: string, quote: string): Promise<number> {
    if (!claimText || !quote) {
      return 0;
    }

    try {
      // Generate embeddings for both texts
      const [claimEmbedding, quoteEmbedding] = await Promise.all([
        this.embeddingService.generateEmbedding(claimText),
        this.embeddingService.generateEmbedding(quote)
      ]);

      // Calculate cosine similarity
      const similarity = this.embeddingService.cosineSimilarity(claimEmbedding, quoteEmbedding);
      
      // Ensure result is between 0 and 1
      return Math.max(0, Math.min(1, similarity));
    } catch (error) {
      console.error('Error calculating similarity:', error);
      return 0;
    }
  }

  /**
   * Find better supporting quotes from the same paper.
   * Requirement 46.4: Suggest alternative quotes from same paper
   * 
   * @param claimText The claim statement
   * @param source The source identifier (AuthorYear format)
   * @returns Array of suggested quotes, or empty array if none found
   */
  async findBetterQuotes(claimText: string, source: string): Promise<string[]> {
    try {
      // Skip if no source provided
      if (!source || source.trim().length === 0) {
        console.debug('[ClaimSupportValidator] No source provided, skipping quote search');
        return [];
      }

      // Try to load the source text from extracted text directory
      const sourceText = await this.loadSourceText(source);
      
      if (!sourceText) {
        console.debug(`[ClaimSupportValidator] Source text not found for ${source}`);
        return [];
      }

      // Split source text into sentences
      const sentences = this.extractSentences(sourceText);
      
      if (sentences.length === 0) {
        return [];
      }

      // Generate embedding for claim
      const claimEmbedding = await this.embeddingService.generateEmbedding(claimText);
      
      // Calculate similarity for each sentence
      const sentenceScores: Array<{ sentence: string; similarity: number }> = [];
      
      // Process sentences in batches to avoid memory issues
      const BATCH_SIZE = 50;
      for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
        const batch = sentences.slice(i, i + BATCH_SIZE);
        const embeddings = await this.embeddingService.generateBatch(batch);
        
        for (let j = 0; j < batch.length; j++) {
          const similarity = this.embeddingService.cosineSimilarity(claimEmbedding, embeddings[j]);
          sentenceScores.push({
            sentence: batch[j],
            similarity
          });
        }
      }
      
      // Sort by similarity and take top 3
      sentenceScores.sort((a, b) => b.similarity - a.similarity);
      
      // Filter for sentences with reasonable similarity (> 0.5) and return top 3
      const suggestions = sentenceScores
        .filter(s => s.similarity > 0.5)
        .slice(0, 3)
        .map(s => s.sentence);
      
      return suggestions;
    } catch (error) {
      console.error(`Error finding better quotes for ${source}:`, error);
      return [];
    }
  }

  /**
   * Validate all claims in a batch.
   * Requirement 46.5: Allow batch validation of all claims
   * 
   * @param claims Array of claims to validate
   * @param progressCallback Optional callback for progress updates
   * @returns Array of validation results
   */
  async batchValidate(
    claims: Claim[],
    progressCallback?: (current: number, total: number) => void
  ): Promise<SupportValidation[]> {
    const results: SupportValidation[] = [];
    const total = claims.length;
    
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, total);
      }
      
      // Validate claim
      const validation = await this.validateSupport(claim);
      results.push(validation);
      
      // Yield to event loop to avoid blocking
      if (i % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    return results;
  }

  /**
   * Flag claims with weak support (low similarity).
   * Requirement 46.3: Flag claims with weak support
   * 
   * @param claims Array of claims to check
   * @param threshold Similarity threshold (default: 0.6)
   * @returns Array of claims with weak support
   */
  async flagWeakSupport(claims: Claim[], threshold?: number): Promise<Array<{ claim: Claim; validation: SupportValidation }>> {
    const effectiveThreshold = threshold ?? this.WEAK_SUPPORT_THRESHOLD;
    const weakClaims: Array<{ claim: Claim; validation: SupportValidation }> = [];
    
    for (const claim of claims) {
      const validation = await this.validateSupport(claim);
      
      if (validation.similarity < effectiveThreshold) {
        weakClaims.push({ claim, validation });
      }
    }
    
    return weakClaims;
  }

  /**
   * Generate a human-readable analysis of the validation result.
   */
  private generateAnalysis(similarity: number, supported: boolean): string {
    if (similarity >= this.STRONG_SUPPORT_THRESHOLD) {
      return `Strong support: The quote strongly supports the claim (similarity: ${(similarity * 100).toFixed(1)}%)`;
    } else if (similarity >= this.WEAK_SUPPORT_THRESHOLD) {
      return `Moderate support: The quote provides some support for the claim (similarity: ${(similarity * 100).toFixed(1)}%). Consider finding a more directly relevant quote.`;
    } else {
      return `Weak support: The quote may not adequately support the claim (similarity: ${(similarity * 100).toFixed(1)}%). Consider finding a better supporting quote.`;
    }
  }

  /**
   * Load source text from the extracted text directory.
   */
  private async loadSourceText(source: string): Promise<string | null> {
    try {
      // Try common filename patterns
      const possibleFilenames = [
        `${source}.txt`,
        `${source}.md`,
        `${source}_extracted.txt`,
        `${source}_extracted.md`
      ];
      
      for (const filename of possibleFilenames) {
        const filePath = path.join(this.extractedTextPath, filename);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return content;
        } catch {
          // Try next filename
          continue;
        }
      }
      
      // If no file found, source text is not available
      console.warn(`Source file not found for: ${source}`);
      return null;
    } catch (error) {
      console.error(`Error loading source text for ${source}:`, error);
      return null;
    }
  }

  /**
   * Extract sentences from text.
   * Uses simple sentence boundary detection.
   */
  private extractSentences(text: string): string[] {
    // Split on sentence boundaries (., !, ?)
    // Keep sentences that are at least 20 characters long
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 20);
    
    return sentences;
  }

  /**
   * Update the extracted text path.
   */
  updateExtractedTextPath(newPath: string): void {
    this.extractedTextPath = newPath;
  }
}
