// Writing Mode JavaScript
// Note: vscode is declared in the HTML inline script

// State
let state = {
  pairs: [],
  isDirty: false,
  autoSaveTimer: null,
  centerItemId: null,
  scrollTimeout: null,
  itemHeights: new Map(), // Cache of measured item heights by ID
  undoStack: [], // Stack of previous states for undo
  maxUndoSteps: 20 // Maximum number of undo steps to keep
};

// Virtual scrolling configuration
const ESTIMATED_ITEM_HEIGHT = 150; // Initial estimate for Q&A pairs
const BUFFER_SIZE = 3;

// DOM elements
const pairsList = document.getElementById('pairsList');
const helpBtn = document.getElementById('helpBtn');
const editBtn = document.getElementById('editBtn');
const exportMarkdownBtn = document.getElementById('exportMarkdownBtn');
const exportWordBtn = document.getElementById('exportWordBtn');
const saveStatus = document.getElementById('saveStatus');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Help button
  if (helpBtn) {
    helpBtn.addEventListener('click', toggleHelpOverlay);
  }

  // Edit button
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'switchToEditingMode' });
    });
  }

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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+? - Help overlay
    if ((e.ctrlKey || e.metaKey) && e.key === '?') {
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

    // Ctrl+Z - Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
  });

  // Save center item on scroll with debounce
  const content = document.querySelector('.content');
  if (content) {
    content.addEventListener('scroll', () => {
      if (state.scrollTimeout) {
        clearTimeout(state.scrollTimeout);
      }

      // Measure actual heights of visible pair rows
      requestAnimationFrame(() => {
        const pairRows = document.querySelectorAll('.pair-row');
        pairRows.forEach(row => {
          const pairId = row.dataset.pairId;
          const actualHeight = row.offsetHeight;
          state.itemHeights.set(pairId, actualHeight);
        });
      });

      state.scrollTimeout = setTimeout(() => {
        const currentCenterItem = getCenterItem();
        if (currentCenterItem && currentCenterItem.id !== state.centerItemId) {
          state.centerItemId = currentCenterItem.id;
          vscode.postMessage({ 
            type: 'saveCenterItem', 
            itemId: state.centerItemId,
            position: currentCenterItem.position
          });
        }
      }, 500);
    });
  }
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

    case 'pairAdded':
      addNewPair(message.section);
      break;

    case 'pairDeleted':
      deletePair(message.pairId);
      break;

    case 'error':
      showErrorNotification(message.message, message.pairId);
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
});

/**
 * Initialize UI with question-answer pairs
 */
function initializeUI(message) {
  console.log('[WritingMode WebView] Received initialize message:', {
    pairCount: message.pairs?.length || 0,
    centerItemId: message.centerItemId
  });
  
  state.pairs = message.pairs || [];
  state.centerItemId = message.centerItemId || null;
  
  console.log('[WritingMode WebView] Pairs array:', state.pairs.length);
  
  renderPairs();
  
  // Restore scroll to center item after rendering is complete
  if (state.centerItemId) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToCenterItem(state.centerItemId);
      });
    });
  }
  
  updateSaveStatus('Saved');
}

/**
 * Render all question-answer pairs
 */
