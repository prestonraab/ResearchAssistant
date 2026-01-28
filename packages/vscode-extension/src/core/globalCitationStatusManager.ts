import * as vscode from 'vscode';

/**
 * GlobalCitationStatusManager - Manages citation status across all modes
 * Persists which quotes are marked for citation in the final output
 * Uses VS Code's memento for persistence across sessions
 */
export class GlobalCitationStatusManager {
  private static instance: GlobalCitationStatusManager;
  
  private citationStatus: Map<string, boolean> = new Map(); // key: "claimId:quoteIndex"
  private memento: vscode.Memento;
  private onStatusChangeEmitter = new vscode.EventEmitter<{ key: string; cited: boolean }>();
  public readonly onStatusChange = this.onStatusChangeEmitter.event;

  private constructor(memento: vscode.Memento) {
    this.memento = memento;
    this.loadFromMemento();
  }

  static getInstance(memento?: vscode.Memento): GlobalCitationStatusManager {
    if (!GlobalCitationStatusManager.instance) {
      if (!memento) {
        throw new Error('Memento required for first initialization of GlobalCitationStatusManager');
      }
      GlobalCitationStatusManager.instance = new GlobalCitationStatusManager(memento);
    }
    return GlobalCitationStatusManager.instance;
  }

  /**
   * Load citation status from memento
   */
  private loadFromMemento(): void {
    try {
      const stored = this.memento.get<Record<string, boolean>>('citationStatus', {});
      this.citationStatus.clear();
      for (const [key, value] of Object.entries(stored)) {
        this.citationStatus.set(key, value);
      }
      console.log(`[GlobalCitationStatusManager] Loaded ${this.citationStatus.size} citation statuses from memento`);
    } catch (error) {
      console.error('[GlobalCitationStatusManager] Failed to load from memento:', error);
    }
  }

  /**
   * Save citation status to memento
   */
  private async saveToMemento(): Promise<void> {
    try {
      const stored: Record<string, boolean> = {};
      for (const [key, value] of this.citationStatus.entries()) {
        stored[key] = value;
      }
      await this.memento.update('citationStatus', stored);
    } catch (error) {
      console.error('[GlobalCitationStatusManager] Failed to save to memento:', error);
    }
  }

  /**
   * Mark a quote as cited
   */
  async markForCitation(claimId: string, quoteIndex: number): Promise<void> {
    const key = `${claimId}:${quoteIndex}`;
    this.citationStatus.set(key, true);
    await this.saveToMemento();
    this.onStatusChangeEmitter.fire({ key, cited: true });
  }

  /**
   * Unmark a quote from citation
   */
  async unmarkForCitation(claimId: string, quoteIndex: number): Promise<void> {
    const key = `${claimId}:${quoteIndex}`;
    this.citationStatus.set(key, false);
    await this.saveToMemento();
    this.onStatusChangeEmitter.fire({ key, cited: false });
  }

  /**
   * Check if a quote is marked for citation
   */
  isCitedForFinal(claimId: string, quoteIndex: number): boolean {
    const key = `${claimId}:${quoteIndex}`;
    return this.citationStatus.get(key) ?? false;
  }

  /**
   * Get all cited quotes for a claim
   */
  getCitedQuotesForClaim(claimId: string): number[] {
    const cited: number[] = [];
    for (const [key, value] of this.citationStatus.entries()) {
      if (key.startsWith(`${claimId}:`) && value) {
        const quoteIndex = parseInt(key.split(':')[1], 10);
        cited.push(quoteIndex);
      }
    }
    return cited;
  }

  /**
   * Clear all citation status
   */
  async clearAll(): Promise<void> {
    this.citationStatus.clear();
    await this.saveToMemento();
  }

  /**
   * Clear citation status for a specific claim
   */
  async clearForClaim(claimId: string): Promise<void> {
    const keysToDelete: string[] = [];
    for (const key of this.citationStatus.keys()) {
      if (key.startsWith(`${claimId}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.citationStatus.delete(key);
    }
    await this.saveToMemento();
  }

  /**
   * Get all citation status as object
   */
  getAll(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [key, value] of this.citationStatus.entries()) {
      result[key] = value;
    }
    return result;
  }
}

export function getGlobalCitationStatusManager(memento?: vscode.Memento): GlobalCitationStatusManager {
  return GlobalCitationStatusManager.getInstance(memento);
}
