/**
 * Word Renderer for exporting manuscripts to .docx format
 * 
 * This module provides a renderer that transforms a DocumentModel into
 * a valid Microsoft Word document (.docx) using the docx library.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  FootnoteReferenceRun,
  Packer,
  convertInchesToTwip
} from 'docx';

import type {
  DocumentModel,
  DocumentSection,
  DocumentParagraph,
  DocumentRun,
  DocumentFootnote,
  BibliographyEntry
} from './documentModel';

/**
 * Configuration for Word document styles
 */
const WORD_STYLES = {
  body: {
    font: 'Times New Roman',
    size: 24 // 12pt in half-points
  },
  heading1: {
    font: 'Times New Roman',
    size: 32, // 16pt
    bold: true
  },
  heading2: {
    font: 'Times New Roman',
    size: 28, // 14pt
    bold: true
  },
  heading3: {
    font: 'Times New Roman',
    size: 26, // 13pt
    bold: true
  },
  footnote: {
    font: 'Times New Roman',
    size: 20 // 10pt
  },
  bibliography: {
    font: 'Times New Roman',
    size: 24 // 12pt
  }
};

/**
 * Renders a DocumentModel to a Word document buffer
 */
export class WordRenderer {
  private footnoteMap: Map<number, DocumentFootnote>;

  constructor(model?: DocumentModel) {
    this.footnoteMap = new Map();
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
  private buildContent(model: DocumentModel): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Render sections and their content
    for (const section of model.sections) {
      // Add heading paragraph (6.2)
      paragraphs.push(this.createHeadingParagraph(section.heading, section.level));

      // Add section paragraphs (6.3)
      for (const paragraph of section.paragraphs) {
        paragraphs.push(this.createBodyParagraph(paragraph));
      }
    }

    // Add bibliography section if included (6.5)
    if (model.metadata.includeBibliography && model.bibliography.length > 0) {
      paragraphs.push(...this.createBibliographySection(model.bibliography));
    }

    return paragraphs;
  }

  /**
   * Create a heading paragraph with appropriate Word heading style (6.2)
   * 
   * @param text The heading text
   * @param level The heading level (1-6)
   * @returns A Word Paragraph object
   */
  private createHeadingParagraph(text: string, level: number): Paragraph {
    // Map heading level to Word HeadingLevel enum
    const headingLevels = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6
    ];

    const headingLevel = headingLevels[Math.min(level - 1, 5)] || HeadingLevel.HEADING_1;
    const style = this.getHeadingStyle(level);

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
   * Get the style configuration for a heading level (6.2)
   * 
   * @param level The heading level
   * @returns Style configuration object
   */
  private getHeadingStyle(level: number): { font: string; size: number; bold: boolean } {
    switch (level) {
      case 1:
        return WORD_STYLES.heading1;
      case 2:
        return WORD_STYLES.heading2;
      case 3:
        return WORD_STYLES.heading3;
      default:
        return WORD_STYLES.heading1;
    }
  }

  /**
   * Create a body paragraph with text runs and footnote references (6.3)
   * 
   * @param paragraph The document paragraph
   * @returns A Word Paragraph object
   */
  private createBodyParagraph(paragraph: DocumentParagraph): Paragraph {
    const runs: (TextRun | FootnoteReferenceRun)[] = [];

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
   * Build the footnotes section for the document (6.4)
   * 
   * @param footnotes Array of footnotes
   * @returns Footnotes configuration object for docx Document
   */
  private buildFootnotes(footnotes: DocumentFootnote[]): Record<number, { children: Paragraph[] }> {
    const footnotesObj: Record<number, { children: Paragraph[] }> = {};

    for (const footnote of footnotes) {
      const content = this.buildFootnoteContent(footnote);
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
   * Build the content of a footnote from quote text and source (6.4)
   * 
   * @param footnote The footnote to format
   * @returns Formatted footnote content string
   */
  private buildFootnoteContent(footnote: DocumentFootnote): string {
    const parts: string[] = [];

    // Add quote text
    if (footnote.quoteText) {
      parts.push(footnote.quoteText);
    }

    // Add source and year
    if (footnote.source) {
      const sourceStr = footnote.year
        ? `${footnote.source}, ${footnote.year}`
        : footnote.source;
      parts.push(sourceStr);
    }

    return parts.join(' --- ');
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
      const year = entry.year ? ` (${entry.year})` : '';
      const formattedEntry = `${entry.source}${year}`;

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
