import type { SentenceParser, Sentence } from '@research-assistant/core';
import type { DocumentModel, DocumentSection, DocumentParagraph, DocumentRun, DocumentFootnote, DocumentImage, DocumentTable, DocumentCitation } from '../documentModel';
import type { ManuscriptExportOptions, CitedQuote } from '../exportService';
import { TableImageRenderer } from './TableImageRenderer';
import { ManuscriptParser } from './ManuscriptParser';
import { CitationCollector } from './CitationCollector';
import { SourceTagParser } from './SourceTagParser';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { ZoteroApiService, ZoteroItem } from '../../services/zoteroApiService';

/**
 * Handles document model building from manuscript text
 * Parses manuscript into sections, collects citations, and builds a format-agnostic DocumentModel
 */
export class DocumentBuilder {
  private tableImageRenderer = new TableImageRenderer();
  private citationCollector: CitationCollector;
  private zoteroApiService?: ZoteroApiService;
  private zoteroItemCache: Map<string, ZoteroItem> = new Map();

  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager,
    private sentenceParser?: SentenceParser,
    zoteroApiService?: ZoteroApiService
  ) {
    this.citationCollector = new CitationCollector(sentenceClaimQuoteLinkManager, claimsManager);
    this.zoteroApiService = zoteroApiService;
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
    const sections = ManuscriptParser.parseManuscriptSections(manuscriptText);
    const documentSections: DocumentSection[] = [];
    const allCitations: CitedQuote[] = [];
    const footnotes: DocumentFootnote[] = [];
    let footnoteIndex = 1;
    const manuscriptId = options.manuscriptId || 'default';

    // Process each section
    for (const section of sections) {
      const level = ManuscriptParser.getHeadingLevel(section.heading);
      const paragraphs: DocumentParagraph[] = [];

      // Split paragraphs by explicit break markers (---)
      const paragraphGroups = this.splitParagraphsByBreakMarkers(section.paragraphs);

      // Process each paragraph group
      for (const paragraphGroup of paragraphGroups) {
        // Combine all paragraphs in the group into one large paragraph
        const combinedRuns: DocumentRun[] = [];

        for (let groupIndex = 0; groupIndex < paragraphGroup.length; groupIndex++) {
          const paragraphText = paragraphGroup[groupIndex];
          
          // Check if this paragraph is a table
          if (this.tableImageRenderer.isMarkdownTable(paragraphText)) {
            const table = this.tableImageRenderer.parseMarkdownTable(paragraphText);
            if (table) {
              // Tables are kept as separate paragraphs
              paragraphs.push({
                runs: [{
                  type: 'table',
                  content: '',
                  table
                }]
              });
            }
            continue;
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
                
                for (let i = 0; i < sentences.length; i++) {
                  const sentence = sentences[i];
                  // Use the sentence text as-is (no extra spaces added)
                  const sentenceText = sentence.text;
                  
                  // Parse citations from the sentence text
                  const sentenceRuns = this.parseCitationsFromText(sentenceText);
                  runs.push(...sentenceRuns);
                  
                  // Collect citations for this sentence if footnotes are enabled
                  if (options.includeFootnotes !== false) {
                    const citations = await this.citationCollector.collectCitationsForSentence(sentence.id);
                    
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
              
              for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i];
                // Use the sentence text as-is (no extra spaces added)
                const sentenceText = sentence.text;
                
                // Parse citations from the sentence text
                const sentenceRuns = this.parseCitationsFromText(sentenceText);
                runs.push(...sentenceRuns);
                
                if (options.includeFootnotes !== false) {
                  const citations = await this.citationCollector.collectCitationsForSentence(sentence.id);
                  
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
            for (let i = 0; i < sentences.length; i++) {
              const sentence = sentences[i];
              // Use the sentence text as-is (no extra spaces added between sentences)
              const sentenceText = sentence.text;
              
              // Parse citations from the sentence text
              const sentenceRuns = this.parseCitationsFromText(sentenceText);
              runs.push(...sentenceRuns);

              // Collect citations for this sentence if footnotes are enabled
              if (options.includeFootnotes !== false) {
                const citations = await this.citationCollector.collectCitationsForSentence(sentence.id);
                
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

          // Add runs to combined runs, with space between paragraphs
          if (runs.length > 0) {
            combinedRuns.push(...runs);
            // Add space between paragraphs (except after the last one)
            if (groupIndex < paragraphGroup.length - 1) {
              combinedRuns.push({ type: 'text', content: ' ' });
            }
          }
        }

        // Add the combined paragraph if it has content
        if (combinedRuns.length > 0) {
          paragraphs.push({ runs: combinedRuns });
        }
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
      ? this.citationCollector.buildBibliographyFromCitations(allCitations)
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
   * Split paragraphs by explicit break markers (---)
   * Paragraphs separated by --- will be in different groups
   */
  private splitParagraphsByBreakMarkers(paragraphs: string[]): string[][] {
    const groups: string[][] = [];
    let currentGroup: string[] = [];

    for (const para of paragraphs) {
      if (para.trim() === '---') {
        // Break marker - start a new group
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
      } else {
        currentGroup.push(para);
      }
    }

    // Add final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups.length > 0 ? groups : [paragraphs];
  }

  /**
   * Parse paragraph into sentences using the SentenceParser
   * This generates proper sentence IDs that match the citation system
   * Also extracts images and tables from markdown
   * 
   * For Q&A content (callout format), we treat the entire answer block as a single sentence
   * to avoid unnecessary sentence splitting and preserve the original formatting.
   */
  private parseSentencesWithParser(paragraph: string, manuscriptId: string): Sentence[] {
    if (!this.sentenceParser) {
      // Fallback to simple parsing if SentenceParser not available
      return ManuscriptParser.parseSentencesSimple(paragraph);
    }
    
    // For Q&A content in callout format (lines starting with >), 
    // combine all lines into a single sentence with spaces
    if (paragraph.startsWith('>')) {
      // Remove callout markers and join lines with spaces
      const cleanedText = paragraph
        .split('\n')
        .map(line => line.replace(/^>\s*/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');
      
      return [{
        id: `S_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: cleanedText,
        startIndex: 0,
        endIndex: cleanedText.length
      }];
    }
    
    // For regular paragraphs, treat as a single sentence to avoid splitting
    return [{
      id: `S_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: paragraph,
      startIndex: 0,
      endIndex: paragraph.length
    }];
  }

  /**
   * Parse BibTeX citations from text
   * Converts \cite{KEY} and [source:: C_XX(AuthorYear)] to citation runs
   * 
   * @param text The text to parse
   * @returns Array of runs (text and citation)
   */
  private parseCitationsFromText(text: string): DocumentRun[] {
    // First, convert [source:: ...] tags to \cite{} format for unified processing
    const convertedText = this.convertSourceTagsToCite(text);
    
    const runs: DocumentRun[] = [];
    const citationRegex = /\\cite\{([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(convertedText)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        const textBefore = convertedText.substring(lastIndex, match.index);
        runs.push({
          type: 'text',
          content: textBefore
        });
      }

      // Add citation - metadata will be enriched later if Zotero is available
      const citeKey = match[1];
      const citation: DocumentCitation = {
        citeKey,
        zoteroKey: citeKey,
        displayText: `[${citeKey}]`
      };
      
      // Check if we have cached Zotero metadata for this key
      const cachedItem = this.zoteroItemCache.get(citeKey);
      if (cachedItem) {
        this.enrichCitationFromZoteroItem(citation, cachedItem);
      }
      
      runs.push({
        type: 'citation',
        content: '',
        citation
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < convertedText.length) {
      runs.push({
        type: 'text',
        content: convertedText.substring(lastIndex)
      });
    }

    // If no citations found, return single text run
    if (runs.length === 0) {
      runs.push({
        type: 'text',
        content: convertedText
      });
    }

    return runs;
  }

  /**
   * Convert [source:: C_XX(AuthorYear)] tags to \cite{AuthorYear} format
   * Only claims with (AuthorYear) are converted; others are removed
   */
  private convertSourceTagsToCite(text: string): string {
    return SourceTagParser.convertSourceTagsToCitations(text, (authorYears) => {
      if (authorYears.length === 0) return '';
      const keys = authorYears.map(ay => this.normalizeAuthorYear(ay));
      return `\\cite{${keys.join(',')}}`;
    });
  }

  /**
   * Normalize AuthorYear to a valid citation key
   * "Zou 2005" -> "Zou2005"
   */
  private normalizeAuthorYear(authorYear: string): string {
    return authorYear
      .replace(/\s+/g, '')  // Remove spaces
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
      .replace(/[^a-zA-Z0-9]/g, '');  // Remove special chars
  }

  /**
   * Enrich citation with metadata from Zotero item
   */
  private enrichCitationFromZoteroItem(citation: DocumentCitation, item: ZoteroItem): void {
    citation.title = item.title;
    citation.year = item.date ? this.extractYearFromDate(item.date) : undefined;
    
    if (item.creators && item.creators.length > 0) {
      const authorNames = item.creators.map(c => {
        if (c.name) return c.name;
        if (c.lastName) return c.firstName ? `${c.lastName}, ${c.firstName}` : c.lastName;
        return '';
      }).filter(n => n);
      
      citation.authors = authorNames.join('; ');
      
      // Create better display text: (Author et al., Year)
      const firstAuthor = item.creators[0];
      const authorDisplay = firstAuthor.lastName || firstAuthor.name || citation.citeKey;
      const etAl = item.creators.length > 1 ? ' et al.' : '';
      const yearDisplay = citation.year || '';
      citation.displayText = `(${authorDisplay}${etAl}, ${yearDisplay})`;
    }
  }

  /**
   * Extract year from various date formats
   */
  private extractYearFromDate(date: string): string | undefined {
    const match = date.match(/(\d{4})/);
    return match ? match[1] : undefined;
  }

  /**
   * Pre-fetch Zotero metadata for all citations in the manuscript
   * Call this before building the document model for enriched citations
   */
  public async prefetchZoteroMetadata(manuscriptText: string): Promise<void> {
    if (!this.zoteroApiService || !this.zoteroApiService.isConfigured()) {
      return;
    }

    // Extract all citation keys from manuscript (legacy \cite{} format)
    const citationRegex = /\\cite\{([^}]+)\}/g;
    const citeKeys = new Set<string>();
    let match;
    
    while ((match = citationRegex.exec(manuscriptText)) !== null) {
      citeKeys.add(match[1]);
    }

    // Also extract AuthorYear keys from [source:: ...] tags
    const authorYears = SourceTagParser.getAllAuthorYears(manuscriptText);
    for (const ay of authorYears) {
      citeKeys.add(this.normalizeAuthorYear(ay));
    }

    if (citeKeys.size === 0) {
      return;
    }

    // Fetch items from Zotero and cache them
    try {
      const items = await this.zoteroApiService.getItems(100);
      
      for (const item of items) {
        // Cache by Zotero key
        if (citeKeys.has(item.key)) {
          this.zoteroItemCache.set(item.key, item);
        }
        
        // Also cache by AuthorYear format for source tag lookups
        const itemAuthorYear = this.getItemAuthorYear(item);
        const normalizedAuthorYear = this.normalizeAuthorYear(itemAuthorYear);
        if (citeKeys.has(normalizedAuthorYear)) {
          this.zoteroItemCache.set(normalizedAuthorYear, item);
        }
      }
    } catch (error) {
      // Silently fail - citations will just use fallback display
      console.warn('Failed to prefetch Zotero metadata:', error);
    }
  }

  /**
   * Get AuthorYear string from Zotero item
   */
  private getItemAuthorYear(item: ZoteroItem): string {
    const firstAuthor = item.creators?.[0];
    const authorName = firstAuthor?.lastName || firstAuthor?.name || 'Unknown';
    const year = item.date?.match(/\d{4}/)?.[0] || '';
    return `${authorName}${year}`;
  }
}
