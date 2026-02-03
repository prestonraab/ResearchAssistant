import type { SentenceParser, Sentence } from '@research-assistant/core';
import type { DocumentModel, DocumentSection, DocumentParagraph, DocumentRun, DocumentFootnote, DocumentImage, DocumentTable } from '../documentModel';
import type { ManuscriptExportOptions, CitedQuote } from '../exportService';
import { TableImageRenderer } from './TableImageRenderer';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../claimsManagerWrapper';

/**
 * Handles document model building from manuscript text
 * Parses manuscript into sections, collects citations, and builds a format-agnostic DocumentModel
 */
export class DocumentBuilder {
  private tableImageRenderer = new TableImageRenderer();

  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager,
    private sentenceParser?: SentenceParser
  ) {}

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
    const manuscriptId = options.manuscriptId || 'default';

    // Process each section
    for (const section of sections) {
      const level = this.getHeadingLevel(section.heading);
      const paragraphs: DocumentParagraph[] = [];

      // Process each paragraph in the section
      for (const paragraphText of section.paragraphs) {
        // Check if this paragraph is a table
        if (this.tableImageRenderer.isMarkdownTable(paragraphText)) {
          const table = this.tableImageRenderer.parseMarkdownTable(paragraphText);
          if (table) {
            paragraphs.push({
              runs: [{
                type: 'table',
                content: '',
                table
              }]
            });
            continue;
          }
        }

        const runs: DocumentRun[] = [];
        
        // Check for images in the paragraph
        const images = this.tableImageRenderer.parseMarkdownImages(paragraphText);
        
        if (images.length > 0) {
          // Split paragraph by images
          let lastIndex = 0;
          
          for (const { match, image, index } of images) {
            // Add text before image
            if (index > lastIndex) {
              const textBefore = paragraphText.substring(lastIndex, index);
              const sentences = this.parseSentencesWithParser(textBefore, manuscriptId);
              
              for (const sentence of sentences) {
                runs.push({ type: 'text', content: sentence.text });
                
                // Collect citations for this sentence if footnotes are enabled
                if (options.includeFootnotes !== false) {
                  const citations = await this.collectCitationsForSentence(sentence.id);
                  
                  for (const citation of citations) {
                    allCitations.push(citation);
                    
                    const footnote: DocumentFootnote = {
                      id: footnoteIndex,
                      quoteText: citation.quoteText,
                      source: citation.source,
                      year: citation.year
                    };
                    footnotes.push(footnote);
                    
                    runs.push({
                      type: 'footnote-ref',
                      content: '',
                      footnoteId: footnoteIndex
                    });
                    
                    footnoteIndex++;
                  }
                }
              }
            }
            
            // Add image
            runs.push({
              type: 'image',
              content: '',
              image
            });
            
            lastIndex = index + match.length;
          }
          
          // Add remaining text after last image
          if (lastIndex < paragraphText.length) {
            const textAfter = paragraphText.substring(lastIndex);
            const sentences = this.parseSentencesWithParser(textAfter, manuscriptId);
            
            for (const sentence of sentences) {
              runs.push({ type: 'text', content: sentence.text });
              
              if (options.includeFootnotes !== false) {
                const citations = await this.collectCitationsForSentence(sentence.id);
                
                for (const citation of citations) {
                  allCitations.push(citation);
                  
                  const footnote: DocumentFootnote = {
                    id: footnoteIndex,
                    quoteText: citation.quoteText,
                    source: citation.source,
                    year: citation.year
                  };
                  footnotes.push(footnote);
                  
                  runs.push({
                    type: 'footnote-ref',
                    content: '',
                    footnoteId: footnoteIndex
                  });
                  
                  footnoteIndex++;
                }
              }
            }
          }
        } else {
          // No images, process normally
          const sentences = this.parseSentencesWithParser(paragraphText, manuscriptId);

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
    const metadata = {
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
  private buildBibliographyFromCitations(citations: CitedQuote[]) {
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
   * Parse paragraph into sentences using the SentenceParser
   * This generates proper sentence IDs that match the citation system
   * Also extracts images and tables from markdown
   */
  private parseSentencesWithParser(paragraph: string, manuscriptId: string): Sentence[] {
    if (!this.sentenceParser) {
      // Fallback to simple parsing if SentenceParser not available
      return this.parseSentencesSimple(paragraph);
    }
    
    return this.sentenceParser.parseSentences(paragraph, manuscriptId);
  }

  /**
   * Simple sentence parsing fallback
   * Removes HTML comment markers and inline fields that appear in the manuscript
   * Removes question markers (legacy and Obsidian callout format) and keeps only the answers
   */
  private parseSentencesSimple(paragraph: string): Sentence[] {
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
      text: text.trim(),
      originalText: text.trim(),
      position: 0,
      claims: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }));
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
}
