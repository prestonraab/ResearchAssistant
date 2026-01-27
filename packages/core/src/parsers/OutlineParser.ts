import * as fs from 'fs/promises';
import type { OutlineSection } from '../types/index.js';

/**
 * OutlineParser parses markdown outline files and extracts hierarchical sections.
 * 
 * Supports:
 * - Parsing markdown headers (##, ###, etc.) into sections
 * - Looking up sections by position (line number)
 * - Looking up sections by ID
 * 
 * Requirements: 1.2, 1.3
 */
export class OutlineParser {
  private sections: OutlineSection[] = [];
  private filePath: string | null = null;

  /**
   * Parse a markdown file and extract all sections.
   * 
   * Sections are identified by markdown headers (##, ###, etc.).
   * Each section includes:
   * - id: Generated from the header text (e.g., "2.1" or slugified title)
   * - title: The header text without the # symbols
   * - level: The header level (2 for ##, 3 for ###, etc.)
   * - lineStart: The line number where the section starts (0-indexed)
   * - lineEnd: The line number where the section ends (0-indexed)
   * - content: Array of content lines within the section
   * 
   * @param filePath Path to the markdown file
   * @returns Array of parsed sections
   */
  async parse(filePath: string): Promise<OutlineSection[]> {
    this.filePath = filePath;
    this.sections = [];

    // Read the file
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Track current section being built
    let currentSection: Partial<OutlineSection> | null = null;
    const sectionStack: OutlineSection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{2,6})\s+(.+)$/);

      if (headerMatch) {
        // Close the previous section if it exists
        if (currentSection) {
          currentSection.lineEnd = i - 1;
          const section = currentSection as OutlineSection;
          this.sections.push(section);
          sectionStack.push(section);
        }

        // Start a new section
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        const id = this.generateSectionId(title, i);

        currentSection = {
          id,
          title,
          level,
          lineStart: i,
          lineEnd: i, // Will be updated when next section starts or file ends
          content: []
        };
      } else if (currentSection) {
        // Add content to current section
        currentSection.content!.push(line);
      }
    }

    // Close the last section
    if (currentSection) {
      currentSection.lineEnd = lines.length - 1;
      this.sections.push(currentSection as OutlineSection);
    }

    return this.sections;
  }

  /**
   * Get the section at a specific line position.
   * 
   * This is useful for cursor-based lookups where you want to find
   * which section contains a specific line number.
   * 
   * @param position Line number (0-indexed)
   * @returns The section containing that line, or null if not found
   */
  getSectionAtPosition(position: number): OutlineSection | null {
    for (const section of this.sections) {
      if (position >= section.lineStart && position <= section.lineEnd) {
        return section;
      }
    }
    return null;
  }

  /**
   * Get a section by its ID.
   * 
   * @param sectionId The section ID to look up
   * @returns The section with that ID, or null if not found
   */
  getSectionById(sectionId: string): OutlineSection | null {
    return this.sections.find(s => s.id === sectionId) || null;
  }

  /**
   * Generate a unique section ID from the title.
   * 
   * Strategy:
   * 1. If the title starts with a number pattern (e.g., "2.1"), use that
   * 2. Otherwise, create a slugified version of the title
   * 3. If there are duplicates, append the line number
   * 
   * @param title The section title
   * @param lineNumber The line number where the section starts
   * @returns A unique section ID
   */
  private generateSectionId(title: string, lineNumber: number): string {
    // Check if title starts with a number pattern like "2.1"
    const numberMatch = title.match(/^(\d+(?:\.\d+)*)/);
    if (numberMatch) {
      const numberId = numberMatch[1];
      // Check if this numbered ID already exists
      const existingIds = this.sections.map(s => s.id);
      if (existingIds.includes(numberId)) {
        return `${numberId}-${lineNumber}`;
      }
      return numberId;
    }

    // Otherwise, slugify the title
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // If slug is empty after slugification, use line number
    if (!slug) {
      slug = `section-${lineNumber}`;
    }

    // Check for duplicates
    const existingIds = this.sections.map(s => s.id);
    if (existingIds.includes(slug)) {
      slug = `${slug}-${lineNumber}`;
    }

    return slug;
  }

  /**
   * Get all parsed sections.
   * 
   * @returns Array of all sections
   */
  getSections(): OutlineSection[] {
    return this.sections;
  }

  /**
   * Get the file path that was last parsed.
   * 
   * @returns The file path, or null if no file has been parsed
   */
  getFilePath(): string | null {
    return this.filePath;
  }
}
