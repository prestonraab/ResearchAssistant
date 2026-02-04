import * as crypto from 'crypto';
import { CitationSourceMapper, SourceMapping } from './CitationSourceMapper.js';
import { ClaimsManager } from '../managers/ClaimsManager.js';
import type { Claim } from '../types/index.js';

/**
 * Result of validating a single citation in a claim
 */
export interface CitationValidationResult {
  claimId: string;
  authorYear: string;
  status: 'matched' | 'orphan-citation' | 'missing-claim' | 'missing-quote' | 'unmapped-source';
  matchedQuoteSource?: string;
}

/**
 * Cache entry for validation results
 */
interface ValidationCacheEntry {
  claimId: string;
  validationResults: CitationValidationResult[];
  timestamp: number;
  manuscriptHash: string;
}

/**
 * Service for validating citations against claim quotes
 * 
 * Validates citations in claims against their supporting quotes.
 * Returns validation status: matched, orphan-citation, unmapped-source, missing-claim, missing-quote.
 * Caches validation results with manuscript hash invalidation.
 * 
 * Requirements: 1.1, 1.3, 3.1
 */
export class OrphanCitationValidator {
  private citationSourceMapper: CitationSourceMapper;
  private claimsManager: ClaimsManager;
  private validationCache: Map<string, ValidationCacheEntry> = new Map();
  private lastManuscriptHash: string = '';

  constructor(
    citationSourceMapper: CitationSourceMapper,
    claimsManager: ClaimsManager
  ) {
    this.citationSourceMapper = citationSourceMapper;
    this.claimsManager = claimsManager;
  }

  /**
   * Validate all citations in a claim against its quotes
   * @param claimId - The claim to validate
   * @returns Array of validation results for each author-year citation
   */
  async validateClaimCitations(claimId: string): Promise<CitationValidationResult[]> {
    // Check cache first
    const cached = this.validationCache.get(claimId);
    if (cached && this.isValidCacheEntry(cached)) {
      return cached.validationResults;
    }

    const claim = this.claimsManager.getClaim(claimId);
    if (!claim) {
      return [{
        claimId,
        authorYear: '',
        status: 'missing-claim'
      }];
    }

    // Extract citations from claim
    const citations = this.extractCitationsFromClaim(claim);
    
    // Validate each citation
    const results: CitationValidationResult[] = [];
    for (const authorYear of citations) {
      const result = this.validateSingleCitation(claim, authorYear);
      results.push(result);
    }

    // Cache results
    this.cacheValidationResults(claimId, results);

    return results;
  }

  /**
   * Get all orphan citations for a Q&A pair
   * @param pairId - The Q&A pair ID
   * @returns Map of claimId -> orphan author-years
   */
  async getOrphanCitationsForPair(pairId: string): Promise<Map<string, string[]>> {
    const orphanMap = new Map<string, string[]>();

    // Get all claims (in a real implementation, this would filter by pairId)
    const allClaims = this.claimsManager.getAllClaims();

    for (const claim of allClaims) {
      const validationResults = await this.validateClaimCitations(claim.id);
      const orphanCitations = validationResults
        .filter(r => r.status === 'orphan-citation')
        .map(r => r.authorYear);

      if (orphanCitations.length > 0) {
        orphanMap.set(claim.id, orphanCitations);
      }
    }

    return orphanMap;
  }

  /**
   * Check if a specific author-year citation is orphaned
   * @param claimId - The claim containing the citation
   * @param authorYear - The author-year string (e.g., "Johnson2007")
   * @returns true if orphaned, false if matched
   */
  async isOrphanCitation(claimId: string, authorYear: string): Promise<boolean> {
    const results = await this.validateClaimCitations(claimId);
    const result = results.find(r => r.authorYear === authorYear);
    return result?.status === 'orphan-citation';
  }

