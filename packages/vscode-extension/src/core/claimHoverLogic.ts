import type { Claim } from '@research-assistant/core';

/**
 * Pure logic for claim hover rendering
 * No VSCode dependencies - fully testable with real data
 */

export interface HoverContent {
  markdown: string;
}

/**
 * Extract claim ID from text at a given position
 * Returns null if no valid claim ID pattern found
 */
export function extractClaimId(text: string, position: number): string | null {
  const pattern = /C_\d+/g;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    
    if (position >= start && position <= end) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * Render claim as markdown hover content
 * Pure function - no side effects, no VSCode dependencies
 */
export function renderClaimHover(claim: Claim): string {
  let markdown = '';

  // Header with claim ID and text
  markdown += `### ${claim.id}: ${claim.text}\n\n`;

  // Category and source
  if (claim.category) {
    markdown += `**Category**: ${claim.category}  \n`;
  }
  
  if (claim.primaryQuote && claim.primaryQuote.source) {
    markdown += `**Source**: ${claim.primaryQuote.source}`;
    if (claim.primaryQuote.sourceId) {
      markdown += ` (Source ID: ${claim.primaryQuote.sourceId})`;
    }
    markdown += `  \n`;
  }

  // Verification status
  if (claim.verified) {
    markdown += `**Verification**: ✅ Verified  \n`;
  } else {
    markdown += `**Verification**: ⚪ Not verified  \n`;
  }

  markdown += `\n---\n\n`;

  // Primary quote
  if (claim.primaryQuote && claim.primaryQuote.text) {
    markdown += `**Primary Quote**:\n`;
    markdown += `> "${claim.primaryQuote.text}"\n\n`;
  }

  // Supporting quotes (show first 2 if multiple)
  if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
    const quotesToShow = claim.supportingQuotes.slice(0, 2);
    markdown += `**Supporting Quotes** (${claim.supportingQuotes.length}):\n`;
    
    for (const quote of quotesToShow) {
      markdown += `- "${quote.text}"\n`;
    }
    
    if (claim.supportingQuotes.length > 2) {
      markdown += `\n*...and ${claim.supportingQuotes.length - 2} more*\n`;
    }
    markdown += `\n`;
  }

  // Context
  if (claim.context) {
    markdown += `---\n\n`;
    markdown += `*Context: ${claim.context}*\n\n`;
  }

  // Quick action links
  markdown += `---\n\n`;
  markdown += buildQuickActions(claim);

  return markdown;
}

/**
 * Build quick action command links for a claim
 * Pure function - returns markdown string
 */
function buildQuickActions(claim: Claim): string {
  let actions = '';

  // Go to source action
  if (claim.primaryQuote && claim.primaryQuote.source) {
    const goToSourceCommand = `command:researchAssistant.goToSource?${encodeURIComponent(JSON.stringify([claim.primaryQuote.source]))}`;
    actions += `[📄 Go to source](${goToSourceCommand}) `;
  }

  // View all quotes action
  if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
    const viewQuotesCommand = `command:researchAssistant.viewAllQuotes?${encodeURIComponent(JSON.stringify([claim.id]))}`;
    actions += `[📋 View all quotes](${viewQuotesCommand}) `;
  }

  // Find similar claims action
  const findSimilarCommand = `command:researchAssistant.findSimilarClaims?${encodeURIComponent(JSON.stringify([claim.id]))}`;
  actions += `[🔍 Find similar claims](${findSimilarCommand}) `;

  // Show sections where claim is used
  if (claim.sections && claim.sections.length > 0) {
    const showSectionsCommand = `command:researchAssistant.showClaimSections?${encodeURIComponent(JSON.stringify([claim.id]))}`;
    actions += `[📑 Show sections (${claim.sections.length})](${showSectionsCommand})`;
  }

  return actions;
}
