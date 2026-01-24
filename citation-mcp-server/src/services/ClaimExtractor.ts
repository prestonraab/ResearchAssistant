import { EmbeddingService } from '../core/EmbeddingService.js';
import {
  PotentialClaim,
  ClaimType,
  SectionSuggestion,
  OutlineSection,
} from '../types/index.js';

/**
 * ClaimExtractor extracts potential claims from paper text and suggests relevant sections.
 * 
 * Implements Requirements 8.1, 8.2, 8.3, 9.1
 */
export class ClaimExtractor {
  private embeddingService: EmbeddingService;

  // Keyword patterns for claim categorization
  private readonly CATEGORY_KEYWORDS: Record<ClaimType, string[]> = {
    method: [
      'method',
      'approach',
      'technique',
      'algorithm',
      'we propose',
      'we develop',
      'we introduce',
      'we present',
      'methodology',
      'procedure',
      'framework',
      'model',
    ],
    result: [
      'result',
      'finding',
      'performance',
      'we found',
      'significantly',
      'showed',
      'demonstrated',
      'observed',
      'measured',
      'achieved',
      'obtained',
      'revealed',
    ],
    conclusion: [
      'conclude',
      'therefore',
      'thus',
      'we argue',
      'suggests',
      'indicates',
      'implies',
      'in conclusion',
      'overall',
      'in summary',
    ],
    background: [
      'previous',
      'prior',
      'existing',
      'traditional',
      'conventional',
      'established',
      'known',
      'literature',
      'research',
      'studies',
    ],
    challenge: [
      'challenge',
      'problem',
      'difficulty',
      'limitation',
      'issue',
      'obstacle',
      'barrier',
      'constraint',
      'drawback',
      'shortcoming',
    ],
    data_source: [
      'dataset',
      'data',
      'corpus',
      'database',
      'collection',
      'sample',
      'obtained from',
      'collected from',
      'sourced from',
    ],
    data_trend: [
      'trend',
      'pattern',
      'increase',
      'decrease',
      'growth',
      'decline',
      'correlation',
      'relationship',
      'association',
      'variation',
    ],
    impact: [
      'impact',
      'effect',
      'influence',
      'consequence',
      'implication',
      'outcome',
      'benefit',
      'advantage',
      'improvement',
    ],
    application: [
      'application',
      'applied',
      'use',
      'used',
      'practical',
      'implementation',
      'deployed',
      'real-world',
      'case study',
    ],
    phenomenon: [
      'phenomenon',
      'occurs',
      'happens',
      'observed',
      'behavior',
      'characteristic',
      'property',
      'feature',
      'aspect',
    ],
  };

  // Confidence boost keywords (increase confidence score)
  private readonly CONFIDENCE_BOOST_KEYWORDS = [
    'significantly',
    'demonstrated',
    'showed',
    'found',
    'observed',
    'measured',
    'proved',
    'confirmed',
    'established',
    'revealed',
  ];

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Extract potential claims from paper text.
   * 
   * Requirement 8.1: Identify declarative sentences as potential claims
   * Requirement 8.2: Calculate confidence scores based on keyword presence
   * Requirement 8.3: Categorize claims by type
   * Requirement 8.4: Return claims sorted by confidence score
   * Requirement 8.5: Include surrounding context for each claim
   * 
   * @param text The paper text to extract claims from
   * @param source The source identifier (e.g., "Smith2020")
   * @returns Array of potential claims sorted by confidence (highest first)
   */
  extractFromText(text: string, source: string): PotentialClaim[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const lines = text.split('\n');
    const potentialClaims: PotentialClaim[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines or very short lines
      if (line.length < 20 || line.length > 500) {
        continue;
      }

      // Check if the sentence is declarative
      if (!this.isDeclarative(line)) {
        continue;
      }

      // Calculate confidence score
      const confidence = this.calculateConfidence(line);

      // Categorize the claim
      const type = this.categorizeClaim(line);

      // Extract surrounding context (previous and next lines)
      const context = this.extractContext(lines, i);

      potentialClaims.push({
        text: line,
        context,
        confidence,
        type,
        lineNumber: i + 1, // 1-indexed for human readability
      });
    }

    // Sort by confidence score (highest first)
    potentialClaims.sort((a, b) => b.confidence - a.confidence);

    return potentialClaims;
  }

