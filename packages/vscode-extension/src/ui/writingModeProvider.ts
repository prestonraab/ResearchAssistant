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
import { OrphanCitationValidator, type CitationValidationResult, CitationSourceMapper } from '@research-assistant/core';

/**
 * Display information for an orphan citation
 */
export interface OrphanCitationDisplay {
  claimId: string;
  authorYear: string;
  position: { start: number; end: number };
}

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
  private sourceMetadataCache: Map<string, string | null> = new Map(); // Cache of source ID -> author-year
  private orphanCitationValidator?: OrphanCitationValidator;
  private citationSourceMapper?: CitationSourceMapper;
  
  // Write queue to prevent race conditions on manuscript saves
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.writingModeManager = new WritingModeManager();
    this.questionAnswerParser = new QuestionAnswerParser();
    this.sentenceParsingCache = new SentenceParsingCache(100);
    
    // Initialize orphan citation services
    const workspaceRoot = this.extensionState.getWorkspaceRoot();
    this.citationSourceMapper = new CitationSourceMapper(workspaceRoot);
    this.orphanCitationValidator = new OrphanCitationValidator(
      this.citationSourceMapper,
      this.extensionState.claimsManager
    );
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
    // If panel already exists and is not disposed, reveal it and reload data
    if (this.panel && !this.panelDisposed) {
      this.panel.reveal(vscode.ViewColumn.One);
      
      // Always reinitialize to pick up changes from Editing Mode
      console.log('[WritingMode] Reloading data from manuscript...');
      await this.initializeWritingMode();
      
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
        retainContextWhenHidden: true,
        enableFindWidget: true
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

    // Listen for claim changes to refresh display
    const claimChangeListener = this.extensionState.claimsManager.onDidChange(() => {
      this.refreshWritingModeDisplay();
    });
    this.disposables.push(claimChangeListener);

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
      // Load source metadata first
      await this.loadSourceMetadata();

      // Get manuscript path
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Initialize writing mode manager
      this.writingModeManager.initializeState(manuscriptPath, '');

      // Load and parse manuscript
      const manuscript = await this.loadManuscript();
      let questionAnswerPairs = this.questionAnswerParser.parseManuscript(manuscript);

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
      if (!centerItemId && editingContext?.centerItemPosition !== undefined) {
        const targetPosition = editingContext.centerItemPosition as number;
        // Find the Q&A pair that contains this position
        const matchingPair = sanitizedPairs.find(p => {
          // Check if the position falls within this Q&A pair's answer
          // We need to be more flexible here since positions might not match exactly
          const pPosition = (p as Record<string, unknown>).position as number;
          return Math.abs(pPosition - targetPosition) < 5;
        });
        
        if (matchingPair) {
          centerItemId = (matchingPair as Record<string, unknown>).id as string;
          console.log(`[WritingMode] Found matching pair near position ${targetPosition}: ${centerItemId}`);
        } else {
          // If no exact match, find the closest pair
          let closestPair = sanitizedPairs[0];
          let minDistance = Math.abs(((sanitizedPairs[0] as Record<string, unknown>).position as number) - targetPosition);
          
          for (const pair of sanitizedPairs) {
            const pairObj = pair as Record<string, unknown>;
            const pPosition = pairObj.position as number;
            const distance = Math.abs(pPosition - targetPosition);
            if (distance < minDistance) {
              minDistance = distance;
              closestPair = pair;
            }
          }
          
          const closestObj = closestPair as Record<string, unknown>;
          centerItemId = closestObj.id as string;
          console.log(`[WritingMode] Using closest pair at position ${closestObj.position} for target ${targetPosition}: ${centerItemId}`);
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
      vscode.window.showErrorMessage(
        'Unable to initialize writing mode. Please check your workspace configuration.',
        'Open Settings'
      ).then(action => {
        if (action === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant');
        }
      });
    }
  }

  /**
   * Refresh writing mode display when claims change
   * Reloads manuscript and updates the webview with fresh data
   */
  private async refreshWritingModeDisplay(): Promise<void> {
    if (!this.panel || this.panelDisposed) {
      return;
    }

    try {
      // Load and parse manuscript
      const manuscript = await this.loadManuscript();
      let questionAnswerPairs = this.questionAnswerParser.parseManuscript(manuscript);

      // Validate Q&A pairs
      if (!DataValidationService.validateQAPairsArray(questionAnswerPairs)) {
        console.warn('[WritingMode] Q&A pairs validation failed during refresh');
        return;
      }

      // Enrich pairs with linked sources from claims
      questionAnswerPairs = await this.enrichPairsWithLinkedSources(questionAnswerPairs);

      // Sanitize for webview transmission
      const sanitizedPairs = DataValidationService.sanitizeQAPairsForWebview(questionAnswerPairs);

      // Send updated pairs to webview
      this.panel.webview.postMessage({
        type: 'pairsUpdated',
        pairs: sanitizedPairs
      });

      // Update mode context
      getModeContextManager().setWritingModeContext({
        pairs: sanitizedPairs
      });

      console.log('[WritingMode] Display refreshed with updated claims');
    } catch (error) {
      console.error('[WritingMode] Failed to refresh display:', error);
    }
  }

  /**
   * Enrich question-answer pairs with linked sources from claims
   * Extracts author-year citations from [source:: C_XX(Author Year, ...)] format
   */
  private async enrichPairsWithLinkedSources(pairs: any[]): Promise<any[]> {
    try {
      // For each pair, extract claim IDs and get their quotes
      for (const pair of pairs) {
        const linkedSources: any[] = [];
        const seenSources = new Set<string>();
        const citedAuthorYears = new Map<string, Set<string>>(); // Map of claimId -> Set of author-years

        // Store original answer with Source comments for saving
        pair.originalAnswer = pair.answer;
        
        // Extract cited author-years from answer text
        // Format: [source:: C_01(Author Year, Author Year), C_02]
        const sourceMatches = pair.answer.matchAll(/\[source::\s*([^\]]+)\]/g);
        for (const match of sourceMatches) {
          const sourceSpec = match[1];
          // Parse each claim spec: "C_01(Author Year, ...)" or "C_01"
          const claimSpecs = sourceSpec.split(',').map((s: string) => s.trim());
          
          for (const spec of claimSpecs) {
            const claimMatch = spec.match(/^(C_\d+)(?:\(([^)]+)\))?/);
            if (claimMatch) {
              const claimId = claimMatch[1];
              const authorYearStr = claimMatch[2];
              
              if (authorYearStr) {
                const authorYears = authorYearStr.split(',').map((ay: string) => ay.trim());
                if (!citedAuthorYears.has(claimId)) {
                  citedAuthorYears.set(claimId, new Set());
                }
                authorYears.forEach((ay: string) => citedAuthorYears.get(claimId)!.add(ay));
              }
            }
          }
        }
        
        // Create display version without Source comments (don't modify pair.answer)
        pair.displayAnswer = pair.answer.replace(/<!--\s*Source:[^>]+?-->/g, '').trim();

        // Process each claim ID in the pair
        for (const claimId of pair.claims || []) {
          try {
            const claim = this.extensionState.claimsManager.getClaim(claimId);
            if (!claim) continue;

            const citedSet = citedAuthorYears.get(claimId) || new Set<string>();

            // Add primary quote
            if (claim.primaryQuote && !seenSources.has(claim.primaryQuote.source)) {
              const authorYear = this.extractAuthorYear(claim.primaryQuote.source);
              const isCited = authorYear ? citedSet.has(authorYear) : false;
              
              linkedSources.push({
                claimId: claimId,  // Track which claim this source belongs to
                title: claim.text.substring(0, 50) + (claim.text.length > 50 ? '...' : ''),
                source: claim.primaryQuote.source,
                quote: claim.primaryQuote.text,
                cited: isCited,
                authorYear: authorYear
              });
              seenSources.add(claim.primaryQuote.source);
            }

            // Add supporting quotes
            for (const supportingQuote of claim.supportingQuotes || []) {
              if (!seenSources.has(supportingQuote.source)) {
                const authorYear = this.extractAuthorYear(supportingQuote.source);
                const isCited = authorYear ? citedSet.has(authorYear) : false;
                
                linkedSources.push({
                  claimId: claimId,  // Track which claim this source belongs to
                  title: claim.text.substring(0, 50) + (claim.text.length > 50 ? '...' : ''),
                  source: supportingQuote.source,
                  quote: supportingQuote.text,
                  cited: isCited,
                  authorYear: authorYear
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
   * Extract author-year from source reference
   * The source field already contains the author-year format (e.g., "Johnson2007")
   */
  private extractAuthorYear(source: string): string | null {
    if (!source || source === 'Unknown') {
      return null;
    }
    
    // The source field is already in author-year format (e.g., "Johnson2007")
    // Just return it directly
    return source;
  }

  /**
   * Load source metadata from sources.md
   * Builds a map of source IDs to author-year format
   */
  private async loadSourceMetadata(): Promise<void> {
    try {
      const sourcesPath = this.extensionState.getAbsolutePath('01_Knowledge_Base/sources.md');
      if (!fs.existsSync(sourcesPath)) {
        return;
      }

      const content = fs.readFileSync(sourcesPath, 'utf-8');
      // Parse markdown table to extract Author-Year and Zotero Key columns
      // Format: | Source ID | Author-Year | Zotero Key | ...
      const lines = content.split('\n');
      
      for (const line of lines) {
        // Match table rows
        const match = line.match(/\|\s*\d+\s*\|\s*(\w+\d{4})\s*\|/);
        if (match) {
          const authorYear = match[1];
          // Extract Zotero key from the same line
          const keyMatch = line.match(/\|\s*(\w+)\s*\|/g);
          if (keyMatch && keyMatch.length >= 3) {
            // Third column is typically the Zotero key
            const zoteroKey = keyMatch[2].replace(/[|\s]/g, '');
            if (zoteroKey) {
              this.sourceMetadataCache.set(zoteroKey, authorYear);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[WritingMode] Failed to load source metadata:', error);
    }
  }

  /**
   * Load manuscript content
   */
  private async loadManuscript(): Promise<string> {
    try {
      const config = this.extensionState.getConfig();
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      console.log(`[WritingMode] Loading manuscript from: ${manuscriptPath} \nFile exists: ${fs.existsSync(manuscriptPath)}`);

      if (fs.existsSync(manuscriptPath)) {
        const content = fs.readFileSync(manuscriptPath, 'utf-8');
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

      case 'exportLatex':
        await vscode.commands.executeCommand('researchAssistant.exportManuscriptLatex');
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
      vscode.window.showErrorMessage(
        'Unable to save the manuscript. Your changes may not be saved.',
        'Retry'
      ).then(action => {
        if (action === 'Retry') {
          this.saveManuscript(pairs);
        }
      });
    });
    
    return this.writeQueue;
  }

  private async _performManuscriptSave(pairs: QuestionAnswerPair[]): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Reconstruct source specs with author-year citations based on cited status
      for (const pair of pairs as any[]) {
        if (pair.linkedSources && pair.linkedSources.length > 0) {
          // Group linkedSources by claim ID
          const sourcesByClaimId = new Map<string, any[]>();
          for (const source of pair.linkedSources) {
            const claimId = source.claimId;
            if (claimId) {
              if (!sourcesByClaimId.has(claimId)) {
                sourcesByClaimId.set(claimId, []);
              }
              sourcesByClaimId.get(claimId)!.push(source);
            }
          }

          // Build new source specs with author-year citations for cited sources
          const sourceSpecs: string[] = [];
          for (const claimId of pair.claims || []) {
            const sources = sourcesByClaimId.get(claimId) || [];
            const citedAuthorYears = sources
              .filter((s: any) => s.cited && s.authorYear)
              .map((s: any) => s.authorYear);

            if (citedAuthorYears.length > 0) {
              sourceSpecs.push(`${claimId}(${citedAuthorYears.join(', ')})`);
            } else {
              sourceSpecs.push(claimId);
            }
          }

          // Update answer with new source specs
          if (sourceSpecs.length > 0) {
            // Check if there's an existing source spec to replace
            if (/\[source::\s*[^\]]+\]/.test(pair.answer)) {
              pair.answer = pair.answer.replace(
                /\[source::\s*[^\]]+\]/g,
                `[source:: ${sourceSpecs.join(', ')}]`
              );
            } else {
              // No existing source spec - append one
              pair.answer = pair.answer.trim() + ` [source:: ${sourceSpecs.join(', ')}]`;
            }
          }
        }
      }

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
        <div class="export-dropdown">
          <button id="exportBtn" class="icon-btn" title="Export manuscript">📤</button>
          <div class="export-menu">
            <button class="export-option" data-format="markdown">📄 Markdown</button>
            <button class="export-option" data-format="word">📋 Word (.docx)</button>
            <button class="export-option" data-format="latex">📑 LaTeX (.tex)</button>
          </div>
        </div>
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

    <!-- Find Bar -->
    <div id="findBar" class="find-bar hidden">
      <input 
        id="findInput" 
        class="find-input" 
        type="text" 
        placeholder="Find in writing..."
        autocomplete="off"
      />
      <div id="findCounter" class="find-counter">0 of 0</div>
      <button id="findPrevBtn" class="find-button" title="Previous match (Shift+Enter)">↑</button>
      <button id="findNextBtn" class="find-button" title="Next match (Enter)">↓</button>
      <button id="findCloseBtn" class="find-button close-btn" title="Close (Esc)">✕</button>
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
   * Get orphan citations for display highlighting
   * Identifies citations in a Q&A pair that lack supporting quotes
   * @param pairId - The Q&A pair to analyze
   * @returns Array of orphan citations with positions in the answer text
   */
  async getOrphanCitationsForDisplay(pairId: string): Promise<OrphanCitationDisplay[]> {
    if (!this.orphanCitationValidator) {
      return [];
    }

    try {
      // Get all claims for this pair
      const allClaims = this.extensionState.claimsManager.getAllClaims();
      const orphanDisplays: OrphanCitationDisplay[] = [];

      for (const claim of allClaims) {
        // Validate citations for this claim
        const validationResults = await this.orphanCitationValidator.validateClaimCitations(claim.id);
        
        // Filter for orphan citations
        const orphanCitations = validationResults.filter((r: CitationValidationResult) => r.status === 'orphan-citation');

        for (const orphan of orphanCitations) {
          // Find position of this author-year in the claim text
          const positions = this.findCitationPositions(claim.text, orphan.authorYear);
          
          for (const pos of positions) {
            orphanDisplays.push({
              claimId: claim.id,
              authorYear: orphan.authorYear,
              position: pos
            });
          }
        }
      }

      return orphanDisplays;
    } catch (error) {
      console.error('[WritingMode] Error getting orphan citations for display:', error);
      return [];
    }
  }

  /**
   * Generate tooltip content for orphan citations
   * Shows all orphan author-years for a claim
   * @param claimId - The claim ID
   * @returns HTML content for tooltip
   */
  async generateOrphanTooltip(claimId: string): Promise<string> {
    if (!this.orphanCitationValidator) {
      return '';
    }

    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return '';
      }

      // Validate citations for this claim
      const validationResults = await this.orphanCitationValidator.validateClaimCitations(claimId);
      
      // Filter for orphan citations
      const orphanCitations = validationResults.filter((r: CitationValidationResult) => r.status === 'orphan-citation');

      if (orphanCitations.length === 0) {
        return '';
      }

      // Generate HTML tooltip
      const orphanYears = orphanCitations.map(o => o.authorYear).join(', ');
      const html = `
        <div class="orphan-citation-tooltip">
          <strong>Orphan Citations:</strong><br/>
          <span class="orphan-years">${this.escapeHtml(orphanYears)}</span><br/>
          <small>These citations lack supporting quotes</small>
        </div>
      `;

      return html;
    } catch (error) {
      console.error('[WritingMode] Error generating orphan tooltip:', error);
      return '';
    }
  }

  /**
   * Find all positions of a citation in text
   * Searches for author-year pattern in the text
   * @param text - The text to search
   * @param authorYear - The author-year to find
   * @returns Array of positions {start, end}
   * @private
   */
  private findCitationPositions(text: string, authorYear: string): Array<{ start: number; end: number }> {
    const positions: Array<{ start: number; end: number }> = [];
    
    // Escape special regex characters in authorYear
    const escapedAuthorYear = authorYear.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedAuthorYear, 'g');
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return positions;
  }

  /**
   * Escape HTML special characters
   * @param text - The text to escape
   * @returns Escaped HTML text
   * @private
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
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
