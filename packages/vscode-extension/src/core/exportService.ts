import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { Claim, OutlineSection } from '@research-assistant/core';
import { CoverageMetrics } from './coverageAnalyzer';
import { SentenceClaimQuoteLinkManager } from './sentenceClaimQuoteLinkManager';
import { ClaimsManager } from './claimsManagerWrapper';
import { WordRenderer } from './wordRenderer';
import { LaTeXRenderer } from './latexRenderer';
import type {
  DocumentModel,
  DocumentSection,
  DocumentParagraph,
  DocumentRun,
  DocumentFootnote,
  BibliographyEntry,
  DocumentMetadata
} from './documentModel';

export type ExportFormat = 'markdown' | 'csv' | 'json';

export interface ManuscriptExportOptions {
  outputPath: string;
  includeFootnotes?: boolean;
  includeBibliography?: boolean;
  footnoteStyle?: 'pandoc' | 'native'; // pandoc for markdown, native for Word
  footnoteScope?: 'document' | 'section'; // continuous or per-section numbering
}

export interface ExportOptions {
  format: ExportFormat;
  outputPath: string;
  includeMetadata?: boolean;
  filterBySection?: string;
  filterBySource?: string;
  filterByCategory?: string;
}

export interface CitedQuote {
  quoteText: string;
  source: string;
  year?: string;
  claimId: string;
  sentenceId: string;
  quoteIndex: number;
}

