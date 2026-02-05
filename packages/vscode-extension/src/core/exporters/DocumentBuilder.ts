import type { SentenceParser, Sentence } from '@research-assistant/core';
import type { DocumentModel, DocumentSection, DocumentParagraph, DocumentRun, DocumentFootnote, DocumentImage, DocumentTable, DocumentCitation, CslItemData, CslAuthor } from '../documentModel';
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
        originalText: cleanedText,
        position: 0,
        claims: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];
    }
    
    // For regular paragraphs, treat as a single sentence to avoid splitting
    return [{
      id: `S_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: paragraph,
      originalText: paragraph,
      position: 0,
      claims: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }];
  }

  /**
   * Parse BibTeX citations from text
   * Converts \cite{KEY}, [source:: C_XX(AuthorYear)], and plain text (Author Year) to citation runs
   * 
   * @param text The text to parse
   * @returns Array of runs (text and citation)
   */
  private parseCitationsFromText(text: string): DocumentRun[] {
    // Convert [source:: ...] tags to \cite{} format for unified processing
    let convertedText = this.convertSourceTagsToCite(text);
    
    // Also convert plain text citations like (Author Year), (AuthorYear), (Author et al. Year)
    convertedText = this.convertPlainTextCitationsToCite(convertedText);
    
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
   * Convert plain text citations to \cite{} format
   * Matches patterns like:
   * - (Author Year) e.g., (Guyon 2002)
   * - (AuthorYear) e.g., (Johnson2007)
   * - (Author et al. Year) e.g., (Stuart et al. 2019)
   * - (Author and Author Year) e.g., (Zou and Hastie 2005)
   */
  private convertPlainTextCitationsToCite(text: string): string {
    // Pattern explanation:
    // \( - opening parenthesis
    // ([A-Z][a-zäöüéèàáíóúñ]*) - Author name starting with capital, may include diacritics
    // (?:\s+(?:et\s+al\.?|and\s+[A-Z][a-zäöüéèàáíóúñ]*))? - optional "et al." or "and Author"
    // [,\s]* - optional comma and/or space
    // (\d{4}) - 4-digit year
    // \) - closing parenthesis
    const plainCiteRegex = /\(([A-Z][a-zäöüéèàáíóúñ]*)(?:\s+(?:et\s+al\.?|and\s+[A-Z][a-zäöüéèàáíóúñ]*))?[,\s]*(\d{4})\)/g;
    
    return text.replace(plainCiteRegex, (match, author, year) => {
      // Normalize to AuthorYear format (no spaces)
      const citeKey = `${author}${year}`;
      return `\\cite{${citeKey}}`;
    });
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
    citation.zoteroKey = item.key;
    citation.zoteroUserId = this.getZoteroUserId();
    
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
    
    // Build full CSL-JSON item data for Zotero Word integration
    citation.itemData = this.buildCslItemData(item);
  }

  /**
   * Build CSL-JSON item data from Zotero item
   * This is the format Zotero Word plugin expects in citation fields
   */
  private buildCslItemData(item: ZoteroItem): CslItemData {
    const cslItem: CslItemData = {
      id: this.generateNumericId(item.key),
      type: this.mapZoteroTypeToCsl(item.itemType),
      title: item.title
    };
    
    // Map creators to CSL author format
    if (item.creators && item.creators.length > 0) {
      cslItem.author = item.creators.map(c => {
        if (c.name) {
          return { literal: c.name };
        }
        return {
          family: c.lastName || '',
          given: c.firstName || ''
        };
      });
    }
    
    // Map date to CSL issued format
    if (item.date) {
      const year = this.extractYearFromDate(item.date);
      if (year) {
        cslItem.issued = { 'date-parts': [[parseInt(year)]] };
      }
    }
    
    // Map other fields
    if (item.doi) {
      cslItem.DOI = item.doi;
    }
    if (item.url) {
      cslItem.URL = item.url;
    }
    if (item.abstractNote) {
      cslItem.abstract = item.abstractNote;
    }
    
    return cslItem;
  }

  /**
   * Map Zotero item type to CSL type
   */
  private mapZoteroTypeToCsl(zoteroType: string): string {
    const typeMap: Record<string, string> = {
      'journalArticle': 'article-journal',
      'book': 'book',
      'bookSection': 'chapter',
      'conferencePaper': 'paper-conference',
      'thesis': 'thesis',
      'report': 'report',
      'webpage': 'webpage',
      'patent': 'patent',
      'preprint': 'article',
      'manuscript': 'manuscript',
      'document': 'document'
    };
    return typeMap[zoteroType] || 'article';
  }

  /**
   * Generate a numeric ID from a string key
   * Zotero expects numeric IDs in the citation field
   */
  private generateNumericId(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get Zotero user ID from the API service
   */
  private getZoteroUserId(): string | undefined {
    // The ZoteroApiService stores the userID, but we need to access it
    // For now, we'll try to get it from VS Code settings
    try {
      const vscode = require('vscode');
      const config = vscode.workspace.getConfiguration('researchAssistant');
      return config.get('zoteroUserId') as string | undefined;
    } catch {
      return undefined;
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
      console.log('[DocumentBuilder] Zotero API not configured, skipping metadata prefetch');
      return;
    }

    console.log('[DocumentBuilder] Starting Zotero metadata prefetch...');

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

    // Also extract plain text citations like (Author Year), (AuthorYear)
    const plainCiteRegex = /\(([A-Z][a-zäöüéèàáíóúñ]*)(?:\s+(?:et\s+al\.?|and\s+[A-Z][a-zäöüéèàáíóúñ]*))?[,\s]*(\d{4})\)/g;
    while ((match = plainCiteRegex.exec(manuscriptText)) !== null) {
      const author = match[1];
      const year = match[2];
      citeKeys.add(`${author}${year}`);
    }

    console.log(`[DocumentBuilder] Found ${citeKeys.size} unique citation keys:`, Array.from(citeKeys).slice(0, 10));

    if (citeKeys.size === 0) {
      return;
    }

    // Fetch items from Zotero and cache them
    try {
      console.log('[DocumentBuilder] Fetching items from Zotero API...');
      const items = await this.zoteroApiService.getItems(100);
      console.log(`[DocumentBuilder] Retrieved ${items.length} items from Zotero`);
      
      let matchCount = 0;
      for (const item of items) {
        // Cache by Zotero key
        if (citeKeys.has(item.key)) {
          this.zoteroItemCache.set(item.key, item);
          matchCount++;
          console.log(`[DocumentBuilder] Matched by key: ${item.key}`);
        }
        
        // Also cache by AuthorYear format for source tag lookups
        const itemAuthorYear = this.getItemAuthorYear(item);
        const normalizedAuthorYear = this.normalizeAuthorYear(itemAuthorYear);
        if (citeKeys.has(normalizedAuthorYear)) {
          this.zoteroItemCache.set(normalizedAuthorYear, item);
          matchCount++;
          console.log(`[DocumentBuilder] Matched by AuthorYear: ${normalizedAuthorYear} -> ${item.title?.substring(0, 50)}`);
        }
      }
      
      console.log(`[DocumentBuilder] Cached ${matchCount} matching items`);
    } catch (error) {
      // Silently fail - citations will just use fallback display
      console.warn('[DocumentBuilder] Failed to prefetch Zotero metadata:', error);
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
