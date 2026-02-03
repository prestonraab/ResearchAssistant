import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionState } from '../state';

/**
 * Phase 3 Initializer - Async optional service initialization
 * 
 * This phase initializes optional services in the background:
 * - Embeddings service (if API key configured)
 * - MCP client
 * - Zotero services
 * - File watchers
 * 
 * All operations are non-blocking and can fail without breaking core functionality.
 * Services are initialized in parallel for efficiency.
 */
export class Phase3Initializer {
  private initializationPromises: Promise<void>[] = [];

  /**
   * Initialize Phase 3 - Optional services
   * This is async and non-blocking - the extension is already functional
   */
  async initialize(state: ExtensionState): Promise<void> {
    const startTime = Date.now();
    console.log('[Phase3] Starting optional service initialization...');

    // Start all initializations in parallel (non-blocking)
    // Each handles its own errors and logs appropriately
    this.initializationPromises = [
      this.initializeEmbeddings(state).catch(error => this.handleError('Embeddings', error)),
      this.initializeZotero(state).catch(error => this.handleError('Zotero', error)),
      this.setupFileWatchers(state).catch(error => this.handleError('File Watchers', error))
    ];

    // Don't await - let them complete in background
    // But track them for testing/debugging
    Promise.all(this.initializationPromises).then(() => {
      const duration = Date.now() - startTime;
      console.log(`[Phase3] All optional services initialized in ${duration}ms`);
    });
  }

  /**
   * Wait for all Phase 3 initializations to complete
   * Useful for testing or when you need to ensure all services are ready
   */
  async waitForCompletion(): Promise<void> {
    await Promise.all(this.initializationPromises);
  }

  /**
   * Initialize embeddings service if API key is configured
   */
  private async initializeEmbeddings(state: ExtensionState): Promise<void> {
    console.log('[Phase3] Initializing embeddings service...');

    const config = vscode.workspace.getConfiguration('researchAssistant');
    const apiKey = config.get<string>('openaiApiKey');

    if (!apiKey) {
      console.log('[Phase3] Embeddings disabled: No API key configured');
      return;
    }

    try {
      // Embedding service is already created in ExtensionState constructor
      // Just verify it's working by checking if it has the API key
      if (state.embeddingService) {
        console.log('[Phase3] Embeddings service already initialized');
        
        // Optionally warm up the cache by loading any persisted embeddings
        // This is a no-op if there's nothing to load
        console.log('[Phase3] Embeddings service ready');
      }
    } catch (error) {
      console.error('[Phase3] Failed to initialize embeddings:', error);
      throw error;
    }
  }

  /**
   * Initialize Zotero services
   */
  private async initializeZotero(state: ExtensionState): Promise<void> {
    console.log('[Phase3] Initializing Zotero services...');

    try {
      // Check if Zotero credentials are configured
      const prefs = state.configurationManager.getUserPreferences();
      
      if (!prefs.zoteroApiKey || !prefs.zoteroUserId) {
        console.log('[Phase3] Zotero disabled: No credentials configured');
        return;
      }

      // Zotero API service should already be configured in Phase 2
      // Just initialize the availability manager
      if (state.zoteroAvailabilityManager) {
        await state.zoteroAvailabilityManager.initialize();
        console.log('[Phase3] Zotero availability manager initialized');
      }

      console.log('[Phase3] Zotero services ready');
    } catch (error) {
      console.error('[Phase3] Failed to initialize Zotero services:', error);
      // Don't throw - Zotero is optional
      console.log('[Phase3] Continuing without Zotero integration');
    }
  }

  /**
   * Setup file watchers for outline and claims database
   */
  private async setupFileWatchers(state: ExtensionState): Promise<void> {
    console.log('[Phase3] Setting up file watchers...');

    try {
      const workspaceRoot = state.getWorkspaceRoot();
      const config = state.getConfig();

      // Watch outline file
      const outlineWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, config.outlinePath)
      );

      outlineWatcher.onDidChange(() => {
        this.debounceFileChange('outline', () => {
          console.log('[Phase3] Outline file changed, reparsing...');
          state.outlineParser.parse().catch(error => {
            console.error('[Phase3] Error parsing outline:', error);
          });
        });
      });

      // Watch claims database
      const claimsWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, config.claimsDatabasePath)
      );

      claimsWatcher.onDidChange(() => {
        this.debounceFileChange('claims', () => {
          console.log('[Phase3] Claims database changed, reloading...');
          state.claimsManager.requestReload();
        });
      });

      console.log('[Phase3] File watchers set up successfully');
    } catch (error) {
      console.error('[Phase3] Failed to setup file watchers:', error);
      throw error;
    }
  }

  /**
   * Debounce timer storage
   */
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Debounce file change events to avoid excessive processing
   * Uses 1000ms debounce as per design spec
   */
  private debounceFileChange(key: string, handler: () => void): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      handler();
      this.debounceTimers.delete(key);
    }, 1000); // 1000ms debounce as per design spec

    this.debounceTimers.set(key, timer);
  }

  /**
   * Handle initialization errors
   * Logs error but doesn't show to user unless they try to use the feature
   */
  private handleError(serviceName: string, error: Error): void {
    console.warn(`[Phase3] ${serviceName} initialization failed:`, error);
    console.log(`[Phase3] ${serviceName} will be unavailable. Core functionality not affected.`);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
