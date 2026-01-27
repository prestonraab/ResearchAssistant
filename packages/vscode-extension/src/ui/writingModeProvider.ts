import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { WritingModeManager } from '../core/writingModeManager';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { SentenceParsingCache } from '../services/cachingService';

/**
 * WritingModeProvider - Webview provider for writing mode
 * Displays split-screen outline + manuscript editor
 * Includes memory management and caching for performance
 */
export class WritingModeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'researchAssistant.writingMode';
  private view?: vscode.WebviewView;
  private writingModeManager: WritingModeManager;
  private disposables: vscode.Disposable[] = [];
  private sentenceParsingCache: SentenceParsingCache;
  private disposalManager = getWebviewDisposalManager();

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.writingModeManager = new WritingModeManager();
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
    this.disposalManager.registerWebview(WritingModeProvider.viewType, webviewView.webview);
    this.disposalManager.startMemoryMonitoring(WritingModeProvider.viewType, () => {
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

    this.disposalManager.registerDisposable(WritingModeProvider.viewType, messageListener);

    // Handle webview disposal
    const disposalListener = webviewView.onDidDispose(() => {
      this.dispose();
    });

    this.disposables.push(disposalListener);

    // Initialize writing mode
    await this.initializeWritingMode();
  }

  /**
   * Initialize writing mode with outline and manuscript
   */
  private async initializeWritingMode(): Promise<void> {
    if (!this.view) {
      return;
    }

    try {
      // Get outline and manuscript paths
      const config = this.extensionState.getConfig();
      const outlinePath = this.extensionState.getAbsolutePath(config.outlinePath);
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Initialize writing mode manager
      this.writingModeManager.initializeState(manuscriptPath, outlinePath);

      // Load outline structure
      const outline = await this.loadOutline();
      const manuscript = await this.loadManuscript();

      // Send initial data to webview
      this.view.webview.postMessage({
        type: 'initialize',
        outline,
        manuscript,
        currentSection: this.writingModeManager.getCurrentSection(),
        scrollPosition: this.writingModeManager.getScrollPosition()
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize writing mode: ${error}`);
    }
  }

  /**
   * Load outline structure
   */
  private async loadOutline(): Promise<any[]> {
    try {
      const sections = this.extensionState.outlineParser.getSections();
      const hierarchy = this.extensionState.outlineParser.getHierarchy();

      // Convert to tree structure
      return this.buildOutlineTree(hierarchy);
    } catch (error) {
      console.error('Failed to load outline:', error);
      return [];
    }
  }

  /**
   * Build outline tree from hierarchy
   */
  private buildOutlineTree(hierarchy: any[]): any[] {
    const rootItems: any[] = [];
    const itemMap = new Map<string, any>();

    // Create items for all sections
    for (const section of hierarchy) {
      const item = {
        id: section.id,
        title: section.title,
        level: section.level,
        children: [],
        parent: section.parent
      };
      itemMap.set(section.id, item);
    }

    // Build tree structure
    for (const section of hierarchy) {
      const item = itemMap.get(section.id)!;

      if (section.parent) {
        const parent = itemMap.get(section.parent);
        if (parent) {
          parent.children.push(item);
        }
      } else {
        rootItems.push(item);
      }
    }

    return rootItems;
  }

  /**
   * Load manuscript content
   */
  private async loadManuscript(): Promise<string> {
    try {
      const config = this.extensionState.getConfig();
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
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'saveManuscript':
        await this.saveManuscript(message.content);
        break;

      case 'setCurrentSection':
        this.writingModeManager.setCurrentSection(message.sectionId);
        break;

      case 'saveScrollPosition':
        this.writingModeManager.saveScrollPosition(message.position);
        break;

      case 'switchToEditingMode':
        await vscode.commands.executeCommand('researchAssistant.openEditingMode');
        break;

      case 'switchToClaimReview':
        await vscode.commands.executeCommand('researchAssistant.openClaimReview');
        break;

      case 'showHelp':
        this.showHelpOverlay();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Save manuscript content
   */
  private async saveManuscript(content: string): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Ensure directory exists
      const dir = path.dirname(manuscriptPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(manuscriptPath, content, 'utf-8');

      // Show confirmation
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
        <button id="helpBtn" class="icon-btn" title="Help (?)">?</button>
        <button id="editBtn" class="icon-btn" title="Edit Mode (Shift+E)">✎</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="content">
      <!-- Outline panel (30%) -->
      <div class="outline-panel">
        <div class="panel-header">OUTLINE</div>
        <div id="outlineTree" class="outline-tree"></div>
      </div>

      <!-- Manuscript panel (70%) -->
      <div class="manuscript-panel">
        <div class="panel-header">MANUSCRIPT</div>
        <div class="manuscript-editor-wrapper">
          <textarea id="manuscriptEditor" class="manuscript-editor" placeholder="Start writing your manuscript..."></textarea>
          <div class="auto-save-indicator">
            <span id="saveStatus">Saved</span>
          </div>
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
    console.warn(`High memory usage in writing mode: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`);

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
    this.view = undefined;

    console.log('Writing mode disposed');
  }
}
