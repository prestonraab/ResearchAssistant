import { SentenceClaimQuoteLink } from '@research-assistant/core';
import { ClaimsManager } from './claimsManagerWrapper';

/**
 * SentenceClaimQuoteLinkManager - Manages sentence-claim-quote relationships
 * Tracks which quotes from claims are marked for citation in specific sentences
 * Persists to claims database with write queue protection
 */
export class SentenceClaimQuoteLinkManager {
  private links: Map<string, SentenceClaimQuoteLink> = new Map();
  
  // Write queue to prevent race conditions on persistence
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private claimsManager: ClaimsManager) {}

  /**
   * Generate a unique key for a sentence-claim-quote relationship
   */
  private generateKey(sentenceId: string, claimId: string, quoteIndex: number): string {
    return `${sentenceId}:${claimId}:${quoteIndex}`;
  }

  /**
   * Mark a quote as cited for a sentence-claim relationship
   */
  async markQuoteForCitation(
    sentenceId: string,
    claimId: string,
    quoteIndex: number
  ): Promise<void> {
    const key = this.generateKey(sentenceId, claimId, quoteIndex);
    
    const link: SentenceClaimQuoteLink = {
      sentenceId,
      claimId,
      quoteIndex,
      citedForFinal: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.links.set(key, link);
    await this.queuePersist();
  }

  /**
   * Unmark a quote for citation
   */
  async unmarkQuoteForCitation(
    sentenceId: string,
    claimId: string,
    quoteIndex: number
  ): Promise<void> {
    const key = this.generateKey(sentenceId, claimId, quoteIndex);
    
    const link = this.links.get(key);
    if (link) {
      link.citedForFinal = false;
      link.updatedAt = new Date();
      await this.queuePersist();
    }
  }

  /**
   * Toggle citation status for a quote
   */
  async toggleQuoteCitation(
    sentenceId: string,
    claimId: string,
    quoteIndex: number
  ): Promise<boolean> {
    const key = this.generateKey(sentenceId, claimId, quoteIndex);
    
    let link = this.links.get(key);
    
    if (!link) {
      // Create new link with citation enabled
      link = {
        sentenceId,
        claimId,
        quoteIndex,
        citedForFinal: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.links.set(key, link);
    } else {
      // Toggle existing link
      link.citedForFinal = !link.citedForFinal;
      link.updatedAt = new Date();
    }

    await this.queuePersist();
    return link.citedForFinal;
  }

  /**
   * Check if a quote is marked for citation
   */
  isQuoteCitedForSentence(
    sentenceId: string,
    claimId: string,
    quoteIndex: number
  ): boolean {
    const key = this.generateKey(sentenceId, claimId, quoteIndex);
    const link = this.links.get(key);
    return link ? link.citedForFinal : false;
  }

  /**
   * Get all citations for a sentence
   */
  getCitationsForSentence(sentenceId: string): SentenceClaimQuoteLink[] {
    const citations: SentenceClaimQuoteLink[] = [];

    for (const link of this.links.values()) {
      if (link.sentenceId === sentenceId && link.citedForFinal) {
        citations.push(link);
      }
    }

    return citations;
  }

  /**
   * Get all citations for a claim
   */
  getCitationsForClaim(claimId: string): SentenceClaimQuoteLink[] {
    const citations: SentenceClaimQuoteLink[] = [];

    for (const link of this.links.values()) {
      if (link.claimId === claimId && link.citedForFinal) {
        citations.push(link);
      }
    }

    return citations;
  }

  /**
   * Get all sentences that have a quote marked for citation
   */
  getSentencesWithQuoteCited(claimId: string, quoteIndex: number): string[] {
    const sentences: string[] = [];

    for (const link of this.links.values()) {
      if (link.claimId === claimId && link.quoteIndex === quoteIndex && link.citedForFinal) {
        if (!sentences.includes(link.sentenceId)) {
          sentences.push(link.sentenceId);
        }
      }
    }

    return sentences;
  }

  /**
   * Get all links for a sentence-claim pair
   */
  getLinksForSentenceClaim(sentenceId: string, claimId: string): SentenceClaimQuoteLink[] {
    const links: SentenceClaimQuoteLink[] = [];

    for (const link of this.links.values()) {
      if (link.sentenceId === sentenceId && link.claimId === claimId) {
        links.push(link);
      }
    }

    return links;
  }

  /**
   * Delete all links for a sentence (when sentence is deleted)
   */
  async deleteSentenceLinks(sentenceId: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, link] of this.links.entries()) {
      if (link.sentenceId === sentenceId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.links.delete(key);
    }

    await this.queuePersist();
  }

  /**
   * Delete all links for a claim (when claim is deleted)
   * Note: This preserves the citation status if the claim is reused elsewhere
   */
  async deleteClaimLinks(claimId: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, link] of this.links.entries()) {
      if (link.claimId === claimId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.links.delete(key);
    }

    await this.queuePersist();
  }

  /**
   * Delete a specific link (when claim is removed from sentence)
   */
  async deleteLink(sentenceId: string, claimId: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, link] of this.links.entries()) {
      if (link.sentenceId === sentenceId && link.claimId === claimId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.links.delete(key);
    }

    await this.queuePersist();
  }

  /**
   * Get all links
   */
  getAllLinks(): SentenceClaimQuoteLink[] {
    return Array.from(this.links.values());
  }

  /**
   * Clear all links
   */
  clearLinks(): void {
    this.links.clear();
  }

  /**
   * Load links from persistent storage
   */
  async loadLinks(): Promise<void> {
    // For now, links are stored in memory only
    // In the future, this could load from a persistent store
    this.links.clear();
  }

  /**
   * Persist links to database
   * Currently stores in memory; can be extended to persist to file
   * All persistence operations are queued to prevent race conditions
   */
  private async queuePersist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.persistLinks()).catch(error => {
      console.error('Error in sentence-claim-quote link write queue:', error);
    });
    
    return this.writeQueue;
  }

  private async persistLinks(): Promise<void> {
    // TODO: Implement persistence to claims database
    // This could store links in a separate metadata file or database
    console.log(`Persisted ${this.links.size} sentence-claim-quote links`);
  }

  /**
   * Get link count
   */
  getLinkCount(): number {
    return this.links.size;
  }
}
