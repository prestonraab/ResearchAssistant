/**
 * EditingModeManager - Manages editing mode state
 * Handles sentence-claim UI state and center item tracking
 */

export interface EditingModeState {
  currentSentenceId?: string;
  currentClaimId?: string;
  centerItemId?: string; // ID of the item to center on screen
  centerItemPosition?: number; // Line position for cross-mode navigation
  expandedClaims: Set<string>; // Sentence IDs with expanded claim lists
  selectedSentences: Set<string>; // For multi-select operations
  lastUpdated: Date;
}

export class EditingModeManager {
  private state: EditingModeState | null = null;

  /**
   * Initialize editing mode state
   */
  initializeState(): EditingModeState {
    this.state = {
      expandedClaims: new Set(),
      selectedSentences: new Set(),
      lastUpdated: new Date()
    };
    return this.state;
  }

  /**
   * Get current state
   */
  getState(): EditingModeState | null {
    return this.state;
  }

  /**
   * Set current sentence
   */
  setCurrentSentence(sentenceId: string): void {
    if (this.state) {
      this.state.currentSentenceId = sentenceId;
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Get current sentence
   */
  getCurrentSentence(): string | undefined {
    return this.state?.currentSentenceId;
  }

  /**
   * Set current claim
   */
  setCurrentClaim(claimId: string): void {
    if (this.state) {
      this.state.currentClaimId = claimId;
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Get current claim
   */
  getCurrentClaim(): string | undefined {
    return this.state?.currentClaimId;
  }

  /**
   * Toggle claim expansion for a sentence
   */
  toggleClaimExpansion(sentenceId: string): void {
    if (this.state) {
      if (this.state.expandedClaims.has(sentenceId)) {
        this.state.expandedClaims.delete(sentenceId);
      } else {
        this.state.expandedClaims.add(sentenceId);
      }
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Check if claims are expanded for a sentence
   */
  isClaimExpanded(sentenceId: string): boolean {
    return this.state?.expandedClaims.has(sentenceId) ?? false;
  }

  /**
   * Expand all claims
   */
  expandAllClaims(): void {
    if (this.state) {
      // This would be called with all sentence IDs
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Collapse all claims
   */
  collapseAllClaims(): void {
    if (this.state) {
      this.state.expandedClaims.clear();
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Add sentence to selection
   */
  selectSentence(sentenceId: string): void {
    if (this.state) {
      this.state.selectedSentences.add(sentenceId);
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Remove sentence from selection
   */
  deselectSentence(sentenceId: string): void {
    if (this.state) {
      this.state.selectedSentences.delete(sentenceId);
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Toggle sentence selection
   */
  toggleSentenceSelection(sentenceId: string): void {
    if (this.state) {
      if (this.state.selectedSentences.has(sentenceId)) {
        this.state.selectedSentences.delete(sentenceId);
      } else {
        this.state.selectedSentences.add(sentenceId);
      }
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Get selected sentences
   */
  getSelectedSentences(): string[] {
    return this.state ? Array.from(this.state.selectedSentences) : [];
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    if (this.state) {
      this.state.selectedSentences.clear();
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Save center item ID and position
   */
  saveCenterItemId(itemId: string, position?: number): void {
    if (this.state) {
      this.state.centerItemId = itemId;
      this.state.centerItemPosition = position;
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Get saved center item ID
   */
  getCenterItemId(): string | undefined {
    return this.state?.centerItemId;
  }

  /**
   * Get saved center item position
   */
  getCenterItemPosition(): number | undefined {
    return this.state?.centerItemPosition;
  }

  /**
   * Clear state
   */
  clearState(): void {
    this.state = null;
  }

  /**
   * Check if state is initialized
   */
  isInitialized(): boolean {
    return this.state !== null;
  }
}
