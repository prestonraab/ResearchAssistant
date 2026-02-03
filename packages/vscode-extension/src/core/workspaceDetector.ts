import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * WorkspaceDetector - Detects if the current workspace is a research workspace
 * and handles auto-activation logic.
 * 
 * A research workspace is identified by the presence of specific directories
 * that indicate research-related content.
 */
export class WorkspaceDetector {
  private static readonly RESEARCH_INDICATORS = [
    '01_Knowledge_Base',
    '03_Drafting',
    'literature/ExtractedText'
  ];

  private static readonly CONFIG_KEY = 'researchAssistant';
  private static readonly AUTO_ACTIVATE_KEY = 'autoActivate';

  /**
   * Check if the current workspace is a research workspace
   * by looking for research-specific directories.
   * 
   * @returns true if research workspace detected, false otherwise
   */
  public static isResearchWorkspace(): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return false;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Check if any of the research indicators exist
    return this.RESEARCH_INDICATORS.some(indicator => {
      const indicatorPath = path.join(workspaceRoot, indicator);
      return fs.existsSync(indicatorPath);
    });
  }

  /**
   * Auto-activate the extension if research workspace is detected
   * and auto-activation is not disabled.
   * 
   * Shows a notification to the user with an option to disable auto-activation.
   * 
   * @param context - Extension context for storing configuration
   */
  public static async autoActivateIfNeeded(context: vscode.ExtensionContext): Promise<void> {
    // Check if auto-activation is disabled
    if (this.isAutoActivateDisabled()) {
      return;
    }

    // Check if this is a research workspace
    if (!this.isResearchWorkspace()) {
      return;
    }

    // Show notification with option to disable
    const action = await vscode.window.showInformationMessage(
      'Research workspace detected. Research Assistant is activating...',
      'Disable Auto-Activation',
      'OK'
    );

    if (action === 'Disable Auto-Activation') {
      await this.disableAutoActivation();
      vscode.window.showInformationMessage(
        'Auto-activation disabled. You can re-enable it in settings.'
      );
      return;
    }

    // Activate the extension
    try {
      await vscode.commands.executeCommand('researchAssistant.activate');
    } catch (error) {
      console.error('Failed to auto-activate Research Assistant:', error);
      vscode.window.showErrorMessage(
        'Failed to activate Research Assistant. Please try activating manually via the command palette (Ctrl+Shift+P).',
        'Activate Now'
      ).then(action => {
        if (action === 'Activate Now') {
          vscode.commands.executeCommand('researchAssistant.activate');
        }
      });
    }
  }

  /**
   * Check if auto-activation is disabled in configuration
   * 
   * @returns true if auto-activation is disabled, false otherwise
   */
  private static isAutoActivateDisabled(): boolean {
    const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
    return !config.get<boolean>(this.AUTO_ACTIVATE_KEY, true);
  }

  /**
   * Disable auto-activation by updating the configuration
   */
  private static async disableAutoActivation(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
    await config.update(
      this.AUTO_ACTIVATE_KEY,
      false,
      vscode.ConfigurationTarget.Workspace
    );
  }

  /**
   * Enable auto-activation by updating the configuration
   */
  public static async enableAutoActivation(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
    await config.update(
      this.AUTO_ACTIVATE_KEY,
      true,
      vscode.ConfigurationTarget.Workspace
    );
    vscode.window.showInformationMessage('Auto-activation enabled');
  }

  /**
   * Get the list of research indicators used for detection
   * 
   * @returns Array of directory paths that indicate a research workspace
   */
  public static getResearchIndicators(): string[] {
    return [...this.RESEARCH_INDICATORS];
  }
}
