import { MCPClientManager, VerificationResult, VerificationReport } from '../mcp/mcpClient';
import { ClaimsManager } from './claimsManagerWrapper';
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
  constructor(
    private mcpClient: MCPClientManager,
    private claimsManager: ClaimsManager
  ) {}

  /**
   * Verify a single quote against its source text
   * @param quote The quote text to verify
   * @param authorYear The source identifier (e.g., "Johnson2007")
   * @returns Verification result with similarity score and closest match if failed
   */
  async verifyQuote(quote: string, authorYear: string): Promise<VerificationResult> {
    if (!quote || !authorYear) {
      throw new Error('Quote and authorYear are required');
    }

    try {
      const result = await this.mcpClient.verifyQuote(quote, authorYear);
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
}
