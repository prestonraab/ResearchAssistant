import type { OutlineSection, Claim } from '@research-assistant/core';
import type { ClaimsManager, EmbeddingServiceInterface, PaperRanker } from '../types';

export interface CoverageMetrics {
  sectionId: string;
  claimCount: number;
  coverageLevel: 'none' | 'low' | 'moderate' | 'strong';
  lastUpdated: Date;
  suggestedQueries: string[];
  relevantPapers: string[];
}

export interface CoverageReport {
  totalSections: number;
  sectionsWithNoCoverage: number;
  sectionsWithLowCoverage: number;
  sectionsWithModerateCoverage: number;
  sectionsWithStrongCoverage: number;
  overallCoveragePercentage: number;
  gaps: CoverageMetrics[];
  timestamp: Date;
}

export class CoverageAnalyzer {
  constructor(
    private claimsManager: ClaimsManager,
    private embeddingService: EmbeddingServiceInterface
  ) {}

  /**
   * Analyze coverage for all sections in the outline
   * Maps claims to sections using section IDs in claim metadata
   * Calculates coverage levels based on claim count thresholds
   */
  analyzeCoverage(sections: OutlineSection[], claims: Claim[]): CoverageMetrics[] {
    const metrics: CoverageMetrics[] = [];
    
    for (const section of sections) {
      // Find all claims associated with this section
      const sectionClaims = claims.filter(claim => 
        claim.sections.includes(section.id)
      );
      
      const claimCount = sectionClaims.length;
      const coverageLevel = this.calculateCoverageLevel(claimCount);
      
      metrics.push({
        sectionId: section.id,
        claimCount,
        coverageLevel,
        lastUpdated: new Date(),
        suggestedQueries: this.suggestSearchQueries(section),
        relevantPapers: [] // Will be populated by paper recommendation system
      });
    }
    
    return metrics;
  }

  /**
   * Calculate coverage level based on claim count
   * Thresholds: none (0), low (1-3), moderate (4-6), strong (7+)
   */
  private calculateCoverageLevel(claimCount: number): 'none' | 'low' | 'moderate' | 'strong' {
    if (claimCount === 0) {
      return 'none';
    } else if (claimCount >= 1 && claimCount <= 3) {
      return 'low';
    } else if (claimCount >= 4 && claimCount <= 6) {
      return 'moderate';
    } else {
      return 'strong';
    }
  }

  /**
   * Identify gaps: sections with fewer than 2 claims
   * Returns sections that need more supporting evidence
   */
  identifyGaps(sections: OutlineSection[], claims: Claim[], threshold: number = 2): CoverageMetrics[] {
    const allMetrics = this.analyzeCoverage(sections, claims);
    
    // Filter sections with claim count below threshold
    const gaps = allMetrics.filter(metric => metric.claimCount < threshold);
    
    // Rank gaps by importance
    return this.rankGapsByImportance(gaps, sections);
  }

  /**
   * Rank gaps by importance based on section depth and position
   * Earlier sections and shallower sections (higher in hierarchy) rank higher
   */
  private rankGapsByImportance(gaps: CoverageMetrics[], sections: OutlineSection[]): CoverageMetrics[] {
    // Create a map for quick section lookup
    const sectionMap = new Map<string, OutlineSection>();
    sections.forEach(section => sectionMap.set(section.id, section));
    
    // Sort gaps by importance
    return gaps.sort((a, b) => {
      const sectionA = sectionMap.get(a.sectionId);
      const sectionB = sectionMap.get(b.sectionId);
      
      if (!sectionA || !sectionB) {
        return 0;
      }
      
      // First, compare by depth (level) - lower level (shallower) is more important
      if (sectionA.level !== sectionB.level) {
        return sectionA.level - sectionB.level;
      }
      
      // If same level, compare by position (lineStart) - earlier is more important
      return sectionA.lineStart - sectionB.lineStart;
    });
  }

  /**
   * Generate 2-5 search queries for a section based on title and content
   * Extracts key terms and creates domain-specific queries
   * Alias for suggestSearchQueries for consistency with property tests
   */
  generateSearchQueries(section: OutlineSection): string[] {
    return this.suggestSearchQueries(section);
  }

  /**
   * Generate 2-5 search queries for a section based on title and content
   * Extracts key terms and creates domain-specific queries
   */
  suggestSearchQueries(section: OutlineSection): string[] {
    const queries: string[] = [];
    
    // Query 1: Direct title search
    queries.push(section.title);
    
    // Query 2: Title with key terms from content
    if (section.content.length > 0) {
      const keyTerms = this.extractKeyTerms(section.content);
      if (keyTerms.length > 0) {
        queries.push(`${section.title} ${keyTerms.slice(0, 2).join(' ')}`);
      }
    }
    
    // Query 3: Combine title with parent context if available
    // This would require parent section info, which we can add later
    
    // Query 4: Extract questions from content
    const questions = section.content.filter(line => 
      line.includes('?') || line.toLowerCase().startsWith('how') || 
      line.toLowerCase().startsWith('what') || line.toLowerCase().startsWith('why')
    );
    if (questions.length > 0) {
      // Convert question to search query by removing question mark
      queries.push(questions[0].replace('?', '').trim());
    }
    
    // Query 5: Domain-specific terms
    const domainTerms = this.extractDomainTerms(section.title, section.content);
    if (domainTerms.length > 0) {
      queries.push(domainTerms.join(' '));
    }
    
    // Ensure we return 2-5 queries
    const uniqueQueries = Array.from(new Set(queries));
    
    // If we have less than 2 queries, generate variations of the title
    if (uniqueQueries.length < 2) {
      // Add title words as a separate query
      const titleWords = section.title.split(/\s+/).filter(w => w.length > 3);
      if (titleWords.length > 0) {
        uniqueQueries.push(titleWords.join(' '));
      }
    }
    
    // Still less than 2? Add a generic research query
    if (uniqueQueries.length < 2) {
      uniqueQueries.push(`${section.title} research`);
    }
    
    return uniqueQueries.slice(0, 5);
  }

