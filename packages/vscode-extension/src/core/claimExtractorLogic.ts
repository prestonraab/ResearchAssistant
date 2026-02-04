/**
 * Pure logic for claim extraction from text
 * No external dependencies - fully testable with real data
 */

export interface ParsedClaim {
  text: string;
  context: string;
  confidence: number;
  type: 'method' | 'result' | 'conclusion' | 'background' | 'challenge' | 'data_source' | 'data_trend' | 'impact' | 'application' | 'phenomenon';
  lineNumber: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Keywords for identifying different types of claims
const METHOD_KEYWORDS = [
  'method', 'approach', 'technique', 'algorithm', 'procedure', 'process',
  'framework', 'model', 'system', 'implementation', 'design', 'architecture',
  'we propose', 'we develop', 'we implement', 'we introduce', 'we present',
  'we use', 'we apply', 'we employ', 'we adopt'
];

const RESULT_KEYWORDS = [
  'result', 'finding', 'outcome', 'performance', 'accuracy', 'precision',
  'recall', 'improvement', 'increase', 'decrease', 'reduction', 'enhancement',
  'we found', 'we observe', 'we demonstrate', 'we show', 'we achieve',
  'our results', 'our findings', 'our experiments', 'our analysis',
  'significantly', 'substantially', 'notably', 'remarkably'
];

const CONCLUSION_KEYWORDS = [
  'conclude', 'conclusion', 'summary', 'therefore', 'thus', 'hence',
  'consequently', 'in conclusion', 'in summary', 'overall', 'finally',
  'we conclude', 'we argue', 'this suggests', 'this indicates',
  'implication', 'implications', 'significance', 'important'
];

const CHALLENGE_KEYWORDS = [
  'challenge', 'problem', 'issue', 'difficulty', 'limitation', 'constraint',
  'obstacle', 'barrier', 'gap', 'lack', 'absence', 'insufficient',
  'however', 'but', 'although', 'despite', 'unfortunately', 'remains',
  'unclear', 'unknown', 'unresolved', 'open question'
];

const BACKGROUND_KEYWORDS = [
  'background', 'context', 'previous', 'prior', 'existing', 'traditional',
  'conventional', 'established', 'known', 'literature', 'research',
  'studies', 'work', 'has been', 'have been', 'is known', 'are known'
];

const DATA_SOURCE_KEYWORDS = [
  'data', 'dataset', 'database', 'corpus', 'collection', 'source',
  'repository', 'archive', 'sample', 'survey', 'measurement', 'observation',
  'we collected', 'we gathered', 'we obtained', 'we used data from'
];

const DATA_TREND_KEYWORDS = [
  'trend', 'pattern', 'increase', 'decrease', 'growth', 'decline',
  'change', 'shift', 'evolution', 'development', 'over time', 'temporal',
  'rising', 'falling', 'growing', 'declining', 'stable', 'fluctuation'
];

const IMPACT_KEYWORDS = [
  'impact', 'effect', 'influence', 'consequence', 'outcome', 'implication',
  'affects', 'influences', 'leads to', 'results in', 'causes', 'contributes',
  'significant impact', 'positive effect', 'negative effect', 'beneficial'
];

const APPLICATION_KEYWORDS = [
  'application', 'use case', 'practical', 'real-world', 'deployment',
  'applied', 'utilized', 'can be used', 'useful for',
  'applicable', 'suitable for', 'enables', 'facilitates', 'supports'
];

const PHENOMENON_KEYWORDS = [
  'phenomenon', 'phenomena', 'observation', 'occurrence', 'event',
  'behavior', 'characteristic', 'property', 'feature', 'aspect',
  'we observe', 'we notice', 'we see', 'appears', 'occurs', 'happens'
];

/**
 * Split text into sentences using simple heuristics
 * Pure function - no side effects
 */
export function splitIntoSentences(text: string): string[] {
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
 * Check if a sentence is declarative (not a question or command)
 * Pure function - returns boolean
 */
export function isDeclarative(sentence: string): boolean {
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
 * Count how many keywords from a list appear in the text
 * Pure function - returns count
 */
export function countKeywordMatches(text: string, keywords: string[]): number {
  let count = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      count++;
    }
  }
  return count;
}

/**
 * Calculate confidence score for a sentence being a claim
 * Higher scores indicate stronger likelihood of being a claim
 * Pure function - returns score between 0 and 1
 */
export function calculateConfidence(sentence: string): number {
  const lowerText = sentence.toLowerCase();
  let score = 0.5; // Base score

  // Boost for method keywords
  const methodMatches = countKeywordMatches(lowerText, METHOD_KEYWORDS);
  score += methodMatches * 0.15;

  // Boost for result keywords
  const resultMatches = countKeywordMatches(lowerText, RESULT_KEYWORDS);
  score += resultMatches * 0.2;

  // Boost for conclusion keywords
  const conclusionMatches = countKeywordMatches(lowerText, CONCLUSION_KEYWORDS);
  score += conclusionMatches * 0.15;

  // Boost for challenge keywords
  const challengeMatches = countKeywordMatches(lowerText, CHALLENGE_KEYWORDS);
  score += challengeMatches * 0.1;

  // Penalty for vague language
  const vagueTerms = ['some', 'many', 'often', 'sometimes', 'may', 'might', 'could', 'possibly'];
  const vagueMatches = countKeywordMatches(lowerText, vagueTerms);
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
 * Categorize a claim by analyzing its content
 * Pure function - returns claim type
 */
export function categorizeClaim(text: string): ParsedClaim['type'] {
  const lowerText = text.toLowerCase();

  // Count keyword matches for each category
  const scores = {
    method: countKeywordMatches(lowerText, METHOD_KEYWORDS),
    result: countKeywordMatches(lowerText, RESULT_KEYWORDS),
    conclusion: countKeywordMatches(lowerText, CONCLUSION_KEYWORDS),
    challenge: countKeywordMatches(lowerText, CHALLENGE_KEYWORDS),
    background: countKeywordMatches(lowerText, BACKGROUND_KEYWORDS),
    data_source: countKeywordMatches(lowerText, DATA_SOURCE_KEYWORDS),
    data_trend: countKeywordMatches(lowerText, DATA_TREND_KEYWORDS),
    impact: countKeywordMatches(lowerText, IMPACT_KEYWORDS),
    application: countKeywordMatches(lowerText, APPLICATION_KEYWORDS),
    phenomenon: countKeywordMatches(lowerText, PHENOMENON_KEYWORDS)
  };

  // Find category with highest score
  let maxScore = 0;
  let category: ParsedClaim['type'] = 'background';

  for (const [key, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      category = key as ParsedClaim['type'];
    }
  }

  // If no strong match, default to background
  if (maxScore === 0) {
    return 'background';
  }

  return category;
}

/**
 * Get context for a sentence (surrounding sentences)
 * Pure function - returns context string
 */
export function getContext(sentences: string[], index: number): string {
  const contextBefore = index > 0 ? sentences[index - 1] : '';
  const contextAfter = index < sentences.length - 1 ? sentences[index + 1] : '';
  
  const context = [contextBefore, contextAfter]
    .filter(s => s.length > 0)
    .join(' ... ');

  return context;
}

/**
 * Parse claims from markdown text
 * Pure function - extracts potential claims with confidence scores
 */
export function parseClaimsFromMarkdown(text: string): ParsedClaim[] {
  const sentences = splitIntoSentences(text);
  const potentialClaims: ParsedClaim[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Skip very short or very long sentences
    if (sentence.length < 20 || sentence.length > 500) {
      continue;
    }

    // Check if sentence is declarative
    if (!isDeclarative(sentence)) {
      continue;
    }

    // Calculate confidence score
    const confidence = calculateConfidence(sentence);
    
    // Only include sentences with reasonable confidence
    if (confidence < 0.3) {
      continue;
    }

    // Categorize the claim
    const type = categorizeClaim(sentence);

    // Get context (surrounding sentences)
    const context = getContext(sentences, i);

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
 * Validate claim structure
 * Pure function - checks if a parsed claim is valid
 */
export function validateClaimStructure(claim: ParsedClaim): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!claim.text || claim.text.trim().length === 0) {
    errors.push('Claim text is required');
  }

  if (claim.text && claim.text.length < 10) {
    errors.push('Claim text is too short (minimum 10 characters)');
  }

  if (claim.text && claim.text.length > 1000) {
    errors.push('Claim text is too long (maximum 1000 characters)');
  }

  // Check confidence score
  if (claim.confidence < 0 || claim.confidence > 1) {
    errors.push('Confidence score must be between 0 and 1');
  }

  if (claim.confidence < 0.3) {
    warnings.push('Low confidence score (< 0.3) - claim may not be significant');
  }

  // Check line number
  if (claim.lineNumber < 1) {
    errors.push('Line number must be positive');
  }

  // Check type
  const validTypes: ParsedClaim['type'][] = [
    'method', 'result', 'conclusion', 'background', 'challenge',
    'data_source', 'data_trend', 'impact', 'application', 'phenomenon'
  ];
  
  if (!validTypes.includes(claim.type)) {
    errors.push(`Invalid claim type: ${claim.type}`);
  }

  // Warnings for potential issues
  if (claim.text && claim.text.includes('?')) {
    warnings.push('Claim text contains a question mark - may not be declarative');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Format category name for database (capitalize first letter of each word)
 * Pure function - returns formatted string
 */
export function formatCategory(type: ParsedClaim['type']): string {
  const categoryMap: Record<ParsedClaim['type'], string> = {
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
