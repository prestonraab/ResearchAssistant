import * as vscode from 'vscode';
import { OutlineTreeProvider } from '../../ui/outlineTreeProvider';
import { ClaimsTreeProvider } from '../../ui/claimsTreeProvider';
import { PapersTreeProvider } from '../../ui/papersTreeProvider';
import { ExtensionState } from '../state';

/**
 * Phase 1 Initializer - Minimal UI initialization (< 500ms target)
 * 
 * This phase focuses on getting the UI responsive as quickly as possible:
 * - Register tree providers with empty data
 * - Show loading status bar
 * - Register command stubs that show loading messages
 * 
 * The goal is to make the extension feel responsive immediately,
 * even though data loading happens in Phase 2.
 */
export class Phase1Initializer {
  private statusBarItem?: vscode.StatusBarItem;
  private outlineProvider?: OutlineTreeProvider;
  private claimsProvider?: ClaimsTreeProvider;
  private papersProvider?: PapersTreeProvider;

  /**
   * Initialize Phase 1 - Core UI setup
   * Target: < 500ms
   */
  async initialize(context: vscode.ExtensionContext, state: ExtensionState): Promise<void> {
    const startTime = Date.now();

    // 1. Create tree view providers (they will show empty initially)
    this.outlineProvider = new OutlineTreeProvider(state);
    this.claimsProvider = new ClaimsTreeProvider(state);
    this.papersProvider = new PapersTreeProvider(state);

    // 2. Register tree view providers
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('researchAssistant.outline', this.outlineProvider),
      vscode.window.registerTreeDataProvider('researchAssistant.claims', this.claimsProvider),
      vscode.window.registerTreeDataProvider('researchAssistant.papers', this.papersProvider)
    );

    // 3. Create and show loading status bar
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.text = '$(loading~spin) Research Assistant loading...';
    this.statusBarItem.tooltip = 'Research Assistant is initializing';
    this.statusBarItem.show();
    context.subscriptions.push(this.statusBarItem);

    // 4. Register command stubs that show loading messages
    this.registerCommandStubs(context);

    const duration = Date.now() - startTime;
    console.log(`[Phase1] Initialization completed in ${duration}ms`);
  }

  /**
   * Register command stubs that show loading messages
   * These will be replaced with real implementations in Phase 2
   */
  private registerCommandStubs(context: vscode.ExtensionContext): void {
    const loadingCommands = [
      'researchAssistant.openWritingMode',
      'researchAssistant.openEditingMode',
      'researchAssistant.showDashboard',
      'researchAssistant.analyzeCoverage',
      'researchAssistant.refreshOutline',
      'researchAssistant.refreshClaims',
      'researchAssistant.refreshPapers'
    ];

    for (const commandId of loadingCommands) {
      const disposable = vscode.commands.registerCommand(commandId, () => {
        vscode.window.showInformationMessage(
          'Research Assistant is still loading. Please wait a moment...'
        );
      });
      context.subscriptions.push(disposable);
    }
  }

  /**
   * Update status bar text
   */
  updateStatusBar(text: string, tooltip?: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.text = text;
      if (tooltip) {
        this.statusBarItem.tooltip = tooltip;
      }
    }
  }

  /**
   * Get the tree providers for use in Phase 2
   */
  getProviders(): {
    outline: OutlineTreeProvider;
    claims: ClaimsTreeProvider;
    papers: PapersTreeProvider;
  } {
    if (!this.outlineProvider || !this.claimsProvider || !this.papersProvider) {
      throw new Error('Phase 1 not initialized - providers not available');
    }

    return {
      outline: this.outlineProvider,
      claims: this.claimsProvider,
      papers: this.papersProvider
    };
  }

  /**
   * Get the status bar item for use in Phase 2
   */
  getStatusBarItem(): vscode.StatusBarItem {
    if (!this.statusBarItem) {
      throw new Error('Phase 1 not initialized - status bar not available');
    }
    return this.statusBarItem;
  }
}
