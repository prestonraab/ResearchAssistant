import { EmbeddingService } from './EmbeddingService.js';
import { ClaimsManager } from '../managers/ClaimsManager.js';
import { ClaimValidationCache } from './caching/index.js';
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
  private validationCache: ClaimValidationCache | null = null;
  private workspaceRoot: string | null = null;

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
    similarityThreshold: number = 0.7,
    workspaceRoot?: string
  ) {
    this.embeddingService = embeddingService;
    this.claimsManager = claimsManager;
    this.similarityThreshold = similarityThreshold;
    this.workspaceRoot = workspaceRoot || null;
    
    // Initialize validation cache if workspace root is provided
    if (workspaceRoot) {
      this.validationCache = new ClaimValidationCache(workspaceRoot);
      this.validationCache.initialize().catch(error => {
        console.error('[ClaimStrengthCalculator] Failed to initialize validation cache:', error);
      });
    }
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
      if (claim.primaryQuote?.source === targetClaim.primaryQuote?.source) {
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
            source: claim.primaryQuote?.source || 'Unknown',
            similarity,
            sentimentOpposition,
          });
        } else {
          // This is a supporting claim
          supportingClaims.push({
            claimId: claim.id,
            source: claim.primaryQuote?.source || 'Unknown',
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
        if (claim.primaryQuote?.source === targetClaim.primaryQuote?.source) {
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
              source: claim.primaryQuote?.source || 'Unknown',
              similarity,
              sentimentOpposition,
            });
          } else {
            supportingClaims.push({
              claimId: claim.id,
              source: claim.primaryQuote?.source || 'Unknown',
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
      // Use word stem matching to catch variations like "increase"/"increases"
      const regex1 = new RegExp(`\\b${word1}`, 'i');
      const regex2 = new RegExp(`\\b${word2}`, 'i');

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
   * Validate whether a claim's quote actually supports the claim text.
   * Analyzes semantic similarity between claim text and supporting quotes.
   * Checks cache first before computing.
   * 
   * @param claim The claim to validate
   * @param minSources Minimum number of independent sources required
   * @param similarityThreshold Minimum similarity threshold for support
   * @returns Validation result with similarity score and support status
   */
  async validateSupport(
    claim: Claim,
    minSources: number = 1,
    similarityThreshold: number = 0.6
  ): Promise<{
    claimId: string;
    similarity: number;
    supported: boolean;
    analysis: string;
    suggestedQuotes?: string[];
  }> {
    try {
      // Check cache first
      if (this.validationCache) {
        const cached = this.validationCache.get(claim.text);
        if (cached) {
          console.log(`[ClaimStrengthCalculator] Cache hit for validation of claim ${claim.id}`);
          return {
            claimId: claim.id,
            similarity: cached.similarity,
            supported: cached.supported,
            analysis: cached.analysis,
            suggestedQuotes: cached.suggestedQuotes
          };
        }
      }
      
      // Calculate similarity between claim text and primary quote
      const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);
      const quoteEmbedding = await this.embeddingService.generateEmbedding(claim.primaryQuote?.text || '');
      const similarity = this.embeddingService.cosineSimilarity(claimEmbedding, quoteEmbedding);

      // Check if claim meets minimum source requirement
      const strength = await this.calculateStrength(claim.id);
      const hasEnoughSources = strength.supportingClaims.length >= minSources;

      // Determine if claim is supported
      const supported = similarity >= similarityThreshold && hasEnoughSources;

      // Generate analysis text
      const analysis = this.generateSupportAnalysis(
        similarity,
        supported,
        strength.supportingClaims.length,
        minSources
      );

      const result = {
        claimId: claim.id,
        similarity,
        supported,
        analysis,
      };
      
      // Store in cache
      if (this.validationCache) {
        this.validationCache.set(claim.text, {
          similarity,
          supported,
          suggestedQuotes: [],
          analysis
        });
        console.log(`[ClaimStrengthCalculator] Cached validation result for claim ${claim.id}`);
      }
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        claimId: claim.id,
        similarity: 0,
        supported: false,
        analysis: `Error during validation: ${errorMsg}`,
      };
    }
  }

  /**
   * Generate a human-readable analysis of the validation result.
   */
  private generateSupportAnalysis(
    similarity: number,
    supported: boolean,
    supportingSourceCount: number,
    minSources: number
  ): string {
    const similarityPercent = (similarity * 100).toFixed(1);
    const sourceStatus = `${supportingSourceCount}/${minSources} sources`;

    if (similarity >= 0.75 && supportingSourceCount >= minSources) {
      return `Strong support: Quote strongly supports claim (${similarityPercent}% similarity, ${sourceStatus})`;
    } else if (similarity >= 0.6 && supportingSourceCount >= minSources) {
      return `Moderate support: Quote provides some support (${similarityPercent}% similarity, ${sourceStatus}). Consider finding a more directly relevant quote.`;
    } else if (supportingSourceCount < minSources) {
      return `Insufficient sources: Only ${supportingSourceCount} of ${minSources} required sources found. Need more independent sources.`;
    } else {
      return `Weak support: Quote may not adequately support claim (${similarityPercent}% similarity, ${sourceStatus}). Consider finding a better supporting quote.`;
    }
  }

  /**
   * Check if two texts have opposing sentiment
   */
  private hasSentimentOpposition(text1: string, text2: string): boolean {
    // Helper to determine effective sentiment (accounting for negation)
    const getEffectiveSentiment = (text: string): 'positive' | 'negative' | 'neutral' => {
      const hasNegation = this.hasNegation(text);
      
      const hasPositive = this.POSITIVE_WORDS.some((word) => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(text);
      });

      const hasNegative = this.NEGATIVE_WORDS.some((word) => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(text);
      });

      // If negation is present, flip the sentiment
      if (hasNegation) {
        if (hasPositive) return 'negative'; // "not effective" = negative
        if (hasNegative) return 'positive'; // "not ineffective" = positive
      } else {
        if (hasPositive) return 'positive';
        if (hasNegative) return 'negative';
      }

      return 'neutral';
    };

    const sentiment1 = getEffectiveSentiment(text1);
    const sentiment2 = getEffectiveSentiment(text2);

    // Opposition exists if sentiments are opposite
    return (sentiment1 === 'positive' && sentiment2 === 'negative') ||
           (sentiment1 === 'negative' && sentiment2 === 'positive');
  }

}
