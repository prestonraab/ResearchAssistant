import type { Claim, ClaimCluster, SynthesisOptions, EmbeddingService } from '@research-assistant/core';

/**
 * SynthesisEngine groups related claims by theme and generates prose from claim groups.
 * 
 * This class implements:
 * - Requirement 9.1: Group claims by theme using clustering
 * - Requirement 9.2: Generate draft paragraphs from claim groups
 * - Requirement 9.3: Preserve citation references in generated text
 * - Requirement 9.4: Format citations according to style
 */
export class SynthesisEngine {
  private embeddingService: EmbeddingService;

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Group claims by theme using semantic similarity clustering.
   * Uses hierarchical clustering with cosine similarity.
   * 
   * @param claims Array of claims to cluster
   * @param similarityThreshold Minimum similarity for claims to be in same cluster (default 0.6)
   * @returns Map of theme labels to claim clusters
   */
  async groupClaimsByTheme(
    claims: Claim[],
    similarityThreshold: number = 0.6
  ): Promise<Map<string, Claim[]>> {
    if (claims.length === 0) {
      return new Map();
    }

    // Generate embeddings for all claims
    const claimTexts = claims.map(c => c.text);
    const embeddings = await this.embeddingService.generateBatch(claimTexts);

    // Build similarity matrix
    const clusters: Claim[][] = [];
    const clusterEmbeddings: number[][] = [];
    const assigned = new Set<number>();

    // Greedy clustering: iterate through claims and assign to existing cluster or create new one
    for (let i = 0; i < claims.length; i++) {
      if (assigned.has(i)) {
        continue;
      }

      // Find best matching cluster
      let bestClusterIdx = -1;
      let bestSimilarity = similarityThreshold;

      for (let j = 0; j < clusterEmbeddings.length; j++) {
        const similarity = this.embeddingService.cosineSimilarity(
          embeddings[i],
          clusterEmbeddings[j]
        );

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestClusterIdx = j;
        }
      }

      if (bestClusterIdx >= 0) {
        // Add to existing cluster
        clusters[bestClusterIdx].push(claims[i]);
        
        // Update cluster centroid (average of all embeddings in cluster)
        const clusterSize = clusters[bestClusterIdx].length;
        const centroid = clusterEmbeddings[bestClusterIdx];
        for (let k = 0; k < centroid.length; k++) {
          centroid[k] = (centroid[k] * (clusterSize - 1) + embeddings[i][k]) / clusterSize;
        }
      } else {
        // Create new cluster
        clusters.push([claims[i]]);
        clusterEmbeddings.push([...embeddings[i]]);
      }

      assigned.add(i);
    }

    // Generate theme labels for each cluster
    const themeMap = new Map<string, Claim[]>();
    for (const cluster of clusters) {
      const theme = this.generateThemeLabel(cluster);
      themeMap.set(theme, cluster);
    }

