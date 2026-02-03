import type { Claim, OutlineSection } from '@research-assistant/core';
import type { DocumentModel, DocumentFootnote, BibliographyEntry } from '../documentModel';
import type { ManuscriptExportOptions, CitedQuote } from '../exportService';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { CoverageMetrics } from '../coverageAnalyzer';
import { ManuscriptParser } from './ManuscriptParser';
import { CitationCollector } from './CitationCollector';
import { ReportGenerator } from './ReportGenerator';

export type ExportFormat = 'markdown' | 'csv' | 'json';

/**
 * Handles markdown export functionality
 * Generates markdown with Pandoc-style footnotes and bibliography
 */
export class MarkdownExporter {
  private citationCollector: CitationCollector;

  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager
  ) {
    this.citationCollector = new CitationCollector(sentenceClaimQuoteLinkManager, claimsManager);
  }

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
    const sections = ManuscriptParser.parseManuscriptSections(manuscriptText);

    for (const section of sections) {
      lines.push(section.heading);
      lines.push('');

      // Process each paragraph
      for (const paragraph of section.paragraphs) {
        let processedParagraph = paragraph;

        // Parse sentences in paragraph (this now removes HTML comments)
        const sentences = ManuscriptParser.parseSentencesSimple(paragraph);

        for (const sentence of sentences) {
          // Get citations for this sentence
          const citations = await this.citationCollector.collectCitationsForSentence(sentence.id);

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
    return ReportGenerator.generateCoverageMarkdown(metrics, sections);
  }

  /**
   * Generate claims report as markdown
   */
  public generateClaimsMarkdown(claims: Claim[], includeMetadata: boolean): string {
    return ReportGenerator.generateClaimsMarkdown(claims, includeMetadata);
  }

  /**
   * Generate reading progress report as markdown
   */
  public generateReadingProgressMarkdown(statuses: unknown[]): string {
    return ReportGenerator.generateReadingProgressMarkdown(statuses);
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
}
