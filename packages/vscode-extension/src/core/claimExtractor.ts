import { EmbeddingService } from '@research-assistant/core';
import type { OutlineSection } from '@research-assistant/core';
import type { DatabaseClaim } from '../types';

export interface PotentialClaim {
  text: string;
  context: string;
  confidence: number;
  type: 'method' | 'result' | 'conclusion' | 'background' | 'challenge' | 'data_source' | 'data_trend' | 'impact' | 'application' | 'phenomenon';
  lineNumber: number;
}

/**
 * ClaimExtractor identifies and extracts potential claims from paper text.
 * 
 * It analyzes text to find declarative sentences that could be claims,
 * prioritizes sentences with method/result/conclusion keywords,
 * assigns confidence scores, and categorizes claims by type.
 */
export class ClaimExtractor {
  private embeddingService: EmbeddingService;

  // Keywords for identifying different types of claims
  private readonly methodKeywords = [
    'method', 'approach', 'technique', 'algorithm', 'procedure', 'process',
    'framework', 'model', 'system', 'implementation', 'design', 'architecture',
    'we propose', 'we develop', 'we implement', 'we introduce', 'we present',
    'we use', 'we apply', 'we employ', 'we adopt'
  ];

  private readonly resultKeywords = [
    'result', 'finding', 'outcome', 'performance', 'accuracy', 'precision',
    'recall', 'improvement', 'increase', 'decrease', 'reduction', 'enhancement',
    'we found', 'we observe', 'we demonstrate', 'we show', 'we achieve',
    'our results', 'our findings', 'our experiments', 'our analysis',
    'significantly', 'substantially', 'notably', 'remarkably'
  ];

  private readonly conclusionKeywords = [
    'conclude', 'conclusion', 'summary', 'therefore', 'thus', 'hence',
    'consequently', 'in conclusion', 'in summary', 'overall', 'finally',
    'we conclude', 'we argue', 'this suggests', 'this indicates',
    'implication', 'implications', 'significance', 'important'
  ];

  private readonly challengeKeywords = [
    'challenge', 'problem', 'issue', 'difficulty', 'limitation', 'constraint',
    'obstacle', 'barrier', 'gap', 'lack', 'absence', 'insufficient',
    'however', 'but', 'although', 'despite', 'unfortunately', 'remains',
    'unclear', 'unknown', 'unresolved', 'open question'
  ];

  private readonly backgroundKeywords = [
    'background', 'context', 'previous', 'prior', 'existing', 'traditional',
    'conventional', 'established', 'known', 'literature', 'research',
    'studies', 'work', 'has been', 'have been', 'is known', 'are known'
  ];

  private readonly dataSourceKeywords = [
    'data', 'dataset', 'database', 'corpus', 'collection', 'source',
    'repository', 'archive', 'sample', 'survey', 'measurement', 'observation',
    'we collected', 'we gathered', 'we obtained', 'we used data from'
  ];

  private readonly dataTrendKeywords = [
    'trend', 'pattern', 'increase', 'decrease', 'growth', 'decline',
    'change', 'shift', 'evolution', 'development', 'over time', 'temporal',
    'rising', 'falling', 'growing', 'declining', 'stable', 'fluctuation'
  ];

  private readonly impactKeywords = [
    'impact', 'effect', 'influence', 'consequence', 'outcome', 'implication',
    'affects', 'influences', 'leads to', 'results in', 'causes', 'contributes',
    'significant impact', 'positive effect', 'negative effect', 'beneficial'
  ];

  private readonly applicationKeywords = [
    'application', 'use case', 'practical', 'real-world', 'deployment',
    'applied', 'utilized', 'can be used', 'useful for',
    'applicable', 'suitable for', 'enables', 'facilitates', 'supports'
  ];

