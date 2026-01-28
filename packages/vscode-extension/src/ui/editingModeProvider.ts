import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { EditingModeManager } from '../core/editingModeManager';
import { SentenceParser, Sentence } from '../core/sentenceParser';
import { SentenceClaimMapper } from '../core/sentenceClaimMapper';
import { QuestionAnswerParser } from '../core/questionAnswerParser';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { SentenceParsingCache } from '../services/cachingService';
import { getBenchmark } from '../core/performanceBenchmark';
import { getImmersiveModeManager } from './immersiveModeManager';
import { PersistenceUtils } from '../core/persistenceUtils';
import { getModeContextManager } from '../core/modeContextManager';
import { DataValidationService } from '../core/dataValidationService';
import type { Claim } from '@research-assistant/core';

/**
 * EditingModeProvider - Webview panel provider for editing mode
 * Displays sentences from manuscript answers with nested claims in main editor area
 * Includes virtual scrolling and lazy loading for memory efficiency
 */
export class EditingModeProvider {
  public static readonly viewType = 'researchAssistant.editingMode';
  private panel?: vscode.WebviewPanel;
  private panelDisposed: boolean = false;
  private editingModeManager: EditingModeManager;
  private sentenceParser: SentenceParser;
  private sentenceClaimMapper: SentenceClaimMapper;
  private questionAnswerParser: QuestionAnswerParser;
  private disposables: vscode.Disposable[] = [];
  private sentences: Sentence[] = [];
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
    this.editingModeManager = new EditingModeManager();
    this.sentenceParser = new SentenceParser();
    this.sentenceClaimMapper = new SentenceClaimMapper(extensionState.claimsManager, context.workspaceState);
    this.questionAnswerParser = new QuestionAnswerParser();
    this.sentenceParsingCache = new SentenceParsingCache(100);
  }

  /**
   * Create and show editing mode panel
   */
  async show(): Promise<void> {
    // Benchmark mode loading
    await this.benchmark.benchmarkModeLoad('editing', async () => {
      await this._showInternal();
    });
  }

  private async _showInternal(): Promise<void> {
    // If panel already exists and is not disposed, reveal it
    if (this.panel && !this.panelDisposed) {
      this.panel.reveal(vscode.ViewColumn.One);
      
      // Check if we need to navigate to a specific sentence (e.g., returning from claim review)
      const claimReviewContext = getModeContextManager().getClaimReviewContext();
      if (claimReviewContext?.returnToSentenceId) {
        console.log('[EditingMode] Navigating to sentence from existing panel:', claimReviewContext.returnToSentenceId);
        this.panel.webview.postMessage({
          type: 'scrollToItem',
          itemId: claimReviewContext.returnToSentenceId
        });
      }
      
      return;
    }

    // Clear stale reference if panel was disposed
    if (this.panelDisposed) {
      this.panel = undefined;
      this.panelDisposed = false;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      EditingModeProvider.viewType,
      'Editing Mode',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
        retainContextWhenHidden: true
      }
    );

    // Register with immersive mode manager (closes other immersive panels)
    this.immersiveModeManager.registerPanel(this.panel, EditingModeProvider.viewType);

    // Register with disposal manager
    this.disposalManager.registerWebview(EditingModeProvider.viewType, this.panel.webview);
    this.disposalManager.startMemoryMonitoring(EditingModeProvider.viewType, () => {
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

    this.disposalManager.registerDisposable(EditingModeProvider.viewType, messageListener);

    // Listen for claim changes to refresh display
    const claimChangeListener = this.extensionState.claimsManager.onDidChange(() => {
      this.refreshSentencesDisplay();
    });
    this.disposables.push(claimChangeListener);

    // Handle panel disposal
    const disposalListener = this.panel.onDidDispose(() => {
      this.panelDisposed = true;
      this.dispose();
    });

    this.disposables.push(disposalListener);

    // Initialize editing mode
    await this.initializeEditingMode();
  }

  /**
   * Initialize editing mode with sentences and claims
   */
  private async initializeEditingMode(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      // Initialize state
      this.editingModeManager.initializeState();

      // Load manuscript
      const manuscript = await this.loadManuscript();
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      console.log(`[EditingMode] Manuscript length: ${manuscript.length} characters`);

      // Parse manuscript into question-answer pairs
      const questionAnswerPairs = this.questionAnswerParser.parseManuscript(manuscript);
      console.log(`[EditingMode] Parsed ${questionAnswerPairs.length} question-answer pairs`);

      // Extract sentences from answers and associate claims
      this.sentences = [];
      let sentenceIndex = 0;

      for (const pair of questionAnswerPairs) {
        // Parse answer text into sentences
        const answerSentences = this.sentenceParser.parseSentences(pair.answer, `qa_${pair.id}`);
        
        // Associate claims from the Q&A pair with each sentence
        for (const sentence of answerSentences) {
          sentence.id = `S_${sentenceIndex}`;
          sentence.claims = [...pair.claims]; // Copy claims from Q&A pair
          sentence.outlineSection = pair.section;
          this.sentences.push(sentence);
          sentenceIndex++;
        }
      }

      console.log(`[EditingMode] Extracted ${this.sentences.length} sentences from answers`);

      // Load full claim details for each sentence
      const sentencesWithClaims = await this.loadClaimsForSentences();
      console.log(`[EditingMode] Sending ${sentencesWithClaims.length} sentences to webview`);

      // Check if we should restore from cross-mode context
      let centerItemId = this.editingModeManager.getCenterItemId();
      const writingContext = getModeContextManager().getWritingModeContext();
      const claimReviewContext = getModeContextManager().getClaimReviewContext();
      
      console.log('[EditingMode] Context check:', {
        savedCenterItemId: centerItemId,
        claimReviewContext: claimReviewContext,
        writingContext: writingContext
      });
      
      // If returning from claim review, navigate to the sentence
      if (claimReviewContext?.returnToSentenceId) {
        centerItemId = claimReviewContext.returnToSentenceId;
        console.log(`[EditingMode] Returning to sentence from claim review: ${centerItemId}`);
      }
      // If no saved position in editing mode but writing mode has one, find matching sentence by position
      else if (!centerItemId && writingContext.centerItemPosition !== undefined) {
        const matchingSentence = sentencesWithClaims.find(s => s.position === writingContext.centerItemPosition);
        if (matchingSentence) {
          centerItemId = matchingSentence.id;
          console.log(`[EditingMode] Found matching sentence at position ${writingContext.centerItemPosition}: ${centerItemId}`);
        }
      }
      
      console.log('[EditingMode] Final centerItemId:', centerItemId);

      // Send initial data to webview with virtual scrolling enabled
      this.panel.webview.postMessage({
        type: 'initialize',
        sentences: sentencesWithClaims,
        centerItemId: centerItemId,
        virtualScrollingEnabled: true,
        itemHeight: 120 // Height of each sentence box in pixels
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize editing mode: ${error}`);
      console.error('[EditingMode] Initialization error:', error);
    }
  }

  /**
   * Load manuscript content
   */
  private async loadManuscript(): Promise<string> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      console.log(`[EditingMode] Loading manuscript from: ${manuscriptPath}`);
      console.log(`[EditingMode] File exists: ${fs.existsSync(manuscriptPath)}`);

      if (fs.existsSync(manuscriptPath)) {
        const content = fs.readFileSync(manuscriptPath, 'utf-8');
        console.log(`[EditingMode] Loaded ${content.length} characters`);
        return content;
      }

      console.log(`[EditingMode] File not found, returning empty string`);
      return '';
    } catch (error) {
      console.error('[EditingMode] Failed to load manuscript:', error);
      return '';
    }
  }

  /**
   * Load claims for all sentences
   */
  private async loadClaimsForSentences(): Promise<any[]> {
    const sentencesWithClaims = [];

    for (const sentence of this.sentences) {
      // Validate sentence before processing
      if (!DataValidationService.validateSentence(sentence)) {
        console.warn('[EditingMode] Skipping invalid sentence:', sentence);
        continue;
      }

      const claims = [];

      // Get claim IDs from both Q&A pair claims AND sentence-claim mapper
      // This ensures claims added in Claim Review mode are also shown
      const qaClaimIds = sentence.claims || [];
      const mapperClaimIds = this.sentenceClaimMapper.getClaimsForSentence(sentence.id) || [];
      
      // Merge and deduplicate claim IDs
      const allClaimIds = Array.from(new Set([...qaClaimIds, ...mapperClaimIds]));

      // Load claim details from Knowledge Base for each claim ID
      for (const claimId of allClaimIds) {
        try {
          const claim = this.extensionState.claimsManager.getClaim(claimId);
          if (claim && DataValidationService.validateClaim(claim)) {
            claims.push({
              id: claim.id,
              text: claim.text,
              originalText: claim.text,
              category: claim.category,
              source: claim.primaryQuote?.source || 'Unknown',
              verified: claim.verified
            });
          } else {
            console.warn(`[EditingMode] Claim ${claimId} not found or invalid in Knowledge Base`);
          }
        } catch (error) {
          console.error(`[EditingMode] Failed to load claim ${claimId}:`, error);
        }
      }

      sentencesWithClaims.push({
        id: sentence.id,
        text: sentence.text,
        originalText: sentence.originalText,
        position: sentence.position,
        outlineSection: sentence.outlineSection,
        claims: claims,
        claimCount: claims.length
      });
    }

    // Validate the entire array before returning
    if (!DataValidationService.validateSentencesArray(sentencesWithClaims)) {
      console.warn('[EditingMode] Sentences array validation failed, returning empty array');
      return [];
    }

    return sentencesWithClaims;
  }

  /**
   * Refresh sentences display when claims change
   */
  private async refreshSentencesDisplay(): Promise<void> {
    if (!this.panel || this.panelDisposed) {
      return;
    }

    try {
      const sentencesWithClaims = await this.loadClaimsForSentences();
      
      // Sanitize for webview transmission
      const sanitizedSentences = DataValidationService.sanitizeSentencesForWebview(sentencesWithClaims);
      
      // Send updated sentences to webview
      this.panel.webview.postMessage({
        type: 'sentencesUpdated',
        sentences: sanitizedSentences
      });

      // Store in mode context
      getModeContextManager().setEditingModeContext({
        sentences: sanitizedSentences
      });
    } catch (error) {
      console.error('[EditingMode] Failed to refresh sentences display:', error);
    }
  }

  /**
   * Get status color for sentence based on claims
   */
  private getStatusColor(claims: any[]): string {
    if (claims.length === 0) {
      return 'red'; // No claims
    }

    const hasVerified = claims.some(c => c.verified === true);
    const hasUnverified = claims.some(c => c.verified !== true);

    if (hasVerified && !hasUnverified) {
      return 'green'; // All verified
    } else if (hasVerified && hasUnverified) {
      return 'blue'; // Mixed
    } else if (hasUnverified) {
      return 'orange'; // Unverified claims
    }

    return 'grey'; // Unknown status
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'editSentence':
        await this.editSentence(message.sentenceId, message.newText);
        break;

      case 'deleteSentence':
        await this.deleteSentence(message.sentenceId);
        break;

      case 'createClaim':
        await this.createClaimFromSentence(message.sentenceId);
        break;

      case 'editClaim':
        await this.editClaim(message.claimId, message.newText);
        break;

      case 'deleteClaim':
        await this.deleteClaimFromSentence(message.sentenceId, message.claimId);
        break;

      case 'matchClaims':
        // Find the sentence text from the stored sentences
        const sentence = this.sentences.find(s => s.id === message.sentenceId);
        const sentenceText = sentence ? sentence.text : '';
        console.log(`[EditingMode] Match claims for sentence ${message.sentenceId}: "${sentenceText}"`);
        await vscode.commands.executeCommand('researchAssistant.openClaimMatching', message.sentenceId, sentenceText);
        break;

      case 'openClaim':
        // Store the sentence ID so we can return to it from claim review
        getModeContextManager().setClaimReviewContext({
          returnToSentenceId: message.sentenceId
        });
        await vscode.commands.executeCommand('researchAssistant.openClaimReview', message.claimId);
        break;

      case 'switchToWritingMode':
        await vscode.commands.executeCommand('researchAssistant.openWritingMode');
        break;

      case 'switchToClaimReview':
        await vscode.commands.executeCommand('researchAssistant.openClaimReview');
        break;

      case 'saveCenterItem':
        this.editingModeManager.saveCenterItemId(message.itemId, message.position);
        // Also update global context for cross-mode navigation
        getModeContextManager().setEditingModeContext({
          centerItemId: message.itemId,
          centerItemPosition: message.position
        });
        break;

      case 'showHelp':
        this.showHelpOverlay();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Edit sentence text
   */
  private async editSentence(sentenceId: string, newText: string): Promise<void> {
    try {
      const sentence = this.sentences.find(s => s.id === sentenceId);
      if (!sentence) {
        return;
      }

      // Update sentence
      sentence.text = newText;
      sentence.updatedAt = new Date();

      // Save to manuscript
      await this.saveManuscript();

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'sentenceUpdated',
          sentenceId,
          text: newText
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to edit sentence: ${error}`);
    }
  }

  /**
   * Delete sentence (preserve claims)
   */
  private async deleteSentence(sentenceId: string): Promise<void> {
    try {
      const confirmed = await vscode.window.showWarningMessage(
        'Delete sentence? Claims will be preserved.',
        'Delete',
        'Cancel'
      );

      if (confirmed !== 'Delete') {
        return;
      }

      // Remove sentence from list
      this.sentences = this.sentences.filter(s => s.id !== sentenceId);

      // Delete mapping (preserves claims)
      await this.sentenceClaimMapper.deleteSentence(sentenceId);

      // Save to manuscript
      await this.saveManuscript();

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'sentenceDeleted',
          sentenceId
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete sentence: ${error}`);
    }
  }

  /**
   * Create claim from sentence
   */
  private async createClaimFromSentence(sentenceId: string): Promise<void> {
    try {
      const sentence = this.sentences.find(s => s.id === sentenceId);
      if (!sentence) {
        return;
      }

      // Show input for claim text (defaults to sentence text, but editable)
      const claimText = await vscode.window.showInputBox({
        prompt: 'Claim text (edit if needed)',
        value: sentence.text,
        validateInput: (value) => {
          return value.trim().length === 0 ? 'Claim text cannot be empty' : null;
        }
      });

      if (!claimText) {
        return;
      }

      // Create claim with minimal defaults
      const claimId = `C_${Date.now()}`;
      const claim: Claim = {
        id: claimId,
        text: claimText.trim(),
        category: 'Uncategorized',
        context: sentence.text,
        primaryQuote: {
          text: '',
          source: '',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      // Add to claims manager and ensure it's saved
      await this.extensionState.claimsManager.saveClaim(claim);

      // Link sentence to claim
      await this.sentenceClaimMapper.linkSentenceToClaim(sentenceId, claimId);

      // Update the local sentence object to include the new claim
      if (!sentence.claims) {
        sentence.claims = [];
      }
      if (!sentence.claims.includes(claimId)) {
        sentence.claims.push(claimId);
      }

      // Notify webview of new claim
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'claimCreated',
          sentenceId,
          claim: {
            id: claimId,
            text: claim.text,
            category: claim.category,
            source: claim.primaryQuote?.source || 'Unknown',
            verified: claim.verified
          }
        });
      }

      // Small delay to ensure claim is persisted before opening review
      await new Promise(resolve => setTimeout(resolve, 100));

      // Open claim review interface to search for supporting quotes
      await vscode.commands.executeCommand('researchAssistant.openClaimReview', claimId);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create claim: ${error}`);
    }
  }

  /**
   * Edit claim text
   */
  private async editClaim(claimId: string, newText: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return;
      }

      // Update claim
      claim.text = newText;
      claim.modifiedAt = new Date();

      this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'claimUpdated',
          claimId,
          text: newText
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to edit claim: ${error}`);
    }
  }

  /**
   * Delete claim from sentence
   */
  private async deleteClaimFromSentence(sentenceId: string, claimId: string): Promise<void> {
    try {
      const confirmed = await vscode.window.showWarningMessage(
        'Remove claim from sentence?',
        'Remove',
        'Cancel'
      );

      if (confirmed !== 'Remove') {
        return;
      }

      // Unlink claim from sentence
      await this.sentenceClaimMapper.unlinkSentenceFromClaim(sentenceId, claimId);

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'claimDeleted',
          sentenceId,
          claimId
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete claim: ${error}`);
    }
  }

  /**
   * Save manuscript
   * Queues the save operation to prevent race conditions
   */
  private async saveManuscript(): Promise<void> {
    // Queue the save operation to prevent race conditions with file watchers
    this.writeQueue = this.writeQueue.then(() => this._performManuscriptSave()).catch(error => {
      console.error('Error in manuscript write queue:', error);
      vscode.window.showErrorMessage(`Failed to save manuscript: ${error}`);
    });
    
    return this.writeQueue;
  }

  private async _performManuscriptSave(): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Reconstruct manuscript from sentences
      const content = this.sentences.map(s => s.text).join('\n\n');

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

      // Notify webview
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
        () => this._performManuscriptSave()
      );
      
      throw err;
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
   * Handle high memory usage
   */
  private handleHighMemory(): void {
    const stats = this.disposalManager.getMemoryStats();
    console.warn(`High memory usage in editing mode: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`);

    // Trim caches
    this.sentenceParsingCache.clear();

    // Notify webview to clear non-essential data
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'memoryWarning',
        message: 'Memory usage is high. Clearing cache...'
      });
    }

    // Force garbage collection if available
    this.disposalManager.forceGarbageCollection();
  }

  /**
   * Get HTML content for webview
   */
  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editingMode.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editingMode.js')
    );

    const nonce = this.getNonce();
    const helpOverlayHtml = generateHelpOverlayHtml('editing');
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
  <title>Editing Mode</title>
  <link rel="stylesheet" href="${styleUri}">
  <style nonce="${nonce}">
    ${helpOverlayCss}
    ${breadcrumbCss}
  </style>
</head>
<body>
  <div class="editing-mode-container">
    <!-- Header -->
    <div class="header">
      <div class="title">Research Assistant | Editing Mode</div>
      <div class="controls">
        <button id="helpBtn" class="icon-btn" title="Help (?)">?</button>
        <button id="writeBtn" class="icon-btn" title="Write Mode (Shift+W)">✎</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="content">
      <div id="sentencesList" class="sentences-list"></div>
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
   * Dispose resources
   */
  dispose(): void {
    // Stop memory monitoring
    this.disposalManager.stopMemoryMonitoring(EditingModeProvider.viewType);

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

    // Clear sentences
    this.sentences = [];

    // Clear view reference
    this.panel = undefined;

    console.log('Editing mode disposed');
  }
}
