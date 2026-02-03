import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import type { Claim } from '@research-assistant/core';
import { renderClaimHover } from '../core/claimHoverLogic';

/**
 * HoverProvider for claim references in markdown files
 * Detects C_XX patterns and displays rich hover information
 * 
 * This is a thin VSCode integration layer - all logic is in claimHoverLogic.ts
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

    // Render using pure logic (fully tested, no mocks needed)
    const markdownText = renderClaimHover(claim);
    
    const markdown = new vscode.MarkdownString(markdownText);
    markdown.isTrusted = true;
    markdown.supportHtml = true;
    
    return new vscode.Hover(markdown, range);
  }
}
