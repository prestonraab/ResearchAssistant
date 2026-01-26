import { EmbeddingService } from '../core/EmbeddingService.js';
import { ClaimsManager } from '../core/ClaimsManager.js';
import {
  ClaimMatch,
  DraftAnalysis,
  SentenceAnalysis,
  GeneralizationMatch,
  MultiSourceResult,
  Claim,
} from '@research-assistant/core';

/**
 * SearchService handles semantic search across claims database.
 * Implements Requirements 1.1, 1.3, 2.1, 2.3, 3.1, 3.2
 */
export class SearchService {
  private embeddingService: EmbeddingService;
  private claimsManager: ClaimsManager;
  private defaultThreshold: number;

  // Generalization keywords that indicate need for multiple sources
  private readonly GENERALIZATION_KEYWORDS = [
    'often',
    'typically',
    'generally',
    'consistently',
    'usually',
    'frequently',
    'commonly',
  ];

  constructor(
    embeddingService: EmbeddingService,
    claimsManager: ClaimsManager,
    defaultThreshold: number = 0.3
  ) {
    this.embeddingService = embeddingService;
    this.claimsManager = claimsManager;
    this.defaultThreshold = defaultThreshold;
  }

  /**
   * Search for claims relevant to a question using semantic similarity.
   * Requirement 1.1: Search all claims using semantic similarity
   * Requirement 1.2: Return claims ranked by relevance with similarity scores
   * Requirement 1.3: Support relevance threshold parameter
   */
  async searchByQuestion(
    question: string,
    threshold: number = this.defaultThreshold
  ): Promise<ClaimMatch[]> {
    // Validate inputs
    if (!question || question.trim().length === 0) {
      return [];
    }

    // Ensure claims are loaded
    const claims = this.claimsManager.getAllClaims();
    if (claims.length === 0) {
      return [];
    }

    // Generate embedding for the question
    const questionEmbedding = await this.embeddingService.generateEmbedding(question);

    // Calculate similarity with all claims
    const matches: ClaimMatch[] = [];

    for (const claim of claims) {
      const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);
      const similarity = this.embeddingService.cosineSimilarity(
        questionEmbedding,
        claimEmbedding
      );

      // Filter by threshold
      if (similarity >= threshold) {
        matches.push({
          claimId: claim.id,
          claimText: claim.text,
          source: claim.source,
          similarity,
          primaryQuote: claim.primaryQuote,
        });
      }
    }

    // Sort by descending similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);

