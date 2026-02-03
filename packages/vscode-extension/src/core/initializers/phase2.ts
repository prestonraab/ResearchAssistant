import * as vscode from 'vscode';
import { ExtensionState } from '../state';
import { Phase1Initializer } from './phase1';

/**
 * Phase 2 Initializer - Parallel data loading (< 2s target)
 * 
 * This phase loads essential data in parallel:
 * - Load claims database
 * - Parse outline file
 * - Load configuration
 * 
 * All operations include error handling and graceful degradation.
 * If one operation fails, others continue and the extension remains functional.
 */
export class Phase2Initializer {
  private phase1: Phase1Initializer;

  constructor(phase1: Phase1Initializer) {
    this.phase1 = phase1;
  }

  /**
   * Initialize Phase 2 - Data loading
   * Target: < 2s
   */
  async initialize(state: ExtensionState): Promise<void> {
    const startTime = Date.now();

    // Update status bar to show loading
    this.phase1.updateStatusBar(
      '$(loading~spin) Research Assistant: Loading data...',
      'Loading claims, outline, and configuration'
    );

    // Load data in parallel with error handling
    const results = await Promise.allSettled([
      this.loadClaims(state),
      this.parseOutline(state),
      this.loadConfiguration(state)
    ]);

    // Check results and log any failures
    const [claimsResult, outlineResult, configResult] = results;

    if (claimsResult.status === 'rejected') {
      console.error('[Phase2] Failed to load claims:', claimsResult.reason);
    }

    if (outlineResult.status === 'rejected') {
      console.error('[Phase2] Failed to parse outline:', outlineResult.reason);
    }

    if (configResult.status === 'rejected') {
      console.error('[Phase2] Failed to load configuration:', configResult.reason);
    }

    // Update tree views with loaded data
    await this.updateTreeViews();

    // Update status bar to show ready state
    this.phase1.updateStatusBar(
      '$(book) Research Assistant',
      'Research Assistant is ready'
    );

    const duration = Date.now() - startTime;
    console.log(`[Phase2] Initialization completed in ${duration}ms`);

    // Show warning if any critical operations failed
    const failedOperations = results.filter(r => r.status === 'rejected').length;
    if (failedOperations > 0) {
      vscode.window.showWarningMessage(
        `Research Assistant: ${failedOperations} operation(s) failed during initialization. Some features may be limited.`,
        'View Output'
      ).then(action => {
        if (action === 'View Output') {
          vscode.commands.executeCommand('workbench.action.output.toggleOutput');
        }
      });
    }
  }

  /**
   * Load claims database with error handling
   */
  private async loadClaims(state: ExtensionState): Promise<void> {
    try {
      console.log('[Phase2] Loading claims...');
      await state.claimsManager.loadClaims();
      console.log('[Phase2] Claims loaded successfully');
    } catch (error) {
      console.error('[Phase2] Failed to load claims:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showWarningMessage(
        `Could not load claims database: ${errorMessage}. Claims-related features will be limited.`
      );
      
      // Re-throw to mark as failed in Promise.allSettled
      throw error;
    }
  }

  /**
   * Parse outline file with error handling
   */
  private async parseOutline(state: ExtensionState): Promise<void> {
    try {
      console.log('[Phase2] Parsing outline...');
      await state.outlineParser.parse();
      console.log('[Phase2] Outline parsed successfully');
    } catch (error) {
      console.error('[Phase2] Failed to parse outline:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showWarningMessage(
        `Could not parse outline: ${errorMessage}. Outline navigation will be limited.`
      );
      
      // Re-throw to mark as failed in Promise.allSettled
      throw error;
    }
  }

  /**
   * Load configuration with error handling
   */
  private async loadConfiguration(state: ExtensionState): Promise<void> {
    try {
      console.log('[Phase2] Loading configuration...');
      await state.configurationManager.initialize();
      
      // Configure Zotero API service if credentials are available
      const prefs = state.configurationManager.getUserPreferences();
      if (prefs.zoteroApiKey && prefs.zoteroUserId) {
        state.zoteroClient.initialize(prefs.zoteroApiKey, prefs.zoteroUserId);
        console.log('[Phase2] Zotero client configured');
      }
      
      console.log('[Phase2] Configuration loaded successfully');
    } catch (error) {
      console.error('[Phase2] Failed to load configuration:', error);
      
      // Configuration failure is less critical - log but don't show error to user
      // The extension can still function with default configuration
      console.warn('[Phase2] Using default configuration');
      
      // Re-throw to mark as failed in Promise.allSettled
      throw error;
    }
  }

  /**
   * Update tree views with loaded data
   */
  private async updateTreeViews(): Promise<void> {
    try {
      const providers = this.phase1.getProviders();
      
      // Refresh all tree views to show loaded data
      providers.outline.refresh();
      providers.claims.refresh();
      providers.papers.refresh();
      
      console.log('[Phase2] Tree views updated');
    } catch (error) {
      console.error('[Phase2] Failed to update tree views:', error);
      // Non-critical error - tree views will update on next interaction
    }
  }
}
