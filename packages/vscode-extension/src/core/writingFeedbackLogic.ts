import type { Claim } from '@research-assistant/core';

/**
 * Pure logic for writing feedback analysis
 * No VSCode dependencies - fully testable with real data
 */

export interface Sentence {
  text: string;
  offset: number;
}

export interface VagueTermMatch {
  term: string;
  offset: number;
  length: number;
}

export interface UnsupportedStatement {
  text: string;
  offset: number;
  length: number;
  suggestedClaims: Array<{ id: string; text: string }>;
}

export interface WritingAnalysis {
  sentences: Sentence[];
  vagueTermMatches: VagueTermMatch[];
  unsupportedStatements: UnsupportedStatement[];
}

export interface FeedbackItem {
  type: 'vagueness' | 'missing-citation';
  offset: number;
  length: number;
  message: string;
  suggestions?: string[];
}

// Common vague terms to detect
const VAGUE_TERMS = [
  'some', 'many', 'often', 'sometimes', 'usually', 'generally',
  'mostly', 'frequently', 'rarely', 'seldom', 'occasionally',
  'several', 'various', 'numerous', 'a lot', 'a few',
  'quite', 'rather', 'fairly', 'somewhat', 'relatively',
  'pretty', 'very', 'extremely', 'highly', 'significantly'
];

// Pattern to detect claim references (e.g., C_01, C_123)
const CLAIM_REFERENCE_PATTERN = /\bC_\d+\b/g;

// Factual indicators that suggest a statement needs citation
const FACTUAL_INDICATORS = [
  'research', 'study', 'studies', 'found', 'showed', 'demonstrated',
  'evidence', 'suggests', 'indicates', 'reveals', 'confirms',
  'reported', 'observed', 'measured', 'analyzed', 'compared',
  'results', 'findings', 'data', 'analysis', 'method', 'approach',
  'technique', 'algorithm', 'model', 'framework', 'system',
  'performance', 'accuracy', 'improvement', 'increase', 'decrease',
  'significant', 'effective', 'efficient', 'better', 'worse',
  'higher', 'lower', 'more', 'less', 'than'
];

/**
 * Split text into sentences with their positions
 * Pure function - no side effects
 */
export function splitIntoSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  
  // Simple sentence splitting on period, exclamation, or question mark
  // followed by whitespace or end of string
  const sentencePattern = /[^.!?]+[.!?]+(?:\s+|$)/g;
  let match;

  while ((match = sentencePattern.exec(text)) !== null) {
    const sentenceText = match[0].trim();
    
    // Skip very short sentences (likely abbreviations or list items)
    if (sentenceText.length < 20) {
      continue;
    }

    // Skip sentences that are headers (start with #)
    if (sentenceText.startsWith('#')) {
      continue;
    }

    // Skip sentences that are list items
    if (/^\s*[-*+]\s/.test(sentenceText)) {
      continue;
    }

    sentences.push({
      text: sentenceText,
      offset: match.index
    });
  }

  return sentences;
}

/**
 * Find vague terms in a sentence
 * Pure function - returns all matches
 */
export function findVagueTerms(sentence: Sentence): VagueTermMatch[] {
  const matches: VagueTermMatch[] = [];

  for (const term of VAGUE_TERMS) {
    // Create word boundary pattern for the term
    const pattern = new RegExp(`\\b${term}\\b`, 'gi');
    let match;

    while ((match = pattern.exec(sentence.text)) !== null) {
      matches.push({
        term: match[0],
        offset: sentence.offset + match.index,
        length: match[0].length
      });
    }
  }

  return matches;
}

/**
 * Check if a sentence is an unsupported statement
 * A statement is unsupported if it:
 * 1. Makes a factual claim (contains certain keywords)
 * 2. Does not have a nearby claim reference
 * 3. Is not a question or header
 */