  /**
   * Categorize a claim by type based on keyword matching.
   * 
   * Requirement 8.3: Categorize claims by type using keyword matching
   * 
   * @param text The claim text
   * @returns The claim type with the highest keyword match score
   */
  categorizeClaim(text: string): ClaimType {
    const lowerText = text.toLowerCase();
    const scores: Record<ClaimType, number> = {
      method: 0,
      result: 0,
      conclusion: 0,
      background: 0,
      challenge: 0,
      data_source: 0,
      data_trend: 0,
      impact: 0,
      application: 0,
      phenomenon: 0,
    };

    // Count keyword matches for each category
    for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        // Use word boundaries to match whole words/phrases
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
        if (regex.test(lowerText)) {
          scores[category as ClaimType]++;
        }
      }
    }

    // Find category with highest score
    let maxScore = 0;
    let bestCategory: ClaimType = 'background'; // Default fallback

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as ClaimType;
      }
    }

    return bestCategory;
  }

  /**
   * Suggest relevant outline sections for a claim using semantic similarity.
   * 
   * Requirement 9.1: Calculate semantic similarity between claim and sections
   * Requirement 9.2: Return top 1-3 most relevant sections ranked by similarity
   * Requirement 9.3: Include similarity scores for each suggestion
   * 
   * @param claimText The claim text
   * @param sections Array of outline sections
   * @returns Top 1-3 section suggestions sorted by similarity (highest first)
   */
  async suggestSections(
    claimText: string,
    sections: OutlineSection[]
  ): Promise<SectionSuggestion[]> {
    if (!claimText || claimText.trim().length === 0 || sections.length === 0) {
      return [];
    }

    // Generate embedding for the claim
    const claimEmbedding = await this.embeddingService.generateEmbedding(claimText);

    const suggestions: SectionSuggestion[] = [];

    // Calculate similarity with each section
    for (const section of sections) {
      // Combine section title and content for similarity calculation
      const sectionText = `${section.title}\n${section.content.join('\n')}`;
      const sectionEmbedding = await this.embeddingService.generateEmbedding(sectionText);

      const similarity = this.embeddingService.cosineSimilarity(
        claimEmbedding,
        sectionEmbedding
      );

      suggestions.push({
        sectionId: section.id,
        sectionTitle: section.title,
        similarity,
      });
    }

    // Sort by similarity (highest first) and take top 3
    suggestions.sort((a, b) => b.similarity - a.similarity);

    return suggestions.slice(0, 3);
  }

  /**
   * Check if a sentence is declarative (not a question or command).
   * 
   * Requirement 8.1: Filter for declarative sentences
   * 
   * @param sentence The sentence to check
   * @returns True if the sentence is declarative
   */
  private isDeclarative(sentence: string): boolean {
    const trimmed = sentence.trim();

    // Not a question (doesn't end with ?)
    if (trimmed.endsWith('?')) {
      return false;
    }

    // Not a command (doesn't start with imperative verbs)
    const imperativeStarts = [
      'see',
      'refer',
      'note',
      'consider',
      'assume',
      'let',
      'suppose',
      'imagine',
    ];

    const lowerSentence = trimmed.toLowerCase();
    for (const verb of imperativeStarts) {
      if (lowerSentence.startsWith(verb + ' ')) {
        return false;
      }
    }

    // Not a heading or title (all caps or ends with colon)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 5) {
      return false;
    }

    if (trimmed.endsWith(':')) {
      return false;
    }

    // Has a verb (basic check for sentence structure)
    // Look for common verb patterns
    const hasVerb = /\b(is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|should|could|may|might|can|must|shall)\b/i.test(
      trimmed
    );

    return hasVerb;
  }

  /**
   * Calculate confidence score for a potential claim.
   * 
   * Requirement 8.2: Calculate confidence based on keyword presence and structure
   * 
   * Base score starts at 0.5, then:
   * - Add 0.1 for each confidence boost keyword (max +0.3)
   * - Add 0.05 for each category keyword match (max +0.2)
   * - Normalize to [0, 1] range
   * 
   * @param text The claim text
   * @returns Confidence score between 0 and 1
   */
  private calculateConfidence(text: string): number {
    const lowerText = text.toLowerCase();
    let score = 0.5; // Base score

    // Boost for confidence keywords
    let boostCount = 0;
    for (const keyword of this.CONFIDENCE_BOOST_KEYWORDS) {
      const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
      if (regex.test(lowerText)) {
        boostCount++;
      }
    }
    score += Math.min(boostCount * 0.1, 0.3);

    // Boost for category keyword matches
    let categoryMatches = 0;
    for (const keywords of Object.values(this.CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
        if (regex.test(lowerText)) {
          categoryMatches++;
        }
      }
    }
    score += Math.min(categoryMatches * 0.05, 0.2);

    // Normalize to [0, 1]
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Extract surrounding context for a claim.
   * 
   * Requirement 8.5: Include surrounding context
   * 
   * @param lines All lines from the text
   * @param lineIndex The index of the claim line
   * @returns Context string with previous and next lines
   */
  private extractContext(lines: string[], lineIndex: number): string {
    const contextLines: string[] = [];

    // Add previous line if available
    if (lineIndex > 0) {
      const prevLine = lines[lineIndex - 1].trim();
      if (prevLine.length > 0) {
        contextLines.push(prevLine);
      }
    }

    // Add the claim line itself
    contextLines.push(lines[lineIndex].trim());

    // Add next line if available
    if (lineIndex < lines.length - 1) {
      const nextLine = lines[lineIndex + 1].trim();
      if (nextLine.length > 0) {
        contextLines.push(nextLine);
      }
    }

    return contextLines.join(' ');
  }

  /**
   * Escape special regex characters in a string.
   * 
   * @param str The string to escape
   * @returns Escaped string safe for use in regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
