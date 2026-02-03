import * as vscode from 'vscode';
import type { SyncResult } from '@research-assistant/core';

/**
 * SyncNotificationManager handles user notifications and settings for Zotero sync.
 *
 * Responsibilities:
 * - Show notifications with count of new highlights after sync
 * - Open quotes view when user clicks notification
 * - Respect user settings for automatic sync enable/disable
 * - Manage sync interval configuration
 *
 * **Validates: Requirements 5.4, 5.5, 5.6, 5.7**
 *
 * @example
 * ```typescript
 * const notificationManager = new SyncNotificationManager();
 *
 * // Show notification after sync
 * await notificationManager.showSyncNotification(result);
 *
 * // Check if auto-sync is enabled
 * const enabled = notificationManager.isAutoSyncEnabled();
 *
 * // Get configured sync interval
 * const interval = notificationManager.getSyncInterval();
 * ```
 */
export class SyncNotificationManager {
  private readonly SYNC_ENABLED_KEY = 'researchAssistant.zoteroSync.enabled';
  private readonly SYNC_INTERVAL_KEY = 'researchAssistant.zoteroSync.interval';
  private readonly DEFAULT_SYNC_INTERVAL = 15; // minutes

  /**
   * Show notification with count of new highlights after sync
   *
   * Displays a notification showing the number of new highlights imported.
   * If user clicks the notification, opens the quotes view.
   *
   * @param result - Sync result containing count of new highlights
   *
   * **Validates: Requirements 5.4, 5.5**
   */
  async showSyncNotification(result: SyncResult): Promise<void> {
    if (!result.success) {
      // Show error notification
      const errorMsg = result.error || 'Unknown error';
      vscode.window.showErrorMessage(
        `Zotero sync failed: ${errorMsg}`,
        'Retry'
      ).then(action => {
        if (action === 'Retry') {
          // Emit event to retry sync (handled by extension)
          vscode.commands.executeCommand('researchAssistant.syncZoteroNow');
        }
      });
      return;
    }

    // Show success notification
    const count = result.newHighlightsCount;
    if (count === 0) {
      // No new highlights, show brief notification
      vscode.window.showInformationMessage(
        'Zotero sync complete. No new highlights found.'
      );
      return;
    }

    // Show notification with count and action
    const message = count === 1
      ? 'Zotero sync complete. 1 new highlight imported.'
      : `Zotero sync complete. ${count} new highlights imported.`;

    vscode.window.showInformationMessage(
      message,
      'View Quotes'
    ).then(action => {
      if (action === 'View Quotes') {
        // Open quotes view
        vscode.commands.executeCommand('researchAssistant.openQuotesView');
      }
    });
  }

  /**
   * Check if automatic sync is enabled
   *
   * Reads the user setting for automatic sync enable/disable.
   *
   * @returns True if automatic sync is enabled
   *
   * **Validates: Requirements 5.6, 5.7**
   */
  isAutoSyncEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('researchAssistant');
    return config.get<boolean>('zoteroSync.enabled', true);
  }

  /**
   * Get configured sync interval in minutes
   *
   * Reads the user setting for sync interval.
   *
   * @returns Sync interval in minutes
   *
   * **Validates: Requirements 5.6**
   */
  getSyncInterval(): number {
    const config = vscode.workspace.getConfiguration('researchAssistant');
    return config.get<number>('zoteroSync.interval', this.DEFAULT_SYNC_INTERVAL);
  }

  /**
   * Set automatic sync enabled/disabled
   *
   * Updates the user setting for automatic sync.
   *
   * @param enabled - True to enable automatic sync
   */
  async setAutoSyncEnabled(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('researchAssistant');
    await config.update('zoteroSync.enabled', enabled, vscode.ConfigurationTarget.Global);
  }

  /**
   * Set sync interval in minutes
   *
   * Updates the user setting for sync interval.
   *
   * @param intervalMinutes - Sync interval in minutes
   */
  async setSyncInterval(intervalMinutes: number): Promise<void> {
    if (intervalMinutes < 1) {
      throw new Error('Sync interval must be at least 1 minute');
    }

    const config = vscode.workspace.getConfiguration('researchAssistant');
    await config.update('zoteroSync.interval', intervalMinutes, vscode.ConfigurationTarget.Global);
  }

  /**
   * Show sync settings dialog
   *
   * Opens a quick pick dialog for user to configure sync settings.
   */
  async showSyncSettingsDialog(): Promise<void> {
    const enabled = this.isAutoSyncEnabled();
    const interval = this.getSyncInterval();

    const items = [
      {
        label: `$(${enabled ? 'check' : 'circle-slash'}) Automatic Sync: ${enabled ? 'Enabled' : 'Disabled'}`,
        description: 'Toggle automatic sync of Zotero highlights',
        action: 'toggle-enabled',
      },
      {
        label: `$(clock) Sync Interval: ${interval} minutes`,
        description: 'Change how often to check for new highlights',
        action: 'change-interval',
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a setting to change',
    });

    if (!selected) {
      return;
    }

    if (selected.action === 'toggle-enabled') {
      await this.setAutoSyncEnabled(!enabled);
      vscode.window.showInformationMessage(
        `Automatic sync ${!enabled ? 'enabled' : 'disabled'}`
      );
    } else if (selected.action === 'change-interval') {
      const newInterval = await vscode.window.showInputBox({
        prompt: 'Enter sync interval in minutes',
        value: String(interval),
        validateInput: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1) {
            return 'Interval must be a number >= 1';
          }
          return '';
        },
      });

      if (newInterval) {
        const intervalNum = parseInt(newInterval, 10);
        await this.setSyncInterval(intervalNum);
        vscode.window.showInformationMessage(
          `Sync interval changed to ${intervalNum} minutes`
        );
      }
    }
  }
}
