/**
 * Word Renderer for exporting manuscripts to .docx format
 * 
 * This module provides a renderer that transforms a DocumentModel into
 * a valid Microsoft Word document (.docx) using the docx library.
 * 
 * This is a facade that coordinates the rendering of different document elements:
 * - Tables (via WordTableRenderer)
 * - Images (via WordImageRenderer)
 * - Formatting (via wordFormattingUtils)
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  FootnoteReferenceRun,
  Packer,
  convertInchesToTwip,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  SimpleField
} from 'docx';

import type {
  DocumentModel,
  DocumentSection,
  DocumentParagraph,
  DocumentRun,
  DocumentFootnote,
  BibliographyEntry,
  DocumentImage,
  DocumentTable
} from './documentModel';

import { WordTableRenderer } from './exporters/wordTableRenderer';
import { WordImageRenderer } from './exporters/wordImageRenderer';
import {
  WORD_STYLES,
  getHeadingStyle,
  mapHeadingLevel,
  formatFootnoteContent,
  formatBibliographyEntry
} from './exporters/wordFormattingUtils';

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Renders a DocumentModel to a Word document buffer
 * 
 * This is a facade that coordinates rendering of different document elements.
 */
export class WordRenderer {
  private footnoteMap: Map<number, DocumentFootnote>;
  private tableRenderer: WordTableRenderer;
  private imageRenderer: WordImageRenderer;

  constructor(model?: DocumentModel) {
    this.footnoteMap = new Map();
    this.tableRenderer = new WordTableRenderer();
    this.imageRenderer = new WordImageRenderer();
    if (model) {
      for (const footnote of model.metadata.footnotes) {
        this.footnoteMap.set(footnote.id, footnote);
      }
    }
  }

