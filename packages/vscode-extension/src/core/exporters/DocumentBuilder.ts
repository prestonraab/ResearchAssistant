import type { SentenceParser, Sentence } from '@research-assistant/core';
import type { DocumentModel, DocumentSection, DocumentParagraph, DocumentRun, DocumentFootnote, DocumentImage, DocumentTable } from '../documentModel';
import type { ManuscriptExportOptions, CitedQuote } from '../exportService';
import { TableImageRenderer } from './TableImageRenderer';
import { ManuscriptParser } from './ManuscriptParser';
import { CitationCollector } from './CitationCollector';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../claimsManagerWrapper';

/**
 * Handles document model building from manuscript text
 * Parses manuscript into sections, collects citations, and builds a format-agnostic DocumentModel
 */
export class DocumentBuilder {
  private tableImageRenderer = new TableImageRenderer();
  private citationCollector: CitationCollector;

  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager,
    private sentenceParser?: SentenceParser
  ) {
    this.citationCollector = new CitationCollector(sentenceClaimQuoteLinkManager, claimsManager);
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
            
            for (const sentence of sentences) {
              runs.push({ type: 'text', content: sentence.text });
              
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
          for (const sentence of sentences) {
            // Add text run for the sentence
            runs.push({ type: 'text', content: sentence.text });

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
   * Parse paragraph into sentences using the SentenceParser
   * This generates proper sentence IDs that match the citation system
   * Also extracts images and tables from markdown
   */
  private parseSentencesWithParser(paragraph: string, manuscriptId: string): Sentence[] {
    if (!this.sentenceParser) {
      // Fallback to simple parsing if SentenceParser not available
      return ManuscriptParser.parseSentencesSimple(paragraph);
    }
    
    return this.sentenceParser.parseSentences(paragraph, manuscriptId);
  }
}
