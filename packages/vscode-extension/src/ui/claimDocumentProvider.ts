import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';

/**
 * Virtual document provider for claim previews.
 * Uses custom URI scheme to avoid save prompts.
 */
export class ClaimDocumentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private extensionState: ExtensionState) {}

  /**
   * Provide content for a claim document URI.
   * URI format: research-claim:claimId
   */
  provideTextDocumentContent(uri: vscode.Uri): string {
    const claimId = uri.path;
    const claim = this.extensionState.claimsManager.getClaim(claimId);

    if (!claim) {
      return `# Claim Not Found\n\nClaim ${claimId} could not be found in the database.`;
    }

    // Build markdown content
    const content = [
      `# ${claim.id}: ${claim.text}`,
      '',
      `**Category**: ${claim.category}`,
      `**Source**: ${claim.source}`,
      `**Verified**: ${claim.verified ? 'Yes' : 'No'}`,
      '',
      claim.context ? `**Context**: ${claim.context}\n` : '',
      claim.primaryQuote ? `## Primary Quote\n\n> ${claim.primaryQuote}\n` : '',
      claim.supportingQuotes && claim.supportingQuotes.length > 0
        ? `## Supporting Quotes\n\n${claim.supportingQuotes.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}\n`
        : '',
      claim.sections && claim.sections.length > 0
        ? `## Used in Sections\n\n${claim.sections.join(', ')}`
        : ''
    ].filter(Boolean).join('\n');

    return content;
  }

  /**
   * Refresh a specific claim document.
   */
  refresh(claimId: string): void {
    const uri = this.createClaimUri(claimId);
    this._onDidChange.fire(uri);
  }

  /**
   * Create a URI for a claim.
   */
  createClaimUri(claimId: string): vscode.Uri {
    return vscode.Uri.parse(`research-claim:${claimId}`);
  }

  /**
   * Open a claim in a virtual document.
   */
  async openClaim(claimId: string): Promise<void> {
    const uri = this.createClaimUri(claimId);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}