    return matches;
  }

  /**
   * Search for claims matching draft manuscript text.
   * Requirement 2.1: Search all claims using semantic similarity
   * Requirement 2.2: Return claims ranked by relevance with similarity scores
   * Requirement 2.3: Support paragraph-level and sentence-level matching modes
   * Requirement 2.5: Identify which specific sentences match each claim
   */
  async searchByDraft(
    draftText: string,
    mode: 'paragraph' | 'sentence',
    threshold: number = this.defaultThreshold
  ): Promise<DraftAnalysis> {
    // Validate inputs
    if (!draftText || draftText.trim().length === 0) {
      return {
        sentences: [],
        needsNewPapers: false,
        suggestedSearches: [],
      };
    }

    const claims = this.claimsManager.getAllClaims();
    const sentences = this.splitIntoSentences(draftText);
    const sentenceAnalyses: SentenceAnalysis[] = [];
    let totalFactualSentences = 0;
    let supportedSentences = 0;

    if (mode === 'sentence') {
      // Analyze each sentence independently
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length === 0) continue;

        // Check if sentence requires multiple sources
        const requiresMultipleSources = this.containsGeneralizationKeyword(trimmed);

        // Search for matching claims
        const matchingClaims = await this.searchSentence(trimmed, claims, threshold);

        // Determine if sentence is supported
        const supported = matchingClaims.length > 0;
        if (supported) {
          supportedSentences++;
        }
        totalFactualSentences++;

        sentenceAnalyses.push({
          text: trimmed,
          supported,
          matchingClaims,
          requiresMultipleSources,
        });
      }
    } else {
      // Paragraph mode: treat entire text as one unit
      const requiresMultipleSources = this.containsGeneralizationKeyword(draftText);
      const matchingClaims = await this.searchSentence(draftText, claims, threshold);
      const supported = matchingClaims.length > 0;

      if (supported) {
        supportedSentences++;
      }
      totalFactualSentences++;

      sentenceAnalyses.push({
        text: draftText.trim(),
        supported,
        matchingClaims,
        requiresMultipleSources,
      });
    }

    // Determine if new papers are needed
    // If less than 50% of sentences are supported, suggest new papers
    const needsNewPapers =
      totalFactualSentences > 0 && supportedSentences / totalFactualSentences < 0.5;

    // Generate suggested searches for unsupported sentences
    const suggestedSearches: string[] = [];
    for (const analysis of sentenceAnalyses) {
      if (!analysis.supported && analysis.text.length > 20) {
        // Extract key terms from unsupported sentence
        const keyTerms = this.extractKeyTerms(analysis.text);
        if (keyTerms.length > 0) {
          suggestedSearches.push(keyTerms.join(' '));
        }
      }
    }

    return {
      sentences: sentenceAnalyses,
      needsNewPapers,
      suggestedSearches: [...new Set(suggestedSearches)], // Remove duplicates
    };
  }

  /**
   * Detect generalization keywords in text.
   * Requirement 3.1: Flag sentences with generalization keywords
   */
  detectGeneralizationKeywords(text: string): GeneralizationMatch[] {
    const matches: GeneralizationMatch[] = [];
    const sentences = this.splitIntoSentences(text);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();

      for (const keyword of this.GENERALIZATION_KEYWORDS) {
        // Use word boundaries to match whole words only
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        let match;

        while ((match = regex.exec(sentence)) !== null) {
          matches.push({
            sentence: sentence.trim(),
            keyword,
            position: match.index,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find multiple independent sources supporting a statement.
   * Requirement 3.2: Search for claims from different sources
   * Requirement 3.3: Return minimum 2-3 supporting claims from independent sources
   * Requirement 3.5: Group supporting claims by source
   */
  async findMultiSourceSupport(
    statement: string,
    minSources: number = 2
  ): Promise<MultiSourceResult> {
    // Search for all matching claims
    const allMatches = await this.searchByQuestion(statement, this.defaultThreshold);

    // Group by source
    const claimsBySource = new Map<string, ClaimMatch[]>();
    for (const match of allMatches) {
      if (!claimsBySource.has(match.source)) {
        claimsBySource.set(match.source, []);
      }
      claimsBySource.get(match.source)!.push(match);
    }

    // Get the best match from each source
    const supportingClaims: ClaimMatch[] = [];
    for (const [source, claims] of claimsBySource.entries()) {
      // Sort by similarity and take the best one from this source
      claims.sort((a, b) => b.similarity - a.similarity);
      supportingClaims.push(claims[0]);
    }

    // Sort all supporting claims by similarity
    supportingClaims.sort((a, b) => b.similarity - a.similarity);

    const sourceCount = claimsBySource.size;
    const sufficient = sourceCount >= minSources;

    // Determine if a review paper is needed
    // If we have 0-1 sources, suggest looking for a review paper
    const needsReviewPaper = sourceCount < 2;

    return {
      statement,
      supportingClaims,
      sourceCount,
      sufficient,
      needsReviewPaper,
    };
  }

  /**
   * Helper: Search for claims matching a single sentence
   */
  private async searchSentence(
    sentence: string,
    claims: Claim[],
    threshold: number
  ): Promise<ClaimMatch[]> {
    if (claims.length === 0) {
      return [];
    }

    const sentenceEmbedding = await this.embeddingService.generateEmbedding(sentence);
    const matches: ClaimMatch[] = [];

    for (const claim of claims) {
      const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);
      const similarity = this.embeddingService.cosineSimilarity(
        sentenceEmbedding,
        claimEmbedding
      );

      if (similarity >= threshold) {
        matches.push({
          claimId: claim.id,
          claimText: claim.text,
          source: claim.source,
          similarity,
          primaryQuote: claim.primaryQuote,
        });
      }
    }

    // Sort by descending similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    return matches;
  }

  /**
   * Helper: Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting on period, exclamation, question mark
    // followed by space or end of string
    const sentences = text
      .split(/[.!?]+\s+|[.!?]+$/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return sentences;
  }

  /**
   * Helper: Check if text contains generalization keywords
   */
  private containsGeneralizationKeyword(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.GENERALIZATION_KEYWORDS.some((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerText);
    });
  }

  /**
   * Helper: Extract key terms from a sentence for search query generation
   */
  private extractKeyTerms(sentence: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'can',
      'this',
      'that',
      'these',
      'those',
    ]);

    // Extract words (alphanumeric sequences)
    const words = sentence
      .toLowerCase()
      .match(/\b[a-z0-9]+\b/g) || [];

    // Filter out stop words and short words
    const keyTerms = words
      .filter((word) => !stopWords.has(word) && word.length > 3)
      .slice(0, 5); // Take top 5 key terms

    return keyTerms;
  }
}
