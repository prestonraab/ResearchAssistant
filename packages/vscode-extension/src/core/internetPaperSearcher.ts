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

          // Get ZoteroClient instance
          const { ZoteroClient } = await import('@research-assistant/core');
          const config = vscode.workspace.getConfiguration('researchAssistant');
          const apiKey = config.get<string>('zoteroApiKey') || '';
          const userId = config.get<string>('zoteroUserId') || '';

          if (!apiKey || !userId) {
            throw new Error('Zotero API credentials not configured. Please set zoteroApiKey and zoteroUserId in settings.');
          }

          const zoteroService = new ZoteroClient();
          zoteroService.initialize(apiKey, userId);

          // Parse authors into Zotero creator format
          const creators = paper.authors.map(author => {
            // Handle "Last, First" format
            if (author.includes(',')) {
              const [lastName, firstName] = author.split(',').map(s => s.trim());
              return {
                creatorType: 'author',
                firstName,
                lastName
              };
            }
            // Handle single name or organization
            if (!author.includes(' ')) {
              return {
                creatorType: 'author',
                name: author
              };
            }
            // Handle "First Last" format
            const parts = author.trim().split(/\s+/);
            const lastName = parts.pop() || '';
            const firstName = parts.join(' ');
            return {
              creatorType: 'author',
              firstName,
              lastName
            };
          });

          // Prepare item data
          const itemData: any = {
            itemType: 'journalArticle',
            title: paper.title,
            creators,
            abstractNote: paper.abstract,
            date: paper.year.toString(),
            url: paper.url
          };

          // Add optional fields
          if (paper.doi) {
            itemData.DOI = paper.doi;
          }
          if (paper.venue) {
            itemData.publicationTitle = paper.venue;
          }

          // Add source tag
          itemData.tags = [{ tag: `imported-from-${paper.source}` }];

          // Create item in Zotero
          const itemKey = await zoteroService.createItem(itemData);
          
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
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(
        errorMsg.includes('credentials') || errorMsg.includes('API')
          ? 'Unable to connect to Zotero. Please check your API credentials in settings.'
          : 'Unable to import the paper. Please try again.',
        'Check Settings',
        'Retry'
      ).then(action => {
        if (action === 'Check Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant.zotero');
        }
      });
      return null;
    }
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
        'Unable to extract text from the PDF. The file may be corrupted or password-protected.',
        'Retry'
      );
    }
  }
}