export class ExportService {
  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager
  ) {}

  /**
   * Export manuscript with marked citations as Markdown with Pandoc-style footnotes
   */
  public async exportManuscriptMarkdown(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<void> {
    const content = await this.generateMarkdownWithFootnotes(manuscriptText, options);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Export manuscript with marked citations as Word (.docx) with native footnotes
   * 
   * Implements task 8.1: Replace stub implementation of exportManuscriptWord
   * - Calls buildDocumentModel with manuscript text and options
   * - Creates WordRenderer instance and calls render
   * - Writes buffer to output path using fs
   * - Requirements: 1.1, 6.1
   */
  public async exportManuscriptWord(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<void> {
    // Validate output path (8.4)
    this.validateOutputPath(options.outputPath);

    // Handle empty manuscript gracefully (8.4)
    if (!manuscriptText || manuscriptText.trim().length === 0) {
      // Create empty document
      const emptyModel: DocumentModel = {
        sections: [],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: options.footnoteScope || 'document',
          includeFootnotes: options.includeFootnotes !== false,
          includeBibliography: options.includeBibliography !== false
        }
      };
      const renderer = new WordRenderer(emptyModel);
      const buffer = await renderer.render(emptyModel);
      await this.writeBufferToFile(options.outputPath, buffer);
      return;
    }

    // Build document model from manuscript (8.1)
    const model = await this.buildDocumentModel(manuscriptText, options);

    // Create WordRenderer instance and render (8.1)
    const renderer = new WordRenderer(model);
    const buffer = await renderer.render(model);

    // Write buffer to output path (8.1)
    await this.writeBufferToFile(options.outputPath, buffer);
  }

  /**
   * Export manuscript with marked citations as LaTeX (.tex) with native footnotes
   * 
   * Implements task 8.2: Add exportManuscriptLatex method
   * - Calls buildDocumentModel with manuscript text and options
   * - Creates LaTeXRenderer instance and calls render
   * - Writes string content to output path
   * - Requirements: 2.1, 6.1
   */
  public async exportManuscriptLatex(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<void> {
    // Validate output path (8.4)
    this.validateOutputPath(options.outputPath);

    // Handle empty manuscript gracefully (8.4)
    if (!manuscriptText || manuscriptText.trim().length === 0) {
      // Create empty document
      const emptyModel: DocumentModel = {
        sections: [],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: options.footnoteScope || 'document',
          includeFootnotes: options.includeFootnotes !== false,
          includeBibliography: options.includeBibliography !== false
        }
      };
      const renderer = new LaTeXRenderer(emptyModel);
      const content = renderer.render(emptyModel);
      await this.writeToFile(options.outputPath, content);
      return;
    }

    // Build document model from manuscript (8.2)
    const model = await this.buildDocumentModel(manuscriptText, options);

    // Create LaTeXRenderer instance and render (8.2)
    const renderer = new LaTeXRenderer(model);
    const content = renderer.render(model);

    // Write string content to output path (8.2)
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Validate that the output path is writable
   * 
   * Implements task 8.4: Validate output path exists and is writable
   * - Throws descriptive error for invalid paths
   * - Requirements: 1.4, 2.6
   */
  private validateOutputPath(outputPath: string): void {
    const dir = path.dirname(outputPath);

    // Check if directory exists, create if needed
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        throw new Error(
          `Cannot create output directory: ${dir}. ` +
          `Please ensure the path is valid and you have write permissions.`
        );
      }
    }

    // Check if directory is writable
    try {
      fs.accessSync(dir, fs.constants.W_OK);
    } catch (error) {
      throw new Error(
        `Output directory is not writable: ${dir}. ` +
        `Please check your file permissions.`
      );
    }
  }

  /**
   * Write a buffer to a file
   * 
   * Used by exportManuscriptWord to write .docx files
   */
  private async writeBufferToFile(filePath: string, buffer: Buffer): Promise<void> {
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);
  }

  /**
   * Collect all marked citations for a sentence
   */
  private async collectCitationsForSentence(sentenceId: string): Promise<CitedQuote[]> {
    if (!this.sentenceClaimQuoteLinkManager || !this.claimsManager) {
      return [];
    }

    const citations = this.sentenceClaimQuoteLinkManager.getCitationsForSentence(sentenceId);
    const citedQuotes: CitedQuote[] = [];

    for (const citation of citations) {
      const claim = this.claimsManager.getClaim(citation.claimId);
      if (!claim) {
        continue;
      }

      // Get the quote text based on quote index
      let quoteText = '';
      if (citation.quoteIndex === 0) {
        quoteText = claim.primaryQuote?.text || '';
      } else if (citation.quoteIndex - 1 < claim.supportingQuotes.length) {
        quoteText = claim.supportingQuotes[citation.quoteIndex - 1]?.text || '';
      }

      if (quoteText) {
        citedQuotes.push({
          quoteText,
          source: claim.primaryQuote?.source || 'Unknown',
          year: this.extractYear(claim.primaryQuote?.source || ''),
          claimId: claim.id,
          sentenceId,
          quoteIndex: citation.quoteIndex
        });
      }
    }

    return citedQuotes;
  }

  /**
   * Extract year from source string (e.g., "Smith2020" -> "2020")
   */
  private extractYear(source: string): string | undefined {
    const match = source.match(/(\d{4})/);
    return match ? match[1] : undefined;
  }

  /**
   * Build a format-agnostic document model from manuscript text
   * This method parses the manuscript into sections, collects citations,
   * and builds a DocumentModel that can be rendered to multiple formats.
   */
  public async buildDocumentModel(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<DocumentModel> {
    const sections = this.parseManuscriptSections(manuscriptText);
    const documentSections: DocumentSection[] = [];
    const allCitations: CitedQuote[] = [];
    const footnotes: DocumentFootnote[] = [];
    let footnoteIndex = 1;

    // Process each section
    for (const section of sections) {
      const level = this.getHeadingLevel(section.heading);
      const paragraphs: DocumentParagraph[] = [];

      // Process each paragraph in the section
      for (const paragraphText of section.paragraphs) {
        const runs: DocumentRun[] = [];
        const sentences = this.parseSentences(paragraphText);

        // Process each sentence
        for (const sentence of sentences) {
          // Add text run for the sentence
          runs.push({ type: 'text', content: sentence.text });

          // Collect citations for this sentence if footnotes are enabled
          if (options.includeFootnotes !== false) {
            const citations = await this.collectCitationsForSentence(sentence.id);
            
            for (const citation of citations) {
              allCitations.push(citation);
              
              // Create footnote entry
              const footnote: DocumentFootnote = {
                id: footnoteIndex,
                quoteText: citation.quoteText,
                source: citation.source,
                year: citation.year
              };
              footnotes.push(footnote);
              
              // Add footnote reference run
              runs.push({
                type: 'footnote-ref',
                content: '',
                footnoteId: footnoteIndex
              });
              
              footnoteIndex++;
            }
          }
        }

        paragraphs.push({ runs });
      }

      documentSections.push({
        heading: section.heading.replace(/^#+\s*/, ''),
        level,
        paragraphs
      });

      // Reset footnote numbering for section scope
      if (options.footnoteScope === 'section') {
        footnoteIndex = 1;
      }
    }

    // Build bibliography if requested
    const bibliography = options.includeBibliography !== false
      ? this.buildBibliographyFromCitations(allCitations)
      : [];

    // Create document metadata
    const metadata: DocumentMetadata = {
      footnotes,
      footnoteScope: options.footnoteScope || 'document',
      includeFootnotes: options.includeFootnotes !== false,
      includeBibliography: options.includeBibliography !== false
    };

    return {
      sections: documentSections,
      bibliography,
      metadata
    };
  }

  /**
   * Extract heading level from markdown syntax
   * # = 1, ## = 2, ### = 3, etc.
   */
  private getHeadingLevel(heading: string): number {
    const match = heading.match(/^#+/);
    return match ? match[0].length : 1;
  }

  /**
   * Build bibliography entries from citations
   * Collects unique sources and formats them as BibliographyEntry objects
   */
  private buildBibliographyFromCitations(citations: CitedQuote[]): BibliographyEntry[] {
    const sourceMap = new Map<string, CitedQuote>();

    // Collect unique sources (keyed by source name)
    for (const citation of citations) {
      const key = citation.source;
      if (!sourceMap.has(key)) {
        sourceMap.set(key, citation);
      }
    }

    // Convert to BibliographyEntry array and sort
    const entries = Array.from(sourceMap.values())
      .map(citation => ({
        source: citation.source,
        year: citation.year
      }))
      .sort((a, b) => a.source.localeCompare(b.source));

    return entries;
  }

  /**
   * Generate unique footnote ID
   */
  private generateFootnoteId(index: number): string {
    return `^${index}`;
  }

  /**
   * Build bibliography from all cited sources
   */
  private async buildBibliography(allCitations: CitedQuote[]): Promise<string[]> {
    const sources = new Map<string, CitedQuote>();

    // Collect unique sources
    for (const citation of allCitations) {
      const key = `${citation.source}`;
      if (!sources.has(key)) {
        sources.set(key, citation);
      }
    }

    // Sort by source
    const sortedSources = Array.from(sources.values()).sort((a, b) =>
      a.source.localeCompare(b.source)
    );

    // Format bibliography entries
    return sortedSources.map(citation => {
      const year = citation.year ? ` (${citation.year})` : '';
      return `- ${citation.source}${year}`;
    });
  }

  /**
   * Generate markdown with Pandoc-style footnotes
   */
  private async generateMarkdownWithFootnotes(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<string> {
    const lines: string[] = [];
    const footnotes: Map<number, string> = new Map();
    const allCitations: CitedQuote[] = [];
    let footnoteIndex = 1;

    // Parse manuscript into sections
    const sections = this.parseManuscriptSections(manuscriptText);

    for (const section of sections) {
      lines.push(section.heading);
      lines.push('');

      // Process each paragraph
      for (const paragraph of section.paragraphs) {
        let processedParagraph = paragraph;

        // Parse sentences in paragraph
        const sentences = this.parseSentences(paragraph);

        for (const sentence of sentences) {
          // Get citations for this sentence
          const citations = await this.collectCitationsForSentence(sentence.id);

          if (citations.length > 0) {
            allCitations.push(...citations);

            // Add footnote references to sentence
            let sentenceWithFootnotes = sentence.text;

            for (const citation of citations) {
              const footnoteId = this.generateFootnoteId(footnoteIndex);
              const footnoteText = `${citation.quoteText} (${citation.source}${citation.year ? ', ' + citation.year : ''})`;

              footnotes.set(footnoteIndex, footnoteText);
              sentenceWithFootnotes += ` ${footnoteId}`;
              footnoteIndex++;
            }

            processedParagraph = processedParagraph.replace(sentence.text, sentenceWithFootnotes);
          }
        }

        lines.push(processedParagraph);
        lines.push('');
      }

      // Add footnotes for this section if document-scoped
      if (options.footnoteScope === 'section') {
        for (const [index, text] of footnotes.entries()) {
          lines.push(`${this.generateFootnoteId(index)}: ${text}`);
        }
        lines.push('');
        footnotes.clear();
        footnoteIndex = 1;
      }
    }

    // Add bibliography if requested
    if (options.includeBibliography !== false) {
      lines.push('## Bibliography');
      lines.push('');

      const bibliography = await this.buildBibliography(allCitations);
      for (const entry of bibliography) {
        lines.push(entry);
      }
      lines.push('');
    }

    // Add document-scoped footnotes if applicable
    if (options.footnoteScope !== 'section' && footnotes.size > 0) {
      lines.push('## Footnotes');
      lines.push('');

      for (const [index, text] of footnotes.entries()) {
        lines.push(`${this.generateFootnoteId(index)}: ${text}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Parse manuscript into sections (headings + paragraphs)
   */
  private parseManuscriptSections(text: string): Array<{ heading: string; paragraphs: string[] }> {
    const sections: Array<{ heading: string; paragraphs: string[] }> = [];
    const lines = text.split('\n');

    let currentSection = { heading: '', paragraphs: [] as string[] };
    let currentParagraph = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        // Save previous section
        if (currentSection.heading || currentParagraph) {
          if (currentParagraph.trim()) {
            currentSection.paragraphs.push(currentParagraph.trim());
          }
          if (currentSection.heading) {
            sections.push(currentSection);
          }
        }

        // Start new section
        currentSection = { heading: line, paragraphs: [] };
        currentParagraph = '';
      } else if (line.trim() === '') {
        // End of paragraph
        if (currentParagraph.trim()) {
          currentSection.paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
      } else {
        // Add to current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + line.trim();
      }
    }

    // Save final section
    if (currentParagraph.trim()) {
      currentSection.paragraphs.push(currentParagraph.trim());
    }
    if (currentSection.heading) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Parse paragraph into sentences
   */
  private parseSentences(paragraph: string): Array<{ id: string; text: string }> {
    // Simple sentence parsing - split by period, exclamation, question mark
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    const matches = paragraph.match(sentenceRegex) || [];

    return matches.map((text, index) => ({
      id: `sentence_${index}`,
      text: text.trim()
    }));
  }

  /**
   * Export coverage analysis report
   */
  public async exportCoverageAnalysis(
    coverageMetrics: CoverageMetrics[],
    sections: OutlineSection[],
    options: ExportOptions
  ): Promise<void> {
    const content = this.generateCoverageReport(coverageMetrics, sections, options.format);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Export coverage report (convenience method)
   */
  public async exportCoverageReport(
    outputPath: string,
    format: 'markdown' | 'csv'
  ): Promise<void> {
    // This method needs to be called with coverage metrics and sections
    // For now, throw an error indicating it needs to be called differently
    throw new Error('Use exportCoverageAnalysis with coverageMetrics and sections instead');
  }

  /**
   * Export claims list
   */
  public async exportClaims(
    claims: Claim[],
    options: ExportOptions
  ): Promise<void> {
    // Apply filters
    let filteredClaims = claims;

    if (options.filterBySection) {
      filteredClaims = filteredClaims.filter(c => 
        c.sections.includes(options.filterBySection!)
      );
    }

    if (options.filterBySource) {
      filteredClaims = filteredClaims.filter(c => 
        (c.primaryQuote?.source || '').toLowerCase().includes(options.filterBySource!.toLowerCase())
      );
    }

    if (options.filterByCategory) {
      filteredClaims = filteredClaims.filter(c => 
        c.category === options.filterByCategory
      );
    }

    const content = this.generateClaimsReport(filteredClaims, options.format, options.includeMetadata);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Export reading progress report
   */
  public async exportReadingProgress(
    readingStatuses: any[],
    options: ExportOptions
  ): Promise<void> {
    const content = this.generateReadingProgressReport(readingStatuses, options.format);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Generate coverage report in specified format
   */
  private generateCoverageReport(
    metrics: CoverageMetrics[],
    sections: OutlineSection[],
    format: ExportFormat
  ): string {
    switch (format) {
      case 'markdown':
        return this.generateCoverageMarkdown(metrics, sections);
      case 'csv':
        return this.generateCoverageCSV(metrics);
      case 'json':
        return JSON.stringify({ metrics, sections }, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate coverage report as markdown
   */
  private generateCoverageMarkdown(
    metrics: CoverageMetrics[],
    sections: OutlineSection[]
  ): string {
    const lines: string[] = [];
    
    lines.push('# Coverage Analysis Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Summary statistics
    const totalSections = metrics.length;
    const sectionsWithCoverage = metrics.filter(m => m.coverageLevel !== 'none').length;
    const coveragePercentage = totalSections > 0 
      ? Math.round((sectionsWithCoverage / totalSections) * 100)
      : 0;
    const gaps = metrics.filter(m => m.claimCount < 2).length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Sections: ${totalSections}`);
    lines.push(`- Sections with Coverage: ${sectionsWithCoverage}`);
    lines.push(`- Coverage Percentage: ${coveragePercentage}%`);
    lines.push(`- Gaps (< 2 claims): ${gaps}`);
    lines.push('');

    // Coverage by level
    const byLevel = {
      none: metrics.filter(m => m.coverageLevel === 'none').length,
      low: metrics.filter(m => m.coverageLevel === 'low').length,
      moderate: metrics.filter(m => m.coverageLevel === 'moderate').length,
      strong: metrics.filter(m => m.coverageLevel === 'strong').length
    };

    lines.push('## Coverage Distribution');
    lines.push('');
    lines.push(`- None (0 claims): ${byLevel.none}`);
    lines.push(`- Low (1-3 claims): ${byLevel.low}`);
    lines.push(`- Moderate (4-6 claims): ${byLevel.moderate}`);
    lines.push(`- Strong (7+ claims): ${byLevel.strong}`);
    lines.push('');

    // Detailed section breakdown
    lines.push('## Section Details');
    lines.push('');

    metrics.forEach(metric => {
      const section = sections.find(s => s.id === metric.sectionId);
      if (!section) {
        return;
      }

      const levelEmoji = {
        none: '❌',
        low: '⚠️',
        moderate: '✅',
        strong: '🌟'
      }[metric.coverageLevel];

      lines.push(`### ${levelEmoji} ${section.title}`);
      lines.push('');
      lines.push(`- **Claims**: ${metric.claimCount}`);
      lines.push(`- **Coverage Level**: ${metric.coverageLevel}`);
      lines.push(`- **Last Updated**: ${metric.lastUpdated.toISOString()}`);
      
      if (metric.suggestedQueries.length > 0) {
        lines.push('- **Suggested Queries**:');
        metric.suggestedQueries.forEach(q => lines.push(`  - ${q}`));
      }
      
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate coverage report as CSV
   */
  private generateCoverageCSV(metrics: CoverageMetrics[]): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Section ID,Claim Count,Coverage Level,Last Updated');

    // Data rows
    metrics.forEach(metric => {
      lines.push([
        metric.sectionId,
        metric.claimCount,
        metric.coverageLevel,
        metric.lastUpdated.toISOString()
      ].join(','));
    });

    return lines.join('\n');
  }

  /**
   * Generate claims report in specified format
   */
  private generateClaimsReport(
    claims: Claim[],
    format: ExportFormat,
    includeMetadata: boolean = true
  ): string {
    switch (format) {
      case 'markdown':
        return this.generateClaimsMarkdown(claims, includeMetadata);
      case 'csv':
        return this.generateClaimsCSV(claims);
      case 'json':
        return JSON.stringify(claims, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate claims report as markdown
   */
  private generateClaimsMarkdown(claims: Claim[], includeMetadata: boolean): string {
    const lines: string[] = [];
    
    lines.push('# Claims Export');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Total Claims: ${claims.length}`);
    lines.push('');

    claims.forEach(claim => {
      lines.push(`## ${claim.id}`);
      lines.push('');
      lines.push(`**Text**: ${claim.text}`);
      lines.push('');
      lines.push(`**Category**: ${claim.category}`);
      lines.push(`**Source**: ${claim.primaryQuote?.source || 'Unknown'}`);
      
      if (includeMetadata) {
        lines.push(`**Verified**: ${claim.verified ? 'Yes' : 'No'}`);
        lines.push(`**Sections**: ${claim.sections.join(', ')}`);
        lines.push(`**Created**: ${claim.createdAt?.toISOString() || 'Unknown'}`);
      }
      
      lines.push('');
      lines.push('**Primary Quote**:');
      lines.push('');
      lines.push(`> ${claim.primaryQuote?.text || ''}`);
      lines.push('');

      if (claim.supportingQuotes.length > 0) {
        lines.push('**Supporting Quotes**:');
        lines.push('');
        claim.supportingQuotes.forEach((quote, i) => {
          lines.push(`${i + 1}. > ${quote.text}`);
          lines.push('');
        });
      }

      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate claims report as CSV
   */
  private generateClaimsCSV(claims: Claim[]): string {
    const lines: string[] = [];
    
    // Header
    lines.push('ID,Text,Category,Source,Verified,Sections,Primary Quote');

    // Data rows
    claims.forEach(claim => {
      const row = [
        claim.id,
        this.escapeCsvField(claim.text),
        claim.category,
        claim.primaryQuote?.source || 'Unknown',
        claim.verified ? 'Yes' : 'No',
        this.escapeCsvField(claim.sections.join('; ')),
        this.escapeCsvField(claim.primaryQuote?.text || '')
      ];
      lines.push(row.join(','));
    });

    return lines.join('\n');
  }

  /**
   * Generate reading progress report
   */
  private generateReadingProgressReport(
    statuses: any[],
    format: ExportFormat
  ): string {
    switch (format) {
      case 'markdown':
        return this.generateReadingProgressMarkdown(statuses);
      case 'csv':
        return this.generateReadingProgressCSV(statuses);
      case 'json':
        return JSON.stringify(statuses, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate reading progress report as markdown
   */
  private generateReadingProgressMarkdown(statuses: any[]): string {
    const lines: string[] = [];
    
    lines.push('# Reading Progress Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    const total = statuses.length;
    const read = statuses.filter(s => s.status === 'read').length;
    const reading = statuses.filter(s => s.status === 'reading').length;
    const toRead = statuses.filter(s => s.status === 'to-read').length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Papers: ${total}`);
    lines.push(`- Read: ${read} (${Math.round((read / total) * 100)}%)`);
    lines.push(`- Currently Reading: ${reading}`);
    lines.push(`- To Read: ${toRead}`);
    lines.push('');

    // Group by status
    ['read', 'reading', 'to-read'].forEach(status => {
      const papers = statuses.filter(s => s.status === status);
      if (papers.length === 0) {
        return;
      }

      lines.push(`## ${status.charAt(0).toUpperCase() + status.slice(1)}`);
      lines.push('');

      papers.forEach(paper => {
        lines.push(`- ${paper.itemKey}`);
        if (paper.readingStarted) {
          lines.push(`  - Started: ${new Date(paper.readingStarted).toLocaleDateString()}`);
        }
        if (paper.readingCompleted) {
          lines.push(`  - Completed: ${new Date(paper.readingCompleted).toLocaleDateString()}`);
        }
      });

      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate reading progress report as CSV
   */
  private generateReadingProgressCSV(statuses: any[]): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Paper ID,Status,Started,Completed');

    // Data rows
    statuses.forEach(status => {
      lines.push([
        status.itemKey,
        status.status,
        status.readingStarted ? new Date(status.readingStarted).toISOString() : '',
        status.readingCompleted ? new Date(status.readingCompleted).toISOString() : ''
      ].join(','));
    });

    return lines.join('\n');
  }

  /**
   * Escape CSV field
   */
  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Write content to file
   */
  private async writeToFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Prompt user for export location
   */
  public async promptForExportLocation(
    defaultFilename: string,
    format: ExportFormat
  ): Promise<string | undefined> {
    const extension = format === 'markdown' ? 'md' : format;
    
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFilename),
      filters: {
        [format.toUpperCase()]: [extension]
      }
    });

    return uri?.fsPath;
  }
}
