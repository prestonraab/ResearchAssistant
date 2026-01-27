import { PaperRanker as CorePaperRanker, EmbeddingService, OutlineParser } from '@research-assistant/core';
import type { PaperMetadata, RankedPaper, OutlineSection } from '@research-assistant/core';

export interface RankingConfig {
  citationBoostFactor: number;
  citationThreshold: number;
  wordsPerMinute: number;
  defaultPageWordCount: number;
}

/**
 * PaperRanker wrapper for VS Code extension.
 * Wraps the core PaperRanker to provide convenience methods
 * for working with outline sections and additional filtering.
 * 
 * Validates Requirements 4.1, 4.2, 4.3, 4.4
 */
export class PaperRanker {
  private coreRanker: CorePaperRanker;
  private config: RankingConfig;

  constructor(
    embeddingService: EmbeddingService,
    outlineParser: OutlineParser,
    config: Partial<RankingConfig> = {}
  ) {
    this.config = {
      citationBoostFactor: config.citationBoostFactor ?? 0.1,
      citationThreshold: config.citationThreshold ?? 50,
      wordsPerMinute: config.wordsPerMinute ?? 200,
      defaultPageWordCount: config.defaultPageWordCount ?? 500
    };

    this.coreRanker = new CorePaperRanker(
      embeddingService,
      outlineParser,
      this.config.citationThreshold,
      this.config.citationBoostFactor,
      this.config.wordsPerMinute,
      this.config.defaultPageWordCount
    );
  }

  /**
   * Rank papers by relevance to a section.
   * 
   * @param papers Array of papers to rank
   * @param section The outline section to rank papers for
   * @param citedByPapers Optional set of paper IDs that cite each paper (for citation boost)
   * @returns Array of ranked papers, sorted by relevance (descending)
   * 
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */
  async rankPapers(
    papers: PaperMetadata[],
    section: OutlineSection,
    citedByPapers?: Map<string, Set<string>>
  ): Promise<RankedPaper[]> {
    // Use core ranker to rank papers for section
    return this.coreRanker.rankPapersForSection(section.id, papers);
  }

  /**
   * Calculate estimated reading time for a paper.
   * 
   * @param paper The paper to calculate reading time for
   * @returns Estimated reading time in minutes
   * 
   * Validates: Requirement 4.4
   */
  calculateReadingTime(paper: PaperMetadata): number {
    return this.coreRanker.calculateReadingTime(paper);
  }

  /**
   * Filter papers by minimum relevance threshold.
   * Useful for showing only relevant papers to users.
   * 
   * @param rankedPapers Array of ranked papers
   * @param threshold Minimum relevance score (0-1)
   * @returns Filtered array of papers above threshold
   */
  filterByRelevance(
    rankedPapers: RankedPaper[],
    threshold: number = 0.3
  ): RankedPaper[] {
    return rankedPapers.filter(rp => rp.relevanceScore >= threshold);
  }

  /**
   * Group papers by reading time ranges.
   * Useful for helping users choose papers based on available time.
   * 
   * @param rankedPapers Array of ranked papers
   * @returns Map of time range to papers
   */
  groupByReadingTime(
    rankedPapers: RankedPaper[]
  ): Map<string, RankedPaper[]> {
    const groups = new Map<string, RankedPaper[]>();
    
    const ranges = [
      { label: 'Quick read (< 15 min)', max: 15 },
      { label: 'Short (15-30 min)', min: 15, max: 30 },
      { label: 'Medium (30-60 min)', min: 30, max: 60 },
      { label: 'Long (> 60 min)', min: 60 }
    ];

    for (const range of ranges) {
      const papers = rankedPapers.filter(rp => {
        const time = rp.estimatedReadingTime;
        const matchesMin = range.min === undefined || time >= range.min;
        const matchesMax = range.max === undefined || time < range.max;
        return matchesMin && matchesMax;
      });
      
      if (papers.length > 0) {
        groups.set(range.label, papers);
      }
    }

    return groups;
  }

  /**
   * Update ranking configuration.
   * 
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<RankingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current ranking configuration.
   * 
   * @returns Current configuration
   */
  getConfig(): RankingConfig {
    return { ...this.config };
  }
}
