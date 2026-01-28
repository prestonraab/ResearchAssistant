import { EmbeddingService } from './EmbeddingService.js';
import {
  Claim,
  SynthesisOptions,
  SynthesisStyle,
} from '../types/index.js';

/**
 * SynthesisEngine generates coherent prose from multiple related claims.
 * 
 * Implements Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */
export class SynthesisEngine {
  private embeddingService: EmbeddingService;

  // Transition phrases for connecting claims
  private readonly TRANSITIONS = {
    addition: [
      'Additionally',
      'Furthermore',
      'Moreover',
      'In addition',
      'Similarly',
      'Likewise',
    ],
    contrast: [
      'However',
      'In contrast',
      'On the other hand',
      'Conversely',
      'Nevertheless',
      'Nonetheless',
    ],
    causation: [
      'Therefore',
      'Consequently',
      'As a result',
      'Thus',
      'Hence',
      'Accordingly',
    ],
    temporal: [
      'Subsequently',
      'Previously',
      'Earlier',
      'Later',
      'Meanwhile',
      'Concurrently',
    ],
    elaboration: [
      'Specifically',
      'In particular',
      'For example',
      'For instance',
      'Notably',
      'Indeed',
    ],
  };

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Group claims by theme using hierarchical clustering.
   * 
   * Requirement 10.1: Group claims by theme using semantic clustering
   * Requirement 10.2: Generate theme labels for each cluster
   * 
   * @param claims Array of claims to group
   * @param threshold Similarity threshold for clustering (default 0.6)
   * @returns Map of theme labels to claim arrays
   */
  async groupClaimsByTheme(
    claims: Claim[],
    threshold: number = 0.6
  ): Promise<Map<string, Claim[]>> {
    if (claims.length === 0) {
      return new Map();
    }

    // Generate embeddings for all claims
    const claimTexts = claims.map((c) => c.text);
    const embeddings = await this.embeddingService.generateBatch(claimTexts);

    // Perform hierarchical clustering
    const clusters: Claim[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < claims.length; i++) {
      if (used.has(i)) {
        continue;
      }

      const cluster: Claim[] = [claims[i]];
      used.add(i);

      // Find similar claims
      for (let j = i + 1; j < claims.length; j++) {
        if (used.has(j)) {
          continue;
        }

        const similarity = this.embeddingService.cosineSimilarity(
          embeddings[i],
          embeddings[j]
        );

        if (similarity >= threshold) {
          cluster.push(claims[j]);
          used.add(j);
        }
      }

      clusters.push(cluster);
    }

    // Generate theme labels for each cluster
    const themeMap = new Map<string, Claim[]>();

    for (const cluster of clusters) {
      const themeLabel = this.generateThemeLabel(cluster);
      themeMap.set(themeLabel, cluster);
    }

    return themeMap;
  }

  /**
   * Generate a paragraph from claims with specified style.
   * 
   * Requirement 10.3: Support narrative, analytical, and descriptive styles
   * Requirement 10.4: Preserve citation references in (AuthorYear) format
   * Requirement 10.5: Generate appropriate transition phrases between claims
   * 
   * @param options Synthesis options including claims, style, and formatting
   * @returns Generated paragraph text
   */
  async generateParagraph(options: SynthesisOptions): Promise<string> {
    const { claims, style, includeCitations, maxLength } = options;

    if (claims.length === 0) {
      return '';
    }

    // Sort claims by year for logical flow
    const sortedClaims = [...claims].sort((a, b) => {
      const yearA = this.extractYear(a.primaryQuote?.source || '');
      const yearB = this.extractYear(b.primaryQuote?.source || '');
      return yearA - yearB;
    });

    // Generate paragraph based on style
    let paragraph = '';

    switch (style) {
      case 'narrative':
        paragraph = this.generateNarrative(sortedClaims, includeCitations);
        break;
      case 'analytical':
        paragraph = this.generateAnalytical(sortedClaims, includeCitations);
        break;
      case 'descriptive':
        paragraph = this.generateDescriptive(sortedClaims, includeCitations);
        break;
    }

    // Truncate if exceeds max length
    if (maxLength > 0 && paragraph.length > maxLength) {
      paragraph = paragraph.substring(0, maxLength - 3) + '...';
    }

    return paragraph;
  }

