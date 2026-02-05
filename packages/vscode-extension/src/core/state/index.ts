import * as vscode from 'vscode';
import { CoreState, ExtensionConfig } from './coreState';
import { ServiceState } from './serviceState';
import { UIState } from './uiState';

// Re-export types for backward compatibility
export { ExtensionConfig } from './coreState';
export { CoreState } from './coreState';
export { ServiceState } from './serviceState';
export { UIState } from './uiState';

/**
 * Unified ExtensionState that composes CoreState, ServiceState, and UIState.
 * Maintains backward compatibility with existing code while using modular internals.
 * 
 * NFR-3: All functions < 50 lines
 */
export class ExtensionState {
  private coreState: CoreState;
  private serviceState: ServiceState;
  private uiState: UIState;

  // Expose services directly for backward compatibility
  public get outlineParser() { return this.serviceState.outlineParser; }
  public get claimsManager() { return this.serviceState.claimsManager; }
  public get embeddingService() { return this.serviceState.embeddingService; }
  public get paperRanker() { return this.serviceState.paperRanker; }
  public get coverageAnalyzer() { return this.serviceState.coverageAnalyzer; }
  public get readingStatusManager() { return this.serviceState.readingStatusManager; }
  public get claimExtractor() { return this.serviceState.claimExtractor; }
  public get literatureIndexer() { return this.serviceState.literatureIndexer; }
  public get unifiedQuoteSearch() { return this.serviceState.unifiedQuoteSearch; }
  public get pdfExtractionService() { return this.serviceState.pdfExtractionService; }
  public get citationNetworkAnalyzer() { return this.serviceState.citationNetworkAnalyzer; }
  public get batchOperationHandler() { return this.serviceState.batchOperationHandler; }
  public get exportService() { return this.serviceState.exportService; }
  public get configurationManager() { return this.serviceState.configurationManager; }
  public get unifiedSearchService() { return this.serviceState.unifiedSearchService; }
  public get quoteVerificationService() { return this.serviceState.quoteVerificationService; }
  public get autoQuoteVerifier() { return this.serviceState.autoQuoteVerifier; }
  public get verificationFeedbackLoop() { return this.serviceState.verificationFeedbackLoop; }
  public get zoteroAvailabilityManager() { return this.serviceState.zoteroAvailabilityManager; }
  public get zoteroClient() { return this.serviceState.zoteroClient; }
  public get quoteManager() { return this.serviceState.quoteManager; }
  public get sentenceClaimQuoteLinkManager() { return this.serviceState.sentenceClaimQuoteLinkManager; }
  public get sentenceParser() { return this.serviceState.sentenceParser; }
  public get zoteroImportManager() { return this.serviceState.zoteroImportManager; }
  public get syncManager() { return this.serviceState.syncManager; }
  public get orphanCitationValidator() { return this.serviceState.orphanCitationValidator; }
  public get citationSourceMapper() { return this.serviceState.citationSourceMapper; }
  public get zoteroLeadQueue() { return this.serviceState.zoteroLeadQueue; }

  // Expose UI state
  public get positionMapper() { return this.uiState.positionMapper; }
  public get fulltextStatusManager() { return this.uiState.fulltextStatusManager; }
  public get manuscriptContextDetector() { return this.uiState.manuscriptContextDetector; }

  constructor(context: vscode.ExtensionContext) {
    this.coreState = new CoreState(context);
    this.serviceState = new ServiceState(this.coreState);
    this.uiState = new UIState(this.coreState, this.serviceState);

    this.showApiKeyWarningIfNeeded();
    this.initializeConfigurationManager();
  }

  private showApiKeyWarningIfNeeded(): void {
    const config = vscode.workspace.getConfiguration('researchAssistant');
    const apiKey = config.get<string>('openaiApiKey');

    if (!apiKey) {
      vscode.window.showErrorMessage(
        'OpenAI API key not configured. Please set researchAssistant.openaiApiKey in settings.',
        'Open Settings'
      ).then(action => {
        if (action === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant.openaiApiKey');
        }
      });
    }
  }

  private initializeConfigurationManager(): void {
    this.serviceState.configurationManager.initialize().catch(error => {
      console.error('Failed to initialize configuration manager:', error);
    });
  }

