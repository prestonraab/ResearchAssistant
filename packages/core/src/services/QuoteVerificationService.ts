import { QuoteVerificationCache } from './caching/index.js';
import type { Claim } from '../types/index.js';

export interface VerificationResult {
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
}

export interface QuoteVerifier {
  verifyQuote(quote: string, source: string): Promise<VerificationResult>;
}

export interface ClaimsProvider {
  getClaim(claimId: string): Claim | undefined;
  getClaims(): Claim[];
  updateClaim(claimId: string, updates: Partial<Claim>): Promise<void>;
}

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

/**
 * Service for verifying quotes against source texts
 * Uses caching to avoid redundant verifications
 */
export class QuoteVerificationService {
  private cache: QuoteVerificationCache | null = null;

  constructor(
    private verifier: QuoteVerifier,
    private claimsProvider: ClaimsProvider,
    workspaceRoot?: string
  ) {
    if (workspaceRoot) {
      this.cache = new QuoteVerificationCache(workspaceRoot);
      this.cache.initialize().catch(error => {
        console.error('[QuoteVerificationService] Failed to initialize cache:', error);
      });
    }
  }

  async verifyQuote(quote: string, source: string): Promise<VerificationResult> {
    if (!quote || !source) {
      throw new Error('Quote and source are required');
    }

    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(quote, source);
      if (cached) {
        console.log(`[QuoteVerificationService] Cache hit for quote from ${source}`);
        return {
          verified: cached.verified,
          similarity: cached.similarity,
          closestMatch: cached.closestMatch,
          context: undefined
        };
      }
    }

    try {
      const result = await this.verifier.verifyQuote(quote, source);
      
      // Store in cache
      if (this.cache) {
        this.cache.set(quote, source, result.verified, result.similarity, result.closestMatch);
        console.log(`[QuoteVerificationService] Cached verification result for ${source} (similarity: ${result.similarity.toFixed(2)})`);
      }
      
      return result;
    } catch (error) {
      console.error('Error verifying quote:', error);
      throw new Error(`Failed to verify quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async verifyClaim(claimId: string): Promise<QuoteVerificationResult> {
    const claim = this.claimsProvider.getClaim(claimId);
    
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
      const result = await this.verifyQuote(claim.primaryQuote.text, claim.primaryQuote.source);
      
      if (result.verified) {
        await this.claimsProvider.updateClaim(claimId, { verified: true });
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

  async verifyAllClaims(): Promise<BatchVerificationResult> {
    const claims = this.claimsProvider.getClaims();
    const results: QuoteVerificationResult[] = [];
    const failures: BatchVerificationResult['failures'] = [];
    
    let totalQuotes = 0;
    let verified = 0;
    let failed = 0;
    let errors = 0;

    for (const claim of claims) {
      if (!claim.primaryQuote || !claim.primaryQuote.text) {
        continue;
      }

      totalQuotes++;

      const result = await this.verifyClaim(claim.id);
      results.push(result);

      if (result.error) {
        errors++;
      } else if (result.verified) {
        verified++;
      } else {
        failed++;
        
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

  async verifyClaimsBatch(claimIds: string[]): Promise<BatchVerificationResult> {
    const results: QuoteVerificationResult[] = [];
    const failures: BatchVerificationResult['failures'] = [];
    
    let totalQuotes = 0;
    let verified = 0;
    let failed = 0;
    let errors = 0;

    for (const claimId of claimIds) {
      const claim = this.claimsProvider.getClaim(claimId);
      
      if (!claim || !claim.primaryQuote || !claim.primaryQuote.text) {
        continue;
      }

      totalQuotes++;

      const result = await this.verifyClaim(claimId);
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

  getUnverifiedClaims(): Claim[] {
    return this.claimsProvider.getClaims().filter(claim => !claim.verified && claim.primaryQuote);
  }

  getVerificationStats(): {
    total: number;
    verified: number;
    unverified: number;
    withoutQuotes: number;
    verificationRate: number;
  } {
    const claims = this.claimsProvider.getClaims();
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

  getCacheStats() {
    if (!this.cache) {
      return null;
    }
    return this.cache.getStats();
  }

  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
      console.log('[QuoteVerificationService] Cache cleared');
    }
  }

  async dispose(): Promise<void> {
    if (this.cache) {
      await this.cache.dispose();
    }
  }
}
