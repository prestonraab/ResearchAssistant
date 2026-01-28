import { MCPClientManager, VerificationResult, VerificationReport } from '../mcp/mcpClient';
import { ClaimsManager } from './claimsManagerWrapper';
import { QuoteVerificationCache } from '@research-assistant/core';
import type { Claim } from '@research-assistant/core';

export interface QuoteVerificationResult {
  claimId: string;
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
  error?: string;
}

export interface BatchVerificationResult {
  totalClaims: number;
  totalQuotes: number;
  verified: number;
  failed: number;
  errors: number;
  results: QuoteVerificationResult[];
  failures: Array<{
    claimId: string;
    quote: string;
    source: string;
    closestMatch: string;
    similarity: number;
  }>;
}

export class QuoteVerificationService {
  private cache: QuoteVerificationCache | null = null;
  private cacheReady: Promise<void>;

  constructor(
    private mcpClient: MCPClientManager,
    private claimsManager: ClaimsManager,
    private workspaceRoot?: string
  ) {
    // Initialize cache if workspace root is provided
    if (workspaceRoot) {
      this.cache = new QuoteVerificationCache(workspaceRoot);
      this.cacheReady = this.cache.initialize().catch(error => {
        console.error('[QuoteVerificationService] Failed to initialize cache:', error);
      });
    } else {
      this.cacheReady = Promise.resolve();
    }
  }

  /**
   * Ensure cache is ready before operations
   */
  private async ensureCacheReady(): Promise<void> {
    await this.cacheReady;
  }

  /**
   * Verify a single quote against its source text
   * Uses cache if available, otherwise performs verification via MCP
   * @param quote The quote text to verify
   * @param authorYear The source identifier (e.g., "Johnson2007")
   * @returns Verification result with similarity score and closest match if failed
   */
  async verifyQuote(quote: string, authorYear: string): Promise<VerificationResult> {
    if (!quote || !authorYear) {
      throw new Error('Quote and authorYear are required');
    }

    // Ensure cache is loaded before checking
    await this.ensureCacheReady();

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(quote, authorYear);
      if (cached) {
        console.log(`[QuoteVerificationService] Cache hit for quote from ${authorYear}`);
        return {
          verified: cached.verified,
          similarity: cached.similarity,
          closestMatch: cached.closestMatch, // Now included from cache
          context: undefined
        };
      }
    }