  private readonly phenomenonKeywords = [
    'phenomenon', 'phenomena', 'observation', 'occurrence', 'event',
    'behavior', 'characteristic', 'property', 'feature', 'aspect',
    'we observe', 'we notice', 'we see', 'appears', 'occurs', 'happens'
  ];

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Extract potential claims from paper text.
   * 
   * @param text The full text of the paper
   * @param source The source identifier (e.g., "Smith2023")
   * @returns Array of potential claims with confidence scores
   */
  extractFromText(text: string, source: string): PotentialClaim[] {
    const sentences = this.splitIntoSentences(text);
    const potentialClaims: PotentialClaim[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      // Skip very short or very long sentences
      if (sentence.length < 20 || sentence.length > 500) {
        continue;
      }

      // Check if sentence is declarative
      if (!this.isDeclarative(sentence)) {
        continue;
      }

      // Calculate confidence score
      const confidence = this.calculateConfidence(sentence);
      
      // Only include sentences with reasonable confidence
      if (confidence < 0.3) {
        continue;
      }

      // Categorize the claim
      const type = this.categorizeClaim(sentence);

      // Get context (surrounding sentences)
      const context = this.getContext(sentences, i);

      potentialClaims.push({
        text: sentence.trim(),
        context,
        confidence,
        type,
        lineNumber: i + 1
      });
    }

    // Sort by confidence (descending)
    potentialClaims.sort((a, b) => b.confidence - a.confidence);

    return potentialClaims;
  }

  /**
   * Categorize a claim by analyzing its content.
   * 
   * @param text The claim text
   * @returns The category of the claim
   */
  categorizeClaim(text: string): PotentialClaim['type'] {
    const lowerText = text.toLowerCase();

    // Count keyword matches for each category
    const scores = {
      method: this.countKeywordMatches(lowerText, this.methodKeywords),
      result: this.countKeywordMatches(lowerText, this.resultKeywords),
      conclusion: this.countKeywordMatches(lowerText, this.conclusionKeywords),
      challenge: this.countKeywordMatches(lowerText, this.challengeKeywords),
      background: this.countKeywordMatches(lowerText, this.backgroundKeywords),
      data_source: this.countKeywordMatches(lowerText, this.dataSourceKeywords),
      data_trend: this.countKeywordMatches(lowerText, this.dataTrendKeywords),
      impact: this.countKeywordMatches(lowerText, this.impactKeywords),
      application: this.countKeywordMatches(lowerText, this.applicationKeywords),
      phenomenon: this.countKeywordMatches(lowerText, this.phenomenonKeywords)
    };

    // Find category with highest score
    let maxScore = 0;
    let category: PotentialClaim['type'] = 'background';

    for (const [key, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        category = key as PotentialClaim['type'];
      }
    }

    // If no strong match, default to background
    if (maxScore === 0) {
      return 'background';
    }

    return category;
  }

  /**
   * Suggest relevant outline sections for a claim.
   * Uses semantic similarity to find the most relevant sections.
   * 
   * @param claim The claim text
   * @param sections All outline sections
   * @returns Top 1-3 most relevant sections
   */
  async suggestSections(
    claim: string,
    sections: OutlineSection[]
  ): Promise<OutlineSection[]> {
    if (sections.length === 0) {
      return [];
    }

    // Generate embedding for the claim
    const claimEmbedding = await this.embeddingService.generateEmbedding(claim);

    // Calculate similarity with each section
    const similarities: Array<{ section: OutlineSection; similarity: number }> = [];

    for (const section of sections) {
      // Combine section title and content for better matching
      const sectionText = `${section.title} ${section.content.join(' ')}`;
      const sectionEmbedding = await this.embeddingService.generateEmbedding(sectionText);
      
      const similarity = this.embeddingService.cosineSimilarity(
        claimEmbedding,
        sectionEmbedding
      );

      similarities.push({ section, similarity });
    }

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top 1-3 sections with similarity > 0.3
    const topSections = similarities
      .filter(s => s.similarity > 0.3)
      .slice(0, 3)
      .map(s => s.section);

    // Always return at least 1 section if available
    if (topSections.length === 0 && similarities.length > 0) {
      return [similarities[0].section];
    }

    return topSections;
  }

