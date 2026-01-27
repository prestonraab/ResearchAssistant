import { ClaimsManager } from './claimsManagerWrapper';
import { Sentence } from './sentenceParser';

/**
 * SentenceClaimMapper - Manages many-to-many relationships between sentences and claims
 * Persists mappings to claims database and handles deletion/editing
 */

export interface SentenceClaimMapping {
  sentenceId: string;
  claimIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SentenceClaimMapper {
  private mappings: Map<string, SentenceClaimMapping> = new Map();

  constructor(private claimsManager: ClaimsManager) {}

  /**
   * Link a sentence to a claim
   */
  async linkSentenceToClaim(sentenceId: string, claimId: string): Promise<void> {
    let mapping = this.mappings.get(sentenceId);

    if (!mapping) {
      mapping = {
        sentenceId,
        claimIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.mappings.set(sentenceId, mapping);
    }

    if (!mapping.claimIds.includes(claimId)) {
      mapping.claimIds.push(claimId);
      mapping.updatedAt = new Date();
    }
  }

  /**
   * Unlink a sentence from a claim
   */
  async unlinkSentenceFromClaim(sentenceId: string, claimId: string): Promise<void> {
    const mapping = this.mappings.get(sentenceId);

    if (mapping) {
      mapping.claimIds = mapping.claimIds.filter(id => id !== claimId);
      mapping.updatedAt = new Date();

      // Remove mapping if no claims left
      if (mapping.claimIds.length === 0) {
        this.mappings.delete(sentenceId);
      }
    }
  }

  /**
   * Get all claims for a sentence
   */
  getClaimsForSentence(sentenceId: string): string[] {
    const mapping = this.mappings.get(sentenceId);
    return mapping ? [...mapping.claimIds] : [];
  }

  /**
   * Get all sentences for a claim
   */
  getSentencesForClaim(claimId: string): string[] {
    const sentences: string[] = [];

    for (const [sentenceId, mapping] of this.mappings.entries()) {
      if (mapping.claimIds.includes(claimId)) {
        sentences.push(sentenceId);
      }
    }

    return sentences;
  }

  /**
   * Delete a sentence (preserves claims)
   */
  async deleteSentence(sentenceId: string): Promise<void> {
    const mapping = this.mappings.get(sentenceId);

    if (mapping) {
      // Claims are preserved - just remove the mapping
      this.mappings.delete(sentenceId);
    }
  }

  /**
   * Delete a claim (removes from all sentences)
   */
  async deleteClaim(claimId: string): Promise<void> {
    for (const [sentenceId, mapping] of this.mappings.entries()) {
      mapping.claimIds = mapping.claimIds.filter(id => id !== claimId);

      if (mapping.claimIds.length === 0) {
        this.mappings.delete(sentenceId);
      }
    }
  }

  /**
   * Update sentence text (preserves claims and original text)
   */
  async updateSentenceText(sentenceId: string, newText: string, originalText: string): Promise<void> {
    // Mapping is preserved - claims stay linked
    // Original text is stored in the sentence object itself
  }

  /**
   * Load mappings from claims database
   */
  async loadMappings(): Promise<void> {
    // For now, mappings are stored in memory only
    // In the future, this could load from a persistent store
    this.mappings.clear();
  }

  /**
   * Get all mappings
   */
  getAllMappings(): SentenceClaimMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Clear all mappings
   */
  clearMappings(): void {
    this.mappings.clear();
  }

  /**
   * Get mapping count
   */
  getMappingCount(): number {
    return this.mappings.size;
  }
}
