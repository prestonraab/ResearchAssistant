import { Claim } from './claimsManager';
import { EmbeddingService } from './embeddingService';

/**
 * Result of claim strength analysis
 */
export interface ClaimStrengthResult {
  claimId: string;
  strengthScore: number;
  supportingClaims: SupportingClaim[];
  contradictoryClaims: ContradictoryClaim[];
}

/**
 * A claim that supports another claim
 */
export interface SupportingClaim {
  claimId: string;
  source: string;
  similarity: number;
}

/**
 * A claim that contradicts another claim
 */
export interface ContradictoryClaim {
  claimId: string;
  source: string;
  similarity: number;
  sentimentOpposition: boolean;
}

/**
 * ClaimStrengthCalculator analyzes claims to determine:
 * - How many papers support similar claims (strength)
 * - Which claims contradict each other
 * 
 * Validates Requirements: 17.1, 17.2, 17.3, 28.1, 28.2
 */
export class ClaimStrengthCalculator {
  private embeddingService: EmbeddingService;
  private similarityThreshold: number;
  private contradictionThreshold: number;

  constructor(
    embeddingService: EmbeddingService,
    similarityThreshold: number = 0.75,
    contradictionThreshold: number = 0.65
  ) {
    this.embeddingService = embeddingService;
    this.similarityThreshold = similarityThreshold;
    this.contradictionThreshold = contradictionThreshold;
  }

  /**
   * Calculate strength score for a claim based on supporting claims from different sources.
   * 
   * Strength score increases with the number of different sources that support similar claims.
   * 
   * @param claim The claim to analyze
   * @param allClaims All claims in the database
   * @returns Claim strength analysis result
   */
  async calculateStrength(claim: Claim, allClaims: Claim[]): Promise<ClaimStrengthResult> {
    // Generate embedding for the target claim
    const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);

    // Find similar claims from different sources
    const supportingClaims: SupportingClaim[] = [];
    const contradictoryClaims: ContradictoryClaim[] = [];

    for (const otherClaim of allClaims) {
      // Skip the claim itself
      if (otherClaim.id === claim.id) {
        continue;
      }

      // Skip claims from the same source
      if (otherClaim.source === claim.source) {
        continue;
      }

      // Calculate semantic similarity
      const otherEmbedding = await this.embeddingService.generateEmbedding(otherClaim.text);
      const similarity = this.embeddingService.cosineSimilarity(claimEmbedding, otherEmbedding);

      // Check if claims are similar enough to be related
      if (similarity >= this.contradictionThreshold) {
        // Detect if this is a contradiction or support
        const isContradiction = this.detectContradiction(claim.text, otherClaim.text, similarity);

        if (isContradiction) {
          contradictoryClaims.push({
            claimId: otherClaim.id,
            source: otherClaim.source,
            similarity,
            sentimentOpposition: true
          });
        } else if (similarity >= this.similarityThreshold) {
          // This is a supporting claim
          supportingClaims.push({
            claimId: otherClaim.id,
            source: otherClaim.source,
            similarity
          });
        }
      }
    }

    // Calculate strength score based on number of supporting sources
    // Score increases monotonically with number of supporting claims
    const strengthScore = this.calculateScore(supportingClaims.length);

