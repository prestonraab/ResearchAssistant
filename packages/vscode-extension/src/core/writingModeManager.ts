/**
 * WritingModeManager - Manages writing mode state
 * Handles outline-manuscript synchronization and center item tracking
 */

export interface WritingModeState {
  currentSection?: string;
  centerItemId?: string; // ID of the pair to center on screen
  centerItemPosition?: number; // Line position for cross-mode navigation
  manuscriptPath: string;
  outlinePath: string;
  lastUpdated: Date;
}

export class WritingModeManager {
  private state: WritingModeState | null = null;

  /**
   * Initialize writing mode state
   */
  initializeState(manuscriptPath: string, outlinePath: string): WritingModeState {
    this.state = {
      manuscriptPath,
      outlinePath,
      lastUpdated: new Date()
    };
    return this.state;
  }

  /**
   * Get current state
   */
  getState(): WritingModeState | null {
    return this.state;
  }

  /**
   * Set current section
   */
  setCurrentSection(sectionId: string): void {
    if (this.state) {
      this.state.currentSection = sectionId;
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Get current section
   */
  getCurrentSection(): string | undefined {
    return this.state?.currentSection;
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
