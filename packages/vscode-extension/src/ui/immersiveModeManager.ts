import * as vscode from 'vscode';

/**
 * Manages immersive mode panels to ensure only one is open at a time
 */
class ImmersiveModeManager {
  private activePanel?: vscode.WebviewPanel;
  private activePanelType?: string;

  /**
   * Register a panel as the active immersive mode panel
   * Closes any previously active panel
   */
  registerPanel(panel: vscode.WebviewPanel, type: string): void {
    // Close previous panel if it exists and is different
    if (this.activePanel && this.activePanelType !== type) {
      this.activePanel.dispose();
    }

    this.activePanel = panel;
    this.activePanelType = type;

    // Clear reference when panel is disposed
    panel.onDidDispose(() => {
      if (this.activePanel === panel) {
        this.activePanel = undefined;
        this.activePanelType = undefined;
      }
    });
  }

  /**
   * Get the currently active panel
   */
  getActivePanel(): vscode.WebviewPanel | undefined {
    return this.activePanel;
  }

  /**
   * Get the type of the currently active panel
   */
  getActivePanelType(): string | undefined {
    return this.activePanelType;
  }

  /**
   * Check if a specific panel type is currently active
   */
  isActive(type: string): boolean {
    return this.activePanelType === type;
  }

  /**
   * Close the currently active panel
   */
  closeActivePanel(): void {
    if (this.activePanel) {
      this.activePanel.dispose();
      this.activePanel = undefined;
      this.activePanelType = undefined;
    }
  }
}

// Singleton instance
let instance: ImmersiveModeManager | null = null;

export function getImmersiveModeManager(): ImmersiveModeManager {
  if (!instance) {
    instance = new ImmersiveModeManager();
  }
  return instance;
}
