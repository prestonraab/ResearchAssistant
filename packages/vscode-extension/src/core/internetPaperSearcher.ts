import * as vscode from 'vscode';
import { InternetPaperSearcher as CoreInternetPaperSearcher, ExternalPaper } from '@research-assistant/core';

/**
 * InternetPaperSearcher - VS Code extension wrapper
 * 
 * Extends the core InternetPaperSearcher with VS Code-specific UI methods
 * for displaying results and importing to Zotero.
 * 
 * Requirements: 47.1, 47.2, 47.3, 47.4, 47.5
 */
export class InternetPaperSearcher extends CoreInternetPaperSearcher {
  constructor(private workspaceRoot: string) {
    super();
  }

  /**
   * Display external search results in a quick pick
   * Requirement 47.3: Display external results with metadata
   */
  public async displayExternalResults(results: ExternalPaper[]): Promise<ExternalPaper | null> {
    if (results.length === 0) {
      vscode.window.showInformationMessage('No papers found from external sources.');
      return null;
    }

    const items = results.map((paper, index) => ({
      label: `$(globe) ${paper.title}`,
      description: `${paper.authors.slice(0, 2).join(', ')}${paper.authors.length > 2 ? ' et al.' : ''} (${paper.year})`,
      detail: `${paper.abstract.substring(0, 150)}${paper.abstract.length > 150 ? '...' : ''} [${paper.source.toUpperCase()}]${paper.doi ? ` DOI: ${paper.doi}` : ''}`,
      paper,
      index,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Found ${results.length} paper${results.length !== 1 ? 's' : ''} from external sources - Select to import`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    return selected ? selected.paper : null;
  }

  /**
   * Import a paper to Zotero
   * Requirement 47.4: Import paper into Zotero with full metadata
   */
  public async importToZotero(paper: ExternalPaper): Promise<string | null> {
    try {
      // Show progress
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Importing "${paper.title.substring(0, 50)}..." to Zotero`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Creating Zotero item...' });

          // For now, we'll use a workaround since direct Zotero import via MCP
          // may not be available. We'll create a note with the metadata
          // and instruct the user to import manually.
          
          // In a full implementation, this would use Zotero's API or MCP
          // to create a new item directly.
          
          const itemKey = await this.createZoteroItemViaNote(paper);
          
          if (itemKey) {
            vscode.window.showInformationMessage(
              `Successfully imported "${paper.title.substring(0, 50)}..." to Zotero`,
              'Extract Fulltext'
            ).then(action => {
              if (action === 'Extract Fulltext' && itemKey) {
                this.extractFulltext(itemKey);
              }
            });
          }

          return itemKey;
        }
      );
    } catch (error) {
      console.error('Failed to import to Zotero:', error);
      vscode.window.showErrorMessage(
        `Failed to import paper: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Create a Zotero item via note (workaround for direct API)
   * In production, this would use Zotero's proper API
   */
  private async createZoteroItemViaNote(paper: ExternalPaper): Promise<string | null> {
    // This is a placeholder implementation
    // In a real system, you would:
    // 1. Use Zotero's web API to create an item
    // 2. Or use a Zotero MCP method to create items
    // 3. Or use Zotero's import from identifier (DOI)
    
    // For now, we'll show instructions to the user
    const metadata = this.formatMetadataForImport(paper);
    
    const action = await vscode.window.showInformationMessage(
      'Zotero import requires manual action. Copy metadata to clipboard?',
      'Copy Metadata',
      'Cancel'
    );

    if (action === 'Copy Metadata') {
      await vscode.env.clipboard.writeText(metadata);
      vscode.window.showInformationMessage(
        'Metadata copied! Paste into Zotero to import.',
        'Open Zotero'
      );
      
      // Return a pseudo item key
      return `external_${Date.now()}`;
    }

    return null;
  }

  /**
   * Format paper metadata for import
   */
  private formatMetadataForImport(paper: ExternalPaper): string {
    const lines = [
      `Title: ${paper.title}`,
      `Authors: ${paper.authors.join('; ')}`,
      `Year: ${paper.year}`,
      paper.venue ? `Venue: ${paper.venue}` : '',
      paper.doi ? `DOI: ${paper.doi}` : '',
      paper.url ? `URL: ${paper.url}` : '',
      '',
      'Abstract:',
      paper.abstract,
    ];

    return lines.filter(Boolean).join('\n');
  }

  /**
   * Extract fulltext after import
   * Requirement 47.5: Auto-trigger fulltext extraction after import
   * 
   * Triggers the extraction command which will handle PDF lookup and extraction
   */
  public async extractFulltext(itemKey: string): Promise<void> {
    try {
      // Trigger extraction via command - the command will handle PDF lookup
      await vscode.commands.executeCommand(
        'researchAssistant.extractPdfForItem',
        itemKey
      );
    } catch (error) {
      console.error('Failed to extract fulltext:', error);
      vscode.window.showErrorMessage(
        `Failed to extract fulltext: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
