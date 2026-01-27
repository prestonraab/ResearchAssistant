import * as vscode from 'vscode';

/**
 * WebviewDisposalManager - Manages webview lifecycle and cleanup
 * Ensures proper disposal of resources when webviews are closed
 */
export class WebviewDisposalManager {
  private disposables: Map<string, vscode.Disposable[]> = new Map();
  private webviewStates: Map<string, any> = new Map();
  private memoryMonitors: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a webview for disposal management
   */
  registerWebview(viewType: string, webview: vscode.Webview): void {
    if (!this.disposables.has(viewType)) {
      this.disposables.set(viewType, []);
    }

    // Note: onDidChangeVisibility is not available on Webview interface
    // We'll handle visibility through the WebviewView instead
  }

  /**
   * Register a disposable resource for a webview
   */
  registerDisposable(viewType: string, disposable: vscode.Disposable): void {
    if (!this.disposables.has(viewType)) {
      this.disposables.set(viewType, []);
    }
    this.disposables.get(viewType)!.push(disposable);
  }

  /**
   * Save webview state for restoration
   */
  saveWebviewState(viewType: string, state: any): void {
    this.webviewStates.set(viewType, state);
  }

  /**
   * Get saved webview state
   */
  getWebviewState(viewType: string): any {
    return this.webviewStates.get(viewType);
  }

  /**
   * Start memory monitoring for a webview
   */
  startMemoryMonitoring(viewType: string, onHighMemory?: () => void): void {
    // Stop existing monitor if any
    this.stopMemoryMonitoring(viewType);

    const monitor = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

      // Trigger callback if memory usage exceeds 70%
      if (heapUsedMB > heapTotalMB * 0.7) {
        if (onHighMemory) {
          onHighMemory();
        }
      }
    }, 30000); // Check every 30 seconds

    this.memoryMonitors.set(viewType, monitor);
  }

  /**
   * Stop memory monitoring for a webview
   */
  stopMemoryMonitoring(viewType: string): void {
    const monitor = this.memoryMonitors.get(viewType);
    if (monitor) {
      clearInterval(monitor);
      this.memoryMonitors.delete(viewType);
    }
  }

  /**
   * Dispose all resources for a webview
   */
  disposeWebview(viewType: string): void {
    // Stop memory monitoring
    this.stopMemoryMonitoring(viewType);

    // Dispose all registered disposables
    const disposables = this.disposables.get(viewType);
    if (disposables) {
      disposables.forEach(d => {
        try {
          d.dispose();
        } catch (error) {
          console.error(`Error disposing resource for ${viewType}:`, error);
        }
      });
      this.disposables.delete(viewType);
    }

    // Clear saved state
    this.webviewStates.delete(viewType);
  }

  /**
   * Dispose all webviews
   */
  disposeAll(): void {
    // Stop all memory monitors
    this.memoryMonitors.forEach(monitor => clearInterval(monitor));
    this.memoryMonitors.clear();

    // Dispose all disposables
    this.disposables.forEach((disposables, viewType) => {
      disposables.forEach(d => {
        try {
          d.dispose();
        } catch (error) {
          console.error(`Error disposing resource for ${viewType}:`, error);
        }
      });
    });
    this.disposables.clear();

    // Clear all states
    this.webviewStates.clear();
  }

  /**
   * Get memory stats for a webview
   */
  getMemoryStats(): {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
  } {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      externalMB: Math.round(usage.external / 1024 / 1024)
    };
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Global instance of WebviewDisposalManager
 */
let globalDisposalManager: WebviewDisposalManager | null = null;

/**
 * Get or create global disposal manager
 */
export function getWebviewDisposalManager(): WebviewDisposalManager {
  if (!globalDisposalManager) {
    globalDisposalManager = new WebviewDisposalManager();
  }
  return globalDisposalManager;
}

/**
 * Dispose global disposal manager
 */
export function disposeWebviewDisposalManager(): void {
  if (globalDisposalManager) {
    globalDisposalManager.disposeAll();
    globalDisposalManager = null;
  }
}
