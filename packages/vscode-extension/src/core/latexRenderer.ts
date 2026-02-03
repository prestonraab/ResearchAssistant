/**
 * LaTeX Renderer for exporting manuscripts to .tex format
 * 
 * This module provides a renderer that transforms a DocumentModel into
 * valid LaTeX source code suitable for compilation with pdflatex or xelatex.
 */

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

import * as path from 'path';

/**
 * Renders a DocumentModel to LaTeX source code
 */
export class LaTeXRenderer {
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
   * Render a DocumentModel to LaTeX source text
   * 
   * @param model The document model to render
   * @returns LaTeX source code as a string
   */
  public render(model: DocumentModel): string {
    // Build footnote map for reference during rendering
    this.footnoteMap.clear();
    for (const footnote of model.metadata.footnotes) {
      this.footnoteMap.set(footnote.id, footnote);
    }

    const lines: string[] = [];

    // Generate preamble (4.1)
    lines.push(this.generatePreamble());
    lines.push('\\begin{document}');
    lines.push('');

    // Render sections and their content
    for (const section of model.sections) {
      lines.push(this.renderSection(section));
      lines.push('');
    }

    // Render bibliography if included (4.5)
    if (model.metadata.includeBibliography && model.bibliography.length > 0) {
      lines.push(this.renderBibliography(model.bibliography));
      lines.push('');
    }

    lines.push('\\end{document}');

    return lines.join('\n');
  }

  /**
   * Generate LaTeX preamble with document class and packages (4.1)
   * 
   * @returns LaTeX preamble string
   */
  private generatePreamble(): string {
    return `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{times}
\\usepackage[margin=1in]{geometry}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{array}

\\title{}
\\author{}
\\date{}`;
  }

