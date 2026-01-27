// Writing Mode JavaScript

const vscode = acquireVsCodeApi();

// State
let state = {
  outline: [],
  manuscript: '',
  currentSection: null,
  scrollPosition: 0,
  isDirty: false,
  autoSaveTimer: null
};

// DOM elements
const outlineTree = document.getElementById('outlineTree');
const manuscriptEditor = document.getElementById('manuscriptEditor');
const helpOverlay = document.getElementById('helpOverlay');
const helpBtn = document.getElementById('helpBtn');
const editBtn = document.getElementById('editBtn');
const exportMarkdownBtn = document.getElementById('exportMarkdownBtn');
const exportWordBtn = document.getElementById('exportWordBtn');
const saveStatus = document.getElementById('saveStatus');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupKeyboardShortcuts();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Manuscript editor
  manuscriptEditor.addEventListener('input', () => {
    state.isDirty = true;
    updateSaveStatus('Unsaved');
    scheduleAutoSave();
  });

  manuscriptEditor.addEventListener('scroll', () => {
    state.scrollPosition = manuscriptEditor.scrollTop;
    vscode.postMessage({
      type: 'saveScrollPosition',
      position: state.scrollPosition
    });
  });

  // Help button
  helpBtn.addEventListener('click', toggleHelpOverlay);

  // Edit button
  editBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'switchToEditingMode' });
  });

  // Export buttons
  if (exportMarkdownBtn) {
    exportMarkdownBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportMarkdown' });
    });
  }

  if (exportWordBtn) {
    exportWordBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportWord' });
    });
  }

  // Help overlay
  helpOverlay.addEventListener('click', (e) => {
    if (e.target === helpOverlay) {
      toggleHelpOverlay();
    }
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Shift+E - Edit mode
    if (e.shiftKey && e.key === 'E') {
      e.preventDefault();
      vscode.postMessage({ type: 'switchToEditingMode' });
      return;
    }

    // Shift+C - Claim review mode
    if (e.shiftKey && e.key === 'C') {
      e.preventDefault();
      vscode.postMessage({ type: 'switchToClaimReview' });
      return;
    }

    // Shift+W - Already in writing mode
    if (e.shiftKey && e.key === 'W') {
      e.preventDefault();
      return;
    }

    // Esc - Close writing mode
    if (e.key === 'Escape') {
      e.preventDefault();
      // Could close the webview or return to previous view
      return;
    }

    // ? - Help overlay
    if (e.key === '?') {
      e.preventDefault();
      toggleHelpOverlay();
      return;
    }

    // Ctrl+S - Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveManuscript();
      return;
    }

    // Ctrl+F - Find (let VS Code handle this)
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      // Could implement find UI here
      return;
    }

    // Ctrl+H - Find and replace (let VS Code handle this)
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault();
      // Could implement find and replace UI here
      return;
    }
  });
}

/**
 * Handle messages from extension
 */
window.addEventListener('message', (event) => {
  const message = event.data;

  switch (message.type) {
    case 'initialize':
      initializeUI(message);
      break;

    case 'saved':
      updateSaveStatus('Saved');
      state.isDirty = false;
      break;

    case 'showHelp':
      toggleHelpOverlay();
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
});

/**
 * Initialize UI with outline and manuscript
 */
function initializeUI(message) {
  state.outline = message.outline;
  state.manuscript = message.manuscript;
  state.currentSection = message.currentSection;
  state.scrollPosition = message.scrollPosition;

  // Render outline tree
  renderOutlineTree(state.outline);

  // Load manuscript
  manuscriptEditor.value = state.manuscript;
  manuscriptEditor.scrollTop = state.scrollPosition;

  updateSaveStatus('Saved');
}

/**
 * Render outline tree
 */
function renderOutlineTree(items, parentElement = null) {
  const container = parentElement || outlineTree;

  for (const item of items) {
    const itemElement = createOutlineItem(item);
    container.appendChild(itemElement);

    if (item.children && item.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'outline-children';
      childrenContainer.style.display = 'block';
      container.appendChild(childrenContainer);

      renderOutlineTree(item.children, childrenContainer);
    }
  }
}

/**
 * Create outline item element
 */
function createOutlineItem(item) {
  const itemElement = document.createElement('div');
  itemElement.className = `outline-item outline-item-level-${item.level}`;
  itemElement.dataset.sectionId = item.id;

  // Toggle button
  const toggleBtn = document.createElement('div');
  toggleBtn.className = 'outline-item-toggle';
  if (item.children && item.children.length > 0) {
    toggleBtn.classList.add('expanded');
  } else {
    toggleBtn.classList.add('no-children');
  }
  itemElement.appendChild(toggleBtn);

  // Text
  const textSpan = document.createElement('span');
  textSpan.className = 'outline-item-text';
  textSpan.textContent = item.title;
  itemElement.appendChild(textSpan);

  // Click handler
  itemElement.addEventListener('click', (e) => {
    e.stopPropagation();

    // Toggle children visibility
    if (item.children && item.children.length > 0) {
      const nextElement = itemElement.nextElementSibling;
      if (nextElement && nextElement.classList.contains('outline-children')) {
        const isVisible = nextElement.style.display !== 'none';
        nextElement.style.display = isVisible ? 'none' : 'block';
        toggleBtn.classList.toggle('expanded');
        toggleBtn.classList.toggle('collapsed');
      }
    }

    // Set current section
    setCurrentSection(item.id);
  });

  // Highlight if current section
  if (item.id === state.currentSection) {
    itemElement.classList.add('active');
  }

  return itemElement;
}

/**
 * Set current section
 */
function setCurrentSection(sectionId) {
  // Remove active class from all items
  document.querySelectorAll('.outline-item.active').forEach(item => {
    item.classList.remove('active');
  });

  // Add active class to selected item
  const selectedItem = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (selectedItem) {
    selectedItem.classList.add('active');
    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Update state
  state.currentSection = sectionId;

  // Notify extension
  vscode.postMessage({
    type: 'setCurrentSection',
    sectionId: sectionId
  });
}

/**
 * Schedule auto-save
 */
function scheduleAutoSave() {
  if (state.autoSaveTimer) {
    clearTimeout(state.autoSaveTimer);
  }

  state.autoSaveTimer = setTimeout(() => {
    saveManuscript();
  }, 2000); // Auto-save after 2 seconds of inactivity
}

/**
 * Save manuscript
 */
function saveManuscript() {
  if (!state.isDirty) {
    return;
  }

  updateSaveStatus('Saving...');

  vscode.postMessage({
    type: 'saveManuscript',
    content: manuscriptEditor.value
  });
}

/**
 * Update save status
 */
function updateSaveStatus(status) {
  saveStatus.textContent = status;

  if (status === 'Saving...') {
    saveStatus.parentElement.classList.add('saving');
  } else {
    saveStatus.parentElement.classList.remove('saving');
  }
}

/**
 * Toggle help overlay
 */
function toggleHelpOverlay() {
  helpOverlay.classList.toggle('hidden');
}
