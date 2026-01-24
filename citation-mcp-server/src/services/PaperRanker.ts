import { EmbeddingService } from '../core/EmbeddingService.js';
import { OutlineParser } from '../core/OutlineParser.js';
import { PaperMetadata, RankedPaper } from '../types/index.js';

/**
 * PaperRanker ranks papers by relevance to sections or queries.
 * Implements Requirements 7.1, 7.2, 7.3
 */
export class PaperRanker {
  private embeddingService: EmbeddingService;
  private outlineParser: OutlineParser;
  private citationBoostThreshold: number;
  private citationBoostFactor: number;
  private wordsPerMinute: number;
  private wordsPerPage: number;

  constructor(
    embeddingService: EmbeddingService,
    outlineParser: OutlineParser,
    citationBoostThreshold: number = 50,
    citationBoostFactor: number = 0.1,
    wordsPerMinute: number = 200,
    wordsPerPage: number = 500
  ) {
    this.embeddingService = embeddingService;
    this.outlineParser = outlineParser;
    this.citationBoostThreshold = citationBoostThreshold;
    this.citationBoostFactor = citationBoostFactor;
    this.wordsPerMinute = wordsPerMinute;
    this.wordsPerPage = wordsPerPage;
  }

  /**
   * Rank papers by relevance to a specific section.
   * Requirement 7.1: Calculate semantic similarity between paper abstracts and section content
   * Requirement 7.2: Boost rankings for highly-cited papers (50+ citations)
   * Requirement 7.3: Calculate estimated reading time based on paper length
   * Requirement 7.4: Return ranked papers sorted by relevance score
   * Requirement 7.5: Include relevance score, semantic similarity, citation boost, and reading time
   */
  async rankPapersForSection(
    sectionId: string,
    papers: PaperMetadata[]
  ): Promise<RankedPaper[]> {
    // Validate inputs
    if (!sectionId || papers.length === 0) {
      return [];
    }

    // Get section content
    const section = this.outlineParser.getSectionById(sectionId);
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    // Combine section title and content for semantic matching
    const sectionText = `${section.title}\n${section.content.join('\n')}`;

    // Rank papers using the section text as query
    return this.rankPapersForQuery(sectionText, papers);
  }

  /**
   * Rank papers by relevance to a query string.
   * Requirement 7.1: Calculate semantic similarity between paper abstracts and query
   * Requirement 7.2: Boost rankings for highly-cited papers (50+ citations)
   * Requirement 7.3: Calculate estimated reading time based on paper length
   * Requirement 7.4: Return ranked papers sorted by relevance score
   * Requirement 7.5: Include relevance score, semantic similarity, citation boost, and reading time
   */
  async rankPapersForQuery(
    query: string,
    papers: PaperMetadata[]
  ): Promise<RankedPaper[]> {
    // Validate inputs
    if (!query || query.trim().length === 0 || papers.length === 0) {
      return [];
    }

    // Generate embedding for query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Batch generate embeddings for all paper abstracts
    const abstracts = papers.map((p) => p.abstract || p.title);
    const abstractEmbeddings = await this.embeddingService.generateBatch(abstracts);

    // Calculate rankings for each paper
    const rankedPapers: RankedPaper[] = [];

    for (let i = 0; i < papers.length; i++) {
      const paper = papers[i];
      const abstractEmbedding = abstractEmbeddings[i];

      // Calculate semantic similarity
      const semanticSimilarity = this.embeddingService.cosineSimilarity(
        queryEmbedding,
        abstractEmbedding
      );

      // Calculate citation boost
      const citationBoost = this.calculateCitationBoost(paper.citationCount);

      // Calculate relevance score (semantic similarity + citation boost)
      const relevanceScore = semanticSimilarity + citationBoost;

      // Calculate estimated reading time
      const estimatedReadingTime = this.calculateReadingTime(paper);

      rankedPapers.push({
        paper,
        relevanceScore,
        semanticSimilarity,
        citationBoost,
        estimatedReadingTime,
      });
    }

    // Sort by descending relevance score (highest first)
    rankedPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return rankedPapers;
  }

  /**
   * Calculate estimated reading time for a paper.
   * Requirement 7.3: Calculate estimated reading time based on paper length
   * 
   * Uses word count if available, estimates from page count, or falls back to abstract length.
   * Assumes 200 words/minute reading speed.
   */
  calculateReadingTime(paper: PaperMetadata): number {
    let wordCount = 0;

    // Priority 1: Use word count if available
    if (paper.wordCount && paper.wordCount > 0) {
      wordCount = paper.wordCount;
    }
    // Priority 2: Estimate from page count (500 words/page)
    else if (paper.pageCount && paper.pageCount > 0) {
      wordCount = paper.pageCount * this.wordsPerPage;
    }
    // Priority 3: Estimate from abstract length
    else if (paper.abstract) {
      // Estimate abstract is ~10% of paper, so multiply by 10
      const abstractWords = paper.abstract.split(/\s+/).length;
      wordCount = abstractWords * 10;
    }
    // Priority 4: Estimate from title (very rough estimate)
    else if (paper.title) {
      // Assume average paper is ~5000 words
      wordCount = 5000;
    }

    // Calculate reading time in minutes
    const readingTimeMinutes = Math.ceil(wordCount / this.wordsPerMinute);

    return readingTimeMinutes;
  }

  /**
   * Calculate citation boost for a paper.
   * Requirement 7.2: Boost rankings for highly-cited papers (50+ citations)
   * 
   * Papers with 50+ citations get a boost to their relevance score.
   * The boost is proportional to the citation count above the threshold.
   */
  private calculateCitationBoost(citationCount?: number): number {
    if (!citationCount || citationCount < this.citationBoostThreshold) {
      return 0;
    }

    // Calculate boost: 0.1 * log10(citations / threshold)
    // This gives a boost that increases logarithmically with citation count
    const ratio = citationCount / this.citationBoostThreshold;
    const boost = this.citationBoostFactor * Math.log10(ratio);

    return boost;
  }
}
