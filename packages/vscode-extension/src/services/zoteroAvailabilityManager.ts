import * as vscode from 'vscode';
import { ZoteroClient } from '@research-assistant/core';

/**
 * ZoteroAvailabilityManager handles checking Zotero API availability
 * and managing graceful degradation when Zotero is unavailable.
 * 
 * Responsibilities:
 * - Check Zotero API availability with timeout
 * - Disable Zotero commands and hide UI elements when unavailable
 * - Enable features dynamically when Zotero becomes available
 * - Provide methods to check current availability status
 * - Support dynamic re-checking of availability
 */
export class ZoteroAvailabilityManager {
  private zoteroClient: ZoteroClient;
  private isAvailable: boolean = false;
  private availabilityCheckTimeout: number = 5000; // 5 seconds timeout
  private checkInProgress: boolean = false;
  private lastCheckTime: number = 0;
  private checkCacheTimeout: number = 30000; // Cache availability check for 30 seconds
  private onAvailabilityChanged: vscode.EventEmitter<boolean> | null = null;
  private disposables: vscode.Disposable[] = [];
  private disabledCommands: Set<string> = new Set();
  private hiddenUIElements: Set<string> = new Set();
  private lastError: string = '';

  private getLogger() {
    try {
      const loggingService = require('../core/loggingService');
      return loggingService.getLogger();
    } catch (error) {
      return {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        dispose: () => {},
      };
    }
  }

  private getEventEmitter(): vscode.EventEmitter<boolean> {
    if (!this.onAvailabilityChanged) {
      this.onAvailabilityChanged = new vscode.EventEmitter();
    }
    return this.onAvailabilityChanged;
  }

  constructor(zoteroClient: ZoteroClient) {
    this.zoteroClient = zoteroClient;
  }