    return {
      claimId: claim.id,
      strengthScore,
      supportingClaims,
      contradictoryClaims
    };
  }

  /**
   * Calculate strength scores for all claims in batch.
   * More efficient than calling calculateStrength multiple times.
   * 
   * @param claims All claims to analyze
   * @returns Map of claim ID to strength result
   */
  async calculateStrengthBatch(claims: Claim[]): Promise<Map<string, ClaimStrengthResult>> {
    const results = new Map<string, ClaimStrengthResult>();

    // Pre-generate all embeddings in batch for efficiency
    const embeddings = await this.embeddingService.generateBatch(
      claims.map(c => c.text)
    );

    // Create embedding map for quick lookup
    const embeddingMap = new Map<string, number[]>();
    claims.forEach((claim, idx) => {
      embeddingMap.set(claim.id, embeddings[idx]);
    });

    // Calculate strength for each claim
    for (const claim of claims) {
      const claimEmbedding = embeddingMap.get(claim.id)!;
      const supportingClaims: SupportingClaim[] = [];
      const contradictoryClaims: ContradictoryClaim[] = [];

      for (const otherClaim of claims) {
        // Skip the claim itself
        if (otherClaim.id === claim.id) {
          continue;
        }

        // Skip claims from the same source
        if (otherClaim.source === claim.source) {
          continue;
        }

        // Calculate semantic similarity
        const otherEmbedding = embeddingMap.get(otherClaim.id)!;
        const similarity = this.embeddingService.cosineSimilarity(claimEmbedding, otherEmbedding);

        // Check if claims are similar enough to be related
        if (similarity >= this.contradictionThreshold) {
          // Detect if this is a contradiction or support
          const isContradiction = this.detectContradiction(claim.text, otherClaim.text, similarity);

          if (isContradiction) {
            contradictoryClaims.push({
              claimId: otherClaim.id,
              source: otherClaim.source,
              similarity,
              sentimentOpposition: true
            });
          } else if (similarity >= this.similarityThreshold) {
            // This is a supporting claim
            supportingClaims.push({
              claimId: otherClaim.id,
              source: otherClaim.source,
              similarity
            });
          }
        }
      }

      // Calculate strength score
      const strengthScore = this.calculateScore(supportingClaims.length);

      results.set(claim.id, {
        claimId: claim.id,
        strengthScore,
        supportingClaims,
        contradictoryClaims
      });
    }

    return results;
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
  private detectContradiction(claim1Text: string, claim2Text: string, similarity: number): boolean {
    // If similarity is very high (> 0.9), they're likely the same claim, not contradictory
    if (similarity > 0.90) {
      return false;
    }

    // Check for negation patterns
    const hasNegation1 = this.hasNegation(claim1Text);
    const hasNegation2 = this.hasNegation(claim2Text);

    // If one has negation and the other doesn't, and they're similar, it's likely a contradiction
    if (hasNegation1 !== hasNegation2) {
      return true;
    }

    // Check for opposing sentiment words
    const sentiment1 = this.analyzeSentiment(claim1Text);
    const sentiment2 = this.analyzeSentiment(claim2Text);

    // If sentiments are opposite (one positive, one negative) and claims are similar
    // Lowered threshold to 0.5 to catch more sentiment-based contradictions
    if (sentiment1 * sentiment2 < 0 && Math.abs(sentiment1 - sentiment2) > 0.5) {
      return true;
    }

    // Check for contradictory keywords
    const hasContradictoryKeywords = this.hasContradictoryKeywords(claim1Text, claim2Text);
    if (hasContradictoryKeywords) {
      return true;
    }

    return false;
  }

  /**
   * Check if text contains negation patterns.
   */
  private hasNegation(text: string): boolean {
    const negationPatterns = [
      /\bnot\b/i,
      /\bno\b/i,
      /\bnever\b/i,
      /\bneither\b/i,
      /\bnor\b/i,
      /\bwithout\b/i,
      /\bfailed to\b/i,
      /\bdoes not\b/i,
      /\bdo not\b/i,
      /\bdid not\b/i,
      /\bcannot\b/i,
      /\bcan't\b/i,
      /\bwon't\b/i,
      /\bdidn't\b/i,
      /\bdoesn't\b/i,
      /\bisn't\b/i,
      /\baren't\b/i,
      /\bwasn't\b/i,
      /\bweren't\b/i,
      /\bhadn't\b/i,
      /\bhasn't\b/i,
      /\bhaven't\b/i,
      /\bshouldn't\b/i,
      /\bwouldn't\b/i,
      /\bcouldn't\b/i
    ];

    return negationPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Analyze sentiment of text.
   * Returns a score: positive > 0, negative < 0, neutral ≈ 0
   */
  private analyzeSentiment(text: string): number {
    const lowerText = text.toLowerCase();

    // Positive sentiment words
    const positiveWords = [
      'effective', 'improved', 'better', 'superior', 'successful', 'accurate',
      'robust', 'reliable', 'significant', 'increase', 'enhance', 'advantage',
      'beneficial', 'positive', 'strong', 'high', 'good', 'excellent', 'optimal',
      'outperform', 'higher', 'greater', 'best', 'promising', 'novel'
    ];

    // Negative sentiment words
    const negativeWords = [
      'ineffective', 'poor', 'worse', 'inferior', 'failed', 'inaccurate',
      'weak', 'unreliable', 'insignificant', 'decrease', 'reduce', 'disadvantage',
      'harmful', 'negative', 'low', 'bad', 'suboptimal', 'underperform',
      'lower', 'lesser', 'worst', 'limited', 'problematic', 'challenging'
    ];

    let score = 0;

    // Count positive words
    for (const word of positiveWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    // Count negative words
    for (const word of negativeWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        score -= matches.length;
      }
    }

    return score;
  }

  /**
   * Check if two texts contain contradictory keywords.
   */
  private hasContradictoryKeywords(text1: string, text2: string): boolean {
    const contradictoryPairs = [
      ['increase', 'decrease'],
      ['improve', 'worsen'],
      ['effective', 'ineffective'],
      ['successful', 'unsuccessful'],
      ['accurate', 'inaccurate'],
      ['reliable', 'unreliable'],
      ['significant', 'insignificant'],
      ['better', 'worse'],
      ['higher', 'lower'],
      ['more', 'less'],
      ['superior', 'inferior'],
      ['advantage', 'disadvantage'],
      ['positive', 'negative'],
      ['strong', 'weak'],
      ['robust', 'fragile'],
      ['outperform', 'underperform']
    ];

    const lower1 = text1.toLowerCase();
    const lower2 = text2.toLowerCase();

    for (const [word1, word2] of contradictoryPairs) {
      // Check if text1 has word1 and text2 has word2, or vice versa
      if (
        (lower1.includes(word1) && lower2.includes(word2)) ||
        (lower1.includes(word2) && lower2.includes(word1))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate strength score based on number of supporting claims.
   * Score increases monotonically with number of supporting claims.
   * 
   * Score ranges:
   * - 0 supporting claims: score = 0
   * - 1 supporting claim: score = 1
   * - 2 supporting claims: score = 2
   * - 3+ supporting claims: score = 3 + log(n-2)
   * 
   * This provides a monotonically increasing score that grows more slowly
   * as the number of supporting claims increases.
   */
  private calculateScore(supportingCount: number): number {
    if (supportingCount === 0) {
      return 0;
    } else if (supportingCount === 1) {
      return 1;
    } else if (supportingCount === 2) {
      return 2;
    } else {
      // For 3+ supporting claims, use logarithmic growth
      return 3 + Math.log(supportingCount - 2);
    }
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