  /**
   * Extract key terms from content lines
   * Focuses on nouns and important phrases
   */
  private extractKeyTerms(content: string[]): string[] {
    const terms: string[] = [];
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being']);
    
    for (const line of content) {
      // Remove markdown formatting and split into words
      const words = line
        .replace(/[*_`#\-]/g, '')
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
      
      terms.push(...words);
    }
    
    // Return unique terms, limited to most relevant
    return Array.from(new Set(terms)).slice(0, 5);
  }

  /**
   * Extract domain-specific terminology
   * Looks for technical terms, acronyms, and specialized vocabulary
   */
  private extractDomainTerms(title: string, content: string[]): string[] {
    const terms: string[] = [];
    const allText = [title, ...content].join(' ');
    
    // Find capitalized terms (potential acronyms or proper nouns)
    const capitalizedTerms = allText.match(/\b[A-Z]{2,}\b/g) || [];
    terms.push(...capitalizedTerms);
    
    // Find hyphenated terms (often technical)
    const hyphenatedTerms = allText.match(/\b\w+-\w+\b/g) || [];
    terms.push(...hyphenatedTerms);
    
    // Find quoted terms (often important concepts)
    const quotedTerms = allText.match(/"([^"]+)"/g) || [];
    terms.push(...quotedTerms.map(t => t.replace(/"/g, '')));
    
    // Return unique terms, limited to most relevant
    return Array.from(new Set(terms)).slice(0, 3);
  }

  /**
   * Generate a comprehensive coverage report
   * Provides statistics and identifies all gaps
   */
  generateReport(sections: OutlineSection[], claims: Claim[]): CoverageReport {
    const metrics = this.analyzeCoverage(sections, claims);
    const gaps = this.identifyGaps(sections, claims);
    
    // Calculate statistics
    const sectionsWithNoCoverage = metrics.filter(m => m.coverageLevel === 'none').length;
    const sectionsWithLowCoverage = metrics.filter(m => m.coverageLevel === 'low').length;
    const sectionsWithModerateCoverage = metrics.filter(m => m.coverageLevel === 'moderate').length;
    const sectionsWithStrongCoverage = metrics.filter(m => m.coverageLevel === 'strong').length;
    
    // Calculate overall coverage percentage
    // Sections with at least moderate coverage are considered "covered"
    const coveredSections = sectionsWithModerateCoverage + sectionsWithStrongCoverage;
    const overallCoveragePercentage = sections.length > 0 
      ? Math.round((coveredSections / sections.length) * 100)
      : 0;
    
    return {
      totalSections: sections.length,
      sectionsWithNoCoverage,
      sectionsWithLowCoverage,
      sectionsWithModerateCoverage,
      sectionsWithStrongCoverage,
      overallCoveragePercentage,
      gaps,
      timestamp: new Date()
    };
  }

  /**
   * Recommend papers for a specific section
   * Uses PaperRanker to rank papers by semantic similarity
   * 
   * @param section The outline section
   * @param papers Array of papers to rank
   * @param paperRanker PaperRanker instance for ranking
   * @param topK Number of top papers to return (default: 5)
   * @returns Array of top K paper item keys
   */
  async recommendPapers(
    section: OutlineSection,
    papers: unknown[],
    paperRanker: PaperRanker,
    topK: number = 5
  ): Promise<string[]> {
    if (papers.length === 0) {
      return [];
    }

    // Rank papers using PaperRanker
    const ranked = (await (paperRanker as any).rankPapers(papers, section)) as any[];
    
    // Return top K paper item keys
    return ranked.slice(0, topK).map((rp: any) => {
      const rpObj = rp as Record<string, unknown>;
      const paper = rpObj.paper as Record<string, unknown>;
      return (paper.itemKey || paper.key) as string;
    });
  }

  /**
   * Suggest 1-3 outline sections for a claim based on semantic similarity
   * Returns sections ranked by relevance to the claim text
   * 
   * @param claim The claim to find sections for
   * @param sections Array of outline sections
   * @returns Array of section suggestions with similarity scores
   */
  async suggestSectionsForClaim(
    claim: Claim,
    sections: OutlineSection[]
  ): Promise<Array<{ sectionId: string; similarity: number }>> {
    if (sections.length === 0) {
      return [];
    }

    // Generate embedding for claim text
    const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);

    // Calculate similarity with each section
    const similarities: Array<{ sectionId: string; similarity: number }> = [];

    for (const section of sections) {
      // Combine section title and content for embedding
      const sectionObj = (section as unknown) as Record<string, unknown>;
      const content = (sectionObj.content as string[]) || [];
      const sectionText = [sectionObj.title, ...content].join(' ');
      const sectionEmbedding = await this.embeddingService.generateEmbedding(sectionText);

      // Calculate cosine similarity
      const similarity = this.embeddingService.cosineSimilarity(claimEmbedding, sectionEmbedding);

      similarities.push({
        sectionId: sectionObj.id as string,
        similarity
      });
    }

    // Sort by similarity (descending) and return top 1-3
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, 3);
  }
}
