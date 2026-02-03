/**
 * Word Formatting Utilities
 * 
 * Provides formatting constants and utility functions for Word document generation.
 */

import { HeadingLevel } from 'docx';

/**
 * Configuration for Word document styles
 */
export const WORD_STYLES = {
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
 * Get the style configuration for a heading level
 * 
 * @param level The heading level (1-6)
 * @returns Style configuration object
 */
export function getHeadingStyle(level: number): { font: string; size: number; bold: boolean } {
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
 * Map heading level to Word HeadingLevel enum
 * 
 * @param level The heading level (1-6)
 * @returns Word HeadingLevel enum value
 */
export function mapHeadingLevel(level: number): any {
  const headingLevels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6
  ];

  return headingLevels[Math.min(level - 1, 5)] || HeadingLevel.HEADING_1;
}

/**
 * Format footnote content from quote text and source
 * 
 * @param quoteText Optional quote text
 * @param source Optional source
 * @param year Optional year
 * @returns Formatted footnote content string
 */
export function formatFootnoteContent(
  quoteText?: string,
  source?: string,
  year?: string
): string {
  const parts: string[] = [];

  // Add quote text
  if (quoteText) {
    parts.push(quoteText);
  }

  // Add source and year
  if (source) {
    const sourceStr = year ? `${source}, ${year}` : source;
    parts.push(sourceStr);
  }

  return parts.join(' --- ');
}

/**
 * Format bibliography entry with source and year
 * 
 * @param source The source text
 * @param year Optional year
 * @returns Formatted bibliography entry
 */
export function formatBibliographyEntry(source: string, year?: string): string {
  return year ? `${source} (${year})` : source;
}