  /**
   * Initialize the availability manager and perform initial availability check
   */
  async initialize(): Promise<void> {
    this.getLogger().info('Initializing ZoteroAvailabilityManager');
    
    try {
      // Perform initial availability check
      await this.checkAvailability();
      
      // Set up periodic re-checking (every 60 seconds)
      const checkInterval = setInterval(async () => {
        await this.checkAvailability();
      }, 60000);
      
      this.disposables.push({
        dispose: () => clearInterval(checkInterval),
      });
      
      this.getLogger().info(`Zotero availability: ${this.isAvailable}`);
    } catch (error) {
      this.getLogger().error('Failed to initialize ZoteroAvailabilityManager:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Check if Zotero MCP client is available with timeout
   * Uses caching to avoid excessive checks
   * @returns True if Zotero is available, false otherwise
   */
  async checkAvailability(): Promise<boolean> {
    // Return cached result if check was recent
    const now = Date.now();
    if (now - this.lastCheckTime < this.checkCacheTimeout && !this.checkInProgress) {
      return this.isAvailable;
    }

    // Prevent concurrent checks
    if (this.checkInProgress) {
      return this.isAvailable;
    }

    this.checkInProgress = true;
    const previousAvailability = this.isAvailable;

    try {
      // Attempt to check Zotero availability with timeout
      const available = await this.performAvailabilityCheck();
      this.isAvailable = available;
      this.lastCheckTime = now;
      this.lastError = ''; // Clear error on success

      // Notify listeners if availability changed
      if (available !== previousAvailability) {
        this.getLogger().info(`Zotero availability changed: ${previousAvailability} -> ${available}`);
        this.getEventEmitter().fire(available);
        
        if (available) {
          await this.enableZoteroFeatures();
        } else {
          await this.disableZoteroFeatures();
        }
      }

      return this.isAvailable;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.getLogger().error('Error checking Zotero availability:', errorMessage);
      this.lastError = errorMessage; // Store error for display
      this.isAvailable = false;
      this.lastCheckTime = now;

      // Notify listeners if availability changed
      if (!this.isAvailable && previousAvailability) {
        this.getEventEmitter().fire(false);
        await this.disableZoteroFeatures();
      }

      return false;
    } finally {
      this.checkInProgress = false;
    }
  }

  /**
   * Perform the actual availability check with timeout
   * @returns True if Zotero MCP client is available
   */
  private async performAvailabilityCheck(): Promise<boolean> {
    return Promise.race([
      this.attemptZoteroConnection(),
      this.createTimeoutPromise(this.availabilityCheckTimeout),
    ]);
  }

  /**
   * Attempt to connect to Zotero API
   * @returns True if connection succeeds
   */
  private async attemptZoteroConnection(): Promise<boolean> {
    try {
      // Test connection to Zotero API
      return await this.zoteroClient.testConnection();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.getLogger().debug('Zotero API connection attempt failed:', message);
      // Store the error message for later display
      this.lastError = message;
      return false;
    }
  }

  /**
   * Create a timeout promise that rejects after specified duration
   * @param timeoutMs - Timeout duration in milliseconds
   * @returns Promise that rejects after timeout
   */
  private createTimeoutPromise(timeoutMs: number): Promise<boolean> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Zotero availability check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Get current availability status
   * @returns True if Zotero is available
   */
  getAvailabilityStatus(): boolean {
    return this.isAvailable;
  }

  /**
   * Subscribe to availability changes
   * @param listener - Callback function that receives availability status
   * @returns Disposable to unsubscribe
   */
  onAvailabilityStatusChanged(listener: (available: boolean) => void): vscode.Disposable {
    return this.getEventEmitter().event(listener);
  }

  /**
   * Disable Zotero-specific commands and UI elements
   */
  private async disableZoteroFeatures(): Promise<void> {
    this.getLogger().info('Disabling Zotero features');
    this.getLogger().info(`Last error: ${this.lastError}`);

    // Disable Zotero commands
    const zoteroCommands = [
      'researchAssistant.importZoteroHighlights',
      'researchAssistant.syncZoteroHighlights',
      'researchAssistant.jumpToPDF',
    ];

    for (const command of zoteroCommands) {
      try {
        await vscode.commands.executeCommand('setContext', `${command}.enabled`, false);
        this.disabledCommands.add(command);
      } catch (error) {
        this.getLogger().warn(`Failed to disable command ${command}:`, error);
      }
    }

    // Hide Zotero UI elements
    const uiElements = [
      'researchAssistant.zoteroIndicator',
      'researchAssistant.jumpToPDFButton',
      'researchAssistant.zoteroMetadata',
    ];

    for (const element of uiElements) {
      try {
        await vscode.commands.executeCommand('setContext', `${element}.visible`, false);
        this.hiddenUIElements.add(element);
      } catch (error) {
        this.getLogger().warn(`Failed to hide UI element ${element}:`, error);
      }
    }

    // Show notification with specific error message
    const errorDetail = this.lastError ? `\n\nDetails: ${this.lastError}` : '';
    const message = `Zotero is not available. Some features have been disabled.${errorDetail}`;
    this.getLogger().info(`Showing message: ${message}`);
    
    vscode.window.showWarningMessage(
      message,
      'Configure Settings'
    ).then((selection) => {
      if (selection === 'Configure Settings') {
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'researchAssistant.zotero'
        );
      }
    });
  }

  /**
   * Enable Zotero-specific commands and UI elements
   */
  private async enableZoteroFeatures(): Promise<void> {
    this.getLogger().info('Enabling Zotero features');

    // Enable Zotero commands
    const zoteroCommands = [
      'researchAssistant.importZoteroHighlights',
      'researchAssistant.syncZoteroHighlights',
      'researchAssistant.jumpToPDF',
    ];

    for (const command of zoteroCommands) {
      try {
        await vscode.commands.executeCommand('setContext', `${command}.enabled`, true);
        this.disabledCommands.delete(command);
      } catch (error) {
        this.getLogger().warn(`Failed to enable command ${command}:`, error);
      }
    }

    // Show Zotero UI elements
    const uiElements = [
      'researchAssistant.zoteroIndicator',
      'researchAssistant.jumpToPDFButton',
      'researchAssistant.zoteroMetadata',
    ];

    for (const element of uiElements) {
      try {
        await vscode.commands.executeCommand('setContext', `${element}.visible`, true);
        this.hiddenUIElements.delete(element);
      } catch (error) {
        this.getLogger().warn(`Failed to show UI element ${element}:`, error);
      }
    }

    // Show notification to user
    vscode.window.showInformationMessage('Zotero is now available. Zotero features have been enabled.');
  }

  /**
   * Force a re-check of Zotero availability
   * Bypasses cache and performs immediate check
   * @returns True if Zotero is available
   */
  async forceRecheck(): Promise<boolean> {
    this.getLogger().info('Forcing Zotero availability recheck');
    this.lastCheckTime = 0; // Clear cache
    return this.checkAvailability();
  }

  /**
   * Get the last error message
   */
  getLastError(): string {
    return this.lastError;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.getLogger().info('Disposing ZoteroAvailabilityManager');
    if (this.onAvailabilityChanged) {
      this.onAvailabilityChanged.dispose();
    }
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
