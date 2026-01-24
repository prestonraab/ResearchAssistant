import { OutlineSection } from './outlineParser';
import { EmbeddingService } from './embeddingService';

/**
 * Paper metadata from Zotero
 */
export interface PaperMetadata {
  itemKey: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  doi?: string;
  url?: string;
  citationCount?: number;
  venue?: string;
  pageCount?: number;
  wordCount?: number;
  tags: string[];
  readingStatus?: 'to-read' | 'reading' | 'read';
  readingStarted?: Date;
  readingCompleted?: Date;
  readingDuration?: number; // in minutes
}

/**
 * Ranked paper with relevance score and metadata
 */
export interface RankedPaper {
  paper: PaperMetadata;
  relevanceScore: number;
  semanticSimilarity: number;
  citationBoost: number;
  estimatedReadingTime: number; // in minutes
}

/**
 * Configuration for paper ranking
 */
export interface RankingConfig {
  citationBoostFactor: number; // Multiplier for citation count boost
  citationThreshold: number; // Minimum citations to be considered highly-cited
  wordsPerMinute: number; // Average reading speed
  defaultPageWordCount: number; // Estimated words per page if word count unavailable
}

/**
 * PaperRanker ranks papers by relevance to section content.
 * 
 * Ranking algorithm:
 * 1. Calculate semantic similarity between paper abstract and section content
 * 2. Boost ranking for highly-cited papers (foundation papers)
 * 3. Calculate estimated reading time from paper length
 * 
 * Validates Requirements 4.1, 4.2, 4.3, 4.4
 */
export class PaperRanker {
  private embeddingService: EmbeddingService;
  private config: RankingConfig;

  constructor(
    embeddingService: EmbeddingService,
    config: Partial<RankingConfig> = {}
  ) {
    this.embeddingService = embeddingService;
    this.config = {
      citationBoostFactor: config.citationBoostFactor ?? 0.1,
      citationThreshold: config.citationThreshold ?? 50,
      wordsPerMinute: config.wordsPerMinute ?? 200,
      defaultPageWordCount: config.defaultPageWordCount ?? 500
    };
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
    // Generate embedding for section content
    const sectionText = this.getSectionText(section);
    const sectionEmbedding = await this.embeddingService.generateEmbedding(sectionText);

    // Generate embeddings for all paper abstracts in batch
    const paperAbstracts = papers.map(p => p.abstract || p.title);
    const paperEmbeddings = await this.embeddingService.generateBatch(paperAbstracts);

    // Calculate rankings
    const rankedPapers: RankedPaper[] = [];

    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      const paperEmbedding = paperEmbeddings[i];

      // Calculate semantic similarity
      const semanticSimilarity = this.embeddingService.cosineSimilarity(
        sectionEmbedding,
        paperEmbedding
      );

      // Calculate citation boost
      const citationBoost = this.calculateCitationBoost(
        paper,
        citedByPapers?.get(paper.itemKey)
      );

      // Calculate final relevance score
      const relevanceScore = semanticSimilarity + citationBoost;

      // Calculate estimated reading time
      const estimatedReadingTime = this.calculateReadingTime(paper);

      rankedPapers.push({
        paper,
        relevanceScore,
        semanticSimilarity,
        citationBoost,
        estimatedReadingTime
      });
    }

    // Sort by relevance score (descending)
    rankedPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return rankedPapers;
  }

  /**
   * Calculate citation boost for a paper.
   * Papers cited by multiple papers in the reading queue get a boost.
   * 
   * @param paper The paper to calculate boost for
   * @param citedBySet Set of paper IDs that cite this paper
   * @returns Citation boost value (0 to ~0.5)
   * 
   * Validates: Requirement 4.3
   */
  private calculateCitationBoost(
    paper: PaperMetadata,
    citedBySet?: Set<string>
  ): number {
    let boost = 0;

    // Boost based on citation count (if available)
    if (paper.citationCount !== undefined && paper.citationCount > 0) {
      // Normalize citation count with logarithmic scaling
      // Papers with 50+ citations get significant boost
      const normalizedCitations = Math.log10(paper.citationCount + 1) / Math.log10(this.config.citationThreshold + 1);
      boost += normalizedCitations * this.config.citationBoostFactor;
    }

    // Additional boost for papers cited by multiple papers in the collection
    if (citedBySet && citedBySet.size > 0) {
      // Each citing paper adds a small boost
      // Papers cited by 3+ papers in collection get significant boost
      const collectionCitationBoost = Math.min(citedBySet.size * 0.05, 0.3);
      boost += collectionCitationBoost;
    }

    return boost;
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
    let wordCount = paper.wordCount;

    // If word count not available, estimate from page count
    if (!wordCount && paper.pageCount) {
      wordCount = paper.pageCount * this.config.defaultPageWordCount;
    }

    // If neither available, estimate from abstract and title length
    if (!wordCount) {
      const abstractWords = (paper.abstract || '').split(/\s+/).length;
      const titleWords = paper.title.split(/\s+/).length;
      // Rough estimate: abstract is ~3% of paper, title is ~0.5%
      wordCount = Math.max(
        (abstractWords / 0.03),
        (titleWords / 0.005),
        3000 // Minimum estimate for a short paper
      );
    }

    // Calculate reading time
    const readingTime = Math.ceil(wordCount / this.config.wordsPerMinute);

    return readingTime;
  }

  /**
   * Get combined text from section for embedding.
   * Combines title and content into a single string.
   * 
   * @param section The outline section
   * @returns Combined text for embedding
   */
  private getSectionText(section: OutlineSection): string {
    const parts: string[] = [section.title];
    
    if (section.content && section.content.length > 0) {
      parts.push(...section.content);
    }

    return parts.join(' ');
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
