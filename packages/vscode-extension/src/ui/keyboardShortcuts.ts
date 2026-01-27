/**
 * Shared keyboard shortcuts and help overlay configuration
 * Used across all immersive modes (writing, editing, claim matching, claim review)
 */

export interface KeyboardShortcut {
  key: string;
  description: string;
  command?: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: KeyboardShortcut[];
}

/**
 * Global shortcuts available in all modes
 */
export const GLOBAL_SHORTCUTS: ShortcutGroup = {
  title: 'NAVIGATION',
  shortcuts: [
    { key: '?', description: 'Toggle help overlay' },
    { key: 'Shift+W', description: 'Switch to writing mode' },
    { key: 'Shift+E', description: 'Switch to editing mode' },
    { key: 'Shift+C', description: 'Switch to claim review mode' },
    { key: 'Esc', description: 'Close current mode' }
  ]
};

/**
 * Writing mode specific shortcuts
 */
export const WRITING_MODE_SHORTCUTS: ShortcutGroup[] = [
  GLOBAL_SHORTCUTS,
  {
    title: 'EDITING',
    shortcuts: [
      { key: 'Ctrl+S', description: 'Save manuscript' },
      { key: 'Ctrl+F', description: 'Find in manuscript' },
      { key: 'Ctrl+H', description: 'Find and replace' }
    ]
  }
];

/**
 * Editing mode specific shortcuts
 */
export const EDITING_MODE_SHORTCUTS: ShortcutGroup[] = [
  GLOBAL_SHORTCUTS,
  {
    title: 'SENTENCE EDITING',
    shortcuts: [
      { key: 'c', description: 'Create claim from sentence' },
      { key: 'x', description: 'Delete claim from sentence' },
      { key: 'Enter', description: 'Open claim in review mode' },
      { key: 'n/p', description: 'Next/previous sentence' },
      { key: 'j/k', description: 'Scroll down/up' },
      { key: 'f', description: 'Find/search' }
    ]
  }
];

/**
 * Claim matching mode specific shortcuts
 */
export const CLAIM_MATCHING_SHORTCUTS: ShortcutGroup[] = [
  GLOBAL_SHORTCUTS,
  {
    title: 'CLAIM MATCHING',
    shortcuts: [
      { key: 'Enter', description: 'Link selected claim' },
      { key: 'c', description: 'Create new claim' },
      { key: 'Arrow keys', description: 'Navigate between cards' }
    ]
  }
];

/**
 * Claim review mode specific shortcuts
 */
export const CLAIM_REVIEW_SHORTCUTS: ShortcutGroup[] = [
  GLOBAL_SHORTCUTS,
  {
    title: 'QUOTE MANAGEMENT',
    shortcuts: [
      { key: 'v', description: 'Verify current quote' },
      { key: 'a', description: 'Accept & replace quote' },
      { key: 'd', description: 'Delete quote' },
      { key: 'f', description: 'Find new quotes' },
      { key: 'i', description: 'Search internet' }
    ]
  },
  {
    title: 'VALIDATION',
    shortcuts: [
      { key: 'Shift+V', description: 'Validate support' },
      { key: 'Shift+M', description: 'Toggle manuscript sidebar' },
      { key: 'n/p', description: 'Next/previous claim' }
    ]
  }
];

/**
 * Get shortcuts for a specific mode
 */
export function getShortcutsForMode(mode: 'writing' | 'editing' | 'matching' | 'review'): ShortcutGroup[] {
  switch (mode) {
    case 'writing':
      return WRITING_MODE_SHORTCUTS;
    case 'editing':
      return EDITING_MODE_SHORTCUTS;
    case 'matching':
      return CLAIM_MATCHING_SHORTCUTS;
    case 'review':
      return CLAIM_REVIEW_SHORTCUTS;
    default:
      return [GLOBAL_SHORTCUTS];
  }
}

/**
 * Generate HTML for help overlay
 */
export function generateHelpOverlayHtml(mode: 'writing' | 'editing' | 'matching' | 'review'): string {
  const shortcuts = getShortcutsForMode(mode);

  const shortcutSections = shortcuts
    .map(
      (group) => `
    <div class="help-section">
      <h3>${group.title}</h3>
      ${group.shortcuts.map((s) => `
      <div class="shortcut">
        <span class="key">${s.key}</span>
        <span class="description">${s.description}</span>
      </div>
      `).join('')}
    </div>
    `
    )
    .join('');

  return `
    <!-- Help overlay -->
    <div id="helpOverlay" class="help-overlay hidden">
      <div class="help-content">
        <h2>KEYBOARD SHORTCUTS</h2>
        ${shortcutSections}
        <p class="help-footer">Click anywhere or press ? to close</p>
      </div>
    </div>
  `;
}

/**
 * Generate CSS for help overlay
 */
export function getHelpOverlayCss(): string {
  return `
    .help-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    .help-overlay.hidden {
      display: none;
    }

    .help-content {
      background-color: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .help-content h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: bold;
      color: #212121;
    }

    .help-section {
      margin-bottom: 16px;
    }

    .help-section h3 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: bold;
      color: #2196F3;
    }

    .shortcut {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .shortcut .key {
      background-color: #f5f5f5;
      border: 1px solid #bdbdbd;
      border-radius: 4px;
      padding: 4px 8px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #212121;
      min-width: 80px;
      text-align: center;
      margin-right: 12px;
    }

    .shortcut .description {
      color: #757575;
      flex: 1;
    }

    .help-footer {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      font-size: 11px;
      color: #9e9e9e;
      text-align: center;
    }
  `;
}

/**
 * Generate JavaScript for help overlay interaction
 */
export function getHelpOverlayJs(): string {
  return `
    (function() {
      const helpOverlay = document.getElementById('helpOverlay');
      const helpBtn = document.getElementById('helpBtn');

      if (!helpOverlay || !helpBtn) return;

      // Toggle help overlay with ? key
      document.addEventListener('keydown', (e) => {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          helpOverlay.classList.toggle('hidden');
        }
      });

      // Close help overlay with Esc key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !helpOverlay.classList.contains('hidden')) {
          helpOverlay.classList.add('hidden');
        }
      });

      // Close help overlay on click
      helpOverlay.addEventListener('click', (e) => {
        if (e.target === helpOverlay) {
          helpOverlay.classList.add('hidden');
        }
      });

      // Toggle help overlay on button click
      helpBtn.addEventListener('click', () => {
        helpOverlay.classList.toggle('hidden');
      });
    })();
  `;
}