  /**
   * Render a document section with its heading and paragraphs (4.3, 4.4)
   * 
   * @param section The section to render
   * @returns LaTeX source for the section
   */
  private renderSection(section: DocumentSection): string {
    const lines: string[] = [];

    // Render section heading with appropriate LaTeX command (4.3)
    const command = this.getSectionCommand(section.level);
    lines.push(`${command}{${this.escapeLatex(section.heading)}}`);
    lines.push('');

    // Render paragraphs in the section (4.4)
    for (const paragraph of section.paragraphs) {
      lines.push(this.renderParagraph(paragraph));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get the LaTeX section command for a given heading level (4.3)
   * 
   * @param level Heading level (1-6)
   * @returns LaTeX section command (e.g., \section, \subsection)
   */
  private getSectionCommand(level: number): string {
    const commands = [
      '\\section',
      '\\subsection',
      '\\subsubsection',
      '\\paragraph',
      '\\subparagraph'
    ];
    // Clamp level to valid range
    const index = Math.min(level - 1, commands.length - 1);
    return commands[index];
  }

  /**
   * Render a paragraph with text runs, footnote references, images, and tables (4.4)
   * 
   * @param paragraph The paragraph to render
   * @returns LaTeX source for the paragraph
   */
  private renderParagraph(paragraph: DocumentParagraph): string {
    // Check if this is a table paragraph
    if (paragraph.runs.length === 1 && paragraph.runs[0].type === 'table') {
      return this.renderTable(paragraph.runs[0].table!);
    }

    const parts: string[] = [];

    for (const run of paragraph.runs) {
      if (run.type === 'text') {
        // Regular text run - escape special characters (4.2)
        parts.push(this.escapeLatex(run.content));
      } else if (run.type === 'footnote-ref' && run.footnoteId !== undefined) {
        // Footnote reference - insert \footnote command with quote and source (4.4)
        const footnote = this.footnoteMap.get(run.footnoteId);
        if (footnote) {
          const footnoteContent = this.buildFootnoteContent(footnote);
          parts.push(`\\footnote{${footnoteContent}}`);
        }
      } else if (run.type === 'image' && run.image) {
        // Image - insert \includegraphics command
        parts.push('\n\n');
        parts.push(this.renderImage(run.image));
        parts.push('\n\n');
      }
    }

    return parts.join('');
  }

  /**
   * Render an image as LaTeX figure
   * 
   * @param image The image data
   * @returns LaTeX source for the image
   */
  private renderImage(image: DocumentImage): string {
    const lines: string[] = [];
    
    lines.push('\\begin{figure}[htbp]');
    lines.push('\\centering');
    
    // Convert path to relative if needed and escape
    const imagePath = this.escapeLatex(image.path);
    
    // Add width specification if provided
    if (image.width) {
      const widthInches = image.width / 72; // Convert pixels to inches (72 DPI)
      lines.push(`\\includegraphics[width=${widthInches.toFixed(2)}in]{${imagePath}}`);
    } else {
      lines.push(`\\includegraphics[width=0.8\\textwidth]{${imagePath}}`);
    }
    
    // Add caption if provided
    if (image.caption) {
      lines.push(`\\caption{${this.escapeLatex(image.caption)}}`);
    }
    
    lines.push('\\end{figure}');
    
    return lines.join('\n');
  }

  /**
   * Render a table as LaTeX tabular environment
   * 
   * @param table The table data
   * @returns LaTeX source for the table
   */
  private renderTable(table: DocumentTable): string {
    if (table.rows.length === 0) {
      return '';
    }

    const lines: string[] = [];
    const numCols = table.rows[0].length;
    
    // Start table environment
    lines.push('\\begin{table}[htbp]');
    lines.push('\\centering');
    
    // Add caption if provided
    if (table.caption) {
      lines.push(`\\caption{${this.escapeLatex(table.caption)}}`);
    }
    
    // Start tabular with column specification (left-aligned columns)
    const colSpec = 'l'.repeat(numCols);
    lines.push(`\\begin{tabular}{${colSpec}}`);
    lines.push('\\toprule');
    
    // Render rows
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      const isHeader = table.hasHeader && i === 0;
      
      // Escape and join cells with &
      const cells = row.map(cell => this.escapeLatex(cell));
      lines.push(cells.join(' & ') + ' \\\\');
      
      // Add midrule after header
      if (isHeader) {
        lines.push('\\midrule');
      }
    }
    
    lines.push('\\bottomrule');
    lines.push('\\end{tabular}');
    lines.push('\\end{table}');
    
    return lines.join('\n');
  }

  /**
   * Build the content of a footnote from quote text and source (4.4)
   * 
   * @param footnote The footnote to format
   * @returns Escaped footnote content
   */
  private buildFootnoteContent(footnote: DocumentFootnote): string {
    const parts: string[] = [];

    // Add quote text
    if (footnote.quoteText) {
      parts.push(this.escapeLatex(footnote.quoteText));
    }

    // Add source and year
    if (footnote.source) {
      const sourceStr = footnote.year
        ? `${this.escapeLatex(footnote.source)}, ${footnote.year}`
        : this.escapeLatex(footnote.source);
      parts.push(sourceStr);
    }

    return parts.join(' --- ');
  }

  /**
   * Escape special LaTeX characters in text (4.2)
   * 
   * Special characters that need escaping: % $ & # _ { } ~ ^ \
   * 
   * @param text The text to escape
   * @returns Escaped text safe for LaTeX
   */
  private escapeLatex(text: string): string {
    // Order matters: we need to escape backslash first, but use a placeholder
    // to avoid escaping the backslashes we add for other characters
    const BACKSLASH_PLACEHOLDER = '\x00BACKSLASH\x00';
    
    return text
      // Replace backslashes with placeholder
      .replace(/\\/g, BACKSLASH_PLACEHOLDER)
      // Escape other special characters
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/&/g, '\\&')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}')
      // Replace placeholder with escaped backslash
      .replace(new RegExp(BACKSLASH_PLACEHOLDER, 'g'), '\\textbackslash{}');
  }

  /**
   * Render the bibliography section (4.5)
   * 
   * @param entries Bibliography entries to render
   * @returns LaTeX source for the bibliography section
   */
  private renderBibliography(entries: BibliographyEntry[]): string {
    const lines: string[] = [];

    // Add bibliography heading (4.5)
    lines.push('\\section*{Bibliography}');
    lines.push('\\begin{itemize}');
    lines.push('');

    // Render each bibliography entry (4.5)
    for (const entry of entries) {
      const year = entry.year ? ` (${entry.year})` : '';
      const formattedEntry = `${this.escapeLatex(entry.source)}${year}`;
      lines.push(`\\item ${formattedEntry}`);
    }

    lines.push('');
    lines.push('\\end{itemize}');

    return lines.join('\n');
  }
}