    try {
      const result = await this.mcpClient.verifyQuote(quote, authorYear);
      
      // Store in cache with closestMatch
      if (this.cache) {
        this.cache.set(quote, authorYear, result.verified, result.similarity, result.closestMatch);
        console.log(`[QuoteVerificationService] Cached verification result for ${authorYear} (similarity: ${result.similarity.toFixed(2)})`);
      }
      
      return result;
    } catch (error) {
      console.error('Error verifying quote:', error);
      throw new Error(`Failed to verify quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify a claim's primary quote and optionally its supporting quotes
   * @param claimId The claim ID to verify
   * @param verifySupportingQuotes Whether to verify supporting quotes as well
   * @returns Verification result for the claim
   */
  async verifyClaim(claimId: string, verifySupportingQuotes: boolean = false): Promise<QuoteVerificationResult> {
    const claim = this.claimsManager.getClaim(claimId);
    
    if (!claim) {
      return {
        claimId,
        verified: false,
        similarity: 0,
        error: `Claim ${claimId} not found`
      };
    }

    if (!claim.primaryQuote || !claim.primaryQuote.text) {
      return {
        claimId,
        verified: false,
        similarity: 0,
        error: 'Claim has no primary quote to verify'
      };
    }

    if (!claim.primaryQuote.source) {
      return {
        claimId,
        verified: false,
        similarity: 0,
        error: 'Claim has no source specified'
      };
    }

    try {
      // Verify primary quote
      const result = await this.verifyQuote(claim.primaryQuote.text, claim.primaryQuote.source);
      
      // Update claim verification status
      if (result.verified) {
        await this.claimsManager.updateClaim(claimId, { verified: true });
      }

      return {
        claimId,
        verified: result.verified,
        similarity: result.similarity,
        closestMatch: result.closestMatch,
        context: result.context
      };
    } catch (error) {
      console.error(`Error verifying claim ${claimId}:`, error);
      return {
        claimId,
        verified: false,
        similarity: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find the closest matching text for a quote in the source
   * @param quote The quote to search for
   * @param authorYear The source identifier
   * @returns The closest matching text with similarity score
   */
  async findClosestMatch(quote: string, authorYear: string): Promise<VerificationResult> {
    try {
      const result = await this.verifyQuote(quote, authorYear);
      
      // Even if not verified, the result should contain the closest match
      return result;
    } catch (error) {
      console.error('Error finding closest match:', error);
      throw error;
    }
  }

  /**
   * Verify all claims in the database
   * @param verifySupportingQuotes Whether to verify supporting quotes as well
   * @returns Batch verification report with all results
   */
  async verifyAllClaims(verifySupportingQuotes: boolean = false): Promise<BatchVerificationResult> {
    const claims = this.claimsManager.getClaims();
    const results: QuoteVerificationResult[] = [];
    const failures: BatchVerificationResult['failures'] = [];
    
    let totalQuotes = 0;
    let verified = 0;
    let failed = 0;
    let errors = 0;

    for (const claim of claims) {
      // Skip claims without quotes
      if (!claim.primaryQuote || !claim.primaryQuote.text) {
        continue;
      }

      totalQuotes++;

      const result = await this.verifyClaim(claim.id, verifySupportingQuotes);
      results.push(result);

      if (result.error) {
        errors++;
      } else if (result.verified) {
        verified++;
      } else {
        failed++;
        
        // Add to failures list
        if (result.closestMatch) {
          failures.push({
            claimId: claim.id,
            quote: claim.primaryQuote.text,
            source: claim.primaryQuote.source,
            closestMatch: result.closestMatch,
            similarity: result.similarity
          });
        }
      }
    }

    return {
      totalClaims: claims.length,
      totalQuotes,
      verified,
      failed,
      errors,
      results,
      failures
    };
  }

  /**
   * Verify a batch of specific claims
   * @param claimIds Array of claim IDs to verify
   * @param verifySupportingQuotes Whether to verify supporting quotes as well
   * @returns Batch verification report for the specified claims
   */
  async verifyClaimsBatch(claimIds: string[], verifySupportingQuotes: boolean = false): Promise<BatchVerificationResult> {
    const results: QuoteVerificationResult[] = [];
    const failures: BatchVerificationResult['failures'] = [];
    
    let totalQuotes = 0;
    let verified = 0;
    let failed = 0;
    let errors = 0;

    for (const claimId of claimIds) {
      const claim = this.claimsManager.getClaim(claimId);
      
      if (!claim || !claim.primaryQuote || !claim.primaryQuote.text) {
        continue;
      }

      totalQuotes++;

      const result = await this.verifyClaim(claimId, verifySupportingQuotes);
      results.push(result);

      if (result.error) {
        errors++;
      } else if (result.verified) {
        verified++;
      } else {
        failed++;
        
        if (result.closestMatch && claim) {
          failures.push({
            claimId: claim.id,
            quote: claim.primaryQuote.text,
            source: claim.primaryQuote.source,
            closestMatch: result.closestMatch,
            similarity: result.similarity
          });
        }
      }
    }

    return {
      totalClaims: claimIds.length,
      totalQuotes,
      verified,
      failed,
      errors,
      results,
      failures
    };
  }

  /**
   * Update the verification status of a claim
   * @param claimId The claim ID
   * @param verified The verification status
   */
  async updateClaimVerificationStatus(claimId: string, verified: boolean): Promise<void> {
    await this.claimsManager.updateClaim(claimId, { verified });
  }

  /**
   * Update the verification status of a supporting quote
   * @param claimId The claim ID
   * @param quoteIndex The index of the supporting quote
   * @param verified The verification status
   */
  async updateSupportingQuoteVerificationStatus(claimId: string, quoteIndex: number, verified: boolean): Promise<void> {
    const claim = this.claimsManager.getClaim(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    if (!claim.supportingQuotes || quoteIndex < 0 || quoteIndex >= claim.supportingQuotes.length) {
      throw new Error(`Supporting quote at index ${quoteIndex} not found in claim ${claimId}`);
    }

    // Update the verification status of the quote
    const quote = claim.supportingQuotes[quoteIndex];
    if (typeof quote === 'string') {
      // If it's a string, convert to object with verified status
      claim.supportingQuotes[quoteIndex] = {
        text: quote,
        source: 'Unknown',
        verified
      };
    } else {
      // If it's already an object, just update the verified status
      quote.verified = verified;
    }

    // Persist the change
    await this.claimsManager.updateClaim(claimId, claim);
  }

  /**
   * Update the verification status of the primary quote
   * @param claimId The claim ID
   * @param verified The verification status
   */
  async updatePrimaryQuoteVerificationStatus(claimId: string, verified: boolean): Promise<void> {
    const claim = this.claimsManager.getClaim(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    if (!claim.primaryQuote) {
      throw new Error(`Primary quote not found in claim ${claimId}`);
    }

    // Update the verification status
    claim.primaryQuote.verified = verified;

    // Persist the change
    await this.claimsManager.updateClaim(claimId, claim);
  }

  /**
   * Get all unverified claims
   * @returns Array of claims that have not been verified
   */
  getUnverifiedClaims(): Claim[] {
    return this.claimsManager.getClaims().filter(claim => !claim.verified && claim.primaryQuote);
  }

  /**
   * Get verification statistics
   * @returns Statistics about claim verification status
   */
  getVerificationStats(): {
    total: number;
    verified: number;
    unverified: number;
    withoutQuotes: number;
    verificationRate: number;
  } {
    const claims = this.claimsManager.getClaims();
    const total = claims.length;
    const withoutQuotes = claims.filter(c => !c.primaryQuote).length;
    const verified = claims.filter(c => c.verified).length;
    const unverified = claims.filter(c => !c.verified && c.primaryQuote).length;
    const verificationRate = total > 0 ? (verified / (total - withoutQuotes)) * 100 : 0;

    return {
      total,
      verified,
      unverified,
      withoutQuotes,
      verificationRate
    };
  }

  /**
   * Get cache statistics
   * @returns Statistics about the verification cache
   */
  async getCacheStats() {
    await this.ensureCacheReady();
    if (!this.cache) {
      return null;
    }
    return this.cache.getStats();
  }

  /**
   * Clear the verification cache
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
      console.log('[QuoteVerificationService] Cache cleared');
    }
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    if (this.cache) {
      await this.cache.dispose();
    }
  }
}
