import * as vscode from 'vscode';
import * as path from 'path';

export interface ExtensionConfig {
  outlinePath: string;
  claimsDatabasePath: string;
  extractedTextPath: string;
  coverageThresholds: { low: number; moderate: number; strong: number };
  embeddingCacheSize: number;
}

/** Core state: context, configuration, workspace, and resource cleanup. */
export class CoreState {
  private _context: vscode.ExtensionContext;
  private _config: ExtensionConfig;
  private _workspaceRoot: string;
  private _fileWatchers: vscode.FileSystemWatcher[] = [];
  private _debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) throw new Error('No workspace folder found.');
    this._workspaceRoot = folders[0].uri.fsPath;
    this._config = this.loadConfiguration();
  }

  get context() { return this._context; }
  get config() { return this._config; }
  get workspaceRoot() { return this._workspaceRoot; }
  get fileWatchers() { return this._fileWatchers; }
  get debounceTimers() { return this._debounceTimers; }

  loadConfiguration(): ExtensionConfig {
    const c = vscode.workspace.getConfiguration('researchAssistant');
    return {
      outlinePath: c.get<string>('outlinePath', '03_Drafting/outline.md'),
      claimsDatabasePath: c.get<string>('claimsDatabasePath', '01_Knowledge_Base/claims_and_evidence.md'),
      extractedTextPath: c.get<string>('extractedTextPath', 'literature/ExtractedText'),
      coverageThresholds: c.get('coverageThresholds', { low: 3, moderate: 6, strong: 7 }),
      embeddingCacheSize: c.get<number>('embeddingCacheSize', 1000)
    };
  }

  reloadConfiguration(): void { this._config = this.loadConfiguration(); }
  getAbsolutePath(relativePath: string): string { return path.join(this._workspaceRoot, relativePath); }

  addFileWatcher(watcher: vscode.FileSystemWatcher): void {
    this._fileWatchers.push(watcher);
    this._context.subscriptions.push(watcher);
  }

  setDebounceTimer(key: string, timer: NodeJS.Timeout): void {
    this.clearDebounceTimer(key);
    this._debounceTimers.set(key, timer);
  }

  clearDebounceTimer(key: string): void {
    const existing = this._debounceTimers.get(key);
    if (existing) { clearTimeout(existing); this._debounceTimers.delete(key); }
  }

  dispose(): void {
    for (const timer of this._debounceTimers.values()) clearTimeout(timer);
    this._debounceTimers.clear();
    for (const watcher of this._fileWatchers) watcher.dispose();
    this._fileWatchers = [];
  }
}
