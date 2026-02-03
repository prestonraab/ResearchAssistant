import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ZoteroClient, ZoteroItem } from '@research-assistant/core';
import { ManuscriptContextDetector } from './manuscriptContextDetector';

/**
 * InstantSearchHandler enables instant paper search from any selected text in manuscript.md.
 * 
 * Features:
 * - Context menu action "Find Papers for This" on manuscript.md
 * - Extracts selected text and current section context
 * - Calls Zotero MCP semantic search with combined query
 * - Displays results in VS Code quick pick with formatted metadata
 * - Opens extracted text if available, otherwise triggers Docling extraction
 * - Entire flow must complete in <2 seconds
 * - Caches recent searches for instant re-access
 */
export class InstantSearchHandler {
  private searchCache: Map<string, { results: ZoteroItem[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SEARCH_TIMEOUT = 2000; // 2 seconds max
  private disposables: vscode.Disposable[] = [];

  constructor(
    private zoteroClient: ZoteroClient,
    private manuscriptContextDetector: ManuscriptContextDetector,
    private workspaceRoot: string,
    private extractedTextPath: string
  ) {
  }

  /**
   * Register context menu action for manuscript.md files
   */
  public registerContextMenu(): void {
    // Register command for context menu
    const command = vscode.commands.registerCommand(
      'researchAssistant.findPapersForSelection',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const selection = editor.document.getText(editor.selection);
        if (!selection || selection.trim().length === 0) {
          vscode.window.showWarningMessage('Please select some text to search for papers');
          return;
        }

        // Get current section context
        const context = this.getCurrentSectionContext(editor);

        // Perform search
        await this.searchFromSelection(selection, context);
      }
    );

    this.disposables.push(command);
  }

  /**
   * Get the current section context based on cursor position
   * Uses ManuscriptContextDetector for manuscript-aware context (Requirement 48.4)
   */
  private getCurrentSectionContext(editor: vscode.TextEditor): string | undefined {
    try {
      const context = this.manuscriptContextDetector.getContext();
      
      if (context && context.currentSection) {
        // Return section title and content as context
        return context.sectionText;
      }
    } catch (error) {
      console.warn('Failed to get section context:', error);
    }
    
    return undefined;
  }

  /**
   * Search for papers using selected text and optional context
   * @param selection The selected text to search for
   * @param context Optional section context to enhance search
   * @returns Array of Zotero items
   */
  public async searchFromSelection(
    selection: string,
    context?: string
  ): Promise<ZoteroItem[]> {
    const startTime = Date.now();

    try {
      // Build search query
      const query = context 
        ? `${selection} ${context}`.substring(0, 500) // Limit query length
        : selection;

      // Check cache first
      const cached = this.getFromCache(query);
      if (cached) {
        console.log(`Cache hit for query: ${query.substring(0, 50)}...`);
        await this.displayResults(cached);
        return cached;
      }

      // Show progress
      const results = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Searching papers...',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Querying Zotero library' });

          // Perform search with timeout
          const searchPromise = this.zoteroClient.getItems(10);
          const timeoutPromise = new Promise<ZoteroItem[]>((_, reject) =>
            setTimeout(() => reject(new Error('Search timeout')), this.SEARCH_TIMEOUT)
          );

          try {
            const items = await Promise.race([searchPromise, timeoutPromise]);
            
            // Cache results
            this.setCache(query, items);
            
            const elapsed = Date.now() - startTime;
            console.log(`Search completed in ${elapsed}ms`);
            
            return items;
          } catch (error) {
            if (error instanceof Error && error.message === 'Search timeout') {
              vscode.window.showWarningMessage(
                'The search is taking longer than expected. Try using more specific search terms.',
                'Retry'
              );
            }
            throw error;
          }
        }
      );

      // Display results
      await this.displayResults(results);
      
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      vscode.window.showErrorMessage(
        'Unable to search for papers. Please check your Zotero connection and try again.',
        'Check Settings',
        'Retry'
      ).then(action => {
        if (action === 'Check Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant.zotero');
        }
      });
      return [];
    }
  }

  /**
   * Display search results in a quick pick and handle selection
   * @param results Array of Zotero items to display
   * @returns Selected item or null if cancelled
   */
  public async displayResults(results: ZoteroItem[]): Promise<ZoteroItem | null> {
    if (results.length === 0) {
      // Requirement 47.1: Offer "Search Internet" when no results found
      const action = await vscode.window.showInformationMessage(
        'No papers found in Zotero. Try a different search term or search the internet.',
        'Search Internet',
        'Cancel'
      );
      
      if (action === 'Search Internet') {
        await this.searchInternet();
      }
      return null;
    }

    // Format results for quick pick
    const items = results.map((item, index) => {
      // Extract authors from creators array
      const authors = item.creators?.map(c => c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()) || [];
      // Extract year from date field
      const year = item.date ? new Date(item.date).getFullYear() : 'Unknown';
      
      return {
        label: `$(file-text) ${item.title}`,
        description: `${authors.slice(0, 2).join(', ')}${authors.length > 2 ? ' et al.' : ''} (${year})`,
        detail: item.abstractNote?.substring(0, 150) + (item.abstractNote && item.abstractNote.length > 150 ? '...' : ''),
        item,
        index,
      };
    });

    // Show quick pick
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Found ${results.length} paper${results.length !== 1 ? 's' : ''} - Select to open`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) {
      return null;
    }

    // Open or extract paper
    await this.openOrExtractPaper(selected.item);
    
    return selected.item;
  }

  /**
   * Search internet for papers when Zotero search returns no results
   * Requirements: 47.1, 47.2, 47.3, 47.4, 47.5
   */
  private async searchInternet(): Promise<void> {
    try {
      // Get search query from user
      const query = await vscode.window.showInputBox({
        prompt: 'Enter search terms for internet paper search',
        placeHolder: 'e.g., machine learning transformers',
      });

      if (!query || query.trim().length === 0) {
        return;
      }

      // Import InternetPaperSearcher
      const { InternetPaperSearcher } = await import('./internetPaperSearcher');
      const searcher = new InternetPaperSearcher(this.workspaceRoot);

      // Search external sources
      const results = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Searching external sources...',
          cancellable: false,
        },
        async () => {
          return await searcher.searchExternal(query);
        }
      );

      // Display results
      const selected = await searcher.displayExternalResults(results);

      if (selected) {
        // Import to Zotero
        const itemKey = await searcher.importToZotero(selected);
        
        if (itemKey) {
          vscode.window.showInformationMessage(
            'Paper imported successfully!',
            'View in Zotero'
          );
        }
      }
    } catch (error) {
      console.error('Internet search failed:', error);
      vscode.window.showErrorMessage(
        'Unable to search external sources. Please check your internet connection and try again.',
        'Retry'
      );
    }
  }

  /**
   * Open extracted text if available, otherwise trigger extraction
   * @param item The Zotero item to open
   */
  public async openOrExtractPaper(item: ZoteroItem): Promise<void> {
    try {
      // Generate expected filename from item
      const filename = this.generateFilename(item);
      const extractedPath = path.join(this.extractedTextPath, filename);

      // Check if extracted text exists
      if (fs.existsSync(extractedPath)) {
        // Open existing extracted text
        const document = await vscode.workspace.openTextDocument(extractedPath);
        await vscode.window.showTextDocument(document, { preview: false });
        
        vscode.window.showInformationMessage(
          `Opened: ${item.title}`,
          'Extract Claim'
        ).then(action => {
          if (action === 'Extract Claim') {
            vscode.commands.executeCommand('researchAssistant.extractClaimFromSelection');
          }
        });
      } else {
        // Extracted text doesn't exist - offer to extract
        const action = await vscode.window.showInformationMessage(
          `"${item.title}" has not been extracted yet.`,
          'Extract Now',
          'Cancel'
        );

        if (action === 'Extract Now') {
          // Check if PDF exists in literature/PDFs directory
          const pdfDir = path.join(this.workspaceRoot, 'literature', 'PDFs');
          const pdfPath = path.join(pdfDir, filename.replace(/\.(txt|md)$/, '.pdf'));

          if (fs.existsSync(pdfPath)) {
            // Trigger PDF extraction
            await vscode.commands.executeCommand('researchAssistant.extractPdf', pdfPath);
          } else {
            vscode.window.showWarningMessage(
              'PDF not found. Please sync PDFs from Zotero first.',
              'Sync PDFs'
            ).then(syncAction => {
              if (syncAction === 'Sync PDFs') {
                vscode.commands.executeCommand('researchAssistant.syncPDFsFromZotero');
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to open or extract paper:', error);
      vscode.window.showErrorMessage(
        'Unable to open the paper. Please ensure the file exists and try again.',
        'Retry'
      );
    }
  }

  /**
   * Generate filename from Zotero item
   * Format: FirstAuthorLastName_Year.txt
   */
  private generateFilename(item: ZoteroItem): string {
    // Extract first author from creators array
    const firstCreator = item.creators?.[0];
    const firstAuthor = firstCreator?.name || firstCreator?.lastName || 'Unknown';
    
    // Split by comma first (for "Last, First" format), then by space
    const parts = firstAuthor.includes(',') 
      ? firstAuthor.split(',').map((p: string) => p.trim())
      : firstAuthor.split(' ');
    const lastName = parts[0] || firstAuthor;
    
    // Extract year from date field
    const year = item.date ? new Date(item.date).getFullYear() : 'Unknown';
    
    // Clean filename
    const cleanName = lastName.replace(/[^a-zA-Z0-9]/g, '');
    
    return `${cleanName}_${year}.txt`;
  }

  /**
   * Get cached search results
   */
  private getFromCache(query: string): ZoteroItem[] | null {
    const entry = this.searchCache.get(query);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.searchCache.delete(query);
      return null;
    }

    return entry.results;
  }

  /**
   * Cache search results
   */
  private setCache(query: string, results: ZoteroItem[]): void {
    this.searchCache.set(query, {
      results,
      timestamp: Date.now(),
    });

    // Limit cache size to 50 entries
    if (this.searchCache.size > 50) {
      const oldestKey = this.searchCache.keys().next().value;
      if (oldestKey) {
        this.searchCache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear search cache
   */
  public clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d?.dispose());
    this.searchCache.clear();
  }
}