  /**
   * Format a potential claim for insertion into the claims database.
   * 
   * @param claim The potential claim
   * @param metadata Additional metadata (source, sourceId, etc.)
   * @returns Formatted claim object
   */
  formatForDatabase(
    claim: PotentialClaim,
    metadata: {
      claimId: string;
      source: string;
      sourceId: number;
      sections: string[];
    }
  ): DatabaseClaim {
    return {
      id: metadata.claimId,
      text: claim.text,
      category: this.formatCategory(claim.type),
      source: metadata.source,
      sourceId: metadata.sourceId,
      context: claim.context,
      primaryQuote: claim.text, // Use the claim text as the quote
      supportingQuotes: [],
      sections: metadata.sections,
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
  }

  // Private helper methods

  /**
   * Split text into sentences using simple heuristics.
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries (., !, ?)
    // But avoid splitting on abbreviations and decimals
    const sentences = text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return sentences;
  }

  /**
   * Check if a sentence is declarative (not a question or command).
   */
  private isDeclarative(sentence: string): boolean {
    const trimmed = sentence.trim();
    
    // Questions end with ?
    if (trimmed.endsWith('?')) {
      return false;
    }

    // Commands often start with imperative verbs
    const commandStarters = ['see', 'refer', 'note', 'consider', 'suppose', 'assume', 'let'];
    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
    if (commandStarters.includes(firstWord)) {
      return false;
    }

    // Likely declarative
    return true;
  }

  /**
   * Calculate confidence score for a sentence being a claim.
   * Higher scores indicate stronger likelihood of being a claim.
   */
  private calculateConfidence(sentence: string): number {
    const lowerText = sentence.toLowerCase();
    let score = 0.5; // Base score

    // Boost for method keywords
    const methodMatches = this.countKeywordMatches(lowerText, this.methodKeywords);
    score += methodMatches * 0.15;

    // Boost for result keywords
    const resultMatches = this.countKeywordMatches(lowerText, this.resultKeywords);
    score += resultMatches * 0.2;

    // Boost for conclusion keywords
    const conclusionMatches = this.countKeywordMatches(lowerText, this.conclusionKeywords);
    score += conclusionMatches * 0.15;

    // Boost for challenge keywords
    const challengeMatches = this.countKeywordMatches(lowerText, this.challengeKeywords);
    score += challengeMatches * 0.1;

    // Penalty for vague language
    const vagueTerms = ['some', 'many', 'often', 'sometimes', 'may', 'might', 'could', 'possibly'];
    const vagueMatches = this.countKeywordMatches(lowerText, vagueTerms);
    score -= vagueMatches * 0.1;

    // Penalty for very short sentences
    if (sentence.length < 50) {
      score -= 0.1;
    }

    // Boost for sentences with numbers/statistics
    if (/\d+(\.\d+)?%/.test(sentence) || /\d+(\.\d+)?\s*(times|fold|percent)/.test(sentence)) {
      score += 0.15;
    }

    // Clamp score between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Count how many keywords from a list appear in the text.
   */
  private countKeywordMatches(text: string, keywords: string[]): number {
    let count = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get context for a sentence (surrounding sentences).
   */
  private getContext(sentences: string[], index: number): string {
    const contextBefore = index > 0 ? sentences[index - 1] : '';
    const contextAfter = index < sentences.length - 1 ? sentences[index + 1] : '';
    
    const context = [contextBefore, contextAfter]
      .filter(s => s.length > 0)
      .join(' ... ');

    return context;
  }

  /**
   * Format category name for database (capitalize first letter of each word).
   */
  private formatCategory(type: PotentialClaim['type']): string {
    const categoryMap: Record<PotentialClaim['type'], string> = {
      method: 'Method',
      result: 'Result',
      conclusion: 'Conclusion',
      background: 'Background',
      challenge: 'Challenge',
      data_source: 'Data Source',
      data_trend: 'Data Trend',
      impact: 'Impact',
      application: 'Application',
      phenomenon: 'Phenomenon'
    };

    return categoryMap[type] || 'Background';
  }
}
