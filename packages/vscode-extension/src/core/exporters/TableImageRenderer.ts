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
    console.log(`[TableImageRenderer] Parsing table from text (${text.length} chars)`);
    
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      console.log(`[TableImageRenderer] Not enough lines for a table: ${lines.length}`);
      return null;
    }
    
    // Check if this looks like a table (has | characters)
    if (!lines[0].includes('|')) {
      console.log(`[TableImageRenderer] First line doesn't contain pipes`);
      return null;
    }
    
    const rows: string[][] = [];
    let hasHeader = false;
    let separatorFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      console.log(`[TableImageRenderer] Processing line ${i}: "${line}"`);
      
      // Skip empty lines
      if (line.length === 0) {
        console.log(`[TableImageRenderer] Skipping empty line ${i}`);
        continue;
      }
      
      // Check if this is a separator line (e.g., |---|---|)
      if (line.match(/^\|?[\s\-:|]+\|?$/)) {
        console.log(`[TableImageRenderer] Line ${i} is a separator, marking hasHeader=true`);
        hasHeader = rows.length > 0; // If we have rows before separator, they're headers
        separatorFound = true;
        continue;
      }
      
      // Parse table row - strip leading/trailing pipes then split
      let rowContent = line;
      // Remove leading pipe
      if (rowContent.startsWith('|')) {
        rowContent = rowContent.substring(1);
      }
      // Remove trailing pipe
      if (rowContent.endsWith('|')) {
        rowContent = rowContent.substring(0, rowContent.length - 1);
      }
      
      const cells = rowContent
        .split('|')
        .map(cell => cell.trim());
      
      console.log(`[TableImageRenderer] Line ${i} parsed into ${cells.length} cells:`, cells);
      
      // Filter out rows that are entirely empty cells
      if (cells.length > 0 && cells.some(cell => cell.length > 0)) {
        rows.push(cells);
      } else {
        console.log(`[TableImageRenderer] Skipping line ${i} - all cells empty`);
      }
    }
    
    if (rows.length === 0) {
      console.log(`[TableImageRenderer] No valid rows found`);
      return null;
    }
    
    // If no separator was found, assume no header
    if (!separatorFound) {
      hasHeader = false;
    }
    
    console.log(`[TableImageRenderer] Table parsed: ${rows.length} rows, hasHeader=${hasHeader}`);
    
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
    
    // Check if first line has pipes
    if (!lines[0].includes('|')) {
      return false;
    }
    
    // Check if second line is a separator (standard markdown table format)
    if (lines[1].match(/^\|?[\s\-:|]+\|?$/)) {
      return true;
    }
    
    // Also accept tables without separators (simple pipe-delimited format)
    // If we have at least 2 lines with pipes, it's likely a table
    if (lines.length >= 2 && lines[1].includes('|')) {
      return true;
    }
    
    return false;
  }
}