  async initialize(): Promise<void> {
    this.setupFileWatchers();
    console.log('[ResearchAssistant] Starting data load...');

    await this.initializeConfiguration();
    await this.loadClaims();
    await this.loadCitationLinks();
    this.parseOutlineInBackground();
    await this.initializeZoteroAvailability();
  }

  private async initializeConfiguration(): Promise<void> {
    try {
      await this.serviceState.configurationManager.initialize();
      console.log('[ResearchAssistant] Configuration manager initialized');
      
      const prefs = this.serviceState.configurationManager.getUserPreferences();
      if (prefs.zoteroApiKey && prefs.zoteroUserId) {
        this.serviceState.zoteroClient.initialize(prefs.zoteroApiKey, prefs.zoteroUserId);
        console.log('[ResearchAssistant] Zotero client configured');
      } else {
        console.log('[ResearchAssistant] Zotero API credentials not configured');
      }
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
    }
  }

  private async loadClaims(): Promise<void> {
    try {
      await this.serviceState.claimsManager.loadClaims();
      console.log('[ResearchAssistant] Claims loaded');
    } catch (error) {
      console.error('Failed to load claims:', error);
    }
  }

  private async loadCitationLinks(): Promise<void> {
    try {
      await this.serviceState.sentenceClaimQuoteLinkManager.loadLinks();
      console.log('[ResearchAssistant] Citation links loaded');
    } catch (error) {
      console.error('Failed to load citation links:', error);
    }
  }

  private parseOutlineInBackground(): void {
    this.serviceState.outlineParser.parse()
      .then(() => console.log('[ResearchAssistant] Outline parsed'))
      .catch(error => console.error('Failed to parse outline:', error));
  }

  private async initializeZoteroAvailability(): Promise<void> {
    try {
      await this.serviceState.zoteroAvailabilityManager.initialize();
      console.log('[ResearchAssistant] Zotero availability manager initialized');
      
      // Start periodic processing of Zotero lead queue (every 5 minutes)
      const queueDisposable = this.serviceState.zoteroLeadQueue.startPeriodicProcessing(300000);
      this.coreState.context.subscriptions.push(queueDisposable);
      console.log('[ResearchAssistant] Zotero lead queue processing started');
    } catch (error) {
      console.error('Failed to initialize Zotero availability manager:', error);
    }
  }

  initializePositionMapper(claimsPanelProvider: any): void {
    this.uiState.initializePositionMapper(claimsPanelProvider, this.coreState, this.serviceState);
  }

  private setupFileWatchers(): void {
    this.setupOutlineWatcher();
    this.setupClaimsWatcher();
  }

  private setupOutlineWatcher(): void {
    const config = this.coreState.config;
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.coreState.workspaceRoot, config.outlinePath)
    );

    watcher.onDidChange(() => {
      const timer = setTimeout(() => {
        this.serviceState.outlineParser.parse().catch(error => {
          console.error('Error parsing outline:', error);
        });
        this.coreState.debounceTimers.delete('outline');
      }, 500);
      this.coreState.setDebounceTimer('outline', timer);
    });

    this.coreState.addFileWatcher(watcher);
  }

  private setupClaimsWatcher(): void {
    const config = this.coreState.config;
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.coreState.workspaceRoot, config.claimsDatabasePath)
    );

    watcher.onDidChange(() => {
      const timer = setTimeout(() => {
        this.serviceState.claimsManager.requestReload();
        this.coreState.debounceTimers.delete('claims');
      }, 500);
      this.coreState.setDebounceTimer('claims', timer);
    });

    this.coreState.addFileWatcher(watcher);
  }

  reloadConfiguration(): void {
    this.coreState.reloadConfiguration();
    this.serviceState.updatePaths(this.coreState);
  }

  getAbsolutePath(relativePath: string): string {
    return this.coreState.getAbsolutePath(relativePath);
  }

  getWorkspaceRoot(): string {
    return this.coreState.workspaceRoot;
  }

  getConfig(): ExtensionConfig {
    return this.coreState.config;
  }

  async analyzeCoverage(): Promise<void> {
    console.log('Analyzing coverage...');
  }

  dispose(): void {
    this.coreState.dispose();
    this.serviceState.dispose();
    this.uiState.dispose();
  }
}
