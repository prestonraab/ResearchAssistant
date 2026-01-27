import { ClaimStrengthCalculator as CoreClaimStrengthCalculator, EmbeddingService, ClaimsManager } from '@research-assistant/core';
import type { Claim, ClaimStrengthResult } from '@research-assistant/core';

/**
 * ClaimStrengthCalculator wrapper for VS Code extension.
 * Wraps the core ClaimStrengthCalculator to provide convenience methods
 * for working with claims arrays instead of ClaimsManager.
 * 
 * Validates Requirements: 17.1, 17.2, 17.3, 28.1, 28.2
 */
export class ClaimStrengthCalculator {
  private coreCalculator: CoreClaimStrengthCalculator;
  private embeddingService: EmbeddingService;

  constructor(
    embeddingService: EmbeddingService,
    claimsManager: ClaimsManager,
    similarityThreshold: number = 0.7
  ) {
    this.embeddingService = embeddingService;
    this.coreCalculator = new CoreClaimStrengthCalculator(
      embeddingService,
      claimsManager,
      similarityThreshold
    );
  }

  /**
   * Calculate strength score for a claim based on supporting claims from different sources.
   * 
   * Strength score increases with the number of different sources that support similar claims.
   * 
   * @param claim The claim to analyze
   * @param allClaims All claims in the database (for compatibility)
   * @returns Claim strength analysis result
   */
  async calculateStrength(claim: Claim, allClaims: Claim[]): Promise<ClaimStrengthResult> {
    // Use core calculator which uses ClaimsManager
    return this.coreCalculator.calculateStrength(claim.id);
  }

  /**
   * Calculate strength scores for all claims in batch.
   * More efficient than calling calculateStrength multiple times.
   * 
   * @param claims All claims to analyze
   * @returns Map of claim ID to strength result
   */
  async calculateStrengthBatch(claims: Claim[]): Promise<Map<string, ClaimStrengthResult>> {
    const claimIds = claims.map(c => c.id);
    return this.coreCalculator.calculateStrengthBatch(claimIds);
  }

  /**
   * Detect if two similar claims contradict each other.
   * 
   * Uses sentiment analysis and negation detection to identify contradictions.
   * 
   * @param claim1Text First claim text
   * @param claim2Text Second claim text
   * @param similarity Semantic similarity between claims
   * @returns True if claims contradict each other
   */
  detectContradiction(claim1Text: string, claim2Text: string, similarity: number): boolean {
    return this.coreCalculator.detectContradiction(claim1Text, claim2Text, similarity);
  }

  /**
   * Get claims sorted by strength score (descending).
   * 
   * @param strengthResults Map of claim ID to strength result
   * @returns Array of strength results sorted by score (highest first)
   */
  sortByStrength(strengthResults: Map<string, ClaimStrengthResult>): ClaimStrengthResult[] {
    const results = Array.from(strengthResults.values());
    return results.sort((a, b) => b.strengthScore - a.strengthScore);
  }

  /**
   * Filter claims by minimum strength score.
   * 
   * @param strengthResults Map of claim ID to strength result
   * @param minScore Minimum strength score
   * @returns Array of claims meeting the minimum score
   */
  filterByMinStrength(
    strengthResults: Map<string, ClaimStrengthResult>,
    minScore: number
  ): ClaimStrengthResult[] {
    return Array.from(strengthResults.values()).filter(
      result => result.strengthScore >= minScore
    );
  }

  /**
   * Get all claims with contradictions.
   * 
   * @param strengthResults Map of claim ID to strength result
   * @returns Array of claims that have contradictions
   */
  getClaimsWithContradictions(
    strengthResults: Map<string, ClaimStrengthResult>
  ): ClaimStrengthResult[] {
    return Array.from(strengthResults.values()).filter(
      result => result.contradictoryClaims.length > 0
    );
  }
}
