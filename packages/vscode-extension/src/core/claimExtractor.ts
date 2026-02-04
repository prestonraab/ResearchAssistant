import { EmbeddingService } from '@research-assistant/core';
import type { OutlineSection } from '@research-assistant/core';
import type { DatabaseClaim } from '../types';
import {
  parseClaimsFromMarkdown,
  formatCategory,
  categorizeClaim,
  type ParsedClaim
} from './claimExtractorLogic';

export interface PotentialClaim {
  text: string;
  context: string;
  confidence: number;
  type: 'method' | 'result' | 'conclusion' | 'background' | 'challenge' | 'data_source' | 'data_trend' | 'impact' | 'application' | 'phenomenon';
  lineNumber: number;
}

/**
 * ClaimExtractor identifies and extracts potential claims from paper text.
 * 
 * It analyzes text to find declarative sentences that could be claims,
 * prioritizes sentences with method/result/conclusion keywords,
 * assigns confidence scores, and categorizes claims by type.
 */
export class ClaimExtractor {
  private embeddingService: EmbeddingService;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Extract potential claims from paper text.
   * 
   * @param text The full text of the paper
   * @param source The source identifier (e.g., "Smith2023")
   * @returns Array of potential claims with confidence scores
   */
  extractFromText(text: string, source: string): PotentialClaim[] {
    // Delegate to pure logic function
    return parseClaimsFromMarkdown(text);
  }

  /**
   * Categorize a claim by analyzing its content.
   * 
   * @param text The claim text
   * @returns The category of the claim
   */
  categorizeClaim(text: string): PotentialClaim['type'] {
    // Delegate to pure logic function
    return categorizeClaim(text);
  }

  /**
   * Suggest relevant outline sections for a claim.
   * Uses semantic similarity to find the most relevant sections.
   * 
   * @param claim The claim text
   * @param sections All outline sections
   * @returns Top 1-3 most relevant sections
   */
  async suggestSections(
    claim: string,
    sections: OutlineSection[]
  ): Promise<OutlineSection[]> {
    if (sections.length === 0) {
      return [];
    }

    // Generate embedding for the claim
    const claimEmbedding = await this.embeddingService.generateEmbedding(claim);

    // Calculate similarity with each section
    const similarities: Array<{ section: OutlineSection; similarity: number }> = [];

    for (const section of sections) {
      // Combine section title and content for better matching
      const sectionText = `${section.title} ${section.content.join(' ')}`;
      const sectionEmbedding = await this.embeddingService.generateEmbedding(sectionText);
      
      const similarity = this.embeddingService.cosineSimilarity(
        claimEmbedding,
        sectionEmbedding
      );

      similarities.push({ section, similarity });
    }

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top 1-3 sections with similarity > 0.3
    const topSections = similarities
      .filter(s => s.similarity > 0.3)
      .slice(0, 3)
      .map(s => s.section);

    // Always return at least 1 section if available
    if (topSections.length === 0 && similarities.length > 0) {
      return [similarities[0].section];
    }

    return topSections;
  }

  /**
   * Format a potential claim for insertion into the claims database.
   * 
   * @param claim The potential claim
   * @param metadata Additional metadata (source, sourceId, etc.)
   * @returns Formatted claim object
   */
  formatForDatabase(
    claim: PotentialClaim,
    metadata: {
      claimId: string;
      source: string;
      sourceId: number;
      sections: string[];
    }
  ): DatabaseClaim {
    return {
      id: metadata.claimId,
      text: claim.text,
      category: this.formatCategory(claim.type),
      source: metadata.source,
      sourceId: metadata.sourceId,
      context: claim.context,
      primaryQuote: claim.text, // Use the claim text as the quote
      supportingQuotes: [],
      sections: metadata.sections,
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
  }

  // Private helper methods

  /**
   * Format category name for database (capitalize first letter of each word).
   */
  private formatCategory(type: PotentialClaim['type']): string {
    // Delegate to pure logic function
    return formatCategory(type);
  }
}
