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
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    
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

  private findSectionAtLine(sections: OutlineSection[], line: number): OutlineSection | null {
    // Find the section that contains this line
    for (const section of sections) {
      if (line >= section.lineStart - 1 && line <= section.lineEnd - 1) {
        return section;
      }
    }
    return null;
  }

  private async detectSectionFromDocument(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<OutlineSection | null> {
    // Look backwards from cursor to find the most recent header
    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text;
      const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
      
      if (headerMatch) {
        const title = headerMatch[2].trim();
        
        // Try to find matching section in outline
        const sections = await this.state.outlineParser.parse();
        const matchingSection = sections.find(s => 
          s.title.toLowerCase() === title.toLowerCase()
        );
        
        return matchingSection || null;
      }
    }
    
    return null;
  }

  private async sortClaimsByRelevance(
    claims: Claim[],
    currentSection: OutlineSection | null
  ): Promise<Claim[]> {
    if (!currentSection) {
      // No section context, return claims sorted by ID
      return claims.sort((a, b) => a.id.localeCompare(b.id));
    }

    // Separate claims into those associated with current section and others
    const sectionClaims: Claim[] = [];
    const otherClaims: Claim[] = [];

    for (const claim of claims) {
      if (claim.sections.includes(currentSection.id)) {
        sectionClaims.push(claim);
      } else {
        otherClaims.push(claim);
      }
    }

    // For other claims, calculate semantic similarity if embedding service is available
    const rankedOtherClaims = await this.rankClaimsBySimilarity(
      otherClaims,
      currentSection
    );

    // Return section claims first, then ranked other claims
    return [...sectionClaims, ...rankedOtherClaims];
  }

  private async rankClaimsBySimilarity(
    claims: Claim[],
    section: OutlineSection
  ): Promise<Claim[]> {
    try {
      // Build section context text
      const sectionText = `${section.title} ${section.content.join(' ')}`;
      
      // Generate embedding for section
      const sectionEmbedding = await this.state.embeddingService.generateEmbedding(sectionText);
      
      // Calculate similarity for each claim
      const claimsWithSimilarity = await Promise.all(
        claims.map(async (claim) => {
          const claimEmbedding = await this.state.embeddingService.generateEmbedding(claim.text);
          const similarity = this.state.embeddingService.cosineSimilarity(
            sectionEmbedding,
            claimEmbedding
          );
          return { claim, similarity };
        })
      );

      // Sort by similarity descending
      claimsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
      
      return claimsWithSimilarity.map(item => item.claim);
    } catch (error) {
      console.error('Error ranking claims by similarity:', error);
      // Fall back to ID sorting
      return claims.sort((a, b) => a.id.localeCompare(b.id));
    }
  }

  private createCompletionItem(
    claim: Claim,
    currentSection: OutlineSection | null
  ): vscode.CompletionItem {
    const item = new vscode.CompletionItem(claim.id, vscode.CompletionItemKind.Reference);
    
    // Set the text to insert (just the ID, replacing "C_")
    item.insertText = claim.id;
    
    // Set label with claim ID
    item.label = claim.id;
    
    // Set detail to show category and source
    item.detail = `${claim.category} - ${claim.primaryQuote?.source || 'Unknown'}`;
    
    // Set documentation with claim preview
    const preview = this.createClaimPreview(claim);
    item.documentation = new vscode.MarkdownString(preview);
    
    // Set sort text to control ordering
    // Claims from current section get priority (prefix with "0")
    // Other claims get normal sorting (prefix with "1")
    if (currentSection && claim.sections.includes(currentSection.id)) {
      item.sortText = `0_${claim.id}`;
    } else {
      item.sortText = `1_${claim.id}`;
    }

    // Add command to insert full claim text as alternative
    item.command = {
      command: 'researchAssistant.insertClaimReference',
      title: 'Insert Claim Reference',
      arguments: [claim.id]
    };

    return item;
  }

  private createClaimPreview(claim: Claim): string {
    let preview = `**${claim.id}**: ${claim.text}\n\n`;
    preview += `**Category**: ${claim.category}  \n`;
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

  async resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem> {
    // Additional details can be loaded here if needed
    return item;
  }
}
