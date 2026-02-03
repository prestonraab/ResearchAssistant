import * as vscode from 'vscode';
import type {
  EditingModeContext,
  WritingModeContext,
  ClaimReviewContext,
  ClaimMatchingContext,
  ModeContextChangeEvent
} from '../types';

/**
 * ModeContextManager - Manages context and data passing between modes
 * Ensures data is not lost when switching between editing, writing, and claim review modes
 */
export class ModeContextManager {
  private static instance: ModeContextManager;
  
  private editingModeContext: EditingModeContext = {};
  private writingModeContext: WritingModeContext = {};
  private claimReviewContext: ClaimReviewContext = {};
  private claimMatchingContext: ClaimMatchingContext = {};
  
  private onContextChangeEmitter = new vscode.EventEmitter<ModeContextChangeEvent>();
  public readonly onContextChange = this.onContextChangeEmitter.event;

  private constructor() {}

  static getInstance(): ModeContextManager {
    if (!ModeContextManager.instance) {
      ModeContextManager.instance = new ModeContextManager();
    }
    return ModeContextManager.instance;
  }

  /**
   * Set editing mode context
   */
  setEditingModeContext(context: EditingModeContext): void {
    this.editingModeContext = { ...this.editingModeContext, ...context };
    this.onContextChangeEmitter.fire({ mode: 'editing', context: this.editingModeContext });
  }

  /**
   * Get editing mode context
   */
  getEditingModeContext(): EditingModeContext {
    return { ...this.editingModeContext };
  }

  /**
   * Set writing mode context
   */
  setWritingModeContext(context: WritingModeContext): void {
    this.writingModeContext = { ...this.writingModeContext, ...context };
    this.onContextChangeEmitter.fire({ mode: 'writing', context: this.writingModeContext });
  }

  /**
   * Get writing mode context
   */
  getWritingModeContext(): WritingModeContext {
    return { ...this.writingModeContext };
  }

  /**
   * Set claim review context
   */
  setClaimReviewContext(context: ClaimReviewContext): void {
    this.claimReviewContext = { ...this.claimReviewContext, ...context };
    this.onContextChangeEmitter.fire({ mode: 'claimReview', context: this.claimReviewContext });
  }

  /**
   * Get claim review context
   */
  getClaimReviewContext(): ClaimReviewContext {
    return { ...this.claimReviewContext };
  }

  /**
   * Set claim matching context
   */
  setClaimMatchingContext(context: ClaimMatchingContext): void {
    this.claimMatchingContext = { ...this.claimMatchingContext, ...context };
    this.onContextChangeEmitter.fire({ mode: 'claimMatching', context: this.claimMatchingContext });
  }

  /**
   * Get claim matching context
   */
  getClaimMatchingContext(): ClaimMatchingContext {
    return { ...this.claimMatchingContext };
  }

  /**
   * Clear all contexts
   */
  clearAll(): void {
    this.editingModeContext = {};
    this.writingModeContext = {};
    this.claimReviewContext = {};
    this.claimMatchingContext = {};
  }

  /**
   * Clear specific mode context
   */
  clearModeContext(mode: 'editing' | 'writing' | 'claimReview' | 'claimMatching'): void {
    switch (mode) {
      case 'editing':
        this.editingModeContext = {};
        break;
      case 'writing':
        this.writingModeContext = {};
        break;
      case 'claimReview':
        // Preserve returnToSentenceId when clearing claim review context
        const returnToSentenceId = this.claimReviewContext.returnToSentenceId;
        this.claimReviewContext = {};
        if (returnToSentenceId) {
          this.claimReviewContext.returnToSentenceId = returnToSentenceId;
        }
        break;
      case 'claimMatching':
        this.claimMatchingContext = {};
        break;
    }
  }
}

export function getModeContextManager(): ModeContextManager {
  return ModeContextManager.getInstance();
}
