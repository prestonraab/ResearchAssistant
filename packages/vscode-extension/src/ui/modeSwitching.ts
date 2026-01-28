/**
 * Mode switching and state preservation utilities
 * Handles switching between modes while preserving scroll position and current item
 */

export interface ModeState {
  mode: 'writing' | 'editing' | 'matching' | 'review';
  scrollPosition: number;
  currentItemId?: string;
  currentItemType?: 'sentence' | 'claim' | 'section';
  timestamp: number;
}

/**
 * Global state storage for mode switching
 */
class ModeStateManager {
  private states: Map<string, ModeState> = new Map();
  private currentMode: 'writing' | 'editing' | 'matching' | 'review' = 'writing';

  /**
   * Save state for a mode
   */
  saveState(
    mode: 'writing' | 'editing' | 'matching' | 'review',
    scrollPosition: number,
    currentItemId?: string,
    currentItemType?: 'sentence' | 'claim' | 'section'
  ): void {
    this.states.set(mode, {
      mode,
      scrollPosition,
      currentItemId,
      currentItemType,
      timestamp: Date.now()
    });
  }

  /**
   * Get state for a mode
   */
  getState(mode: 'writing' | 'editing' | 'matching' | 'review'): ModeState | undefined {
    return this.states.get(mode);
  }

  /**
   * Set current mode
   */
  setCurrentMode(mode: 'writing' | 'editing' | 'matching' | 'review'): void {
    this.currentMode = mode;
  }

  /**
   * Get current mode
   */
  getCurrentMode(): 'writing' | 'editing' | 'matching' | 'review' {
    return this.currentMode;
  }

  /**
   * Clear all states
   */
  clearStates(): void {
    this.states.clear();
  }
}

// Global instance
export const modeStateManager = new ModeStateManager();

/**
 * Generate breadcrumb HTML for mode navigation
 */
export function generateBreadcrumb(
  mode: 'writing' | 'editing' | 'matching' | 'review',
  currentSection?: string,
  currentSentence?: string
): string {
  const modeLabel = {
    writing: 'Writing',
    editing: 'Editing',
    matching: 'Claim Matching',
    review: 'Claim Review'
  }[mode];

  let breadcrumb = `<span class="breadcrumb-item">${modeLabel}</span>`;

  if (currentSection) {
    breadcrumb += ` > <span class="breadcrumb-item">${currentSection}</span>`;
  }

  if (currentSentence) {
    const truncated = currentSentence.length > 50 ? currentSentence.substring(0, 50) + '...' : currentSentence;
    breadcrumb += ` > <span class="breadcrumb-item">${truncated}</span>`;
  }

  return breadcrumb;
}

/**
 * Generate CSS for breadcrumb and mode indicator
 */
export function getBreadcrumbCss(): string {
  return `
    .breadcrumb {
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #757575;
      padding: 8px 12px;
      background-color: #fafafa;
      border-bottom: 1px solid #e0e0e0;
      overflow-x: auto;
    }

    .breadcrumb-item {
      white-space: nowrap;
      color: #2196F3;
      cursor: pointer;
    }

    .breadcrumb-item:hover {
      text-decoration: underline;
    }

    .mode-indicator {
      display: inline-block;
      background-color: #2196F3;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      margin-right: 8px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background-color: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }

    .title {
      font-size: 14px;
      font-weight: bold;
      color: #212121;
      flex: 1;
    }

    .controls {
      display: flex;
      gap: 8px;
    }

    .icon-btn {
      background: none;
      border: 1px solid #bdbdbd;
      border-radius: 4px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 14px;
      color: #424242;
      transition: all 0.2s;
    }

    .icon-btn:hover {
      background-color: #e0e0e0;
      border-color: #9e9e9e;
    }

    .icon-btn:active {
      background-color: #bdbdbd;
    }
  `;
}

/**
 * Generate JavaScript for mode switching
 */
export function getModeSwitchingJs(): string {
  return `
    (function() {
      // Mode switching is handled by VS Code keybindings (Cmd/Ctrl+Alt+W/E/R)
      // No keyboard shortcuts in webview to avoid conflicts with typing

      // Handle Esc to close mode
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          vscode.postMessage({ type: 'closeMode' });
        }
      });

      // Save scroll position before switching modes
      window.addEventListener('beforeunload', () => {
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        vscode.postMessage({
          type: 'saveScrollPosition',
          position: scrollPosition
        });
      });

      // Restore scroll position on load
      window.addEventListener('load', () => {
        const savedPosition = sessionStorage.getItem('scrollPosition');
        if (savedPosition) {
          window.scrollTo(0, parseInt(savedPosition));
          sessionStorage.removeItem('scrollPosition');
        }
      });
    })();
  `;
}

/**
 * Generate HTML for mode indicator in header
 */
export function generateModeIndicator(mode: 'writing' | 'editing' | 'matching' | 'review'): string {
  const modeLabel = {
    writing: 'Writing',
    editing: 'Editing',
    matching: 'Matching',
    review: 'Review'
  }[mode];

  return `<span class="mode-indicator">${modeLabel}</span>`;
}
