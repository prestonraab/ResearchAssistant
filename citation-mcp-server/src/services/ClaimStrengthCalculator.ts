import { EmbeddingService } from '../core/EmbeddingService.js';
import { ClaimsManager } from '../core/ClaimsManager.js';
import {
  ClaimStrengthResult,
  SupportingClaim,
  ContradictoryClaim,
  Claim,
} from '../types/index.js';

/**
 * ClaimStrengthCalculator calculates how well claims are supported across sources.
 * Implements Requirements 6.1, 6.2, 6.3, 6.4
 */
export class ClaimStrengthCalculator {
  private embeddingService: EmbeddingService;
  private claimsManager: ClaimsManager;
  private similarityThreshold: number;

  // Keywords for detecting negation
  private readonly NEGATION_KEYWORDS = [
    'not',
    'no',
    'never',
    'without',
    'neither',
    'nor',
    'none',
    'nobody',
    'nothing',
    'nowhere',
    'hardly',
    'scarcely',
    'barely',
  ];

  // Contradictory keyword pairs
  private readonly CONTRADICTORY_PAIRS = [
    ['increase', 'decrease'],
    ['effective', 'ineffective'],
    ['successful', 'unsuccessful'],
    ['improve', 'worsen'],
    ['better', 'worse'],
    ['higher', 'lower'],
    ['more', 'less'],
    ['positive', 'negative'],
    ['beneficial', 'harmful'],
    ['advantage', 'disadvantage'],
    ['strength', 'weakness'],
    ['support', 'oppose'],
    ['agree', 'disagree'],
    ['confirm', 'contradict'],
    ['consistent', 'inconsistent'],
  ];

  // Positive and negative sentiment words
  private readonly POSITIVE_WORDS = [
    'effective',
    'successful',
    'improve',
    'better',
    'beneficial',
    'advantage',
    'positive',
    'enhance',
    'superior',
    'optimal',
    'significant',
    'strong',
  ];

  private readonly NEGATIVE_WORDS = [
    'ineffective',
    'unsuccessful',
    'worsen',
    'worse',
    'harmful',
    'disadvantage',
    'negative',
    'degrade',
    'inferior',
    'suboptimal',
    'insignificant',
    'weak',
  ];

  constructor(
    embeddingService: EmbeddingService,
    claimsManager: ClaimsManager,
    similarityThreshold: number = 0.7
  ) {
    this.embeddingService = embeddingService;
    this.claimsManager = claimsManager;
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Calculate strength score for a single claim.
   * Requirement 6.1: Calculate strength scores for all claims
   * Requirement 6.2: Identify supporting claims from different sources
   * Requirement 6.3: Detect contradictory claims
   * Requirement 6.4: Return strength scores that increase monotonically
   */
  async calculateStrength(claimId: string): Promise<ClaimStrengthResult> {
    // Get the target claim
    const targetClaim = this.claimsManager.getClaim(claimId);
    if (!targetClaim) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    // Get all claims
    const allClaims = this.claimsManager.getAllClaims();

    // Generate embedding for target claim
    const targetEmbedding = await this.embeddingService.generateEmbedding(
      targetClaim.text
    );

    const supportingClaims: SupportingClaim[] = [];
    const contradictoryClaims: ContradictoryClaim[] = [];

    // Compare with all other claims
    for (const claim of allClaims) {
      // Skip the target claim itself
      if (claim.id === claimId) {
        continue;
      }

      // Skip claims from the same source (not independent)
      if (claim.source === targetClaim.source) {
        continue;
      }

      // Calculate similarity
      const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);
      const similarity = this.embeddingService.cosineSimilarity(
        targetEmbedding,
        claimEmbedding
      );

      // Check if similarity is above threshold
      if (similarity >= this.similarityThreshold) {
        // Check for contradiction
        const isContradictory = this.detectContradiction(
          targetClaim.text,
          claim.text,
          similarity
        );

        if (isContradictory) {
          // Determine if sentiment opposition exists
          const sentimentOpposition = this.hasSentimentOpposition(
            targetClaim.text,
            claim.text
          );

          contradictoryClaims.push({
            claimId: claim.id,
            source: claim.source,
            similarity,
            sentimentOpposition,
          });
        } else {
          // This is a supporting claim
          supportingClaims.push({
            claimId: claim.id,
            source: claim.source,
            similarity,
          });
        }
      }
    }

    // Sort by similarity (highest first)
    supportingClaims.sort((a, b) => b.similarity - a.similarity);
    contradictoryClaims.sort((a, b) => b.similarity - a.similarity);

    // Calculate strength score using monotonic formula
    // Formula: 0 sources=0, 1=1, 2=2, 3+=3+log(n-2)
    const strengthScore = this.calculateStrengthScore(supportingClaims.length);

    return {
      claimId,
      strengthScore,
      supportingClaims,
      contradictoryClaims,
    };
  }