  /**
   * Extract citations from a claim's text
   * Looks for author-year patterns in the claim text only (not in quotes)
   * @param claim - The claim to extract citations from
   * @returns Array of author-year strings found in the claim
   * @private
   */
  private extractCitationsFromClaim(claim: Claim): string[] {
    const citations = new Set<string>();

    // Pattern to match author-year citations
    // Matches: Capital letter, followed by word characters/apostrophes/hyphens, followed by 4 digits
    // Examples: Johnson2007, Smith2020, O'Brien2015, van-der-Waals2015
    // The pattern: [A-Z] = capital letter, [\w'-]* = word chars/apostrophe/hyphen, \d{4} = 4 digits
    const authorYearPattern = /[A-Z][\w'-]*\d{4}/g;

    let match;
    while ((match = authorYearPattern.exec(claim.text)) !== null) {
      citations.add(match[0]);
    }

    return Array.from(citations);
  }

  /**
   * Validate a single citation against a claim's quotes
   * @param claim - The claim containing the citation
   * @param authorYear - The author-year to validate
   * @returns Validation result for this citation
   * @private
   */
  private validateSingleCitation(claim: Claim, authorYear: string): CitationValidationResult {
    // Check if the author-year is mapped in sources
    const sourceMapping = this.citationSourceMapper.getSourceMapping(authorYear);
    if (!sourceMapping) {
      return {
        claimId: claim.id,
        authorYear,
        status: 'unmapped-source'
      };
    }

    // Check if any quote from this source exists in the claim
    const quoteFromSource = this.findQuoteFromSource(claim, authorYear);
    
    if (quoteFromSource) {
      return {
        claimId: claim.id,
        authorYear,
        status: 'matched',
        matchedQuoteSource: quoteFromSource.source
      };
    }

    // No quote from this source - it's an orphan citation
    return {
      claimId: claim.id,
      authorYear,
      status: 'orphan-citation'
    };
  }

  /**
   * Find a quote from a specific source in a claim
   * @param claim - The claim to search
   * @param authorYear - The author-year to match
   * @returns The matching quote or null
   * @private
   */
  private findQuoteFromSource(claim: Claim, authorYear: string): { source: string; text: string } | null {
    // Check primary quote
    if (claim.primaryQuote && claim.primaryQuote.source === authorYear) {
      return {
        source: claim.primaryQuote.source,
        text: claim.primaryQuote.text
      };
    }

    // Check supporting quotes
    for (const quote of claim.supportingQuotes) {
      if (quote.source === authorYear) {
        return {
          source: quote.source,
          text: quote.text
        };
      }
    }

    return null;
  }

  /**
   * Cache validation results with manuscript hash
   * @param claimId - The claim ID
   * @param results - The validation results
   * @private
   */
  private cacheValidationResults(claimId: string, results: CitationValidationResult[]): void {
    const entry: ValidationCacheEntry = {
      claimId,
      validationResults: results,
      timestamp: Date.now(),
      manuscriptHash: this.lastManuscriptHash
    };
    this.validationCache.set(claimId, entry);
  }

  /**
   * Check if a cache entry is still valid
   * @param entry - The cache entry to check
   * @returns true if valid, false if stale
   * @private
   */
  private isValidCacheEntry(entry: ValidationCacheEntry): boolean {
    // Cache is valid if manuscript hash hasn't changed
    return entry.manuscriptHash === this.lastManuscriptHash;
  }

  /**
   * Invalidate cache when manuscript changes
   * @param manuscriptContent - The new manuscript content
   */
  invalidateCacheOnManuscriptChange(manuscriptContent: string): void {
    const newHash = this.computeHash(manuscriptContent);
    if (newHash !== this.lastManuscriptHash) {
      this.lastManuscriptHash = newHash;
      this.validationCache.clear();
    }
  }

  /**
   * Compute hash of content for cache invalidation
   * @param content - The content to hash
   * @returns Hash string
   * @private
   */
  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Clear the validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get cache statistics for debugging
   * @returns Object with cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.validationCache.size,
      entries: Array.from(this.validationCache.keys())
    };
  }
}