function renderPairs() {
  if (!pairsList) return;
  
  console.log('[WritingMode] renderPairs called, pairs:', state.pairs.length);
  
  if (state.pairs.length === 0) {
    pairsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-text">No questions found</div>
        <div class="empty-state-hint">Click + to add a question</div>
      </div>
    `;
    return;
  }

  // Log first pair to see structure
  if (state.pairs.length > 0) {
    console.log('[WritingMode] First pair structure:', {
      keys: Object.keys(state.pairs[0]),
      sample: state.pairs[0]
    });
  }

  // Group pairs by section and render with section headers
  let html = '';
  let currentSection = null;
  
  state.pairs.forEach((pair, index) => {
    // Add insert zone before first item
    if (index === 0) {
      html += renderInsertZone(-1);
    }
    
    // Add section header if this is a new section
    if (pair.section !== currentSection) {
      currentSection = pair.section;
      html += renderSectionHeader(pair.section, index);
    }
    
    html += renderPair(pair);
    
    // Add insert zone after each pair
    html += renderInsertZone(index);
  });
  
  pairsList.innerHTML = html;
  
  console.log('[WritingMode] Rendered HTML length:', pairsList.innerHTML.length);
  
  // Measure actual heights of rendered pair rows
  requestAnimationFrame(() => {
    const pairRows = document.querySelectorAll('.pair-row');
    pairRows.forEach(row => {
      const pairId = row.dataset.pairId;
      const actualHeight = row.offsetHeight;
      state.itemHeights.set(pairId, actualHeight);
    });
  });
  
  // Attach event listeners
  attachPairListeners();
}

/**
 * Render a section header
 */
function renderSectionHeader(sectionName, firstPairIndex) {
  return `
    <div class="section-header" data-section="${escapeHtml(sectionName)}" data-first-pair-index="${firstPairIndex}">
      <h2 class="section-title" contenteditable="true">${escapeHtml(sectionName)}</h2>
    </div>
  `;
}

/**
 * Render an insert zone between items
 */
function renderInsertZone(afterIndex) {
  return `
    <div class="insert-zone" data-after-index="${afterIndex}">
      <div class="insert-zone-left">
        <button class="insert-zone-btn insert-section-btn" data-after-index="${afterIndex}">+ Section</button>
      </div>
      <div class="insert-zone-center">
        <button class="insert-zone-btn insert-pair-btn" data-after-index="${afterIndex}">+ Question</button>
      </div>
      <div class="insert-zone-right"></div>
    </div>
  `;
}

/**
 * Render a single question-answer pair
 */
function renderPair(pair) {
  console.log('[WritingMode] Rendering pair:', {
    id: pair.id,
    question: pair.question?.substring(0, 50),
    answerLength: pair.answer?.length || 0,
    status: pair.status,
    claimCount: pair.claims?.length || 0,
    linkedSourcesCount: pair.linkedSources?.length || 0
  });
  
  const status = pair.status || 'DRAFT';
  const statusClass = status.toLowerCase().replace(/\s+/g, '-');
  
  // Condense claims into single row
  const claimsDisplay = pair.claims && pair.claims.length > 0
    ? pair.claims.map(c => `<span class="claim-badge" data-claim-id="${escapeHtml(c)}">${escapeHtml(c)}</span>`).join('')
    : '';

  // Count cited sources
  const citedCount = (pair.linkedSources || []).filter(s => s.cited).length;
  const citationBadge = citedCount > 0 
    ? `<span class="citation-badge">${citedCount}</span>`
    : '';

  // Render citation sidebar
  const citationSidebarHtml = renderCitationSidebar(pair);

  return `
    <div class="pair-wrapper" data-pair-id="${pair.id}">
      <!-- Three-column content row -->
      <div class="pair-row" data-pair-id="${pair.id}">
        <!-- Left column: Question -->
        <div class="left-column">
          <div class="question-text" contenteditable="true" data-pair-id="${pair.id}">
            ${escapeHtml(pair.question)}
          </div>
        </div>
        
        <!-- Middle column: Answer and Citations -->
        <div class="middle-column">
          <textarea 
            class="answer-editor" 
            data-pair-id="${pair.id}"
            placeholder="Write your answer here..."
          >${escapeHtml(pair.answer || '')}</textarea>
          
          <!-- Citations section (expandable within middle column) -->
          <div class="citations-section" data-pair-id="${pair.id}" style="display: none;">
            ${citationSidebarHtml}
          </div>
        </div>
        
        <!-- Right column: Metadata -->
        <div class="right-column">
          <div class="pair-header">
            ${claimsDisplay ? `<div class="claims-badges">${claimsDisplay}</div>` : ''}
            <div class="action-row">
              <select class="status-dropdown" data-pair-id="${pair.id}">
                <option value="DRAFT" ${status === 'DRAFT' ? 'selected' : ''}>Draft</option>
                <option value="RESEARCH" ${status === 'RESEARCH' || status === 'RESEARCH NEEDED' ? 'selected' : ''}>Research</option>
                <option value="PARTIAL" ${status === 'PARTIAL' ? 'selected' : ''}>Partial</option>
                <option value="ANSWERED" ${status === 'ANSWERED' ? 'selected' : ''}>Answered</option>
              </select>
              <button class="citations-toggle-btn" data-pair-id="${pair.id}" title="Toggle citations">📌${citationBadge}</button>
              <button class="delete-btn" data-pair-id="${pair.id}" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render citation sidebar for a pair
 */
function renderCitationSidebar(pair) {
  const linkedSources = pair.linkedSources || [];
  
  if (linkedSources.length === 0) {
    return `
      <div class="citation-sidebar">
        <div class="citation-sidebar-label">Citations</div>
        <div class="citation-empty">No linked sources</div>
      </div>
    `;
  }

  const citationItemsHtml = linkedSources.map((source, index) => {
    const isChecked = source.cited ? 'checked' : '';
    const quoteText = escapeHtml(source.quote || '');
    
    return `
      <div class="citation-item" data-pair-id="${pair.id}" data-source-index="${index}">
        <input 
          type="checkbox" 
          class="citation-checkbox" 
          ${isChecked}
          data-pair-id="${pair.id}"
          data-source-index="${index}"
          title="Mark this source as cited"
        />
        <div class="citation-source">
          <div class="citation-source-title">${escapeHtml(source.title || 'Unknown')}</div>
          <div class="citation-source-meta">${escapeHtml(source.source || 'Unknown source')}</div>
          <div class="citation-quote-text">${quoteText}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="citation-sidebar">
      <div class="citation-sidebar-label">Citations (${linkedSources.length})</div>
      <div class="citation-items-grid">
        ${citationItemsHtml}
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to pairs
 */
function attachPairListeners() {
  // Answer editors - with auto-expand
  document.querySelectorAll('.answer-editor').forEach(editor => {
    editor.addEventListener('input', (e) => {
      const pairId = e.target.dataset.pairId;
      updatePairAnswer(pairId, e.target.value);
      
      // Auto-expand textarea
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 600) + 'px';
    });
    
    // Initial height calculation
    editor.style.height = 'auto';
    editor.style.height = Math.min(editor.scrollHeight, 600) + 'px';
  });

  // Question editors
  document.querySelectorAll('.question-text').forEach(editor => {
    editor.addEventListener('input', (e) => {
      const pairId = e.target.dataset.pairId;
      updatePairQuestion(pairId, e.target.textContent);
    });
  });

  // Section title editors
  document.querySelectorAll('.section-title').forEach(editor => {
    editor.addEventListener('input', (e) => {
      const sectionHeader = e.target.closest('.section-header');
      const oldSectionName = sectionHeader.dataset.section;
      const newSectionName = e.target.textContent.trim();
      
      // If empty, mark for deletion
      if (newSectionName === '') {
        e.target.style.opacity = '0.5';
      } else {
        e.target.style.opacity = '1';
      }
    });
    
    editor.addEventListener('blur', (e) => {
      const sectionHeader = e.target.closest('.section-header');
      const oldSectionName = sectionHeader.dataset.section;
      const newSectionName = e.target.textContent.trim();
      
      // If empty, remove the section (merge with previous or next section)
      if (newSectionName === '') {
        removeSectionHeader(sectionHeader);
      } else if (newSectionName !== oldSectionName) {
        updateSectionName(oldSectionName, newSectionName);
      }
    });
  });

  // Claim badges
  document.querySelectorAll('.claim-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      const claimId = e.target.dataset.claimId;
      if (claimId) {
        vscode.postMessage({
          type: 'openClaim',
          claimId: claimId
        });
      }
    });
    // Make claim badges look clickable
    badge.style.cursor = 'pointer';
  });

  // Delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pairId = e.currentTarget.dataset.pairId;
      console.log('[WritingMode] Delete button clicked for pair:', pairId);
      if (pairId) {
        deletePair(pairId);
      }
    });
  });

  // Citations toggle buttons
  document.querySelectorAll('.citations-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pairId = e.currentTarget.dataset.pairId;
      toggleCitationsSection(pairId);
    });
  });

  // Citation checkboxes
  document.querySelectorAll('.citation-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const pairId = e.target.dataset.pairId;
      const sourceIndex = parseInt(e.target.dataset.sourceIndex);
      const isChecked = e.target.checked;
      
      // Update local state
      const pair = state.pairs.find(p => p.id === pairId);
      if (pair && pair.linkedSources && pair.linkedSources[sourceIndex]) {
        pair.linkedSources[sourceIndex].cited = isChecked;
        state.isDirty = true;
        scheduleAutoSave();
      }

      // Notify extension
      vscode.postMessage({
        type: 'citationToggled',
        pairId,
        sourceIndex,
        cited: isChecked
      });
    });
  });

  // Insert zone buttons
  document.querySelectorAll('.insert-pair-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const afterIndex = parseInt(e.target.dataset.afterIndex);
      insertPairAfter(afterIndex);
    });
  });

  document.querySelectorAll('.insert-section-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const afterIndex = parseInt(e.target.dataset.afterIndex);
      insertSectionAfter(afterIndex);
    });
  });

  // Status dropdowns
  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', (e) => {
      const pairId = e.target.dataset.pairId;
      const newStatus = e.target.value;
      updatePairStatus(pairId, newStatus);
    });
  });
}

/**
 * Toggle citations section visibility for a pair
 */
function toggleCitationsSection(pairId) {
  const section = document.querySelector(`.citations-section[data-pair-id="${pairId}"]`);
  if (section) {
    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
  }
}

/**
 * Update pair answer
 */
function updatePairAnswer(pairId, answer) {
  const pair = state.pairs.find(p => p.id === pairId);
  if (pair) {
    pair.answer = answer;
    state.isDirty = true;
    updateSaveStatus('Unsaved');
    scheduleAutoSave();
  }
}

/**
 * Update pair question
 */
function updatePairQuestion(pairId, question) {
  const pair = state.pairs.find(p => p.id === pairId);
  if (pair) {
    pair.question = question;
    state.isDirty = true;
    updateSaveStatus('Unsaved');
    scheduleAutoSave();
  }
}

/**
 * Update pair status
 */
function updatePairStatus(pairId, status) {
  const pair = state.pairs.find(p => p.id === pairId);
  if (pair) {
    pair.status = status;
    state.isDirty = true;
    updateSaveStatus('Unsaved');
    scheduleAutoSave();
  }
}

/**
 * Add new pair
 */
function addNewPair(section) {
  saveStateToUndo();
  
  const newPair = {
    id: `QA_${Date.now()}`,
    question: 'New question?',
    status: 'DRAFT',
    answer: '',
    claims: [],
    section: section || 'New Section',
    position: state.pairs.length
  };
  
  state.pairs.push(newPair);
  renderPairs();
  state.isDirty = true;
  scheduleAutoSave();
}

/**
 * Insert a new pair after a specific index
 */
function insertPairAfter(afterIndex) {
  saveStateToUndo();
  
  // Determine section for new pair
  let section = 'New Section';
  if (afterIndex >= 0 && afterIndex < state.pairs.length) {
    section = state.pairs[afterIndex].section;
  } else if (afterIndex === -1 && state.pairs.length > 0) {
    section = state.pairs[0].section;
  }
  
  const newPair = {
    id: `QA_${Date.now()}`,
    question: 'New question?',
    status: 'DRAFT',
    answer: '',
    claims: [],
    linkedSources: [],
    section: section,
    position: afterIndex + 1
  };
  
  // Insert at the correct position
  state.pairs.splice(afterIndex + 1, 0, newPair);
  
  // Update positions
  state.pairs.forEach((pair, index) => {
    pair.position = index;
  });
  
  renderPairs();
  state.isDirty = true;
  scheduleAutoSave();
  
  // Focus on the new question
  requestAnimationFrame(() => {
    const newQuestionElement = document.querySelector(`.question-text[data-pair-id="${newPair.id}"]`);
    if (newQuestionElement) {
      newQuestionElement.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(newQuestionElement);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}

/**
 * Insert a new section after a specific index
 */
function insertSectionAfter(afterIndex) {
  saveStateToUndo();
  
  const newSectionName = 'New Section';
  
  const newPair = {
    id: `QA_${Date.now()}`,
    question: 'New question?',
    status: 'DRAFT',
    answer: '',
    claims: [],
    linkedSources: [],
    section: newSectionName,
    position: afterIndex + 1
  };
  
  // Insert at the correct position
  state.pairs.splice(afterIndex + 1, 0, newPair);
  
  // Update positions
  state.pairs.forEach((pair, index) => {
    pair.position = index;
  });
  
  renderPairs();
  state.isDirty = true;
  scheduleAutoSave();
  
  // Focus on the new section title
  requestAnimationFrame(() => {
    const sectionHeaders = document.querySelectorAll('.section-header');
    for (const header of sectionHeaders) {
      const sectionTitle = header.querySelector('.section-title');
      if (sectionTitle && sectionTitle.textContent === newSectionName) {
        sectionTitle.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(sectionTitle);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        break;
      }
    }
  });
}

/**
 * Update section name for all pairs in that section
 */
function updateSectionName(oldName, newName) {
  saveStateToUndo();
  
  let updated = false;
  state.pairs.forEach(pair => {
    if (pair.section === oldName) {
      pair.section = newName;
      updated = true;
    }
  });
  
  if (updated) {
    state.isDirty = true;
    scheduleAutoSave();
    // Re-render to update section headers
    renderPairs();
  }
}

/**
 * Remove a section header by merging its pairs with adjacent section
 */
function removeSectionHeader(sectionHeader) {
  saveStateToUndo();
  
  const sectionName = sectionHeader.dataset.section;
  const firstPairIndex = parseInt(sectionHeader.dataset.firstPairIndex);
  
  // Find the section to merge into (previous section if exists, otherwise next)
  let targetSection = 'Untitled';
  
  // Look for previous pair's section
  if (firstPairIndex > 0) {
    targetSection = state.pairs[firstPairIndex - 1].section;
  } else if (firstPairIndex < state.pairs.length - 1) {
    // Look for next different section
    for (let i = firstPairIndex; i < state.pairs.length; i++) {
      if (state.pairs[i].section !== sectionName) {
        targetSection = state.pairs[i].section;
        break;
      }
    }
  }
  
  // Update all pairs in the removed section
  state.pairs.forEach(pair => {
    if (pair.section === sectionName) {
      pair.section = targetSection;
    }
  });
  
  state.isDirty = true;
  scheduleAutoSave();
  renderPairs();
}

/**
 * Save current state to undo stack
 */
function saveStateToUndo() {
  // Deep clone the current pairs array
  const stateCopy = JSON.parse(JSON.stringify(state.pairs));
  state.undoStack.push(stateCopy);
  
  // Limit undo stack size
  if (state.undoStack.length > state.maxUndoSteps) {
    state.undoStack.shift();
  }
  
  console.log('[WritingMode] Saved state to undo stack. Stack size:', state.undoStack.length);
}

/**
 * Undo last action
 */
function undo() {
  if (state.undoStack.length === 0) {
    console.log('[WritingMode] Nothing to undo');
    showTemporaryNotification('Nothing to undo', 'info');
    return;
  }
  
  // Pop the last state from the stack
  const previousState = state.undoStack.pop();
  state.pairs = previousState;
  
  console.log('[WritingMode] Undo performed. Stack size:', state.undoStack.length);
  
  renderPairs();
  state.isDirty = true;
  scheduleAutoSave();
  
  showTemporaryNotification('Undo successful', 'success');
}

/**
 * Show temporary notification
 */
function showTemporaryNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `temp-notification temp-notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Fade in
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
  });
  
  // Remove after 2 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

/**
 * Delete pair
 */
function deletePair(pairId) {
  console.log('[WritingMode] deletePair called with pairId:', pairId);
  
  // Save current state before deleting
  saveStateToUndo();
  
  const beforeCount = state.pairs.length;
  state.pairs = state.pairs.filter(p => p.id !== pairId);
  const afterCount = state.pairs.length;
  
  console.log('[WritingMode] Deleted:', beforeCount - afterCount, 'pairs');
  
  renderPairs();
  state.isDirty = true;
  scheduleAutoSave();
  
  showTemporaryNotification('Deleted. Press Ctrl+Z to undo', 'info');
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
    pairs: state.pairs
  });
}

/**
 * Update save status
 */
function updateSaveStatus(status) {
  if (saveStatus) {
    saveStatus.textContent = status;
  }
}

/**
 * Show error notification
 */
function showErrorNotification(message, pairId = null) {
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  
  let actionHtml = '';
  if (pairId) {
    actionHtml = `<button class="error-action" data-pair-id="${escapeHtml(pairId)}">Go to Q&A</button>`;
  }
  
  notification.innerHTML = `
    <div class="error-icon">⚠️</div>
    <div class="error-content">
      <div class="error-title">Validation Error</div>
      <div class="error-message">${escapeHtml(message)}</div>
    </div>
    <div class="error-actions">
      ${actionHtml}
      <button class="error-close">✕</button>
    </div>
  `;
  
  const container = document.querySelector('.content') || document.body;
  container.insertBefore(notification, container.firstChild);
  
  // Auto-remove after 10 seconds
  const timeout = setTimeout(() => {
    notification.remove();
  }, 10000);
  
  // Go to Q&A button
  const actionBtn = notification.querySelector('.error-action');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      const pairId = actionBtn.getAttribute('data-pair-id');
      scrollToCenterItem(pairId);
      clearTimeout(timeout);
      notification.remove();
    });
  }
  
  // Close button
  const closeBtn = notification.querySelector('.error-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(timeout);
      notification.remove();
    });
  }
}

