import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { WritingModeManager } from '../core/writingModeManager';
import { QuestionAnswerParser, QuestionAnswerPair } from '../core/questionAnswerParser';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { SentenceParsingCache } from '../services/cachingService';
import { getBenchmark } from '../core/performanceBenchmark';
import { getImmersiveModeManager } from './immersiveModeManager';
import { PersistenceUtils } from '../core/persistenceUtils';
import { getModeContextManager } from '../core/modeContextManager';
import { DataValidationService } from '../core/dataValidationService';

/**
 * WritingModeProvider - Webview panel provider for writing mode
 * Displays question-answer pairs in two-column layout
 * Includes memory management and caching for performance
 */
export class WritingModeProvider {
  public static readonly viewType = 'researchAssistant.writingMode';
  private panel?: vscode.WebviewPanel;
  private panelDisposed: boolean = false;
  private writingModeManager: WritingModeManager;
  private questionAnswerParser: QuestionAnswerParser;
  private disposables: vscode.Disposable[] = [];
  private sentenceParsingCache: SentenceParsingCache;
  private disposalManager = getWebviewDisposalManager();
  private benchmark = getBenchmark();
  private immersiveModeManager = getImmersiveModeManager();
  
  // Write queue to prevent race conditions on manuscript saves
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.writingModeManager = new WritingModeManager();
    this.questionAnswerParser = new QuestionAnswerParser();
    this.sentenceParsingCache = new SentenceParsingCache(100);
  }

  /**
   * Create and show writing mode panel
   */
  async show(): Promise<void> {
    // Benchmark mode loading
    await this.benchmark.benchmarkModeLoad('writing', async () => {
      await this._showInternal();
    });
  }

  private async _showInternal(): Promise<void> {
    // If panel already exists and is not disposed, reveal it
    if (this.panel && !this.panelDisposed) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Clear stale reference if panel was disposed
    if (this.panelDisposed) {
      this.panel = undefined;
      this.panelDisposed = false;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      WritingModeProvider.viewType,
      'Writing Mode',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
        retainContextWhenHidden: true
      }
    );

    // Register with immersive mode manager (closes other immersive panels)
    this.immersiveModeManager.registerPanel(this.panel, WritingModeProvider.viewType);

    // Register with disposal manager
    this.disposalManager.registerWebview(WritingModeProvider.viewType, this.panel.webview);
    this.disposalManager.startMemoryMonitoring(WritingModeProvider.viewType, () => {
      this.handleHighMemory();
    });

    // Load HTML content
    this.panel.webview.html = await this.getHtmlContent(this.panel.webview);

    // Handle messages from webview
    const messageListener = this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      this.disposables
    );

    this.disposalManager.registerDisposable(WritingModeProvider.viewType, messageListener);

    // Handle panel disposal
    const disposalListener = this.panel.onDidDispose(() => {
      this.panelDisposed = true;
      this.dispose();
    });

    this.disposables.push(disposalListener);

    // Initialize writing mode
    await this.initializeWritingMode();
  }

  /**
   * Initialize writing mode with question-answer pairs
   */
  private async initializeWritingMode(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      // Get manuscript path
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Initialize writing mode manager
      this.writingModeManager.initializeState(manuscriptPath, '');

      // Load and parse manuscript
      const manuscript = await this.loadManuscript();
      console.log(`[WritingMode] Loaded ${manuscript.length} characters`);
      
      let questionAnswerPairs = this.questionAnswerParser.parseManuscript(manuscript);
      console.log(`[WritingMode] Parsed ${questionAnswerPairs.length} question-answer pairs`);

      // Validate Q&A pairs
      if (!DataValidationService.validateQAPairsArray(questionAnswerPairs)) {
        console.warn('[WritingMode] Q&A pairs validation failed');
        
        // Find which pair is invalid to provide better error message
        let errorDetails = 'Failed to parse manuscript. ';
        let invalidPairId = null;
        for (let i = 0; i < questionAnswerPairs.length; i++) {
          const pair = questionAnswerPairs[i];
          if (!pair.id || !pair.question || typeof pair.answer !== 'string') {
            errorDetails += `Issue at Q&A #${i + 1}: "${pair.question || '(no question)'}". `;
            if (!pair.id) {
              errorDetails += 'Missing ID. ';
            }
            if (!pair.question) {
              errorDetails += 'Question is empty. ';
            }
            invalidPairId = pair.id;
            break;
          }
        }
        
        this.panel.webview.postMessage({
          type: 'error',
          message: errorDetails,
          pairId: invalidPairId
        });
        return;
      }

      // Enrich pairs with linked sources from claims
      questionAnswerPairs = await this.enrichPairsWithLinkedSources(questionAnswerPairs);

      // Sanitize for webview transmission
      const sanitizedPairs = DataValidationService.sanitizeQAPairsForWebview(questionAnswerPairs);

      // Check if we should restore from cross-mode context
      let centerItemId = this.writingModeManager.getCenterItemId();
      const editingContext = getModeContextManager().getEditingModeContext();
      
      // If no saved position in writing mode but editing mode has one, find matching pair by position
      if (!centerItemId && editingContext.centerItemPosition !== undefined) {
        // Find the Q&A pair that contains this position
        const matchingPair = sanitizedPairs.find(p => {
          // Check if the position falls within this Q&A pair's answer
          // We need to be more flexible here since positions might not match exactly
          return Math.abs(p.position - editingContext.centerItemPosition) < 5;
        });
        
        if (matchingPair) {
          centerItemId = matchingPair.id;
          console.log(`[WritingMode] Found matching pair near position ${editingContext.centerItemPosition}: ${centerItemId}`);
        } else {
          // If no exact match, find the closest pair
          let closestPair = sanitizedPairs[0];
          let minDistance = Math.abs(sanitizedPairs[0].position - editingContext.centerItemPosition);
          
          for (const pair of sanitizedPairs) {
            const distance = Math.abs(pair.position - editingContext.centerItemPosition);
            if (distance < minDistance) {
              minDistance = distance;
              closestPair = pair;
            }
          }
          
          centerItemId = closestPair.id;
          console.log(`[WritingMode] Using closest pair at position ${closestPair.position} for target ${editingContext.centerItemPosition}: ${centerItemId}`);
        }
      }

      // Send initial data to webview
      this.panel.webview.postMessage({
        type: 'initialize',
        pairs: sanitizedPairs,
        centerItemId: centerItemId
      });

      // Store in mode context
      getModeContextManager().setWritingModeContext({
        pairs: sanitizedPairs
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize writing mode: ${error}`);
    }
  }

  /**
   * Enrich question-answer pairs with linked sources from claims
   */
  private async enrichPairsWithLinkedSources(pairs: any[]): Promise<any[]> {
    try {
      // For each pair, extract claim IDs and get their quotes
      for (const pair of pairs) {
        const linkedSources: any[] = [];
        const seenSources = new Set<string>();

        // Remove Source comments from answer text for display
        pair.answer = pair.answer.replace(/<!--\s*Source:[^>]+?-->/g, '').trim();

        // Process each claim ID in the pair
        for (const claimId of pair.claims || []) {
          try {
            const claim = this.extensionState.claimsManager.getClaim(claimId);
            if (!claim) continue;

            // Add primary quote
            if (claim.primaryQuote && !seenSources.has(claim.primaryQuote.source)) {
              linkedSources.push({
                title: claim.text.substring(0, 50) + (claim.text.length > 50 ? '...' : ''),
                source: claim.primaryQuote.source,
                quote: claim.primaryQuote.text,
                cited: false
              });
              seenSources.add(claim.primaryQuote.source);
            }

            // Add supporting quotes
            for (const supportingQuote of claim.supportingQuotes || []) {
              if (!seenSources.has(supportingQuote.source)) {
                linkedSources.push({
                  title: claim.text.substring(0, 50) + (claim.text.length > 50 ? '...' : ''),
                  source: supportingQuote.source,
                  quote: supportingQuote.text,
                  cited: false
                });
                seenSources.add(supportingQuote.source);
              }
            }
          } catch (error) {
            console.warn(`[WritingMode] Failed to get claim ${claimId}:`, error);
          }
        }

        pair.linkedSources = linkedSources;
      }

      return pairs;
    } catch (error) {
      console.error('[WritingMode] Error enriching pairs with linked sources:', error);
      return pairs;
    }
  }

  /**
   * Load manuscript content
   */
  private async loadManuscript(): Promise<string> {
    try {
      const config = this.extensionState.getConfig();
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      console.log(`[WritingMode] Loading manuscript from: ${manuscriptPath}`);
      console.log(`[WritingMode] File exists: ${fs.existsSync(manuscriptPath)}`);

      if (fs.existsSync(manuscriptPath)) {
        const content = fs.readFileSync(manuscriptPath, 'utf-8');
        console.log(`[WritingMode] Loaded ${content.length} characters`);
        return content;
      }

      console.log(`[WritingMode] File not found, returning empty string`);
      return '';
    } catch (error) {
      console.error('[WritingMode] Failed to load manuscript:', error);
      return '';
    }
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'saveManuscript':
        await this.saveManuscript(message.pairs);
        break;

      case 'updateAnswer':
        await this.updateAnswer(message.pairId, message.answer);
        break;

      case 'addPair':
        await this.addQuestionAnswerPair(message.section);
        break;

      case 'deletePair':
        await this.deleteQuestionAnswerPair(message.pairId);
        break;

      case 'citationToggled':
        await this.handleCitationToggled(message.pairId, message.sourceIndex, message.cited);
        break;

      case 'saveCenterItem':
        this.writingModeManager.saveCenterItemId(message.itemId, message.position);
        // Also update global context for cross-mode navigation
        getModeContextManager().setWritingModeContext({
          centerItemId: message.itemId,
          centerItemPosition: message.position
        });
        break;

      case 'switchToEditingMode':
        await vscode.commands.executeCommand('researchAssistant.openEditingMode');
        break;

      case 'switchToClaimReview':
        await vscode.commands.executeCommand('researchAssistant.openClaimReview');
        break;

      case 'openClaim':
        // Store the current writing mode context so we can return to it
        getModeContextManager().setWritingModeContext({
          centerItemId: this.writingModeManager.getCenterItemId(),
          centerItemPosition: this.writingModeManager.getCenterItemPosition?.()
        });
        await vscode.commands.executeCommand('researchAssistant.openClaimReview', message.claimId);
        break;

      case 'exportMarkdown':
        await vscode.commands.executeCommand('researchAssistant.exportManuscriptMarkdown');
        break;

      case 'exportWord':
        await vscode.commands.executeCommand('researchAssistant.exportManuscriptWord');
        break;

      case 'showHelp':
        this.showHelpOverlay();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Save manuscript from question-answer pairs
   * Queues the save operation to prevent race conditions
   */
  private async saveManuscript(pairs: QuestionAnswerPair[]): Promise<void> {
    // Queue the save operation to prevent race conditions with file watchers
    this.writeQueue = this.writeQueue.then(() => this._performManuscriptSave(pairs)).catch(error => {
      console.error('Error in manuscript write queue:', error);
      vscode.window.showErrorMessage(`Failed to save manuscript: ${error}`);
    });
    
    return this.writeQueue;
  }

  private async _performManuscriptSave(pairs: QuestionAnswerPair[]): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Reconstruct manuscript from pairs
      const content = this.questionAnswerParser.reconstructManuscript(pairs);

      // Validate content
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid manuscript content generated');
      }

      // Use atomic write with retry logic
      const result = await PersistenceUtils.writeFileAtomic(manuscriptPath, content, {
        maxRetries: 3,
        initialDelayMs: 100
      });

      if (!result.success) {
        throw result.error || new Error('Unknown write error');
      }

      // Show confirmation
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'saved',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to save manuscript:', err);
      
      // Show error to user with retry option
      await PersistenceUtils.showPersistenceError(
        err,
        'save manuscript',
        this.extensionState.getAbsolutePath('03_Drafting/manuscript.md'),
        () => this._performManuscriptSave(pairs)
      );
      
      throw err;
    }
  }

  /**
   * Update a single answer
   */
  private async updateAnswer(pairId: string, answer: string): Promise<void> {
    // For now, we'll reload and update the full manuscript
    // In the future, could optimize to update just one pair
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'answerUpdated',
        pairId,
        answer
      });
    }
  }

  /**
   * Add new question-answer pair
   */
  private async addQuestionAnswerPair(section: string): Promise<void> {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'pairAdded',
        section
      });
    }
  }

  /**
   * Delete question-answer pair
   */
  private async deleteQuestionAnswerPair(pairId: string): Promise<void> {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'pairDeleted',
        pairId
      });
    }
  }

  /**
   * Handle citation toggle from webview
   */
  private async handleCitationToggled(pairId: string, sourceIndex: number, cited: boolean): Promise<void> {
    try {
      console.log(`[WritingMode] Citation toggled: pair=${pairId}, source=${sourceIndex}, cited=${cited}`);
      
      // In the future, this could persist citation selections to a database
      // For now, we just log the action and let the webview maintain the state
      
      // Optionally: Update the SentenceClaimQuoteLink manager if we have access to it
      // This would track which quotes are marked for citation in the final version
    } catch (error) {
      console.error('[WritingMode] Error handling citation toggle:', error);
    }
  }

  /**
   * Show help overlay
   */
  private showHelpOverlay(): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'showHelp'
      });
    }
  }

  /**
   * Get HTML content for webview
   */
  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'writingMode.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'writingMode.js')
    );

    const nonce = this.getNonce();
    const helpOverlayHtml = generateHelpOverlayHtml('writing');
    const helpOverlayCss = getHelpOverlayCss();
    const breadcrumbCss = getBreadcrumbCss();
    const modeSwitchingJs = getModeSwitchingJs();
    const helpOverlayJs = getHelpOverlayJs();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Writing Mode</title>
  <link rel="stylesheet" href="${styleUri}">
  <style nonce="${nonce}">
    ${helpOverlayCss}
    ${breadcrumbCss}
  </style>
</head>
<body>
  <div class="writing-mode-container">
    <!-- Header -->
    <div class="header">
      <div class="title">Research Assistant | Writing Mode</div>
      <div class="controls">
        <button id="exportMarkdownBtn" class="icon-btn" title="Export as Markdown">📄</button>
        <button id="exportWordBtn" class="icon-btn" title="Export as Word">📋</button>
        <button id="helpBtn" class="icon-btn" title="Help (?)">?</button>
        <button id="editBtn" class="icon-btn" title="Edit Mode">✎</button>
      </div>
    </div>

    <!-- Main content: Two-column table layout -->
    <div class="content">
      <div id="pairsList" class="pairs-list">
        <!-- Question-answer pairs will be rendered here -->
      </div>
      <div class="auto-save-indicator">
        <span id="saveStatus">Saved</span>
      </div>
    </div>

    ${helpOverlayHtml}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    ${modeSwitchingJs}
    ${helpOverlayJs}
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Handle high memory usage
   */
  private handleHighMemory(): void {
    const stats = this.disposalManager.getMemoryStats();
    console.warn(`High memory usage in writing mode: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`);

    // Trim caches
    this.sentenceParsingCache.clear();

    // Only notify user if memory is very high (over 1GB)
    if (this.panel && stats.heapUsedMB > 1024) {
      this.panel.webview.postMessage({
        type: 'memoryWarning',
        message: 'Memory usage is high. Clearing cache...'
      });
    }

    // Force garbage collection if available
    this.disposalManager.forceGarbageCollection();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Stop memory monitoring
    this.disposalManager.stopMemoryMonitoring(WritingModeProvider.viewType);

    // Dispose all registered disposables
    this.disposables.forEach(d => {
      try {
        d.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    });
    this.disposables = [];

    // Clear caches
    this.sentenceParsingCache.dispose();

    // Clear view reference
    this.panel = undefined;

    console.log('Writing mode disposed');
  }
}
