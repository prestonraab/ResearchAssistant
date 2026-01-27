/**
 * WritingModeManager - Manages writing mode state
 * Handles outline-manuscript synchronization and scroll position
 */

export interface WritingModeState {
  currentSection?: string;
  scrollPosition: number;
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
      scrollPosition: 0,
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
   * Save scroll position
   */
  saveScrollPosition(position: number): void {
    if (this.state) {
      this.state.scrollPosition = position;
      this.state.lastUpdated = new Date();
    }
  }

  /**
   * Get saved scroll position
   */
  getScrollPosition(): number {
    return this.state?.scrollPosition ?? 0;
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
