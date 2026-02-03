import type { Claim } from '@research-assistant/core';
import type { OutlineSection } from '@research-assistant/core';

/**
 * Pure logic for claim completion
 * No VSCode dependencies - fully testable with real data
 */

export interface CompletionData {
  claimId: string;
  label: string;
  detail: string;
  documentation: string;
  sortText: string;
  insertText: string;
}

/**
 * Check if completion should be triggered at the given line prefix
 */
export function shouldTriggerCompletion(linePrefix: string): boolean {
  return linePrefix.endsWith('C_');
}

/**
 * Sort claims by relevance to current section
 * Claims in the current section come first, then others
 */
export function sortClaimsBySection(
  claims: Claim[],
  currentSectionId: string | null
): Claim[] {
  if (!currentSectionId) {
    return [...claims].sort((a, b) => a.id.localeCompare(b.id));
  }

  const sectionClaims: Claim[] = [];
  const otherClaims: Claim[] = [];

  for (const claim of claims) {
    if (claim.sections.includes(currentSectionId)) {
      sectionClaims.push(claim);
    } else {
      otherClaims.push(claim);
    }
  }

  // Sort each group by ID
  sectionClaims.sort((a, b) => a.id.localeCompare(b.id));
  otherClaims.sort((a, b) => a.id.localeCompare(b.id));

  return [...sectionClaims, ...otherClaims];
}

/**
 * Generate completion data for a claim
 */
export function generateCompletionData(
  claim: Claim,
  currentSectionId: string | null
): CompletionData {
  const isInCurrentSection = currentSectionId && claim.sections.includes(currentSectionId);
  
  return {
    claimId: claim.id,
    label: claim.id,
    detail: formatCompletionDetail(claim),
    documentation: formatCompletionPreview(claim),
    sortText: isInCurrentSection ? `0_${claim.id}` : `1_${claim.id}`,
    insertText: claim.id
  };
}

/**
 * Format the detail line for a completion item
 */
export function formatCompletionDetail(claim: Claim): string {
  const category = claim.category || 'Uncategorized';
  const source = claim.primaryQuote?.source || 'Unknown';
  return `${category} - ${source}`;
}

/**
 * Format the preview documentation for a completion item
 */
export function formatCompletionPreview(claim: Claim): string {
  let preview = `**${claim.id}**: ${claim.text}\n\n`;
  preview += `**Category**: ${claim.category || 'Uncategorized'}  \n`;
  
  if (claim.primaryQuote && claim.primaryQuote.source) {
    preview += `**Source**: ${claim.primaryQuote.source}\n\n`;
  }
  
  if (claim.primaryQuote && claim.primaryQuote.text) {
    const truncatedQuote = claim.primaryQuote.text.length > 150 
      ? claim.primaryQuote.text.substring(0, 150) + '...'
      : claim.primaryQuote.text;
    preview += `**Quote**: "${truncatedQuote}"\n\n`;
  }
  
  if (claim.sections.length > 0) {
    preview += `**Used in**: ${claim.sections.length} section${claim.sections.length !== 1 ? 's' : ''}`;
  }
  
  return preview;
}

/**
 * Find section at a given line number
 */
export function findSectionAtLine(
  sections: OutlineSection[],
  line: number
): OutlineSection | null {
  for (const section of sections) {
    if (line >= section.lineStart - 1 && line <= section.lineEnd - 1) {
      return section;
    }
  }
  return null;
}

/**
 * Extract header from a markdown line
 * Returns null if line is not a header
 */
export function extractHeaderFromLine(line: string): { level: number; title: string } | null {
  const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
  
  if (!headerMatch) {
    return null;
  }
  
  return {
    level: headerMatch[1].length,
    title: headerMatch[2].trim()
  };
}

/**
 * Find matching section by title
 */
export function findSectionByTitle(
  sections: OutlineSection[],
  title: string
): OutlineSection | null {
  const normalizedTitle = title.toLowerCase();
  return sections.find(s => s.title.toLowerCase() === normalizedTitle) || null;
}
