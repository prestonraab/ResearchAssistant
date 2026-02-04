import * as fs from 'fs';
import * as path from 'path';

/**
 * Mapping of author-year citation to source information
 */
export interface SourceMapping {
  authorYear: string;
  zoteroKey: string;
  sourceId: number;
  extractedTextFile?: string;
}

/**
 * Service for mapping author-year citations to source files and metadata
 * 
 * Parses sources.md to build a registry of author-year → source mappings.
 * Caches mappings with invalidation on file change.
 * Handles unmapped author-years gracefully.
 * 
 * Requirements: 1.1, 1.2, 1.3
 */
export class CitationSourceMapper {
  private mappings: Map<string, SourceMapping> = new Map();
  private lastModified: number = 0;
  private sourcesPath: string;
  private extractedTextPath: string;

  constructor(workspaceRoot: string, sourcesPath: string = '01_Knowledge_Base/sources.md', extractedTextPath: string = 'literature/ExtractedText') {
    this.sourcesPath = path.join(workspaceRoot, sourcesPath);
    this.extractedTextPath = path.join(workspaceRoot, extractedTextPath);
  }

  /**
   * Load source mappings from sources.md
   * Parses the markdown table and builds author-year → source mapping
   * Caches results and invalidates on file change
   */
  async loadSourceMappings(): Promise<void> {
    // Check if file exists
    if (!fs.existsSync(this.sourcesPath)) {
      console.warn(`[CitationSourceMapper] sources.md not found at ${this.sourcesPath}`);
      this.mappings.clear();
      return;
    }

    // Check if cache is still valid
    const stats = fs.statSync(this.sourcesPath);
    if (this.lastModified === stats.mtimeMs && this.mappings.size > 0) {
      return; // Cache is still valid
    }

    // Read and parse sources.md
    const content = fs.readFileSync(this.sourcesPath, 'utf-8');
    this.mappings.clear();

    // Parse the markdown table
    const lines = content.split('\n');
    let inTable = false;
    let headerCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and non-table content
      if (!line || !line.startsWith('|')) {
        inTable = false;
        continue;
      }

      // Skip header separator line (|---|---|...)
      if (line.match(/^\|\s*-+\s*\|/)) {
        headerCount++;
        continue;
      }

      // Skip header row (first row with pipes)
      if (headerCount === 0) {
        headerCount++;
        continue;
      }

      inTable = true;

      // Parse table row
      const cells = line.split('|').map(cell => cell.trim());
      
      // Remove leading and trailing empty cells (from the pipes at start/end of line)
      if (cells.length > 0 && cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();

      // Expected format: | Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
      if (cells.length >= 3) {
        try {
          const sourceId = parseInt(cells[0], 10);
          const authorYear = cells[1];
          const zoteroKey = cells[2];

          if (!isNaN(sourceId) && authorYear && zoteroKey) {
            // Try to find extracted text file
            const extractedTextFile = this.findExtractedTextFile(authorYear);

            const mapping: SourceMapping = {
              authorYear,
              zoteroKey,
              sourceId,
              extractedTextFile
            };

            this.mappings.set(authorYear, mapping);
          }
        } catch (error) {
          console.warn(`[CitationSourceMapper] Failed to parse row at line ${i + 1}: ${line}`);
        }
      }
    }

    this.lastModified = stats.mtimeMs;
  }

  /**
   * Get source mapping for an author-year citation
   * @param authorYear - e.g., "Johnson2007"
   * @returns Source mapping or null if not found
   */
  getSourceMapping(authorYear: string): SourceMapping | null {
    return this.mappings.get(authorYear) || null;
  }

  /**
   * Get extracted text file path for a source
   * @param authorYear - The author-year identifier
   * @returns Path to extracted text file or null
   */
  getExtractedTextPath(authorYear: string): string | null {
    const mapping = this.mappings.get(authorYear);
    if (!mapping || !mapping.extractedTextFile) {
      return null;
    }
    return mapping.extractedTextFile;
  }

  /**
   * Get all loaded mappings
   * @returns Map of author-year to source mapping
   */
  getAllMappings(): Map<string, SourceMapping> {
    return new Map(this.mappings);
  }

  /**
   * Check if an author-year is mapped
   * @param authorYear - The author-year identifier
   * @returns true if mapped, false otherwise
   */
  isMapped(authorYear: string): boolean {
    return this.mappings.has(authorYear);
  }

  /**
   * Get all unmapped author-years from a list
   * @param authorYears - List of author-year strings to check
   * @returns Array of unmapped author-years
   */
  getUnmappedAuthorYears(authorYears: string[]): string[] {
    return authorYears.filter(ay => !this.mappings.has(ay));
  }

  /**
   * Find extracted text file for an author-year
   * Looks for files matching the author-year pattern in extracted text directory
   * @param authorYear - The author-year identifier
   * @returns Path to extracted text file or undefined
   */
  private findExtractedTextFile(authorYear: string): string | undefined {
    if (!fs.existsSync(this.extractedTextPath)) {
      return undefined;
    }

    try {
      const files = fs.readdirSync(this.extractedTextPath);
      
      // Look for files that match the author-year pattern
      // Common patterns: "Johnson2007.txt", "Johnson_2007.txt", etc.
      const patterns = [
        new RegExp(`^${authorYear}\\.txt$`, 'i'),
        new RegExp(`^${authorYear.replace(/(\d+)$/, '_$1')}\\.txt$`, 'i'),
        new RegExp(`${authorYear}`, 'i')
      ];

      for (const file of files) {
        for (const pattern of patterns) {
          if (pattern.test(file)) {
            return path.join(this.extractedTextPath, file);
          }
        }
      }
    } catch (error) {
      console.warn(`[CitationSourceMapper] Error searching extracted text directory: ${error}`);
    }

    return undefined;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.mappings.clear();
    this.lastModified = 0;
  }
}
