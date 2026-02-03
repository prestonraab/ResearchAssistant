import { ClaimsManager } from './claimsManagerWrapper';
import { Sentence } from '@research-assistant/core';
import * as vscode from 'vscode';

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

const SENTENCE_CLAIM_MAPPINGS_KEY = 'sentenceClaimMappings';

export class SentenceClaimMapper {
  private mappings: Map<string, SentenceClaimMapping> = new Map();
  private memento: vscode.Memento | null = null;

  constructor(private claimsManager: ClaimsManager, memento?: vscode.Memento) {
    this.memento = memento || null;
    if (this.memento) {
      this.loadMappingsFromMemento();
    }
  }

  /**
   * Initialize with memento for persistence
   */
  setMemento(memento: vscode.Memento): void {
    this.memento = memento;
    this.loadMappingsFromMemento();
  }

  /**
   * Load mappings from memento
   */
  private loadMappingsFromMemento(): void {
    if (!this.memento) return;
    
    try {
      const stored = this.memento.get<Record<string, any>>(SENTENCE_CLAIM_MAPPINGS_KEY, {});
      this.mappings.clear();
      
      for (const [sentenceId, data] of Object.entries(stored)) {
        this.mappings.set(sentenceId, {
          sentenceId,
          claimIds: data.claimIds || [],
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt)
        });
      }
      
      console.log(`[SentenceClaimMapper] Loaded ${this.mappings.size} mappings from memento`);
    } catch (error) {
      console.error('[SentenceClaimMapper] Failed to load mappings from memento:', error);
    }
  }

  /**
   * Save mappings to memento
   */
  private async saveMappingsToMemento(): Promise<void> {
    if (!this.memento) return;
    
    try {
      const stored: Record<string, any> = {};
      
      for (const [sentenceId, mapping] of this.mappings.entries()) {
        stored[sentenceId] = {
          claimIds: mapping.claimIds,
          createdAt: mapping.createdAt.toISOString(),
          updatedAt: mapping.updatedAt.toISOString()
        };
      }
      
      await this.memento.update(SENTENCE_CLAIM_MAPPINGS_KEY, stored);
    } catch (error) {
      console.error('[SentenceClaimMapper] Failed to save mappings to memento:', error);
    }
  }

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

    // Persist the change
    await this.saveMappingsToMemento();
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

    // Persist the change
    await this.saveMappingsToMemento();
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
      await this.saveMappingsToMemento();
    }
  }

  /**
   * Delete a claim (removes from all sentences)
   */
  async deleteClaim(claimId: string): Promise<void> {
    let changed = false;
    
    for (const [sentenceId, mapping] of this.mappings.entries()) {
      const originalLength = mapping.claimIds.length;
      mapping.claimIds = mapping.claimIds.filter(id => id !== claimId);

      if (mapping.claimIds.length !== originalLength) {
        changed = true;
        mapping.updatedAt = new Date();
      }

      if (mapping.claimIds.length === 0) {
        this.mappings.delete(sentenceId);
      }
    }

    if (changed) {
      await this.saveMappingsToMemento();
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
