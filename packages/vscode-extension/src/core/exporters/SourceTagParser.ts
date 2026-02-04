/**
 * Parses [source:: ...] tags from manuscript text and extracts citation information
 * 
 * Format: [source:: C_XX(AuthorYear), C_YY, C_ZZ(AuthorYear2)]
 * - Claims with (AuthorYear) are marked for export citation
 * - Claims without parentheses are internal references only
 */

export interface ParsedSourceTag {
  /** The full matched tag text */
  fullMatch: string;
  /** All claim IDs referenced */
  claimIds: string[];
  /** Claims marked for citation export with their AuthorYear */
  citableClaims: Array<{
    claimId: string;
    authorYear: string;
  }>;
}

export interface CitationForExport {
  /** Position in text where citation should be inserted */
  position: number;
  /** AuthorYear strings to cite */
  authorYears: string[];
  /** The full source tag to remove */
  tagToRemove: string;
}

export class SourceTagParser {
  /**
   * Parse all [source:: ...] tags from text
   */
  public static parseSourceTags(text: string): ParsedSourceTag[] {
    const results: ParsedSourceTag[] = [];
    // Match [source:: ...] tags, handling multi-line content
    const tagRegex = /\[source::\s*([^\]]+)\]/g;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const content = match[1].trim();
      
      const parsed = this.parseTagContent(content);
      results.push({
        fullMatch,
        ...parsed
      });
    }

    return results;
  }

  /**
   * Parse the content inside a source tag
   * e.g., "C_79(Zou 2005), C_80, C_81(Chen 2016)"
   */
  private static parseTagContent(content: string): { claimIds: string[]; citableClaims: Array<{ claimId: string; authorYear: string }> } {
    const claimIds: string[] = [];
    const citableClaims: Array<{ claimId: string; authorYear: string }> = [];

    // Split by comma, handling potential whitespace
    const parts = content.split(/,\s*/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Match claim ID with optional (AuthorYear)
      // Pattern: C_XX or C_XX(Author Year) or C_XXX(Author Year)
      const claimMatch = trimmed.match(/^(C_\d+[a-z]?)(?:\(([^)]+)\))?/i);
      
      if (claimMatch) {
        const claimId = claimMatch[1];
        const authorYear = claimMatch[2];

        claimIds.push(claimId);

        if (authorYear) {
          citableClaims.push({
            claimId,
            authorYear: authorYear.trim()
          });
        }
      }
    }

    return { claimIds, citableClaims };
  }

  /**
   * Extract all citations for export from text
   * Returns citations with their positions and the tags to remove
   */
  public static extractCitationsForExport(text: string): CitationForExport[] {
    const citations: CitationForExport[] = [];
    const tagRegex = /\[source::\s*([^\]]+)\]/g;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      const fullMatch = match[0];
      const content = match[1].trim();
      const parsed = this.parseTagContent(content);

      if (parsed.citableClaims.length > 0) {
        citations.push({
          position: match.index,
          authorYears: parsed.citableClaims.map(c => c.authorYear),
          tagToRemove: fullMatch
        });
      } else {
        // No citable claims, just mark for removal
        citations.push({
          position: match.index,
          authorYears: [],
          tagToRemove: fullMatch
        });
      }
    }

    return citations;
  }

  /**
   * Convert text by replacing source tags with citations
   * 
   * @param text Original text with [source:: ...] tags
   * @param formatCitation Function to format AuthorYear list into citation string
   * @returns Text with source tags replaced by formatted citations
   */
  public static convertSourceTagsToCitations(
    text: string,
    formatCitation: (authorYears: string[]) => string
  ): string {
    const citations = this.extractCitationsForExport(text);
    
    // Process in reverse order to maintain positions
    let result = text;
    for (let i = citations.length - 1; i >= 0; i--) {
      const citation = citations[i];
      
      if (citation.authorYears.length > 0) {
        // Replace tag with formatted citation
        const formattedCitation = formatCitation(citation.authorYears);
        result = result.slice(0, citation.position) + formattedCitation + result.slice(citation.position + citation.tagToRemove.length);
      } else {
        // Remove tag entirely (no citable claims)
        result = result.slice(0, citation.position) + result.slice(citation.position + citation.tagToRemove.length);
      }
    }

    return result;
  }

  /**
   * Get all unique AuthorYear citations from text
   */
  public static getAllAuthorYears(text: string): Set<string> {
    const authorYears = new Set<string>();
    const tags = this.parseSourceTags(text);

    for (const tag of tags) {
      for (const citable of tag.citableClaims) {
        authorYears.add(citable.authorYear);
      }
    }

    return authorYears;
  }
}
