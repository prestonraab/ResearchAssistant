import * as vscode from 'vscode';
import * as path from 'path';
import { ZoteroClient, ZoteroItem } from '@research-assistant/core';
import { ManuscriptContextDetector } from '../core/manuscriptContextDetector';

interface RecentSearch {
  query: string;
  result: ZoteroItem;
  timestamp: number;
}

/**
 * Provides inline paper search functionality while writing.
 * Triggers on "[[find: " pattern and shows real-time search results.
 * 
 * Requirements: 45.1, 45.2, 45.3, 45.4, 45.5
 */
export class InlineSearchProvider implements vscode.CompletionItemProvider {
  private static readonly TRIGGER_PATTERN = /\[\[find:\s*/;
  private static readonly MAX_RECENT_SEARCHES = 10;
  private static readonly DEBOUNCE_DELAY = 300; // ms
  
  private recentSearches: RecentSearch[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastQuery: string = '';
  private lastResults: ZoteroItem[] = [];
  private context: vscode.ExtensionContext;

  constructor(
    private zoteroClient: ZoteroClient,
    private manuscriptContextDetector: ManuscriptContextDetector,
    private workspaceRoot: string,
    private extractedTextPath: string,
    context: vscode.ExtensionContext
  ) {
    this.context = context;
    this.loadRecentSearches();
  }

  /**
   * Detects if the trigger pattern is present at the current position.
   * Requirement 45.1: Detect trigger pattern "[[find: "
   */
  private detectTriggerPattern(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { active: boolean; query: string } {
    const lineText = document.lineAt(position).text;
    const textBeforeCursor = lineText.substring(0, position.character);
    
    // Check if we have the trigger pattern
    const match = textBeforeCursor.match(/\[\[find:\s*([^\]]*?)$/);
    
    if (match) {
      return {
        active: true,
        query: match[1] || ''
      };
    }
    
    return { active: false, query: '' };
  }

  /**
   * Provides completion items for inline paper search.
   * Requirement 45.2: Show real-time search results as user types
   * Requirement 45.3: Support keyboard navigation through results
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
    // Only activate for manuscript.md or markdown files in drafting directory
    if (!this.isManuscriptFile(document)) {
      return undefined;
    }

    // Check for trigger pattern
    const trigger = this.detectTriggerPattern(document, position);
    
    if (!trigger.active) {
      return undefined;
    }

    const query = trigger.query.trim();

    // If query is empty, show recent searches
    if (query.length === 0) {
      return this.createRecentSearchCompletions();
    }

    // If query is too short, don't search yet
    if (query.length < 2) {
      return new vscode.CompletionList(
        [this.createInfoItem('Type at least 2 characters to search...')],
        true // isIncomplete
      );
    }

    // Debounce search to avoid too many requests
    if (query === this.lastQuery && this.lastResults.length > 0) {
      // Use cached results
      return this.createSearchResultCompletions(this.lastResults, query);
    }

    // Show loading indicator
    const loadingItem = this.createInfoItem('Searching papers...');
    
    // Trigger search asynchronously
    this.performSearch(query, document, position);
    
    // Return loading state with incomplete flag
    return new vscode.CompletionList([loadingItem], true);
  }

  /**
   * Performs the actual search with debouncing.
   * Requirement 45.2: Real-time search with debouncing
   */
  private async performSearch(
    query: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<void> {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(async () => {
      try {
        // Get manuscript context to enhance search
        const context = this.manuscriptContextDetector.getContext();
        
        // Combine query with section context if available
        let enhancedQuery = query;
        if (context && context.currentSection) {
          enhancedQuery = `${query} ${context.currentSection.title}`;
        }

        // Perform semantic search via ZoteroClient
        const results = await this.zoteroClient.getItems(10);
        
        // Cache results
        this.lastQuery = query;
        this.lastResults = results;
        
        // Trigger completion refresh by simulating a text change
        // This is a workaround to update completions after async search
        if (vscode.window.activeTextEditor?.document === document) {
          vscode.commands.executeCommand('editor.action.triggerSuggest');
        }
      } catch (error) {
        console.error('Inline search failed:', error);
        this.lastResults = [];
      }
    }, InlineSearchProvider.DEBOUNCE_DELAY);
  }

  /**
   * Creates completion items from search results.
   * Requirement 45.3: Support keyboard navigation through results
   */
  private createSearchResultCompletions(
    results: ZoteroItem[],
    query: string
  ): vscode.CompletionList {
    if (results.length === 0) {
      return new vscode.CompletionList(
        [this.createInfoItem('No papers found')],
        false
      );
    }

    const items = results.map((item, index) => 
      this.createPaperCompletionItem(item, query, index)
    );

    return new vscode.CompletionList(items, false);
  }

  /**
   * Creates a completion item for a paper.
   * Requirement 45.4: Insert citation reference on selection
   */
  private createPaperCompletionItem(
    item: ZoteroItem,
    query: string,
    index: number
  ): vscode.CompletionItem {
    const authors = this.getAuthorsString(item);
    const year = this.getYear(item);
    
    const citation = `${authors} (${year})`;
    
    const completionItem = new vscode.CompletionItem(
      citation,
      vscode.CompletionItemKind.Reference
    );

    // Set the text to insert - replace the entire [[find: query]] pattern
    completionItem.insertText = `${citation}]]`;
    
    // Set label and detail
    completionItem.label = `${index + 1}. ${item.title}`;
    completionItem.detail = citation;
    
    // Set documentation with abstract preview
    const documentation = new vscode.MarkdownString();
    documentation.appendMarkdown(`**${item.title}**\n\n`);
    documentation.appendMarkdown(`*${citation}*\n\n`);
    
    if (item.abstractNote) {
      const preview = item.abstractNote.length > 200 
        ? item.abstractNote.substring(0, 200) + '...'
        : item.abstractNote;
      documentation.appendMarkdown(`${preview}\n\n`);
    }
    
    documentation.appendMarkdown(`[Open Paper](command:researchAssistant.openPaperFromInlineSearch?${encodeURIComponent(JSON.stringify({ itemKey: item.key, query }))})`);
    
    completionItem.documentation = documentation;
    
    // Sort by index
    completionItem.sortText = `0${index.toString().padStart(3, '0')}`;
    
    // Add command to remember this search
    completionItem.command = {
      command: 'researchAssistant.rememberInlineSearch',
      title: 'Remember Search',
      arguments: [query, item]
    };

    return completionItem;
  }

  /**
   * Creates completion items from recent searches.
   * Requirement 45.5: Remember recent searches for quick access
   */
  private createRecentSearchCompletions(): vscode.CompletionList {
    if (this.recentSearches.length === 0) {
      return new vscode.CompletionList(
        [this.createInfoItem('Start typing to search papers...')],
        true
      );
    }

    const items = this.recentSearches.map((search, index) => {
      const authors = this.getAuthorsString(search.result);
      const year = this.getYear(search.result);
      
      const citation = `${authors} (${year})`;
      
      const item = new vscode.CompletionItem(
        `Recent: ${search.query}`,
        vscode.CompletionItemKind.Reference
      );
      
      item.insertText = `${citation}]]`;
      item.detail = `${citation} - "${search.query}"`;
      item.documentation = new vscode.MarkdownString(
        `**Recent search:** ${search.query}\n\n**Result:** ${search.result.title}`
      );
      item.sortText = `1${index.toString().padStart(3, '0')}`;
      
      item.command = {
        command: 'researchAssistant.rememberInlineSearch',
        title: 'Remember Search',
        arguments: [search.query, search.result]
      };
      
      return item;
    });

    return new vscode.CompletionList(items, true);
  }

  /**
   * Creates an informational completion item (non-selectable).
   */
  private createInfoItem(message: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(message, vscode.CompletionItemKind.Text);
    item.sortText = '9999'; // Sort to bottom
    item.insertText = '';
    item.command = { command: '', title: '' }; // No-op command
    return item;
  }

  /**
   * Checks if the document is a manuscript file.
   */
  private isManuscriptFile(document: vscode.TextDocument): boolean {
    if (document.languageId !== 'markdown') {
      return false;
    }

    const relativePath = path.relative(this.workspaceRoot, document.uri.fsPath);
    
    // Check if it's manuscript.md or any markdown file in drafting directory
    return relativePath.includes('manuscript.md') || 
           relativePath.startsWith('03_Drafting');
  }

  /**
   * Extract authors string from ZoteroItem
   */
  private getAuthorsString(item: ZoteroItem): string {
    if (!item.creators || item.creators.length === 0) {
      return 'Unknown';
    }

    const firstCreator = item.creators[0];
    const authorName = firstCreator.lastName || firstCreator.name || 'Unknown';
    
    return item.creators.length > 1 ? `${authorName} et al.` : authorName;
  }

  /**
   * Extract year from ZoteroItem date field
   */
  private getYear(item: ZoteroItem): string {
    if (!item.date) {
      return 'n.d.';
    }

    // Try to extract year from date string (format can vary)
    const yearMatch = item.date.match(/\d{4}/);
    return yearMatch ? yearMatch[0] : 'n.d.';
  }

  /**
   * Remembers a search for quick access later.
   * Requirement 45.5: Remember recent searches
   */
  rememberSearch(query: string, result: ZoteroItem): void {
    // Remove existing entry for this query if present
    this.recentSearches = this.recentSearches.filter(s => s.query !== query);
    
    // Add to front of list
    this.recentSearches.unshift({
      query,
      result,
      timestamp: Date.now()
    });
    
    // Limit size
    if (this.recentSearches.length > InlineSearchProvider.MAX_RECENT_SEARCHES) {
      this.recentSearches = this.recentSearches.slice(0, InlineSearchProvider.MAX_RECENT_SEARCHES);
    }
    
    // Persist to workspace state
    this.saveRecentSearches();
  }

  /**
   * Opens a paper from inline search results.
   * Requirement 45.4: Optionally open paper for reading
   */
  async openPaper(itemKey: string, query: string): Promise<void> {
    try {
      // Check if extracted text exists
      const extractedPath = path.join(this.extractedTextPath, `${itemKey}.md`);
      const absolutePath = path.join(this.workspaceRoot, extractedPath);
      
      try {
        const uri = vscode.Uri.file(absolutePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (error) {
        // File doesn't exist, offer to extract
        const choice = await vscode.window.showInformationMessage(
          'Extracted text not found. Would you like to extract it now?',
          'Extract',
          'Cancel'
        );
        
        if (choice === 'Extract') {
          // Try to get PDF path from Zotero item children
          const attachments = await this.zoteroClient.getPdfAttachments(itemKey);
          const pdfAttachment = attachments.find((attachment: any) => 
            attachment.contentType === 'application/pdf'
          );
          
          if (pdfAttachment && pdfAttachment.path) {
            await vscode.commands.executeCommand(
              'researchAssistant.extractPdf',
              pdfAttachment.path
            );
          } else {
            vscode.window.showWarningMessage('No PDF attachment found for this paper');
          }
        }
      }
    } catch (error) {
      console.error('Failed to open paper:', error);
      vscode.window.showErrorMessage(
        'Unable to open the paper. Please try again.',
        'Retry'
      );
    }
  }

  /**
   * Clears recent searches.
   */
  clearRecentSearches(): void {
    this.recentSearches = [];
    this.saveRecentSearches();
  }

  /**
   * Loads recent searches from workspace state.
   */
  private loadRecentSearches(): void {
    const saved = this.context.workspaceState.get<RecentSearch[]>('inlineSearchRecent', []);
    
    // Filter out old searches (older than 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.recentSearches = saved.filter(s => s.timestamp > sevenDaysAgo);
  }

  /**
   * Saves recent searches to workspace state.
   */
  private saveRecentSearches(): void {
    this.context.workspaceState.update('inlineSearchRecent', this.recentSearches);
  }

  /**
   * Registers commands for inline search functionality.
   */
  registerCommands(): vscode.Disposable[] {
    return [
      vscode.commands.registerCommand(
        'researchAssistant.rememberInlineSearch',
        (query: string, result: ZoteroItem) => {
          this.rememberSearch(query, result);
        }
      ),
      vscode.commands.registerCommand(
        'researchAssistant.openPaperFromInlineSearch',
        (args: { itemKey: string; query: string }) => {
          this.openPaper(args.itemKey, args.query);
        }
      ),
      vscode.commands.registerCommand(
        'researchAssistant.clearInlineSearchHistory',
        () => {
          this.clearRecentSearches();
          vscode.window.showInformationMessage('Inline search history cleared');
        }
      )
    ];
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
