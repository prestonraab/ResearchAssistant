// Writing Mode JavaScript
// Note: vscode is declared in the HTML inline script

// State
let state = {
  pairs: [],
  isDirty: false,
  autoSaveTimer: null
};

// DOM elements
const pairsList = document.getElementById('pairsList');
const helpBtn = document.getElementById('helpBtn');
const editBtn = document.getElementById('editBtn');
const addPairBtn = document.getElementById('addPairBtn');
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

  // Add pair button
  if (addPairBtn) {
    addPairBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'addPair', section: 'New Section' });
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

    case 'pairAdded':
      addNewPair(message.section);
      break;

    case 'pairDeleted':
      deletePair(message.pairId);
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
    pairCount: message.pairs?.length || 0
  });
  
  state.pairs = message.pairs || [];
  
  console.log('[WritingMode WebView] Pairs array:', state.pairs.length);
  
  renderPairs();
  
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

  pairsList.innerHTML = state.pairs.map(pair => renderPair(pair)).join('');
  
  console.log('[WritingMode] Rendered HTML length:', pairsList.innerHTML.length);
  
  // Attach event listeners
  attachPairListeners();
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
  
  const statusClass = pair.status.toLowerCase().replace(/\s+/g, '-');
  const statusColor = getStatusColor(pair.status);
  
  const claimsHtml = pair.claims.length > 0
    ? `<div class="claims-list">
         <div class="claims-label">Claims:</div>
         ${pair.claims.map(c => `<span class="claim-badge">${c}</span>`).join('')}
       </div>`
    : '<div class="claims-empty">No claims yet</div>';

  // Count cited sources
  const citedCount = (pair.linkedSources || []).filter(s => s.cited).length;
  const citationIndicator = citedCount > 0 
    ? `<span class="citation-indicator">${citedCount} cited</span>`
    : '';

  // Render citation sidebar
  const citationSidebarHtml = renderCitationSidebar(pair);

  return `
    <div class="pair-row" data-pair-id="${pair.id}">
      <!-- Question column -->
      <div class="question-column">
        <div class="question-header">
          <span class="status-badge status-${statusClass}" style="background-color: ${statusColor}">
            ${pair.status}
          </span>
          ${citationIndicator}
          <button class="delete-btn" data-pair-id="${pair.id}" title="Delete">🗑️</button>
        </div>
        <div class="question-text" contenteditable="true" data-pair-id="${pair.id}">
          ${escapeHtml(pair.question)}
        </div>
        ${claimsHtml}
        <div class="section-label">${escapeHtml(pair.section)}</div>
      </div>
      
      <!-- Answer column -->
      <div class="answer-column">
        <textarea 
          class="answer-editor" 
          data-pair-id="${pair.id}"
          placeholder="Write your answer here..."
        >${escapeHtml(pair.answer || '')}</textarea>
      </div>

      <!-- Citation sidebar -->
      ${citationSidebarHtml}
    </div>
  `;
}

/**
 * Get status color
 */
function getStatusColor(status) {
  switch (status.toUpperCase()) {
    case 'ANSWERED':
      return '#4caf50';
    case 'RESEARCH NEEDED':
      return '#ff9800';
    case 'PARTIAL':
      return '#2196f3';
    default:
      return '#9e9e9e';
  }
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
    const quotePreview = escapeHtml(source.quote || '').substring(0, 150);
    
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
        </div>
        <div class="citation-quote-preview">${quotePreview}${source.quote && source.quote.length > 150 ? '...' : ''}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="citation-sidebar">
      <div class="citation-sidebar-label">Citations (${linkedSources.length})</div>
      ${citationItemsHtml}
    </div>
  `;
}

/**
 * Attach event listeners to pairs
 */
function attachPairListeners() {
  // Answer editors
  document.querySelectorAll('.answer-editor').forEach(editor => {
    editor.addEventListener('input', (e) => {
      const pairId = e.target.dataset.pairId;
      updatePairAnswer(pairId, e.target.value);
    });
  });

  // Question editors
  document.querySelectorAll('.question-text').forEach(editor => {
    editor.addEventListener('input', (e) => {
      const pairId = e.target.dataset.pairId;
      updatePairQuestion(pairId, e.target.textContent);
    });
  });

  // Delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pairId = e.target.dataset.pairId;
      if (confirm('Delete this question-answer pair?')) {
        deletePair(pairId);
      }
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
 * Add new pair
 */
function addNewPair(section) {
  const newPair = {
    id: `QA_${state.pairs.length}`,
    question: 'New question?',
    status: 'RESEARCH NEEDED',
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
 * Delete pair
 */
function deletePair(pairId) {
  state.pairs = state.pairs.filter(p => p.id !== pairId);
  renderPairs();
  state.isDirty = true;
  scheduleAutoSave();
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
