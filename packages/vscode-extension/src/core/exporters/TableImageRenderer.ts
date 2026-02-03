import type { DocumentImage, DocumentTable } from '../documentModel';

/**
 * Handles table and image rendering utilities
 * Provides methods for parsing and rendering markdown tables and images
 */
export class TableImageRenderer {
  /**
   * Parse markdown images from text
   * Format: ![alt text](path/to/image.png)
   */
  public parseMarkdownImages(text: string): Array<{ match: string; image: DocumentImage; index: number }> {
    const images: Array<{ match: string; image: DocumentImage; index: number }> = [];
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = imageRegex.exec(text)) !== null) {
      images.push({
        match: match[0],
        image: {
          path: match[2],
          altText: match[1] || 'Image',
          caption: match[1] || undefined
        },
        index: match.index
      });
    }
    
    return images;
  }

  /**
   * Parse markdown tables from text
   * Supports standard markdown table format with | delimiters
   */
  public parseMarkdownTable(text: string): DocumentTable | null {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      return null;
    }
    
    // Check if this looks like a table (has | characters)
    if (!lines[0].includes('|')) {
      return null;
    }
    
    const rows: string[][] = [];
    let hasHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip separator line (e.g., |---|---|)
      if (line.match(/^\|?[\s\-:|]+\|?$/)) {
        hasHeader = i > 0; // If we see a separator, previous row was header
        continue;
      }
      
      // Parse table row
      const cells = line
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    if (rows.length === 0) {
      return null;
    }
    
    return {
      rows,
      hasHeader
    };
  }

  /**
   * Check if a paragraph is a markdown table
   */
  public isMarkdownTable(paragraph: string): boolean {
    const lines = paragraph.trim().split('\n');
    if (lines.length < 2) {
      return false;
    }
    
    // Check if first line has pipes and second line is a separator
    return lines[0].includes('|') && 
           (lines[1].match(/^\|?[\s\-:|]+\|?$/) !== null);
  }
}