/**
 * Toggle help overlay
 */
function toggleHelpOverlay() {
  const helpOverlay = document.getElementById('helpOverlay');
  if (helpOverlay) {
    helpOverlay.classList.toggle('hidden');
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get cumulative height up to a specific index
 */
function getCumulativeHeight(upToIndex) {
  let height = 0;
  for (let i = 0; i < upToIndex && i < state.pairs.length; i++) {
    const pairId = state.pairs[i].id;
    height += state.itemHeights.get(pairId) || ESTIMATED_ITEM_HEIGHT;
  }
  return height;
}

/**
 * Find which pair is at a given scroll position
 */
function findItemAtScrollPosition(scrollTop) {
  let cumulativeHeight = 0;
  for (let i = 0; i < state.pairs.length; i++) {
    const pairId = state.pairs[i].id;
    const itemHeight = state.itemHeights.get(pairId) || ESTIMATED_ITEM_HEIGHT;
    if (cumulativeHeight + itemHeight > scrollTop) {
      return i;
    }
    cumulativeHeight += itemHeight;
  }
  return Math.max(0, state.pairs.length - 1);
}

/**
 * Get the pair currently in the center of the viewport
 */
function getCenterItem() {
  const contentDiv = document.querySelector('.content');
  if (!contentDiv) return null;

  const centerY = contentDiv.scrollTop + contentDiv.clientHeight / 2;
  let cumulativeHeight = 0;
  
  for (let i = 0; i < state.pairs.length; i++) {
    const pairId = state.pairs[i].id;
    const itemHeight = state.itemHeights.get(pairId) || ESTIMATED_ITEM_HEIGHT;
    
    if (cumulativeHeight + itemHeight > centerY) {
      return state.pairs[i];
    }
    cumulativeHeight += itemHeight;
  }
  
  return state.pairs.length > 0 ? state.pairs[state.pairs.length - 1] : null;
}

/**
 * Scroll to center a specific item by ID
 */
function scrollToCenterItem(itemId) {
  const itemIndex = state.pairs.findIndex(p => p.id === itemId);
  if (itemIndex < 0) return;
  
  const contentDiv = document.querySelector('.content');
  
  // Calculate scroll position to center this item
  let cumulativeHeight = getCumulativeHeight(itemIndex);
  const itemHeight = state.itemHeights.get(itemId) || ESTIMATED_ITEM_HEIGHT;
  const itemCenter = cumulativeHeight + itemHeight / 2;
  const viewportCenter = contentDiv.clientHeight / 2;
  const scrollTarget = Math.max(0, itemCenter - viewportCenter);
  
  contentDiv.scrollTop = scrollTarget;
  console.log('[WritingMode WebView] Scrolled to center item:', itemId);
}
