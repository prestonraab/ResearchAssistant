import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { CachingService } from '../services/cachingService';

/**
 * ClaimReviewProvider - Webview provider for claim review mode
 * Displays claim details with verification, validation, and manuscript usage
 * Includes memory management and caching for performance
 */
export class ClaimReviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'researchAssistant.claimReview';
  private view?: vscode.WebviewView;
  private currentClaimId?: string;
  private disposables: vscode.Disposable[] = [];
  private claimDetailsCache: CachingService<any>;
  private disposalManager = getWebviewDisposalManager();

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.claimDetailsCache = new CachingService(500, 1800000); // 500 items, 30 min TTL
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
    this.disposalManager.registerWebview(ClaimReviewProvider.viewType, webviewView.webview);
    this.disposalManager.startMemoryMonitoring(ClaimReviewProvider.viewType, () => {
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

    this.disposalManager.registerDisposable(ClaimReviewProvider.viewType, messageListener);

    // Handle webview disposal
    const disposalListener = webviewView.onDidDispose(() => {
      this.dispose();
    });

    this.disposables.push(disposalListener);
  }

  /**
   * Open a claim in review mode
   */
  async openClaim(claimId: string): Promise<void> {
    this.currentClaimId = claimId;

    if (!this.view) {
      // If view doesn't exist, open it first
      await vscode.commands.executeCommand('researchAssistant.claimReview.focus');
    }

    // Load and display claim
    await this.loadAndDisplayClaim(claimId);
  }

  /**
   * Load and display a claim
   */
  private async loadAndDisplayClaim(claimId: string): Promise<void> {
    if (!this.view) {
      return;
    }

    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        this.view.webview.postMessage({
          type: 'error',
          message: `Claim ${claimId} not found`
        });
        return;
      }

      // Auto-verify quotes on load
      const verificationResults = await this.verifyAllQuotes(claim);

      // Get validation status
      const validationResult = await this.validateClaim(claim);

      // Get manuscript usage locations
      const usageLocations = await this.getManuscriptUsageLocations(claimId);

      // Send claim data to webview
      this.view.webview.postMessage({
        type: 'loadClaim',
        claim: {
          id: claim.id,
          text: claim.text,
          category: claim.category,
          source: claim.source,
          primaryQuote: claim.primaryQuote,
          supportingQuotes: claim.supportingQuotes || [],
          verified: claim.verified,
          context: claim.context
        },
        verificationResults,
        validationResult,
        usageLocations
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load claim: ${error}`);
    }
  }

  /**
   * Verify all quotes for a claim
   */
  private async verifyAllQuotes(claim: any): Promise<any[]> {
    try {
      const results: any[] = [];

      // Verify primary quote
      if (claim.primaryQuote) {
        const primaryResult = await this.extensionState.quoteVerificationService.verifyQuote(
          claim.primaryQuote,
          claim.source
        );

        results.push({
          quote: claim.primaryQuote,
          type: 'primary',
          verified: primaryResult.verified,
          similarity: primaryResult.similarity,
          closestMatch: primaryResult.closestMatch
        });
      }

      // Verify supporting quotes
      if (claim.supportingQuotes && Array.isArray(claim.supportingQuotes)) {
        for (const quote of claim.supportingQuotes) {
          const result = await this.extensionState.quoteVerificationService.verifyQuote(
            quote,
            claim.source
          );

          results.push({
            quote,
            type: 'supporting',
            verified: result.verified,
            similarity: result.similarity,
            closestMatch: result.closestMatch
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to verify quotes:', error);
      return [];
    }
  }

  /**
   * Validate claim support
   */
  private async validateClaim(claim: any): Promise<any> {
    try {
      const validation = await this.extensionState.claimSupportValidator.validateSupport(claim);

      return {
        supported: validation.supported,
        similarity: validation.similarity,
        suggestedQuotes: validation.suggestedQuotes || [],
        analysis: validation.analysis
      };
    } catch (error) {
      console.error('Failed to validate claim:', error);
      return {
        supported: false,
        similarity: 0,
        suggestedQuotes: [],
        analysis: 'Validation failed'
      };
    }
  }

  /**
   * Get manuscript usage locations for a claim
   */
  private async getManuscriptUsageLocations(claimId: string): Promise<any[]> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return [];
      }

      // Get manuscript path
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');
      if (!fs.existsSync(manuscriptPath)) {
        return [];
      }

      // Read manuscript
      const content = fs.readFileSync(manuscriptPath, 'utf-8');
      const lines = content.split('\n');

      // Find sections where this claim is used
      const usageLocations: any[] = [];
      let currentSection = 'Introduction';
      let lineNumber = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track section headers
        if (line.startsWith('#')) {
          currentSection = line.replace(/^#+\s*/, '').trim();
        }

        // Look for claim references in the text
        if (line.includes(claim.id) || line.includes(claim.text.substring(0, 50))) {
          const context = line.substring(0, 100).trim();
          usageLocations.push({
            section: currentSection,
            context: context || '(empty line)',
            lineNumber: i + 1
          });
        }

        lineNumber++;
      }

      return usageLocations;
    } catch (error) {
      console.error('Failed to get manuscript usage locations:', error);
      return [];
    }
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'verifyQuote':
        await this.handleVerifyQuote(message.quote, message.source);
        break;

      case 'acceptQuote':
        await this.handleAcceptQuote(message.claimId, message.quote, message.newQuote);
        break;

      case 'deleteQuote':
        await this.handleDeleteQuote(message.claimId, message.quote);
        break;

      case 'findNewQuotes':
        await this.handleFindNewQuotes(message.claimId, message.query);
        break;

      case 'searchInternet':
        await this.handleSearchInternet(message.query);
        break;

      case 'validateSupport':
        await this.handleValidateSupport(message.claimId);
        break;

      case 'navigateToManuscript':
        await this.handleNavigateToManuscript(message.lineNumber);
        break;

      case 'switchToEditingMode':
        await vscode.commands.executeCommand('researchAssistant.openEditingMode');
        break;

      case 'switchToWritingMode':
        await vscode.commands.executeCommand('researchAssistant.openWritingMode');
        break;

      case 'showHelp':
        this.showHelpOverlay();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle verify quote message
   */
  private async handleVerifyQuote(quote: string, source: string): Promise<void> {
    try {
      const result = await this.extensionState.quoteVerificationService.verifyQuote(quote, source);

      if (this.view) {
        this.view.webview.postMessage({
          type: 'quoteVerified',
          quote,
          verified: result.verified,
          similarity: result.similarity,
          closestMatch: result.closestMatch
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to verify quote: ${error}`);
    }
  }

  /**
   * Handle accept quote message
   */
  private async handleAcceptQuote(claimId: string, oldQuote: string, newQuote: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage('Claim not found');
        return;
      }

      // Replace quote in claim
      if (claim.primaryQuote === oldQuote) {
        claim.primaryQuote = newQuote;
      } else if (claim.supportingQuotes && claim.supportingQuotes.includes(oldQuote)) {
        const index = claim.supportingQuotes.indexOf(oldQuote);
        claim.supportingQuotes[index] = newQuote;
      }

      // Update claim
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Reload claim display
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage('Quote updated successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to accept quote: ${error}`);
    }
  }

  /**
   * Handle delete quote message
   */
  private async handleDeleteQuote(claimId: string, quote: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage('Claim not found');
        return;
      }

      // Remove quote from claim
      if (claim.primaryQuote === quote) {
        claim.primaryQuote = '';
      } else if (claim.supportingQuotes && claim.supportingQuotes.includes(quote)) {
        claim.supportingQuotes = claim.supportingQuotes.filter((q: string) => q !== quote);
      }

      // Update claim
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Reload claim display
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage('Quote deleted successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete quote: ${error}`);
    }
  }

  /**
   * Handle find new quotes message
   */
  private async handleFindNewQuotes(claimId: string, query: string): Promise<void> {
    try {
      vscode.window.showInformationMessage('Searching for new quotes in literature...');

      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return;
      }

      // Search using Zotero semantic search
      try {
        const searchResults = await this.extensionState.mcpClient.zotero.semanticSearch(query, 5);
        
        if (this.view) {
          this.view.webview.postMessage({
            type: 'newQuotesFound',
            quotes: searchResults.map((result: any) => ({
              text: result.abstract || result.title || '',
              source: `${result.authors?.[0] || 'Unknown'} ${result.year || ''}`,
              similarity: 0.8
            }))
          });
        }
      } catch (searchError) {
        console.error('Search failed:', searchError);
        if (this.view) {
          this.view.webview.postMessage({
            type: 'newQuotesFound',
            quotes: []
          });
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to find new quotes: ${error}`);
    }
  }

  /**
   * Handle search internet message
   */
  private async handleSearchInternet(query: string): Promise<void> {
    try {
      vscode.window.showInformationMessage('Searching for related papers...');

      // Search using Zotero semantic search for internet results
      try {
        const searchResults = await this.extensionState.mcpClient.zotero.semanticSearch(query, 5);
        
        if (this.view) {
          this.view.webview.postMessage({
            type: 'internetSearchResults',
            results: searchResults.map((result: any) => ({
              title: result.title || '',
              url: result.url || result.doi || '',
              snippet: result.abstract || ''
            }))
          });
        }
      } catch (searchError) {
        console.error('Search failed:', searchError);
        if (this.view) {
          this.view.webview.postMessage({
            type: 'internetSearchResults',
            results: []
          });
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to search: ${error}`);
    }
  }

  /**
   * Handle validate support message
   */
  private async handleValidateSupport(claimId: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage('Claim not found');
        return;
      }

      vscode.window.showInformationMessage('Validating claim support...');

      const validation = await this.extensionState.claimSupportValidator.validateSupport(claim);

      if (this.view) {
        this.view.webview.postMessage({
          type: 'supportValidated',
          supported: validation.supported,
          similarity: validation.similarity,
          suggestedQuotes: validation.suggestedQuotes || [],
          analysis: validation.analysis
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to validate support: ${error}`);
    }
  }

  /**
   * Handle navigate to manuscript message
   */
  private async handleNavigateToManuscript(lineNumber: number): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      if (!fs.existsSync(manuscriptPath)) {
        vscode.window.showErrorMessage('Manuscript file not found');
        return;
      }

      const doc = await vscode.workspace.openTextDocument(manuscriptPath);
      const editor = await vscode.window.showTextDocument(doc);

      // Navigate to line
      const line = Math.max(0, lineNumber - 1);
      const range = new vscode.Range(line, 0, line, 0);
      editor.selection = new vscode.Selection(range.start, range.start);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to navigate to manuscript: ${error}`);
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
   * Get HTML content for webview
   */
  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'claimReview.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'claimReview.js')
    );

    const nonce = this.getNonce();
    const helpOverlayHtml = generateHelpOverlayHtml('review');
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
  <title>Claim Review</title>
  <link rel="stylesheet" href="${styleUri}">
  <style nonce="${nonce}">
    ${helpOverlayCss}
    ${breadcrumbCss}
  </style>
</head>
<body>
  <div class="claim-review-container">
    <!-- Header -->
    <div class="header">
      <div class="title">Research Assistant | Claim Review</div>
      <div class="controls">
        <button id="helpBtn" class="icon-btn" title="Help (?)">?</button>
        <button id="editBtn" class="icon-btn" title="Edit Mode (Shift+E)">✎</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="content">
      <!-- Manuscript sidebar (20%) -->
      <div class="manuscript-sidebar">
        <div class="sidebar-header">
          <span>MANUSCRIPT USAGE</span>
          <button id="toggleSidebar" class="toggle-btn" title="Toggle sidebar (Shift+M)">◀</button>
        </div>
        <div id="usageList" class="usage-list"></div>
      </div>

      <!-- Main panel (80%) -->
      <div class="main-panel">
        <!-- Claim header -->
        <div id="claimHeader" class="claim-header">
          <div class="claim-id"></div>
          <div class="claim-text"></div>
          <div class="claim-meta">
            <span class="category"></span>
            <span class="source"></span>
          </div>
        </div>

        <!-- Quotes section -->
        <div id="quotesSection" class="quotes-section">
          <h2>QUOTES</h2>
          
          <!-- Primary quote -->
          <div id="primaryQuoteContainer" class="quote-container">
            <div class="quote-header">
              <span class="quote-type">PRIMARY QUOTE</span>
              <span id="primaryStatus" class="status-icon">○</span>
            </div>
            <div id="primaryQuote" class="quote-text"></div>
            <div id="primaryVerification" class="verification-info"></div>
            <div class="quote-actions">
              <button class="btn btn-primary" data-action="acceptQuote">Accept</button>
              <button class="btn btn-danger" data-action="deleteQuote">Delete</button>
              <button class="btn btn-secondary" data-action="findNewQuotes">Find New</button>
            </div>
          </div>

          <!-- Supporting quotes -->
          <div id="supportingQuotesContainer" class="supporting-quotes"></div>
        </div>

        <!-- Validation section -->
        <div id="validationSection" class="validation-section">
          <h2>VALIDATION</h2>
          <div class="validation-gauge">
            <div class="gauge-label">Support Strength</div>
            <div class="gauge-bar">
              <div id="gaugeProgress" class="gauge-progress"></div>
            </div>
            <div id="gaugePercentage" class="gauge-percentage">0%</div>
          </div>
          <div id="validationStatus" class="validation-status"></div>
          <button id="validateBtn" class="btn btn-primary" data-action="validateSupport">Validate</button>
        </div>

        <!-- Action buttons -->
        <div class="action-buttons">
          <button id="searchInternetBtn" class="btn btn-secondary" data-action="searchInternet">
            <span class="icon">🌐</span> Search Internet
          </button>
          <button id="switchEditBtn" class="btn btn-secondary" data-action="switchToEditingMode">
            <span class="icon">✎</span> Back to Editing
          </button>
        </div>
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
    console.warn(`High memory usage in claim review mode: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`);

    // Trim caches
    this.claimDetailsCache.trim(50);

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
   * Dispose resources
   */
  dispose(): void {
    // Stop memory monitoring
    this.disposalManager.stopMemoryMonitoring(ClaimReviewProvider.viewType);

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
    this.claimDetailsCache.dispose();

    // Clear state
    this.currentClaimId = undefined;

    // Clear view reference
    this.view = undefined;

    console.log('Claim review mode disposed');
  }
}
