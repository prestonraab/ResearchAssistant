import * as vscode from 'vscode';
import { PersistenceUtils } from './persistenceUtils';

/**
 * Reading status for a paper
 */
export type ReadingStatus = 'to-read' | 'reading' | 'read';

/**
 * Reading progress information for a paper
 */
export interface ReadingProgress {
  status: ReadingStatus;
  startedAt?: Date;
  completedAt?: Date;
  readingDuration?: number; // in minutes
}

/**
 * Serializable version of ReadingProgress for storage
 */
interface SerializedReadingProgress {
  status: ReadingStatus;
  startedAt?: string; // ISO date string
  completedAt?: string; // ISO date string
  readingDuration?: number;
}

/**
 * ReadingStatusManager tracks reading progress for papers.
 * 
 * Features:
 * - Store reading status (to-read/reading/read) in workspace state
 * - Track timestamps for reading start and completion
 * - Calculate reading duration
 * - Persist status across extension restarts
 * 
 * Validates Requirements 4.5, 16.1, 16.2, 16.3
 */
export class ReadingStatusManager {
  private context: vscode.ExtensionContext;
  private statusMap: Map<string, ReadingProgress>;
  private readonly STORAGE_KEY = 'researchAssistant.readingProgress';
  
  // Write queue to prevent race conditions on storage updates
  private writeQueue: Promise<void> = Promise.resolve();
  private isWriting: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.statusMap = new Map();
    this.loadFromStorage();
  }

  /**
   * Set reading status for a paper.
   * 
   * @param paperId Unique identifier for the paper (e.g., Zotero item key)
   * @param status New reading status
   * 
   * Validates: Requirements 4.5, 16.1, 16.2
   */
  async setStatus(paperId: string, status: ReadingStatus): Promise<void> {
    const currentProgress = this.statusMap.get(paperId);
    const now = new Date();

    let newProgress: ReadingProgress;

    if (status === 'reading') {
      // When marking as "reading", record the start timestamp
      // Validates: Requirement 16.1
      newProgress = {
        status: 'reading',
        startedAt: currentProgress?.startedAt || now,
        completedAt: undefined,
        readingDuration: undefined
      };
    } else if (status === 'read') {
      // When marking as "read", record completion time and calculate duration
      // Validates: Requirement 16.2
      const startedAt = currentProgress?.startedAt || now;
      const completedAt = now;
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      newProgress = {
        status: 'read',
        startedAt,
        completedAt,
        readingDuration: durationMinutes
      };
    } else {
      // status === 'to-read'
      newProgress = {
        status: 'to-read',
        startedAt: undefined,
        completedAt: undefined,
        readingDuration: undefined
      };
    }

    this.statusMap.set(paperId, newProgress);
    await this.saveToStorage();
  }

  /**
   * Get reading status for a paper.
   * 
   * @param paperId Unique identifier for the paper
   * @returns Reading progress information, or undefined if not tracked
   * 
   * Validates: Requirement 4.5
   */
  getStatus(paperId: string): ReadingProgress | undefined {
    return this.statusMap.get(paperId);
  }

  /**
   * Get all papers with a specific status.
   * 
   * @param status Reading status to filter by
   * @returns Array of paper IDs with the specified status
   */
  getPapersByStatus(status: ReadingStatus): string[] {
    const papers: string[] = [];
    
    for (const [paperId, progress] of this.statusMap.entries()) {
      if (progress.status === status) {
        papers.push(paperId);
      }
    }

    return papers;
  }

  /**
   * Get reading statistics.
   * 
   * @returns Statistics about reading progress
   * 
   * Validates: Requirement 16.3
   */
  getStatistics(): {
    toRead: number;
    reading: number;
    read: number;
    totalReadingTime: number; // in minutes
    averageReadingTime: number; // in minutes
  } {
    let toRead = 0;
    let reading = 0;
    let read = 0;
    let totalReadingTime = 0;

    for (const progress of this.statusMap.values()) {
      switch (progress.status) {
        case 'to-read':
          toRead++;
          break;
        case 'reading':
          reading++;
          break;
        case 'read':
          read++;
          if (progress.readingDuration) {
            totalReadingTime += progress.readingDuration;
          }
          break;
      }
    }

    const averageReadingTime = read > 0 ? Math.round(totalReadingTime / read) : 0;

    return {
      toRead,
      reading,
      read,
      totalReadingTime,
      averageReadingTime
    };
  }

  /**
   * Remove reading status for a paper.
   * 
   * @param paperId Unique identifier for the paper
   */
  async removeStatus(paperId: string): Promise<void> {
    this.statusMap.delete(paperId);
    await this.saveToStorage();
  }

  /**
   * Clear all reading status data.
   */
  async clearAll(): Promise<void> {
    this.statusMap.clear();
    await this.saveToStorage();
  }

  /**
   * Load reading progress from workspace state.
   * Persists status across extension restarts.
   * 
   * Validates: Requirement 16.3
   */
  private loadFromStorage(): void {
    const stored = this.context.workspaceState.get<Record<string, SerializedReadingProgress>>(
      this.STORAGE_KEY,
      {}
    );

    this.statusMap.clear();

    for (const [paperId, serialized] of Object.entries(stored)) {
      const progress: ReadingProgress = {
        status: serialized.status,
        startedAt: serialized.startedAt ? new Date(serialized.startedAt) : undefined,
        completedAt: serialized.completedAt ? new Date(serialized.completedAt) : undefined,
        readingDuration: serialized.readingDuration
      };

      this.statusMap.set(paperId, progress);
    }
  }

  /**
   * Save reading progress to workspace state.
   * Persists status across extension restarts.
   * Queues the save operation to prevent race conditions.
   * 
   * Validates: Requirement 16.3
   */
  private async saveToStorage(): Promise<void> {
    // Queue the save operation to prevent race conditions
    this.writeQueue = this.writeQueue.then(() => this._performSaveToStorage()).catch(error => {
      console.error('Error in reading status write queue:', error);
    });
    
    return this.writeQueue;
  }

  private async _performSaveToStorage(): Promise<void> {
    this.isWriting = true;
    try {
      const toStore: Record<string, SerializedReadingProgress> = {};

      for (const [paperId, progress] of this.statusMap.entries()) {
        // Validate each progress entry
        const validation = PersistenceUtils.validateReadingProgress(progress);
        if (!validation.valid) {
          console.warn(`Validation errors for paper ${paperId}:`, validation.errors);
          // Continue with other entries, but log the issue
        }

        toStore[paperId] = {
          status: progress.status,
          startedAt: progress.startedAt?.toISOString(),
          completedAt: progress.completedAt?.toISOString(),
          readingDuration: progress.readingDuration
        };
      }

      try {
        await this.context.workspaceState.update(this.STORAGE_KEY, toStore);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save reading progress:', err);
        
        // Show error to user with retry option
        await PersistenceUtils.showPersistenceError(
          err,
          'save reading progress',
          'workspace state',
          () => this._performSaveToStorage()
        );
        
        throw err;
      }
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Get all tracked papers with their reading progress.
   * 
   * @returns Map of paper ID to reading progress
   */
  getAllProgress(): Map<string, ReadingProgress> {
    return new Map(this.statusMap);
  }

  /**
   * Check if a paper has any reading status tracked.
   * 
   * @param paperId Unique identifier for the paper
   * @returns True if the paper has reading status tracked
   */
  hasStatus(paperId: string): boolean {
    return this.statusMap.has(paperId);
  }
}
