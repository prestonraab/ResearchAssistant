import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { Claim } from '../core/claimsManager';

/**
 * HoverProvider for claim references in markdown files
 * Detects C_XX patterns and displays rich hover information
 */
export class ClaimHoverProvider implements vscode.HoverProvider {
  constructor(private extensionState: ExtensionState) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Detect claim reference pattern (C_\d+)
    const range = document.getWordRangeAtPosition(position, /C_\d+/);
    
    if (!range) {
      return null;
    }

    const claimId = document.getText(range);
    
    // Fetch claim from database
    const claim = this.extensionState.claimsManager.getClaim(claimId);
    
    if (!claim) {
      return null;
    }

    // Render rich markdown hover
    const markdown = this.buildHoverContent(claim);
    
    return new vscode.Hover(markdown, range);
  }

  private buildHoverContent(claim: Claim): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    // Header with claim ID and text
    markdown.appendMarkdown(`### ${claim.id}: ${claim.text}\n\n`);

    // Category and source
    if (claim.category) {
      markdown.appendMarkdown(`**Category**: ${claim.category}  \n`);
    }
    
    if (claim.source) {
      markdown.appendMarkdown(`**Source**: ${claim.source}`);
      if (claim.sourceId) {
        markdown.appendMarkdown(` (Source ID: ${claim.sourceId})`);
      }
      markdown.appendMarkdown(`  \n`);
    }

    // Verification status
    if (claim.verified) {
      markdown.appendMarkdown(`**Verification**: ✅ Verified  \n`);
    } else {
      markdown.appendMarkdown(`**Verification**: ⚪ Not verified  \n`);
    }

    markdown.appendMarkdown(`\n---\n\n`);

    // Primary quote
    if (claim.primaryQuote) {
      markdown.appendMarkdown(`**Primary Quote**:\n`);
      markdown.appendMarkdown(`> "${claim.primaryQuote}"\n\n`);
    }

    // Supporting quotes (show first 2 if multiple)
    if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
      const quotesToShow = claim.supportingQuotes.slice(0, 2);
      markdown.appendMarkdown(`**Supporting Quotes** (${claim.supportingQuotes.length}):\n`);
      
      for (const quote of quotesToShow) {
        markdown.appendMarkdown(`- "${quote}"\n`);
      }
      
      if (claim.supportingQuotes.length > 2) {
        markdown.appendMarkdown(`\n*...and ${claim.supportingQuotes.length - 2} more*\n`);
      }
      markdown.appendMarkdown(`\n`);
    }

    // Context
    if (claim.context) {
      markdown.appendMarkdown(`---\n\n`);
      markdown.appendMarkdown(`*Context: ${claim.context}*\n\n`);
    }

    // Quick action links
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(this.buildQuickActions(claim));

    return markdown;
  }

  private buildQuickActions(claim: Claim): string {
    let actions = '';

    // Go to source action
    if (claim.source) {
      const goToSourceCommand = vscode.Uri.parse(
        `command:researchAssistant.goToSource?${encodeURIComponent(JSON.stringify([claim.source]))}`
      );
      actions += `[📄 Go to source](${goToSourceCommand}) `;
    }

    // View all quotes action
    if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
      const viewQuotesCommand = vscode.Uri.parse(
        `command:researchAssistant.viewAllQuotes?${encodeURIComponent(JSON.stringify([claim.id]))}`
      );
      actions += `[📋 View all quotes](${viewQuotesCommand}) `;
    }

    // Find similar claims action
    const findSimilarCommand = vscode.Uri.parse(
      `command:researchAssistant.findSimilarClaims?${encodeURIComponent(JSON.stringify([claim.id]))}`
    );
    actions += `[🔍 Find similar claims](${findSimilarCommand}) `;

    // Show sections where claim is used
    if (claim.sections && claim.sections.length > 0) {
      const showSectionsCommand = vscode.Uri.parse(
        `command:researchAssistant.showClaimSections?${encodeURIComponent(JSON.stringify([claim.id]))}`
      );
      actions += `[📑 Show sections (${claim.sections.length})](${showSectionsCommand})`;
    }

    return actions;
  }
}