export function isUnsupportedStatement(sentence: Sentence): boolean {
  const text = sentence.text;

  // Skip questions
  if (text.includes('?')) {
    return false;
  }

  // Skip if it already has a claim reference
  if (CLAIM_REFERENCE_PATTERN.test(text)) {
    return false;
  }

  // Check if it's a factual statement (contains certain keywords)
  const lowerText = text.toLowerCase();
  const hasFactualIndicator = FACTUAL_INDICATORS.some(indicator => 
    lowerText.includes(indicator)
  );

  return hasFactualIndicator;
}

/**
 * Extract keywords from text for matching
 * Pure function - returns array of meaningful keywords
 */
export function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'they', 'their', 'them'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word));

  return words;
}

/**
 * Get suggested claims that might support a statement
 * Pure function - uses keyword-based matching
 */
export function getSuggestedClaims(
  statementText: string,
  allClaims: Claim[]
): Array<{ id: string; text: string }> {
  // Simple keyword-based matching
  const keywords = extractKeywords(statementText);
  
  const scoredClaims = allClaims.map(claim => {
    let score = 0;
    const claimLower = claim.text.toLowerCase();
    
    for (const keyword of keywords) {
      if (claimLower.includes(keyword)) {
        score++;
      }
    }
    
    return { claim, score };
  });

  // Return top matches with score > 0
  return scoredClaims
    .filter(sc => sc.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(sc => ({ id: sc.claim.id, text: sc.claim.text }));
}

/**
 * Analyze text for writing quality issues
 * Pure function - returns analysis of vague terms and unsupported statements
 */
export function analyzeWritingQuality(text: string, allClaims: Claim[]): WritingAnalysis {
  const sentences = splitIntoSentences(text);
  const vagueTermMatches: VagueTermMatch[] = [];
  const unsupportedStatements: UnsupportedStatement[] = [];

  for (const sentence of sentences) {
    // Find vague terms in this sentence
    const vagueMatches = findVagueTerms(sentence);
    vagueTermMatches.push(...vagueMatches);

    // Check if this is an unsupported statement
    if (isUnsupportedStatement(sentence)) {
      const suggestions = getSuggestedClaims(sentence.text, allClaims);
      unsupportedStatements.push({
        text: sentence.text,
        offset: sentence.offset,
        length: sentence.text.length,
        suggestedClaims: suggestions
      });
    }
  }

  return {
    sentences,
    vagueTermMatches,
    unsupportedStatements
  };
}

/**
 * Generate feedback items from writing analysis
 * Pure function - converts analysis into actionable feedback
 */
export function generateFeedbackItems(analysis: WritingAnalysis): FeedbackItem[] {
  const feedbackItems: FeedbackItem[] = [];

  // Generate feedback for vague terms
  for (const match of analysis.vagueTermMatches) {
    feedbackItems.push({
      type: 'vagueness',
      offset: match.offset,
      length: match.length,
      message: `⚠️ **Vague term detected**: "${match.term}"\n\n` +
        `Consider providing specific evidence or data to support this statement.\n\n` +
        `💡 **Suggestion**: Add a claim reference (e.g., C_01) to strengthen this statement.`,
      suggestions: ['Add a claim reference', 'Provide specific data']
    });
  }

  // Generate feedback for unsupported statements
  for (const statement of analysis.unsupportedStatements) {
    let message = `⚠️ **Unsupported statement**\n\n` +
      `This statement lacks a citation or claim reference.\n\n`;

    const suggestions: string[] = [];

    if (statement.suggestedClaims.length > 0) {
      message += `💡 **Suggested claims**:\n`;
      for (const claim of statement.suggestedClaims.slice(0, 3)) {
        const claimPreview = claim.text.length > 80 
          ? claim.text.substring(0, 80) + '...'
          : claim.text;
        message += `- **${claim.id}**: ${claimPreview}\n`;
        suggestions.push(`Add ${claim.id}`);
      }
    } else {
      message += `💡 **Suggestion**: Add a claim reference (e.g., C_01) or search for relevant evidence.`;
      suggestions.push('Add a claim reference', 'Search for evidence');
    }

    feedbackItems.push({
      type: 'missing-citation',
      offset: statement.offset,
      length: statement.length,
      message,
      suggestions
    });
  }

  return feedbackItems;
}
