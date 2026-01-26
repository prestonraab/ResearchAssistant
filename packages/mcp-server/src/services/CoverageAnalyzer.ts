import { OutlineParser } from '../core/OutlineParser.js';
import { SearchService } from './SearchService.js';
import {
  SectionCoverage,
  ManuscriptCoverage,
  SentenceCoverage,
  SentenceType,
  ClaimMatch,
} from '@research-assistant/core';

/**
 * CoverageAnalyzer analyzes literature coverage at the sentence level.
 * 
 * Implements Requirements 5.1, 5.2, 5.3, 5.4
 */
export class CoverageAnalyzer {
  private outlineParser: OutlineParser;
  private searchService: SearchService;
  private manuscriptPath: string;
  private threshold: number;

  // Opinion indicators
  private readonly OPINION_INDICATORS = [
    'i think',
    'i believe',
    'arguably',
    'perhaps',
    'possibly',
    'likely',
    'probably',
    'may be',
    'might be',
    'could be',
    'seems',
    'appears',
    'suggests',
    'in my opinion',
    'in my view',
  ];

  // Transition indicators
  private readonly TRANSITION_INDICATORS = [
    'however',
    'furthermore',
    'moreover',
    'in addition',
    'additionally',
    'therefore',
    'thus',
    'consequently',
    'as a result',
    'on the other hand',
    'in contrast',
    'similarly',
    'likewise',
    'meanwhile',
    'nevertheless',
    'nonetheless',
    'first',
    'second',
    'third',
    'finally',
    'in conclusion',
    'to summarize',
    'in summary',
  ];

  constructor(
    outlineParser: OutlineParser,
    searchService: SearchService,
    manuscriptPath: string,
    threshold: number = 0.3
  ) {
    this.outlineParser = outlineParser;
    this.searchService = searchService;
    this.manuscriptPath = manuscriptPath;
    this.threshold = threshold;
  }

  /**
   * Analyze coverage for a specific section.
   * 
   * Requirement 5.1: Analyze each sentence in the section
   * Requirement 5.2: Classify each sentence as supported/unsupported/non-factual
   * Requirement 5.3: Calculate section coverage percentage
   * Requirement 5.4: Generate targeted search queries for unsupported sentences
   * Requirement 5.5: Return sentence-level results with claim matches
   */
  async analyzeSectionCoverage(sectionId: string): Promise<SectionCoverage> {
    // Get the section from the outline parser
    const section = this.outlineParser.getSectionById(sectionId);
    
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    // Parse section content into sentences
    const sectionText = section.content.join('\n');
    const sentences = this.splitIntoSentences(sectionText);

    // Analyze each sentence
    const sentenceDetails: SentenceCoverage[] = [];
    let factualSentences = 0;
    let supportedSentences = 0;

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) continue;

      // Classify the sentence
      const type = this.classifySentence(trimmed);

      // Only search for claims if the sentence is factual
      let matchingClaims: ClaimMatch[] = [];
      let supported = false;
      let suggestedSearches: string[] = [];

      if (type === 'factual') {
        factualSentences++;

        // Search for matching claims
        matchingClaims = await this.searchService.searchByQuestion(
          trimmed,
          this.threshold
        );

        supported = matchingClaims.length > 0;
        if (supported) {
          supportedSentences++;
        } else {
          // Generate search queries for unsupported sentences
          suggestedSearches = this.generateSearchQuery(trimmed);
        }
      }

