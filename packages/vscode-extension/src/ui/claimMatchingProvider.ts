import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { ClaimMatchingService } from '../core/claimMatchingService';
import { SentenceClaimMapper } from '../core/sentenceClaimMapper';
import { SentenceParser, Sentence } from '../core/sentenceParser';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { ClaimSimilarityCache } from '../services/cachingService';

/**
 * ClaimMatchingProvider - Webview provider for claim matching mode
 * Displays similar claims for a sentence in a tiled grid layout
 * Includes lazy loading for memory efficiency
 */
export class ClaimMatchingProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'researchAssistant.claimMatching';
  private view?: vscode.WebviewView;
  private claimMatchingService: ClaimMatchingService;
  private sentenceClaimMapper: SentenceClaimMapper;
  private sentenceParser: SentenceParser;
  private disposables: vscode.Disposable[] = [];
  private currentSentenceId?: string;
  private currentSentenceText?: string;
  private claimSimilarityCache: ClaimSimilarityCache;
  private disposalManager = getWebviewDisposalManager();

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.claimMatchingService = new ClaimMatchingService(
      extensionState.claimsManager,
      extensionState.embeddingService
    );
    this.sentenceClaimMapper = new SentenceClaimMapper(extensionState.claimsManager);
    this.sentenceParser = new SentenceParser();
    this.claimSimilarityCache = new ClaimSimilarityCache(5000);
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
    this.disposalManager.registerWebview(ClaimMatchingProvider.viewType, webviewView.webview);
    this.disposalManager.startMemoryMonitoring(ClaimMatchingProvider.viewType, () => {
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

    this.disposalManager.registerDisposable(ClaimMatchingProvider.viewType, messageListener);

    // Handle webview disposal
    const disposalListener = webviewView.onDidDispose(() => {
      this.dispose();
    });

    this.disposables.push(disposalListener);
  }

  /**
   * Open claim matching mode for a sentence
   */
  async openForSentence(sentenceId: string, sentenceText: string): Promise<void> {
    this.currentSentenceId = sentenceId;
    this.currentSentenceText = sentenceText;

    if (!this.view) {
      return;
    }

    try {
      // Show loading state
      this.view.webview.postMessage({
        type: 'loading',
        message: 'Finding similar claims...'
      });

      // Find similar claims (top 20, sorted by similarity)
      const similarClaims = await this.claimMatchingService.findSimilarClaims(sentenceText);

      // Send data to webview
      this.view.webview.postMessage({
        type: 'initialize',
        sentenceId,
        sentenceText,
        claims: similarClaims.map(claim => ({
          id: claim.claimId,
          text: claim.text,
          category: claim.category,
          source: claim.source,
          similarity: Math.round(claim.similarity * 100)
        }))
      });

      // Show the view
      await vscode.commands.executeCommand('researchAssistant.claimMatching.focus');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to find similar claims: ${error}`);
      this.view.webview.postMessage({
        type: 'error',
        message: `Failed to find similar claims: ${error}`
      });
    }
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'linkClaim':
        await this.linkClaimToSentence(message.claimId);
        break;

      case 'createNewClaim':
        await this.createNewClaim();
        break;

      case 'returnToEditing':
        await this.returnToEditing();
        break;

      case 'showHelp':
        this.showHelpOverlay();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Link claim to sentence
   */
  private async linkClaimToSentence(claimId: string): Promise<void> {
    if (!this.currentSentenceId) {
      return;
    }

    try {
      // Link sentence to claim
      await this.sentenceClaimMapper.linkSentenceToClaim(this.currentSentenceId, claimId);

      // Get claim details
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      // Notify webview
      if (this.view) {
        this.view.webview.postMessage({
          type: 'claimLinked',
          claimId,
          claimText: claim?.text || ''
        });
      }

      // Show success message
      vscode.window.showInformationMessage(`Claim linked to sentence`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to link claim: ${error}`);
    }
  }

  /**
   * Create new claim from sentence
   */
  private async createNewClaim(): Promise<void> {
    if (!this.currentSentenceText) {
      return;
    }

    try {
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
      const claimId = `C_${Date.now()}`;
      const claim = {
        id: claimId,
        text: this.currentSentenceText,
        category,
        source,
        sourceId: 0,
        context: this.currentSentenceText,
        primaryQuote: this.currentSentenceText,
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      // Add to claims manager
      this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Link sentence to claim
      if (this.currentSentenceId) {
        await this.sentenceClaimMapper.linkSentenceToClaim(this.currentSentenceId, claimId);
      }

      // Notify webview
      if (this.view) {
        this.view.webview.postMessage({
          type: 'claimCreated',
          claimId,
          claimText: claim.text
        });
      }

      // Show success message
      vscode.window.showInformationMessage(`New claim created and linked`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create claim: ${error}`);
    }
  }

  /**
   * Return to editing mode
   */
  private async returnToEditing(): Promise<void> {
    await vscode.commands.executeCommand('researchAssistant.openEditingMode');
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
    console.warn(`High memory usage in claim matching mode: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`);

    // Trim caches
    this.claimSimilarityCache.clear();

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
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'claimMatching.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'claimMatching.js')
    );

    const nonce = this.getNonce();
    const helpOverlayHtml = generateHelpOverlayHtml('matching');
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
  <title>Claim Matching</title>
  <link rel="stylesheet" href="${styleUri}">
  <style nonce="${nonce}">
    ${helpOverlayCss}
    ${breadcrumbCss}
  </style>
</head>
<body>
  <div class="claim-matching-container">
    <!-- Header -->
    <div class="header">
      <div class="title">Research Assistant | Claim Matching</div>
      <div class="controls">
        <button id="helpBtn" class="icon-btn" title="Help (?)">?</button>
        <button id="closeBtn" class="icon-btn" title="Close (Esc)">✕</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="content">
      <!-- Sentence display -->
      <div class="sentence-section">
        <div class="sentence-label">Sentence:</div>
        <div id="sentenceText" class="sentence-text"></div>
      </div>

      <!-- Similar claims grid -->
      <div class="claims-section">
        <div class="claims-label">Similar Claims (sorted by similarity):</div>
        <div id="claimsGrid" class="claims-grid"></div>
      </div>

      <!-- Create new claim button -->
      <div class="create-section">
        <button id="createBtn" class="create-btn">+ Create New Claim</button>
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
   * Dispose resources
   */
  dispose(): void {
    // Stop memory monitoring
    this.disposalManager.stopMemoryMonitoring(ClaimMatchingProvider.viewType);

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
    this.claimSimilarityCache.dispose();

    // Clear state
    this.currentSentenceId = undefined;
    this.currentSentenceText = undefined;

    // Clear view reference
    this.view = undefined;

    console.log('Claim matching mode disposed');
  }
}