  /**
   * Generate transition phrases for connecting claims.
   * 
   * Requirement 10.5: Generate appropriate transition phrases
   * 
   * @param claims Array of claims to generate transitions for
   * @returns Array of transition phrases
   */
  generateTransitions(claims: Claim[]): string[] {
    if (claims.length <= 1) {
      return [];
    }

    const transitions: string[] = [];

    for (let i = 1; i < claims.length; i++) {
      const prevClaim = claims[i - 1];
      const currClaim = claims[i];

      // Determine transition type based on claim relationship
      const transitionType = this.determineTransitionType(prevClaim, currClaim);
      const transitionPhrases = this.TRANSITIONS[transitionType];

      // Select a random transition phrase
      const randomIndex = Math.floor(Math.random() * transitionPhrases.length);
      transitions.push(transitionPhrases[randomIndex]);
    }

    return transitions;
  }

  /**
   * Generate a theme label for a cluster of claims.
   * 
   * Requirement 10.2: Generate theme labels based on common keywords
   * 
   * @param claims Claims in the cluster
   * @returns Theme label
   */
  private generateThemeLabel(claims: Claim[]): string {
    if (claims.length === 0) {
      return 'Uncategorized';
    }

    // Extract keywords from all claims
    const allWords: string[] = [];
    for (const claim of claims) {
      const words = this.extractKeywords(claim.text);
      allWords.push(...words);
    }

    // Count word frequencies
    const wordCounts = new Map<string, number>();
    for (const word of allWords) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    // Find most common keywords (appearing in multiple claims)
    const commonKeywords = Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= Math.min(2, claims.length))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word, _]) => word);

    if (commonKeywords.length === 0) {
      // Fallback: use category if all claims have same category
      const categories = claims.map((c) => c.category);
      const uniqueCategories = new Set(categories);
      if (uniqueCategories.size === 1) {
        return categories[0];
      }
      return 'Mixed Topics';
    }

    // Capitalize first letter of each keyword
    const capitalizedKeywords = commonKeywords.map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1)
    );

    return capitalizedKeywords.join(' and ');
  }

  /**
   * Extract keywords from text (nouns, verbs, adjectives).
   * 
   * @param text Text to extract keywords from
   * @returns Array of keywords
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction: remove stop words and short words
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
      'be',
      'been',
      'being',
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
      'must',
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
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));

    return words;
  }

  /**
   * Generate narrative-style paragraph.
   * Tells a story with progression and temporal flow.
   * 
   * @param claims Sorted claims
   * @param includeCitations Whether to include citations
   * @returns Narrative paragraph
   */
  private generateNarrative(claims: Claim[], includeCitations: boolean): string {
    const sentences: string[] = [];

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      let sentence = claim.text;

      // Add citation if requested
      if (includeCitations) {
        sentence = this.addCitation(sentence, claim.primaryQuote?.source || '');
      }

      // Add transition for subsequent claims
      if (i > 0) {
        const transition = this.selectTransition(['temporal', 'addition', 'elaboration']);
        sentence = `${transition}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
      }

      sentences.push(sentence);
    }

    return sentences.join(' ');
  }

  /**
   * Generate analytical-style paragraph.
   * Compares and contrasts different findings.
   * 
   * @param claims Sorted claims
   * @param includeCitations Whether to include citations
   * @returns Analytical paragraph
   */
  private generateAnalytical(claims: Claim[], includeCitations: boolean): string {
    const sentences: string[] = [];

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      let sentence = claim.text;

      // Add citation if requested
      if (includeCitations) {
        sentence = this.addCitation(sentence, claim.primaryQuote?.source || '');
      }

      // Add transition for subsequent claims
      if (i > 0) {
        // Alternate between contrast and addition
        const transitionType = i % 2 === 0 ? 'contrast' : 'addition';
        const transition = this.selectTransition([transitionType, 'elaboration']);
        sentence = `${transition}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
      }

      sentences.push(sentence);
    }

    return sentences.join(' ');
  }

  /**
   * Generate descriptive-style paragraph.
   * Lists and enumerates findings systematically.
   * 
   * @param claims Sorted claims
   * @param includeCitations Whether to include citations
   * @returns Descriptive paragraph
   */
  private generateDescriptive(claims: Claim[], includeCitations: boolean): string {
    const sentences: string[] = [];

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      let sentence = claim.text;

      // Add citation if requested
      if (includeCitations) {
        sentence = this.addCitation(sentence, claim.primaryQuote?.source || '');
      }

      // Add transition for subsequent claims
      if (i > 0) {
        const transition = this.selectTransition(['addition', 'elaboration']);
        sentence = `${transition}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
      }

      sentences.push(sentence);
    }

    return sentences.join(' ');
  }

  /**
   * Add citation to a sentence in (AuthorYear) format.
   * 
   * Requirement 10.4: Preserve citations in (AuthorYear) format
   * 
   * @param sentence The sentence text
   * @param source The source identifier (e.g., "Smith2020")
   * @returns Sentence with citation
   */
  private addCitation(sentence: string, source: string): string {
    // Remove trailing period if present
    let text = sentence.trim();
    const hasPeriod = text.endsWith('.');
    if (hasPeriod) {
      text = text.slice(0, -1);
    }

    // Add citation in (AuthorYear) format
    const citation = `(${source})`;
    
    // Add period back
    return `${text} ${citation}.`;
  }

  /**
   * Extract year from source identifier.
   * 
   * @param source Source identifier (e.g., "Smith2020")
   * @returns Year as number
   */
  private extractYear(source: string): number {
    // Extract 4-digit year from source
    const match = source.match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Determine transition type based on claim relationship.
   * 
   * @param prevClaim Previous claim
   * @param currClaim Current claim
   * @returns Transition type
   */
  private determineTransitionType(
    prevClaim: Claim,
    currClaim: Claim
  ): keyof typeof this.TRANSITIONS {
    // Check if claims are from same source
    if (prevClaim.primaryQuote?.source === currClaim.primaryQuote?.source) {
      return 'elaboration';
    }

    // Check if claims have same category
    if (prevClaim.category === currClaim.category) {
      return 'addition';
    }

    // Check if claims are from different time periods
    const prevYear = this.extractYear(prevClaim.primaryQuote?.source || '');
    const currYear = this.extractYear(currClaim.primaryQuote?.source || '');
    if (Math.abs(currYear - prevYear) > 5) {
      return 'temporal';
    }

    // Check for contrasting keywords
    const contrastKeywords = [
      'however',
      'but',
      'although',
      'despite',
      'while',
      'whereas',
      'not',
      'no',
      'never',
    ];

    const currLower = currClaim.text.toLowerCase();
    const hasContrast = contrastKeywords.some((keyword) =>
      currLower.includes(keyword)
    );

    if (hasContrast) {
      return 'contrast';
    }

    // Default to addition
    return 'addition';
  }

  /**
   * Select a random transition phrase from specified types.
   * 
   * @param types Array of transition types to choose from
   * @returns Random transition phrase
   */
  private selectTransition(types: Array<keyof typeof this.TRANSITIONS>): string {
    // Randomly select a type
    const randomType = types[Math.floor(Math.random() * types.length)];
    const phrases = this.TRANSITIONS[randomType];

    // Randomly select a phrase
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
}
