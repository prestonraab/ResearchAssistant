import * as path from 'path';
import type { Claim } from '@research-assistant/core';

/**
 * Handles parsing and serialization of claims to/from markdown format.
 * Responsible for converting between Claim objects and markdown representations.
 */
export class ClaimsParser {
  /**
   * Parse a claim block from markdown format
   */
  static parseClaim(block: string): Claim | null {
    const lines = block.split('\n');
    const headerMatch = lines[0].match(/^## (C_\d+):\s*(.+)$/);
    if (!headerMatch) {
      return null;
    }

    const id = headerMatch[1];
    const text = headerMatch[2].trim();
    
    return {
      id,
      text,
      category: '',
      context: '',
      primaryQuote: {
        text: '',
        source: '',
        verified: false
      },
      supportingQuotes: [],
      sections: [],
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
  }

  /**
   * Serialize a claim to markdown format
   */
  static serializeClaim(claim: Claim): string {
    let content = `## ${claim.id}: ${claim.text}\n\n`;
    
    if (claim.category) {
      content += `**Category**: ${claim.category}  \n`;
    }
    
    // Get source from primaryQuote (quotes have sources, not claims)
    if (claim.primaryQuote && claim.primaryQuote.source) {
      const source = claim.primaryQuote.source;
      const sourceId = claim.primaryQuote.sourceId;
      if (sourceId) {
        content += `**Source**: ${source} (Source ID: ${sourceId})  \n`;
      } else {
        content += `**Source**: ${source}  \n`;
      }
    }
    
    // Add sections field if claim has section associations
    if (claim.sections && claim.sections.length > 0) {
      content += `**Sections**: [${claim.sections.join(', ')}]  \n`;
    }
    
    if (claim.context) {
      content += `**Context**: ${claim.context}\n\n`;
    }
    
    if (claim.primaryQuote && claim.primaryQuote.text) {
      const quoteText = claim.primaryQuote.text;
      // Detect if quote has a citation prefix (e.g., "(Abstract):")
      const hasPrefix = quoteText.match(/^\([^)]+\):/);
      if (hasPrefix) {
        content += `**Primary Quote** ${hasPrefix[0]}\n`;
        content += `> "${quoteText.substring(hasPrefix[0].length).trim()}"\n\n`;
      } else {
        content += `**Primary Quote**:\n`;
        content += `> "${quoteText}"\n\n`;
      }
    }
    
    if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
      content += `**Supporting Quotes**:\n`;
      for (const quoteObj of claim.supportingQuotes) {
        const quoteText = quoteObj.text || '';
        // Check if quote has citation prefix
        const prefixMatch = quoteText.match(/^\(([^)]+)\):\s*(.+)$/);
        if (prefixMatch) {
          content += `- (${prefixMatch[1]}): "${prefixMatch[2]}"\n`;
        } else {
          content += `- "${quoteText}"\n`;
        }
      }
      content += '\n';
    }
    
    return content;
  }

  /**
   * Build complete file content from claims
   */
  static buildClaimsFileContent(filePath: string, claims: Claim[]): string {
    // Sort claims by ID for consistent ordering
    claims.sort((a, b) => {
      const aNum = parseInt(a.id.replace('C_', ''), 10);
      const bNum = parseInt(b.id.replace('C_', ''), 10);
      return aNum - bNum;
    });

    // Build file content
    let content = '';
    
    // Add header if this is a category file
    if (filePath.includes('/claims/')) {
      const fileName = path.basename(filePath, '.md');
      const categoryName = this.getCategoryNameFromFileName(fileName);
      content = `# Claims and Evidence: ${categoryName}\n\n`;
      content += `This file contains all **${categoryName}** claims with their supporting evidence.\n\n`;
      content += '---\n\n';
    }

    // Add each claim
    for (const claim of claims) {
      content += this.serializeClaim(claim);
      content += '\n---\n\n\n';
    }

    return content;
  }

  /**
   * Get human-readable category name from file name
   */
  private static getCategoryNameFromFileName(fileName: string): string {
    const nameMap: { [key: string]: string } = {
      'methods_batch_correction': 'Method - Batch Correction',
      'methods_advanced': 'Method - Advanced',
      'methods_classifiers': 'Method - Classifiers',
      'methods': 'Method',
      'results': 'Result',
      'challenges': 'Challenge',
      'data_sources': 'Data Source',
      'data_trends': 'Data Trend',
      'impacts': 'Impact',
      'applications': 'Application',
      'phenomena': 'Phenomenon'
    };
    
    return nameMap[fileName] || fileName;
  }

  /**
   * Get file name from category name
   */
  static getCategoryFileName(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'Method': 'methods_batch_correction.md',
      'Method - Batch Correction': 'methods_batch_correction.md',
      'Method - Advanced': 'methods_advanced.md',
      'Method - Classifiers': 'methods_classifiers.md',
      'Result': 'results.md',
      'Challenge': 'challenges.md',
      'Data Source': 'data_sources.md',
      'Data Trend': 'data_trends.md',
      'Impact': 'impacts.md',
      'Application': 'applications.md',
      'Phenomenon': 'phenomena.md'
    };
    
    return categoryMap[category] || 'uncategorized.md';
  }
}
