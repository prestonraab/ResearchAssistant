import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SentenceClaimQuoteLink } from '@research-assistant/core';
import { ClaimsManager } from './claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';

/**
 * Extended link with quote fingerprint for resilience to quote deletions
 */
interface PersistentSentenceClaimQuoteLink extends SentenceClaimQuoteLink {
  quoteFingerprint?: string; // SHA256 hash of quote text for resilience
  isOrphaned?: boolean; // True if quote was deleted but link remains
}

/**
 * SentenceClaimQuoteLinkManager - Manages sentence-claim-quote relationships
 * Tracks which quotes from claims are marked for citation in specific sentences
 * Persists to .kiro/citation-links.json with resilience to quote deletions
 */
export class SentenceClaimQuoteLinkManager {
  private links: Map<string, PersistentSentenceClaimQuoteLink> = new Map();
  private linksFilePath: string;
  
  // Write queue to prevent race conditions on persistence
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private claimsManager: ClaimsManager, workspaceRoot?: string) {
    // Determine links file path
    this.linksFilePath = workspaceRoot 
      ? path.join(workspaceRoot, '.kiro', 'citation-links.json')
      : path.join(process.cwd(), '.kiro', 'citation-links.json');
  }

  /**
   * Generate a unique key for a sentence-claim-quote relationship
   */
  private generateKey(sentenceId: string, claimId: string, quoteIndex: number): string {
    return `${sentenceId}:${claimId}:${quoteIndex}`;
  }

  /**
   * Generate SHA256 fingerprint of quote text for resilience
   */
  private generateQuoteFingerprint(quoteText: string): string {
    return crypto.createHash('sha256').update(quoteText).digest('hex');
  }

  /**
   * Get quote text from claim by index
   */
  private getQuoteText(claim: Claim, quoteIndex: number): string | null {
    if (quoteIndex === 0 && claim.primaryQuote) {
      return claim.primaryQuote.text;
    }
    if (quoteIndex > 0 && quoteIndex - 1 < claim.supportingQuotes.length) {
      return claim.supportingQuotes[quoteIndex - 1].text;
    }
    return null;
  }

  /**
   * Find quote index by fingerprint in a claim
   * Returns -1 if not found
   */
  private findQuoteIndexByFingerprint(claim: Claim, fingerprint: string): number {
    // Check primary quote
    if (claim.primaryQuote) {
      const fp = this.generateQuoteFingerprint(claim.primaryQuote.text);
      if (fp === fingerprint) {
        return 0;
      }
    }

    // Check supporting quotes
    for (let i = 0; i < claim.supportingQuotes.length; i++) {
      const fp = this.generateQuoteFingerprint(claim.supportingQuotes[i].text);
      if (fp === fingerprint) {
        return i + 1;
      }
    }

    return -1;
  }

  /**
   * Validate and repair a link if quote index has shifted
   * Returns true if link is valid, false if orphaned
   */
  private validateAndRepairLink(link: PersistentSentenceClaimQuoteLink): boolean {
    const claim = this.claimsManager.getClaim(link.claimId);
    if (!claim) {
      link.isOrphaned = true;
      return false;
    }

    // Check if quote still exists at current index
    const currentQuoteText = this.getQuoteText(claim, link.quoteIndex);
    if (currentQuoteText) {
      // Verify fingerprint matches
      const currentFingerprint = this.generateQuoteFingerprint(currentQuoteText);
      if (currentFingerprint === link.quoteFingerprint) {
        link.isOrphaned = false;
        return true; // Link is valid
      }
    }

    // Quote at index is gone or changed - try to find it by fingerprint
    if (link.quoteFingerprint) {
      const newIndex = this.findQuoteIndexByFingerprint(claim, link.quoteFingerprint);
      if (newIndex >= 0) {
        // Found quote at new index - repair the link
        link.quoteIndex = newIndex;
        link.isOrphaned = false;
        link.updatedAt = new Date();
        return true;
      }
    }

    // Quote not found - mark as orphaned
    link.isOrphaned = true;
    return false;
  }

  /**
   * Mark a quote as cited for a sentence-claim relationship
   */
  async markQuoteForCitation(
    sentenceId: string,
    claimId: string,
    quoteIndex: number
  ): Promise<void> {
    const claim = this.claimsManager.getClaim(claimId);
    if (!claim) {
      throw new Error(`Claim "${claimId}" not found. It may have been deleted or the claims database needs to be reloaded.`);
    }

    const quoteText = this.getQuoteText(claim, quoteIndex);
    if (!quoteText) {
      throw new Error(`Quote at index ${quoteIndex} not found in claim "${claimId}". The quote may have been deleted.`);
    }

    const key = this.generateKey(sentenceId, claimId, quoteIndex);
    
    const link: PersistentSentenceClaimQuoteLink = {
      sentenceId,
      claimId,
      quoteIndex,
      quoteFingerprint: this.generateQuoteFingerprint(quoteText),
      citedForFinal: true,
      isOrphaned: false,
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
   * Get all citations for a sentence (excluding orphaned links)
   */
  getCitationsForSentence(sentenceId: string): SentenceClaimQuoteLink[] {
    const citations: SentenceClaimQuoteLink[] = [];

    for (const link of this.links.values()) {
      if (link.sentenceId === sentenceId && link.citedForFinal && !link.isOrphaned) {
        citations.push(link);
      }
    }

    return citations;
  }

  /**
   * Get all citations for a claim (excluding orphaned links)
   */
  getCitationsForClaim(claimId: string): SentenceClaimQuoteLink[] {
    const citations: SentenceClaimQuoteLink[] = [];

    for (const link of this.links.values()) {
      if (link.claimId === claimId && link.citedForFinal && !link.isOrphaned) {
        citations.push(link);
      }
    }

    return citations;
  }

  /**
   * Get all sentences that have a quote marked for citation (excluding orphaned)
   */
  getSentencesWithQuoteCited(claimId: string, quoteIndex: number): string[] {
    const sentences: string[] = [];

    for (const link of this.links.values()) {
      if (link.claimId === claimId && link.quoteIndex === quoteIndex && link.citedForFinal && !link.isOrphaned) {
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
   * Load links from persistent storage (.kiro/citation-links.json)
   * Validates and repairs links if quotes have been deleted/moved
   */
  async loadLinks(): Promise<void> {
    try {
      if (!fs.existsSync(this.linksFilePath)) {
        this.links.clear();
        return;
      }

      const content = fs.readFileSync(this.linksFilePath, 'utf-8');
      const data = JSON.parse(content);
      
      this.links.clear();

      if (Array.isArray(data.links)) {
        for (const linkData of data.links) {
          const link: PersistentSentenceClaimQuoteLink = {
            sentenceId: linkData.sentenceId,
            claimId: linkData.claimId,
            quoteIndex: linkData.quoteIndex,
            quoteFingerprint: linkData.quoteFingerprint,
            citedForFinal: linkData.citedForFinal,
            isOrphaned: linkData.isOrphaned || false,
            createdAt: new Date(linkData.createdAt),
            updatedAt: new Date(linkData.updatedAt)
          };

          // Validate and repair link if needed
          this.validateAndRepairLink(link);

          const key = this.generateKey(link.sentenceId, link.claimId, link.quoteIndex);
          this.links.set(key, link);
        }
      }

      console.log(`Loaded ${this.links.size} citation links from ${this.linksFilePath}`);
    } catch (error) {
      console.error(`Error loading citation links from ${this.linksFilePath}:`, error);
      this.links.clear();
    }
  }

  /**
   * Persist links to .kiro/citation-links.json
   * All persistence operations are queued to prevent race conditions
   */
  private async queuePersist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.persistLinks()).catch(error => {
      console.error('Error in citation links write queue:', error);
    });
    
    return this.writeQueue;
  }

  private async persistLinks(): Promise<void> {
    try {
      // Ensure .kiro directory exists
      const dir = path.dirname(this.linksFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert map to serializable format
      const linksArray = Array.from(this.links.values()).map(link => ({
        sentenceId: link.sentenceId,
        claimId: link.claimId,
        quoteIndex: link.quoteIndex,
        quoteFingerprint: link.quoteFingerprint,
        citedForFinal: link.citedForFinal,
        isOrphaned: link.isOrphaned,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString()
      }));

      const data = {
        version: 1,
        links: linksArray,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(this.linksFilePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Persisted ${this.links.size} citation links to ${this.linksFilePath}`);
    } catch (error) {
      console.error(`Error persisting citation links to ${this.linksFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Get link count
   */
  getLinkCount(): number {
    return this.links.size;
  }
}
