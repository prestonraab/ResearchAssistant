import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { EditingModeManager } from '../core/editingModeManager';
import { SentenceParser, Sentence } from '../core/sentenceParser';
import { SentenceClaimMapper } from '../core/sentenceClaimMapper';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { SentenceParsingCache } from '../services/cachingService';

/**
 * EditingModeProvider - Webview provider for editing mode
 * Displays sentences as editable boxes with nested claims
 * Includes virtual scrolling and lazy loading for memory efficiency
 */
export class EditingModeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'researchAssistant.editingMode';
  private view?: vscode.WebviewView;
  private editingModeManager: EditingModeManager;
  private sentenceParser: SentenceParser;
  private sentenceClaimMapper: SentenceClaimMapper;
  private disposables: vscode.Disposable[] = [];
  private sentences: Sentence[] = [];
  private sentenceParsingCache: SentenceParsingCache;
  private disposalManager = getWebviewDisposalManager();

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.editingModeManager = new EditingModeManager();
    this.sentenceParser = new SentenceParser();
    this.sentenceClaimMapper = new SentenceClaimMapper(extensionState.claimsManager);
    this.sentenceParsingCache = new SentenceParsingCache(100);
  }

  /**
   * Resolve webview view
   */
  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;

    // Register with disposal manager
    this.disposalManager.registerWebview(EditingModeProvider.viewType, webviewView.webview);
    this.disposalManager.startMemoryMonitoring(EditingModeProvider.viewType, () => {
      this.handleHighMemory();
    });

    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // Load HTML content
    webviewView.webview.html = await this.getHtmlContent(webviewView.webview);

    // Handle messages from webview
    const messageListener = webviewView.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      this.disposables
    );

    this.disposalManager.registerDisposable(EditingModeProvider.viewType, messageListener);

    // Handle webview disposal
    const disposalListener = webviewView.onDidDispose(() => {
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
    if (!this.view) {
      return;
    }

    try {
      // Initialize state
      this.editingModeManager.initializeState();

      // Load manuscript
      const manuscript = await this.loadManuscript();
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Try to get from cache first
      let parsedSentences = this.sentenceParsingCache.getParsedSentences(manuscriptPath);

      if (!parsedSentences) {
        // Parse sentences if not cached
        this.sentences = this.sentenceParser.parseSentences(manuscript, 'default');
        // Cache the parsed sentences
        this.sentenceParsingCache.cacheParsedSentences(manuscriptPath, this.sentences);
      } else {
        this.sentences = parsedSentences;
      }

      // Load claims for each sentence
      const sentencesWithClaims = await this.loadClaimsForSentences();

      // Send initial data to webview with virtual scrolling enabled
      this.view.webview.postMessage({
        type: 'initialize',
        sentences: sentencesWithClaims,
        scrollPosition: this.editingModeManager.getScrollPosition(),
        virtualScrollingEnabled: true,
        itemHeight: 120 // Height of each sentence box in pixels
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize editing mode: ${error}`);
    }
  }

  /**
   * Load manuscript content
   */
  private async loadManuscript(): Promise<string> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      if (fs.existsSync(manuscriptPath)) {
        return fs.readFileSync(manuscriptPath, 'utf-8');
      }

      return '';
    } catch (error) {
      console.error('Failed to load manuscript:', error);
      return '';
    }
  }

  /**
   * Load claims for all sentences
   */
  private async loadClaimsForSentences(): Promise<any[]> {
    const sentencesWithClaims = [];

    for (const sentence of this.sentences) {
      const claimIds = this.sentenceClaimMapper.getClaimsForSentence(sentence.id);
      const claims = [];

      for (const claimId of claimIds) {
        try {
          const claim = this.extensionState.claimsManager.getClaim(claimId);
          if (claim) {
            claims.push({
              id: claim.id,
              text: claim.text,
              originalText: claim.text,
              category: claim.category,
              source: claim.source,
              verified: claim.verified
            });
          }
        } catch (error) {
          console.error(`Failed to load claim ${claimId}:`, error);
        }
      }

      sentencesWithClaims.push({
        id: sentence.id,
        text: sentence.text,
        originalText: sentence.originalText,
        position: sentence.position,
        claims: claims,
        claimCount: claims.length
      });
    }

    return sentencesWithClaims;
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
        await vscode.commands.executeCommand('researchAssistant.openClaimMatching', message.sentenceId);
        break;

      case 'openClaim':
        await vscode.commands.executeCommand('researchAssistant.openClaimReview', message.claimId);
        break;

      case 'switchToWritingMode':
        await vscode.commands.executeCommand('researchAssistant.openWritingMode');
        break;

      case 'switchToClaimReview':
        await vscode.commands.executeCommand('researchAssistant.openClaimReview');
        break;

      case 'saveScrollPosition':
        this.editingModeManager.saveScrollPosition(message.position);
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
      if (this.view) {
        this.view.webview.postMessage({
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
      if (this.view) {
        this.view.webview.postMessage({
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

      // Show quick input for category and source
      const category = await vscode.window.showInputBox({
        prompt: 'Claim category (e.g., Method, Result, Challenge)',
        value: 'Result'
      });

      if (!category) {
        return;
      }

      const source = await vscode.window.showInputBox({
        prompt: 'Claim source (e.g., Author2020)',
        value: ''
      });

      if (!source) {
        return;
      }

      // Create claim
      const claim = {
        id: `C_${Date.now()}`,
        text: sentence.text,
        category,
        source,
        sourceId: 0,
        context: sentence.text,
        primaryQuote: sentence.text,
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      // Add to claims manager
      this.extensionState.claimsManager.updateClaim(claim.id, claim);

      // Link sentence to claim
      await this.sentenceClaimMapper.linkSentenceToClaim(sentenceId, claim.id);

      // Reload and notify
      const sentencesWithClaims = await this.loadClaimsForSentences();
      if (this.view) {
        this.view.webview.postMessage({
          type: 'claimCreated',
          sentenceId,
          claim: {
            id: claim.id,
            text: claim.text,
            category: claim.category,
            source: claim.source,
            verified: claim.verified
          }
        });
      }
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
      if (this.view) {
        this.view.webview.postMessage({
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
      if (this.view) {
        this.view.webview.postMessage({
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
   */
  private async saveManuscript(): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Reconstruct manuscript from sentences
      const content = this.sentences.map(s => s.text).join('\n\n');

      // Ensure directory exists
      const dir = path.dirname(manuscriptPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(manuscriptPath, content, 'utf-8');

      // Notify webview
      if (this.view) {
        this.view.webview.postMessage({
          type: 'saved',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save manuscript: ${error}`);
    }
  }

  /**
   * Show help overlay
   */
  private showHelpOverlay(): void {
    if (this.view) {
      this.view.webview.postMessage({
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
    if (this.view) {
      this.view.webview.postMessage({
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
    this.view = undefined;

    console.log('Editing mode disposed');
  }
}