  /**
   * Calculate strength scores for multiple claims efficiently.
   * Requirement 12.1: Pre-generate embeddings for all claims
   * Requirement 12.4: Return results in the same order as input items
   */
  async calculateStrengthBatch(
    claimIds: string[]
  ): Promise<Map<string, ClaimStrengthResult>> {
    const results = new Map<string, ClaimStrengthResult>();

    // Handle empty input
    if (claimIds.length === 0) {
      return results;
    }

    // Get all claims
    const allClaims = this.claimsManager.getAllClaims();

    // Pre-generate embeddings for all claims (batch operation for efficiency)
    const claimTexts = allClaims.map((c) => c.text);
    const allEmbeddings = await this.embeddingService.generateBatch(claimTexts);

    // Create a map of claim ID to embedding
    const embeddingMap = new Map<string, number[]>();
    for (let i = 0; i < allClaims.length; i++) {
      embeddingMap.set(allClaims[i].id, allEmbeddings[i]);
    }

    // Calculate strength for each requested claim
    for (const claimId of claimIds) {
      const targetClaim = this.claimsManager.getClaim(claimId);
      if (!targetClaim) {
        // Skip invalid claim IDs but maintain order
        continue;
      }

      const targetEmbedding = embeddingMap.get(claimId);
      if (!targetEmbedding) {
        continue;
      }

      const supportingClaims: SupportingClaim[] = [];
      const contradictoryClaims: ContradictoryClaim[] = [];

      // Compare with all other claims using pre-generated embeddings
      for (const claim of allClaims) {
        // Skip the target claim itself
        if (claim.id === claimId) {
          continue;
        }

        // Skip claims from the same source
        if (claim.source === targetClaim.source) {
          continue;
        }

        const claimEmbedding = embeddingMap.get(claim.id);
        if (!claimEmbedding) {
          continue;
        }

        // Calculate similarity
        const similarity = this.embeddingService.cosineSimilarity(
          targetEmbedding,
          claimEmbedding
        );

        // Check if similarity is above threshold
        if (similarity >= this.similarityThreshold) {
          // Check for contradiction
          const isContradictory = this.detectContradiction(
            targetClaim.text,
            claim.text,
            similarity
          );

          if (isContradictory) {
            const sentimentOpposition = this.hasSentimentOpposition(
              targetClaim.text,
              claim.text
            );

            contradictoryClaims.push({
              claimId: claim.id,
              source: claim.source,
              similarity,
              sentimentOpposition,
            });
          } else {
            supportingClaims.push({
              claimId: claim.id,
              source: claim.source,
              similarity,
            });
          }
        }
      }

      // Sort by similarity
      supportingClaims.sort((a, b) => b.similarity - a.similarity);
      contradictoryClaims.sort((a, b) => b.similarity - a.similarity);

      // Calculate strength score
      const strengthScore = this.calculateStrengthScore(supportingClaims.length);

      results.set(claimId, {
        claimId,
        strengthScore,
        supportingClaims,
        contradictoryClaims,
      });
    }

    return results;
  }

  /**
   * Detect if two claims contradict each other despite high similarity.
   * Requirement 6.3: Detect contradictory claims using negation and sentiment analysis
   */
  detectContradiction(claim1: string, claim2: string, similarity: number): boolean {
    // Only check for contradictions if claims are semantically similar
    if (similarity < this.similarityThreshold) {
      return false;
    }

    const text1Lower = claim1.toLowerCase();
    const text2Lower = claim2.toLowerCase();

    // Check for negation patterns
    const hasNegation1 = this.hasNegation(text1Lower);
    const hasNegation2 = this.hasNegation(text2Lower);

    // If one has negation and the other doesn't, they might contradict
    if (hasNegation1 !== hasNegation2) {
      return true;
    }

    // Check for contradictory keyword pairs
    if (this.hasContradictoryKeywords(text1Lower, text2Lower)) {
      return true;
    }

    // Check for sentiment opposition
    if (this.hasSentimentOpposition(text1Lower, text2Lower)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate strength score using monotonic formula.
   * Formula: 0 sources=0, 1=1, 2=2, 3+=3+log(n-2)
   * Requirement 6.4: Strength scores increase monotonically with supporting claim count
   */
  private calculateStrengthScore(supportingClaimCount: number): number {
    if (supportingClaimCount === 0) {
      return 0;
    } else if (supportingClaimCount === 1) {
      return 1;
    } else if (supportingClaimCount === 2) {
      return 2;
    } else {
      // For 3 or more: 3 + log(n-2)
      return 3 + Math.log(supportingClaimCount - 2);
    }
  }

  /**
   * Check if text contains negation keywords
   */
  private hasNegation(text: string): boolean {
    return this.NEGATION_KEYWORDS.some((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(text);
    });
  }

  /**
   * Check if two texts contain contradictory keyword pairs
   */
  private hasContradictoryKeywords(text1: string, text2: string): boolean {
    for (const [word1, word2] of this.CONTRADICTORY_PAIRS) {
      // Check if text1 has word1 and text2 has word2
      const regex1 = new RegExp(`\\b${word1}\\b`, 'i');
      const regex2 = new RegExp(`\\b${word2}\\b`, 'i');

      if (regex1.test(text1) && regex2.test(text2)) {
        return true;
      }

      // Check the reverse (text1 has word2 and text2 has word1)
      if (regex2.test(text1) && regex1.test(text2)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two texts have opposing sentiment
   */
  private hasSentimentOpposition(text1: string, text2: string): boolean {
    const hasPositive1 = this.POSITIVE_WORDS.some((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(text1);
    });

    const hasNegative1 = this.NEGATIVE_WORDS.some((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(text1);
    });

    const hasPositive2 = this.POSITIVE_WORDS.some((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(text2);
    });

    const hasNegative2 = this.NEGATIVE_WORDS.some((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(text2);
    });

    // Opposition exists if one is positive and the other is negative
    return (hasPositive1 && hasNegative2) || (hasNegative1 && hasPositive2);
  }
}
