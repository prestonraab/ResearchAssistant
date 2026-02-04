import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import type { Claim } from '@research-assistant/core';
import type { OutlineSection } from '@research-assistant/core';
import {
  shouldTriggerCompletion,
  sortClaimsBySection,
  generateCompletionData,
  findSectionAtLine,
  extractHeaderFromLine,
  findSectionByTitle
} from '../core/claimCompletionLogic';

export class ClaimCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private state: ExtensionState) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
    // Get the line text up to the cursor position
    const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
    
    // Check if we should trigger completion (using pure function)
    if (!shouldTriggerCompletion(linePrefix)) {
      return undefined;
    }

    // Get all claims
    const claims = this.state.claimsManager.getClaims();
    
    if (claims.length === 0) {
      return undefined;
    }

    // Determine current section context
    const currentSection = await this.getCurrentSection(document, position);
    
    // Sort claims by relevance to current section (using pure function)
    const sortedClaims = sortClaimsBySection(claims, currentSection?.id || null);

    // Create completion items (using pure function for data generation)
    const completionItems = sortedClaims.map(claim => 
      this.createCompletionItem(claim, currentSection)
    );

    return new vscode.CompletionList(completionItems, false);
  }

  private async getCurrentSection(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<OutlineSection | null> {
    // Check if this is the outline file
    const outlinePath = this.state.getAbsolutePath(this.state.getConfig().outlinePath);
    
    if (document.uri.fsPath === outlinePath) {
      // Get section at cursor position (using pure function)
      const sections = await this.state.outlineParser.parse();
      return findSectionAtLine(sections, position.line);
    }

    // For other files, try to detect section from nearby headers
    return this.detectSectionFromDocument(document, position);
  }

  private async detectSectionFromDocument(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<OutlineSection | null> {
    // Look backwards from cursor to find the most recent header
    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text;
      const header = extractHeaderFromLine(line);
      
      if (header) {
        // Try to find matching section in outline (using pure function)
        const sections = await this.state.outlineParser.parse();
        return findSectionByTitle(sections, header.title);
      }
    }
    
    return null;
  }

  private createCompletionItem(
    claim: Claim,
    currentSection: OutlineSection | null
  ): vscode.CompletionItem {
    // Generate completion data using pure function
    const data = generateCompletionData(claim, currentSection?.id || null);
    
    const item = new vscode.CompletionItem(data.label, vscode.CompletionItemKind.Reference);
    
    // Set properties from pure function output
    item.insertText = data.insertText;
    item.label = data.label;
    item.detail = data.detail;
    item.documentation = new vscode.MarkdownString(data.documentation);
    item.sortText = data.sortText;

    // Add command to insert full claim text as alternative
    item.command = {
      command: 'researchAssistant.insertClaimReference',
      title: 'Insert Claim Reference',
      arguments: [claim.id]
    };

    return item;
  }

  async resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem> {
    // Additional details can be loaded here if needed
    return item;
  }
}
