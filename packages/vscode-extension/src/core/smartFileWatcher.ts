import * as vscode from 'vscode';
import { getLogger } from './loggingService';

/**
 * File change event
 */
export interface FileChange {
  timestamp: number;
  type: 'change' | 'create' | 'delete';
}

/**
 * SmartFileWatcher - Intelligent file watching with debouncing
 * 
 * Provides:
 * - 1000ms debouncing to prevent excessive processing
 * - Change accumulation for batch processing
 * - Automatic cleanup on dispose
 * 
 * Validates: Requirements US-4 (Efficient File Watching)
 */
export class SmartFileWatcher {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private pendingChanges = new Map<string, FileChange[]>();
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private logger = getLogger();

  private readonly DEBOUNCE_MS = 1000; // 1000ms debounce as per design spec

  /**
   * Watch a file pattern for changes
   * 
   * @param pattern - File pattern to watch (relative to workspace)
   * @param handler - Callback function when changes are detected
   * @returns Disposable for cleanup
   */
  watch(
    pattern: string,
    handler: (changes: FileChange[]) => Promise<void>
  ): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange((uri) => {
      this.scheduleProcessing(uri.fsPath, 'change', handler);
    });

    watcher.onDidCreate((uri) => {
      this.scheduleProcessing(uri.fsPath, 'create', handler);
    });

    watcher.onDidDelete((uri) => {
      this.scheduleProcessing(uri.fsPath, 'delete', handler);
    });

    this.watchers.set(pattern, watcher);

    return {
      dispose: () => {
        watcher.dispose();
        this.watchers.delete(pattern);
      }
    };
  }

  /**
   * Schedule processing of file changes with debouncing
   * 
   * @private
   */
  private scheduleProcessing(
    file: string,
    type: 'change' | 'create' | 'delete',
    handler: (changes: FileChange[]) => Promise<void>
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(file);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Accumulate changes
    if (!this.pendingChanges.has(file)) {
      this.pendingChanges.set(file, []);
    }
    this.pendingChanges.get(file)!.push({
      timestamp: Date.now(),
      type
    });

    // Schedule processing
    const timer = setTimeout(async () => {
      const changes = this.pendingChanges.get(file) || [];
      this.pendingChanges.delete(file);
      this.debounceTimers.delete(file);

      try {
        this.logger.debug(`Processing ${changes.length} change(s) for file: ${file}`);
        await handler(changes);
      } catch (error) {
        this.logger.error(`File processing error for ${file}:`, error instanceof Error ? error : undefined);
      }
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(file, timer);
  }

  /**
   * Dispose all watchers and clear timers
   */
  dispose(): void {
    // Clear all pending timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingChanges.clear();

    // Dispose all watchers
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();

    this.logger.debug('SmartFileWatcher disposed');
  }

  /**
   * Get number of pending changes
   */
  getPendingChangesCount(): number {
    return this.pendingChanges.size;
  }

  /**
   * Get number of active watchers
   */
  getActiveWatchersCount(): number {
    return this.watchers.size;
  }
}
