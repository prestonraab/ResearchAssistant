import type { Claim, OutlineSection } from '@research-assistant/core';
import type { DocumentModel, DocumentFootnote, BibliographyEntry } from '../documentModel';
import type { ManuscriptExportOptions, CitedQuote } from '../exportService';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { CoverageMetrics } from '../coverageAnalyzer';

export type ExportFormat = 'markdown' | 'csv' | 'json';

/**
 * Handles markdown export functionality
 * Generates markdown with Pandoc-style footnotes and bibliography
 */
export class MarkdownExporter {
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
  ): Promise<string> {
    return this.generateMarkdownWithFootnotes(manuscriptText, options);
  }

  /**
   * Generate markdown with Pandoc-style footnotes
   * Removes HTML comment markers (<!-- [undefined] -->) from the manuscript
   */
  private async generateMarkdownWithFootnotes(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<string> {
    const lines: string[] = [];
    const footnotes: Map<number, string> = new Map();
    const allCitations: CitedQuote[] = [];
    let footnoteIndex = 1;
    const manuscriptId = options.manuscriptId || 'default';

    // Parse manuscript into sections (this now removes HTML comments)
    const sections = this.parseManuscriptSections(manuscriptText);

    for (const section of sections) {
      lines.push(section.heading);
      lines.push('');

      // Process each paragraph
      for (const paragraph of section.paragraphs) {
        let processedParagraph = paragraph;

        // Parse sentences in paragraph (this now removes HTML comments)
        const sentences = this.parseSentencesSimple(paragraph);

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
   * Generate coverage report as markdown
   */
  public generateCoverageMarkdown(
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
   * Generate claims report as markdown
   */
  public generateClaimsMarkdown(claims: Claim[], includeMetadata: boolean): string {
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
   * Generate reading progress report as markdown
   */
  public generateReadingProgressMarkdown(statuses: unknown[]): string {
    const lines: string[] = [];
    
    lines.push('# Reading Progress Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    const total = statuses.length;
    const read = statuses.filter(s => {
      const sObj = s as Record<string, unknown>;
      return sObj.status === 'read';
    }).length;
    const reading = statuses.filter(s => {
      const sObj = s as Record<string, unknown>;
      return sObj.status === 'reading';
    }).length;
    const toRead = statuses.filter(s => {
      const sObj = s as Record<string, unknown>;
      return sObj.status === 'to-read';
    }).length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Papers: ${total}`);
    lines.push(`- Read: ${read} (${Math.round((read / total) * 100)}%)`);
    lines.push(`- Currently Reading: ${reading}`);
    lines.push(`- To Read: ${toRead}`);
    lines.push('');

    // Group by status
    ['read', 'reading', 'to-read'].forEach(status => {
      const papers = statuses.filter(s => {
        const sObj = s as Record<string, unknown>;
        return sObj.status === status;
      });
      if (papers.length === 0) {
        return;
      }

      lines.push(`## ${status.charAt(0).toUpperCase() + status.slice(1)}`);
      lines.push('');

      papers.forEach(paper => {
        const paperObj = paper as Record<string, unknown>;
        lines.push(`- ${paperObj.itemKey}`);
        if (paperObj.readingStarted) {
          lines.push(`  - Started: ${new Date(paperObj.readingStarted as string).toLocaleDateString()}`);
        }
        if (paperObj.readingCompleted) {
          lines.push(`  - Completed: ${new Date(paperObj.readingCompleted as string).toLocaleDateString()}`);
        }
      });

      lines.push('');
    });

    return lines.join('\n');
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
   * Parse manuscript into sections (headings + paragraphs)
   * Removes HTML comment markers (<!-- [undefined] -->) that appear in the manuscript
   * Removes question markers (legacy **Question?** and Obsidian callouts) and combines answers into paragraphs
   * Removes inline fields like (status:: X) and [source:: X] for clean export
   */
  private parseManuscriptSections(text: string): Array<{ heading: string; paragraphs: string[] }> {
    const sections: Array<{ heading: string; paragraphs: string[] }> = [];
    const lines = text.split('\n');

    let currentSection = { heading: '', paragraphs: [] as string[] };
    let currentParagraph = '';
    let inCallout = false;

    for (const line of lines) {
      let cleanedLine = line.trim();
      
      // Remove HTML comment markers from the line (legacy format)
      cleanedLine = cleanedLine.replace(/<!--\s*\[undefined\]\s*-->/g, '');
      cleanedLine = cleanedLine.replace(/<!--\s*\[[^\]]+\]\s*-->/g, '');
      cleanedLine = cleanedLine.replace(/<!--\s*Source:[^>]+?-->/g, '');
      
      // Remove legacy question markers (bold text ending with ?)
      cleanedLine = cleanedLine.replace(/\*\*[^*]+\?\*\*\s*/g, '');
      
      // Handle Obsidian callout format
      // Skip question line: > [!question]- Question text? (status:: X)
      if (cleanedLine.match(/^>\s*\[!question\]/)) {
        inCallout = true;
        continue; // Skip the question line entirely
      }
      
      // Process callout content lines (lines starting with >)
      if (cleanedLine.startsWith('>')) {
        inCallout = true;
        // Remove the > prefix
        cleanedLine = cleanedLine.replace(/^>\s*/, '');
        
        // Remove inline fields: (status:: X) and [source:: X]
        cleanedLine = cleanedLine.replace(/\(status::\s*[^)]+\)/g, '');
        cleanedLine = cleanedLine.replace(/\[source::\s*[^\]]+\]/g, '');
        cleanedLine = cleanedLine.trim();
        
        if (cleanedLine.length > 0) {
          currentParagraph += (currentParagraph ? ' ' : '') + cleanedLine;
        }
        continue;
      }
      
      // Non-callout line after callout ends the callout
      if (inCallout && !cleanedLine.startsWith('>')) {
        inCallout = false;
        // End the current paragraph when exiting callout
        if (currentParagraph.trim()) {
          currentSection.paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
      }
      
      // Remove inline fields from non-callout lines too
      cleanedLine = cleanedLine.replace(/\(status::\s*[^)]+\)/g, '');
      cleanedLine = cleanedLine.replace(/\[source::\s*[^\]]+\]/g, '');
      cleanedLine = cleanedLine.trim();
      
      if (cleanedLine.startsWith('#')) {
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
        currentSection = { heading: cleanedLine, paragraphs: [] };
        currentParagraph = '';
      } else if (cleanedLine === '') {
        // End of paragraph
        if (currentParagraph.trim()) {
          currentSection.paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
      } else {
        // Add to current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + cleanedLine;
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
   * Simple sentence parsing fallback
   * Removes HTML comment markers and inline fields that appear in the manuscript
   * Removes question markers (legacy and Obsidian callout format) and keeps only the answers
   */
  private parseSentencesSimple(paragraph: string): Array<{ id: string; text: string }> {
    // Remove HTML comment markers (legacy format)
    let cleanedParagraph = paragraph.replace(/<!--\s*\[undefined\]\s*-->/g, '');
    cleanedParagraph = cleanedParagraph.replace(/<!--\s*\[[^\]]+\]\s*-->/g, '');
    cleanedParagraph = cleanedParagraph.replace(/<!--\s*Source:[^>]+?-->/g, '');
    
    // Remove legacy question markers (bold text ending with ?)
    cleanedParagraph = cleanedParagraph.replace(/\*\*[^*]+\?\*\*\s*/g, '');
    
    // Remove Obsidian callout markers
    cleanedParagraph = cleanedParagraph.replace(/^>\s*\[!question\][^\n]*\n?/gm, '');
    cleanedParagraph = cleanedParagraph.replace(/^>\s*/gm, ''); // Remove > prefix from callout lines
    
    // Remove inline fields: (status:: X) and [source:: X]
    cleanedParagraph = cleanedParagraph.replace(/\(status::\s*[^)]+\)/g, '');
    cleanedParagraph = cleanedParagraph.replace(/\[source::\s*[^\]]+\]/g, '');
    
    cleanedParagraph = cleanedParagraph.trim();
    
    // Simple sentence parsing - split by period, exclamation, question mark
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    const matches = cleanedParagraph.match(sentenceRegex) || [];

    return matches.map((text, index) => ({
      id: `sentence_${index}`,
      text: text.trim()
    }));
  }
}
