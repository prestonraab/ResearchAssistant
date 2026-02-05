import type { Sentence } from '@research-assistant/core';

/**
 * Handles manuscript parsing utilities
 * Extracts sections, paragraphs, and sentences from manuscript text
 */
export class ManuscriptParser {
  /**
   * Parse manuscript into sections (headings + paragraphs)
   * Removes HTML comment markers (<!-- [undefined] -->) that appear in the manuscript
   * Removes question markers (legacy **Question?** and Obsidian callouts) and combines answers into paragraphs
   * Removes inline fields like (status:: X) and [source:: X] for clean export
   * Preserves markdown tables as separate paragraphs
   */
  public static parseManuscriptSections(text: string): Array<{ heading: string; paragraphs: string[] }> {
    const sections: Array<{ heading: string; paragraphs: string[] }> = [];
    const lines = text.split('\n');

    let currentSection = { heading: '', paragraphs: [] as string[] };
    let currentParagraph = '';
    let inCallout = false;
    let inTable = false;
    let tableLines: string[] = [];

    for (const line of lines) {
      let cleanedLine = line.trim();
      
      // Remove HTML comment markers from the line (legacy format)
      cleanedLine = cleanedLine.replace(/<!--\s*\[undefined\]\s*-->/g, '');
      cleanedLine = cleanedLine.replace(/<!--\s*\[[^\]]+\]\s*-->/g, '');
      cleanedLine = cleanedLine.replace(/<!--\s*Source:[^>]+?-->/g, '');
      
      // Remove legacy question markers (bold text ending with ?)
      cleanedLine = cleanedLine.replace(/\*\*[^*]+\?\*\*\s*/g, '');
      
      // Check if this line is part of a markdown table
      const isTableLine = cleanedLine.includes('|');
      
      if (isTableLine) {
        // If we were in a paragraph, save it first
        if (currentParagraph.trim() && !inTable) {
          currentSection.paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        
        inTable = true;
        tableLines.push(cleanedLine);
        continue;
      } else if (inTable) {
        // End of table - save it as a paragraph
        if (tableLines.length > 0) {
          currentSection.paragraphs.push(tableLines.join('\n'));
          tableLines = [];
        }
        inTable = false;
      }
      
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
        
        // Remove inline fields: (status:: X) but KEEP [source:: X] for citation processing
        cleanedLine = cleanedLine.replace(/\(status::\s*[^)]+\)/g, '');
        // DO NOT remove [source:: ...] - it will be converted to citations later
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
      // DO NOT remove [source:: ...] - it will be converted to citations later
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

    // Save final table if any
    if (inTable && tableLines.length > 0) {
      currentSection.paragraphs.push(tableLines.join('\n'));
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

  /**
   * Simple sentence parsing fallback
   * Removes HTML comment markers and inline fields that appear in the manuscript
   * Removes question markers (legacy and Obsidian callout format) and keeps only the answers
   * PRESERVES [source:: ...] tags for citation processing
   */
  public static parseSentencesSimple(paragraph: string): Sentence[] {
    // Remove HTML comment markers (legacy format)
    let cleanedParagraph = paragraph.replace(/<!--\s*\[undefined\]\s*-->/g, '');
    cleanedParagraph = cleanedParagraph.replace(/<!--\s*\[[^\]]+\]\s*-->/g, '');
    cleanedParagraph = cleanedParagraph.replace(/<!--\s*Source:[^>]+?-->/g, '');
    
    // Remove legacy question markers (bold text ending with ?)
    cleanedParagraph = cleanedParagraph.replace(/\*\*[^*]+\?\*\*\s*/g, '');
    
    // Remove Obsidian callout markers
    cleanedParagraph = cleanedParagraph.replace(/^>\s*\[!question\][^\n]*\n?/gm, '');
    cleanedParagraph = cleanedParagraph.replace(/^>\s*/gm, ''); // Remove > prefix from callout lines
    
    // Remove inline fields: (status:: X) but KEEP [source:: X] for citation processing
    cleanedParagraph = cleanedParagraph.replace(/\(status::\s*[^)]+\)/g, '');
    // DO NOT remove [source:: ...] - it will be converted to citations later
    
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
   * Extract heading level from markdown syntax
   * # = 1, ## = 2, ### = 3, etc.
   */
  public static getHeadingLevel(heading: string): number {
    const match = heading.match(/^#+/);
    return match ? match[0].length : 1;
  }

  /**
   * Extract year from source string (e.g., "Smith2020" -> "2020")
   */
  public static extractYear(source: string): string | undefined {
    const match = source.match(/(\d{4})/);
    return match ? match[1] : undefined;
  }
}