    return themeMap;
  }

  /**
   * Generate a descriptive theme label for a cluster of claims.
   * Extracts common keywords and concepts from claim texts.
   * 
   * @param claims Claims in the cluster
   * @returns A short theme label (2-4 words)
   */
  private generateThemeLabel(claims: Claim[]): string {
    if (claims.length === 0) {
      return 'Uncategorized';
    }

    if (claims.length === 1) {
      // For single claim, use first few words
      const words = claims[0].text.split(/\s+/).slice(0, 4);
      return words.join(' ');
    }

    // Extract keywords from all claims
    const allWords: string[] = [];
    for (const claim of claims) {
      const words = this.tokenize(claim.text);
      allWords.push(...words);
    }

    // Count word frequencies
    const wordFreq = new Map<string, number>();
    for (const word of allWords) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Filter to words that appear in multiple claims
    const commonWords = Array.from(wordFreq.entries())
      .filter(([_, freq]) => freq >= Math.min(2, claims.length))
      .sort((a, b) => b[1] - a[1])
      .map(([word, _]) => word);

    // Take top 2-3 keywords
    const keywords = commonWords.slice(0, 3);
    
    if (keywords.length === 0) {
      // Fallback: use category if all claims have same category
      const categories = new Set(claims.map(c => c.category));
      if (categories.size === 1) {
        return Array.from(categories)[0];
      }
      return 'Mixed Topics';
    }

    return keywords.join(' ');
  }

  /**
   * Generate a draft paragraph synthesizing multiple claims.
   * 
   * @param options Synthesis options including claims, style, and formatting preferences
   * @returns Generated paragraph text with citations
   */
  async generateParagraph(options: SynthesisOptions): Promise<string> {
    const { claims, style, includeCitations, maxLength } = options;

    if (claims.length === 0) {
      return '';
    }

    // Sort claims by source for logical flow
    const sortedClaims = [...claims].sort((a, b) => {
      // Sort by year (extracted from source AuthorYear format)
      const yearA = this.extractYear(a.source);
      const yearB = this.extractYear(b.source);
      return yearA - yearB;
    });

    // Generate paragraph based on style
    let paragraph = '';
    
    switch (style) {
      case 'narrative':
        paragraph = this.generateNarrativeParagraph(sortedClaims, includeCitations);
        break;
      case 'analytical':
        paragraph = this.generateAnalyticalParagraph(sortedClaims, includeCitations);
        break;
      case 'descriptive':
        paragraph = this.generateDescriptiveParagraph(sortedClaims, includeCitations);
        break;
    }

    // Truncate if exceeds max length
    if (maxLength > 0 && paragraph.length > maxLength) {
      paragraph = paragraph.substring(0, maxLength - 3) + '...';
    }

    return paragraph;
  }

  /**
   * Generate narrative-style paragraph (tells a story, shows progression).
   */
  private generateNarrativeParagraph(claims: Claim[], includeCitations: boolean): string {
    const sentences: string[] = [];

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      const citation = includeCitations ? this.formatCitation(claim) : '';
      
      if (i === 0) {
        // Opening sentence
        sentences.push(`${claim.text}${citation}.`);
      } else if (i === claims.length - 1) {
        // Closing sentence
        sentences.push(`More recently, ${this.lowercaseFirst(claim.text)}${citation}.`);
      } else {
        // Middle sentences with transitions
        const transition = this.selectTransition(i, claims.length, 'narrative');
        sentences.push(`${transition} ${this.lowercaseFirst(claim.text)}${citation}.`);
      }
    }

    return sentences.join(' ');
  }

  /**
   * Generate analytical-style paragraph (compares, contrasts, evaluates).
   */
  private generateAnalyticalParagraph(claims: Claim[], includeCitations: boolean): string {
    const sentences: string[] = [];

    // Group claims by similarity for comparison
    if (claims.length === 1) {
      const claim = claims[0];
      const citation = includeCitations ? this.formatCitation(claim) : '';
      return `${claim.text}${citation}.`;
    }

    // Opening with first claim
    const firstClaim = claims[0];
    const firstCitation = includeCitations ? this.formatCitation(firstClaim) : '';
    sentences.push(`${firstClaim.text}${firstCitation}.`);

    // Compare/contrast with other claims
    for (let i = 1; i < claims.length; i++) {
      const claim = claims[i];
      const citation = includeCitations ? this.formatCitation(claim) : '';
      
      const transition = this.selectTransition(i, claims.length, 'analytical');
      sentences.push(`${transition} ${this.lowercaseFirst(claim.text)}${citation}.`);
    }

    return sentences.join(' ');
  }

  /**
   * Generate descriptive-style paragraph (lists, describes, enumerates).
   */
  private generateDescriptiveParagraph(claims: Claim[], includeCitations: boolean): string {
    if (claims.length === 1) {
      const claim = claims[0];
      const citation = includeCitations ? this.formatCitation(claim) : '';
      return `${claim.text}${citation}.`;
    }

    const sentences: string[] = [];

    // Opening statement
    sentences.push(`Several key findings have been reported in this area.`);

    // List claims
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      const citation = includeCitations ? this.formatCitation(claim) : '';
      
      if (i === 0) {
        sentences.push(`First, ${this.lowercaseFirst(claim.text)}${citation}.`);
      } else if (i === claims.length - 1) {
        sentences.push(`Finally, ${this.lowercaseFirst(claim.text)}${citation}.`);
      } else {
        sentences.push(`Additionally, ${this.lowercaseFirst(claim.text)}${citation}.`);
      }
    }

    return sentences.join(' ');
  }

  /**
   * Generate transition phrases between claims.
   */
  private selectTransition(index: number, total: number, style: string): string {
    const narrativeTransitions = [
      'Subsequently,',
      'Building on this,',
      'Following this work,',
      'In a related study,',
      'Extending this research,'
    ];

    const analyticalTransitions = [
      'Similarly,',
      'In contrast,',
      'However,',
      'Conversely,',
      'On the other hand,',
      'Complementing this,'
    ];

    const transitions = style === 'analytical' ? analyticalTransitions : narrativeTransitions;
    return transitions[index % transitions.length];
  }

  /**
   * Generate transitions between paragraphs or claim groups.
   * 
   * @param claims Claims to generate transitions for
   * @returns Array of transition phrases
   */
  generateTransitions(claims: Claim[]): string[] {
    const transitions: string[] = [];

    for (let i = 0; i < claims.length - 1; i++) {
      // Analyze relationship between consecutive claims
      const current = claims[i];
      const next = claims[i + 1];

      // Check if same source
      if (current.source === next.source) {
        transitions.push('In the same study,');
      }
      // Check if same category
      else if (current.category === next.category) {
        transitions.push('Similarly,');
      }
      // Default transition
      else {
        transitions.push('Furthermore,');
      }
    }

    return transitions;
  }

  /**
   * Format citations for claims according to style.
   * Currently uses inline author-year format.
   * 
   * @param claim Claim to format citation for
   * @returns Formatted citation string (e.g., " (Smith2020)")
   */
  formatCitations(claims: Claim[]): string {
    if (claims.length === 0) {
      return '';
    }

    // Collect unique sources
    const sources = new Set<string>();
    for (const claim of claims) {
      if (claim.source) {
        sources.add(claim.source);
      }
    }

    if (sources.size === 0) {
      return '';
    }

    // Format as inline citations
    const sourceList = Array.from(sources).sort();
    
    if (sourceList.length === 1) {
      return ` (${sourceList[0]})`;
    } else if (sourceList.length === 2) {
      return ` (${sourceList[0]}; ${sourceList[1]})`;
    } else {
      // Multiple sources: list first two and add "et al."
      return ` (${sourceList[0]}; ${sourceList[1]}; et al.)`;
    }
  }

  /**
   * Format a single citation.
   */
  private formatCitation(claim: Claim): string {
    if (!claim.source) {
      return '';
    }
    return ` (${claim.source})`;
  }

  /**
   * Extract year from source string (e.g., "Smith2020" -> 2020).
   */
  private extractYear(source: string): number {
    const match = source.match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Convert first character to lowercase.
   */
  private lowercaseFirst(text: string): string {
    if (!text) {
      return text;
    }
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  /**
   * Tokenize text into words (lowercase, remove punctuation).
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2); // Remove short words
  }
}