      sentenceDetails.push({
        text: trimmed,
        type,
        supported,
        matchingClaims,
        suggestedSearches,
      });
    }

    // Calculate coverage percentage
    const coveragePercentage =
      factualSentences > 0 ? (supportedSentences / factualSentences) * 100 : 0;

    return {
      sectionId: section.id,
      sectionTitle: section.title,
      totalSentences: sentences.length,
      factualSentences,
      supportedSentences,
      coveragePercentage,
      sentenceDetails,
    };
  }

  /**
   * Analyze coverage for the entire manuscript.
   * 
   * Requirement 5.1: Analyze each sentence in all sections
   * Requirement 5.3: Calculate coverage for all sections
   */
  async analyzeManuscriptCoverage(): Promise<ManuscriptCoverage> {
    // Parse the manuscript file
    await this.outlineParser.parse(this.manuscriptPath);
    const sections = this.outlineParser.getSections();

    // Analyze each section
    const sectionCoverages: SectionCoverage[] = [];
    let totalCoverage = 0;

    for (const section of sections) {
      const coverage = await this.analyzeSectionCoverage(section.id);
      sectionCoverages.push(coverage);
      totalCoverage += coverage.coveragePercentage;
    }

    // Calculate average coverage
    const averageCoverage =
      sections.length > 0 ? totalCoverage / sections.length : 0;

    // Identify weakest sections (bottom 3 by coverage percentage)
    const sortedSections = [...sectionCoverages].sort(
      (a, b) => a.coveragePercentage - b.coveragePercentage
    );
    const weakestSections = sortedSections.slice(0, 3);

    return {
      totalSections: sections.length,
      averageCoverage,
      sections: sectionCoverages,
      weakestSections,
    };
  }

  /**
   * Classify a sentence as factual, opinion, transition, or question.
   * 
   * Requirement 5.2: Classify sentences
   * 
   * Classification rules:
   * - Question: Ends with '?'
   * - Opinion: Contains opinion indicators (I think, arguably, perhaps, etc.)
   * - Transition: Starts with or contains transition words (however, furthermore, etc.)
   * - Factual: Declarative statement that doesn't fall into above categories
   */
  classifySentence(sentence: string): SentenceType {
    const trimmed = sentence.trim();
    const lower = trimmed.toLowerCase();

    // Check if it's a question
    if (trimmed.endsWith('?')) {
      return 'question';
    }

    // Check for opinion indicators
    for (const indicator of this.OPINION_INDICATORS) {
      if (lower.includes(indicator)) {
        return 'opinion';
      }
    }

    // Check for transition indicators
    // Transitions often start sentences or appear after punctuation
    for (const indicator of this.TRANSITION_INDICATORS) {
      // Check if sentence starts with the transition word
      if (lower.startsWith(indicator)) {
        return 'transition';
      }
      // Check if transition appears after punctuation (comma, semicolon)
      const transitionPattern = new RegExp(`[,;]\\s+${indicator}\\b`, 'i');
      if (transitionPattern.test(lower)) {
        return 'transition';
      }
    }

    // Default to factual
    return 'factual';
  }

  /**
   * Generate targeted search queries for an unsupported sentence.
   * 
   * Requirement 5.4: Generate targeted search queries for unsupported sentences
   * 
   * Strategy:
   * 1. Extract key terms (nouns, verbs, domain-specific terms)
   * 2. Remove stop words
   * 3. Generate 1-3 queries of varying specificity
   */
  generateSearchQuery(sentence: string): string[] {
    const queries: string[] = [];

    // Extract key terms
    const keyTerms = this.extractKeyTerms(sentence);

    if (keyTerms.length === 0) {
      return [];
    }

    // Query 1: All key terms (most specific)
    if (keyTerms.length >= 2) {
      queries.push(keyTerms.join(' '));
    }

    // Query 2: Top 3-4 key terms (medium specificity)
    if (keyTerms.length >= 4) {
      queries.push(keyTerms.slice(0, 4).join(' '));
    }

    // Query 3: Top 2-3 key terms (broader)
    if (keyTerms.length >= 3) {
      queries.push(keyTerms.slice(0, 3).join(' '));
    }

    // If we only have 1-2 key terms, just use them
    if (queries.length === 0) {
      queries.push(keyTerms.join(' '));
    }

    // Remove duplicates and return
    return [...new Set(queries)];
  }

  /**
   * Helper: Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Split on period, exclamation, question mark followed by space or end
    const sentences = text
      .split(/[.!?]+\s+|[.!?]+$/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return sentences;
  }

  /**
   * Helper: Extract key terms from a sentence
   * 
   * Removes stop words and extracts meaningful terms for search queries.
   */
  private extractKeyTerms(sentence: string): string[] {
    // Common stop words to filter out
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
      'it',
      'its',
      'they',
      'their',
      'them',
      'we',
      'our',
      'us',
      'you',
      'your',
      'he',
      'she',
      'his',
      'her',
      'him',
    ]);

    // Extract words (alphanumeric sequences, including hyphens)
    const words = sentence
      .toLowerCase()
      .match(/\b[a-z0-9-]+\b/g) || [];

    // Filter out stop words and very short words
    const keyTerms = words
      .filter((word) => !stopWords.has(word) && word.length > 2)
      .slice(0, 6); // Take top 6 key terms

    return keyTerms;
  }
}