  /**
   * Render a DocumentModel to a Word document buffer
   * 
   * @param model The document model to render
   * @returns Promise resolving to a Buffer containing the .docx file
   */
  public async render(model: DocumentModel): Promise<Buffer> {
    // Build footnote map for reference during rendering
    this.footnoteMap.clear();
    for (const footnote of model.metadata.footnotes) {
      this.footnoteMap.set(footnote.id, footnote);
    }

    // Build document content paragraphs
    const contentParagraphs = this.buildContent(model);

    // Build footnotes section for the document
    const footnotes = this.buildFootnotes(model.metadata.footnotes);

    // Create the Word document
    const doc = new Document({
      footnotes,
      sections: [
        {
          children: contentParagraphs,
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1)
              }
            }
          }
        }
      ]
    });

    // Convert document to buffer
    return await Packer.toBuffer(doc);
  }

  /**
   * Build the content paragraphs for the document (6.1, 6.2, 6.3, 6.5)
   * 
   * @param model The document model
   * @returns Array of Word Paragraph objects
   */
  private buildContent(model: DocumentModel): Array<Paragraph | Table> {
    const content: Array<Paragraph | Table> = [];

    // Render sections and their content
    for (const section of model.sections) {
      // Add heading paragraph (6.2)
      content.push(this.createHeadingParagraph(section.heading, section.level));

      // Add section paragraphs (6.3)
      for (const paragraph of section.paragraphs) {
        const result = this.createBodyContent(paragraph);
        if (Array.isArray(result)) {
          content.push(...result);
        } else {
          content.push(result);
        }
      }
    }

    // Add bibliography section if included (6.5)
    if (model.metadata.includeBibliography && model.bibliography.length > 0) {
      content.push(...this.createBibliographySection(model.bibliography));
    }

    return content;
  }

  /**
   * Create a heading paragraph with appropriate Word heading style (6.2)
   * 
   * @param text The heading text
   * @param level The heading level (1-6)
   * @returns A Word Paragraph object
   */
  private createHeadingParagraph(text: string, level: number): Paragraph {
    const headingLevel = mapHeadingLevel(level);
    const style = getHeadingStyle(level);

    return new Paragraph({
      text,
      heading: headingLevel,
      style: `Heading${level}`,
      run: {
        font: style.font,
        size: style.size,
        bold: style.bold
      }
    });
  }

  /**
   * Create body content from a paragraph (may include text, images, or tables)
   * 
   * @param paragraph The document paragraph
   * @returns Paragraph, Table, or array of mixed content
   */
  private createBodyContent(paragraph: DocumentParagraph): Paragraph | Table | Array<Paragraph | Table> {
    // Check if this is a table paragraph
    if (paragraph.runs.length === 1 && paragraph.runs[0].type === 'table') {
      return this.tableRenderer.createTable(paragraph.runs[0].table!);
    }

    // Check if paragraph contains images
    const hasImages = paragraph.runs.some(run => run.type === 'image');

    if (hasImages) {
      // Split into multiple paragraphs if needed
      const content: Array<Paragraph | Table> = [];
      let currentRuns: (TextRun | FootnoteReferenceRun | ImageRun)[] = [];

      for (const run of paragraph.runs) {
        if (run.type === 'image') {
          // Flush current runs as a paragraph
          if (currentRuns.length > 0) {
            content.push(
              new Paragraph({
                children: currentRuns,
                spacing: {
                  line: 480,
                  lineRule: 'auto'
                }
              })
            );
            currentRuns = [];
          }

          // Add image as its own paragraph
          const imageRun = this.imageRenderer.createImageRun(run.image!);
          if (imageRun) {
            content.push(
              new Paragraph({
                children: [imageRun],
                spacing: {
                  before: 200,
                  after: 200
                }
              })
            );
          }
        } else if (run.type === 'text') {
          currentRuns.push(
            new TextRun({
              text: run.content,
              font: WORD_STYLES.body.font,
              size: WORD_STYLES.body.size
            })
          );
        } else if (run.type === 'footnote-ref' && run.footnoteId !== undefined) {
          currentRuns.push(new FootnoteReferenceRun(run.footnoteId));
        }
      }

      // Flush remaining runs
      if (currentRuns.length > 0) {
        content.push(
          new Paragraph({
            children: currentRuns,
            spacing: {
              line: 480,
              lineRule: 'auto'
            }
          })
        );
      }

      return content;
    }

    // Regular paragraph with text and footnotes
    return this.createBodyParagraph(paragraph);
  }

  /**
   * Create a body paragraph with text runs, footnote references, and citations (6.3)
   * 
   * @param paragraph The document paragraph
   * @returns A Word Paragraph object
   */
  private createBodyParagraph(paragraph: DocumentParagraph): Paragraph {
    const runs: (TextRun | FootnoteReferenceRun | SimpleField)[] = [];

    for (const run of paragraph.runs) {
      if (run.type === 'text') {
        // Regular text run (6.3)
        runs.push(
          new TextRun({
            text: run.content,
            font: WORD_STYLES.body.font,
            size: WORD_STYLES.body.size
          })
        );
      } else if (run.type === 'footnote-ref' && run.footnoteId !== undefined) {
        // Footnote reference run (6.3, 6.4)
        runs.push(
          new FootnoteReferenceRun(run.footnoteId)
        );
      } else if (run.type === 'citation' && run.citation) {
        // Zotero citation field
        const citationField = this.createZoteroCitationField(run.citation);
        runs.push(citationField);
      }
    }

    return new Paragraph({
      children: runs,
      spacing: {
        line: 480, // 1.5 line spacing (240 = single, 480 = double)
        lineRule: 'auto'
      }
    });
  }

  /**
   * Create a Zotero citation field for Word
   * 
   * This creates a Word field that Zotero plugin will recognize and format.
   * The field code uses Zotero's ADDIN format which Word will preserve.
   * 
   * @param citation The citation data
   * @returns A SimpleField that Word/Zotero can process
   */
  private createZoteroCitationField(citation: any): SimpleField {
    const zoteroKey = citation.zoteroKey || citation.citeKey;
    const displayText = citation.displayText || `[${citation.citeKey}]`;
    
    // Build citation item with available metadata
    const citationItem: Record<string, any> = {
      id: zoteroKey,
      uris: [`http://zotero.org/users/local/${zoteroKey}`]
    };
    
    // Add enriched metadata if available
    if (citation.authors) {
      citationItem['author'] = citation.authors;
    }
    if (citation.year) {
      citationItem['issued'] = { 'date-parts': [[parseInt(citation.year)]] };
    }
    if (citation.title) {
      citationItem['title'] = citation.title;
    }
    
    // Create Zotero ADDIN field code with full CSL citation structure
    const cslCitation = {
      citationID: `cite_${zoteroKey}_${Date.now()}`,
      properties: {
        formattedCitation: displayText,
        plainCitation: displayText.replace(/[()[\]]/g, ''),
        noteIndex: 0
      },
      citationItems: [citationItem],
      schema: 'https://github.com/citation-style-language/schema/raw/master/csl-citation.json'
    };
    
    // SimpleField takes the instruction string directly
    const fieldCode = `ADDIN ZOTERO_ITEM CSL_CITATION ${JSON.stringify(cslCitation)}`;
    
    return new SimpleField(fieldCode);
  }

  /**
   * Build the footnotes section for the document (6.4)
   * 
   * @param footnotes Array of footnotes
   * @returns Footnotes configuration object for docx Document
   */
  private buildFootnotes(footnotes: DocumentFootnote[]): Record<number, { children: Paragraph[] }> {
    const footnotesObj: Record<number, { children: Paragraph[] }> = {};

    for (const footnote of footnotes) {
      const content = formatFootnoteContent(footnote.quoteText, footnote.source, footnote.year);
      footnotesObj[footnote.id] = {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: content,
                font: WORD_STYLES.footnote.font,
                size: WORD_STYLES.footnote.size
              })
            ]
          })
        ]
      };
    }

    return footnotesObj;
  }

  /**
   * Create the bibliography section paragraphs (6.5)
   * 
   * @param entries Bibliography entries to render
   * @returns Array of Word Paragraph objects for the bibliography
   */
  private createBibliographySection(entries: BibliographyEntry[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Add bibliography heading (6.5)
    paragraphs.push(
      new Paragraph({
        text: 'Bibliography',
        heading: HeadingLevel.HEADING_1,
        style: 'Heading1',
        run: {
          font: WORD_STYLES.heading1.font,
          size: WORD_STYLES.heading1.size,
          bold: WORD_STYLES.heading1.bold
        }
      })
    );

    // Add each bibliography entry (6.5)
    for (const entry of entries) {
      const formattedEntry = formatBibliographyEntry(entry.source, entry.year);

      paragraphs.push(
        new Paragraph({
          text: formattedEntry,
          run: {
            font: WORD_STYLES.bibliography.font,
            size: WORD_STYLES.bibliography.size
          },
          spacing: {
            line: 480,
            lineRule: 'auto'
          }
        })
      );
    }

    return paragraphs;
  }
}
