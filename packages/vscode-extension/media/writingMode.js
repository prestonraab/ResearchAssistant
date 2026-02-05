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
  maxUndoSteps: 20, // Maximum number of undo steps to keep
  findState: {
    isOpen: false,
    searchTerm: '',
    matches: [], // Array of {element, text, startIndex, endIndex}
    currentMatchIndex: 0
  }
};

// Virtual scrolling configuration
const ESTIMATED_ITEM_HEIGHT = 150; // Initial estimate for Q&A pairs
const BUFFER_SIZE = 3;

// DOM elements
const pairsList = document.getElementById('pairsList');
const helpBtn = document.getElementById('helpBtn');
const editBtn = document.getElementById('editBtn');
const exportBtn = document.getElementById('exportBtn');
const exportDropdown = document.querySelector('.export-dropdown');
const exportOptions = document.querySelectorAll('.export-option');
const saveStatus = document.getElementById('saveStatus');
const findBar = document.getElementById('findBar');
const findInput = document.getElementById('findInput');
const findCounter = document.getElementById('findCounter');
const findPrevBtn = document.getElementById('findPrevBtn');
const findNextBtn = document.getElementById('findNextBtn');
const findCloseBtn = document.getElementById('findCloseBtn');

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
      // Save current position before switching
      const currentCenterItem = getCenterItem();
      if (currentCenterItem) {
        vscode.postMessage({ 
          type: 'saveCenterItem', 
          itemId: currentCenterItem.id,
          position: currentCenterItem.position
        });
      }
      
      // Small delay to ensure message is processed
      setTimeout(() => {
        vscode.postMessage({ type: 'switchToEditingMode' });
      }, 50);
    });
  }

  // Export dropdown
  if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.toggle('open');
    });
  }

  // Export options
  exportOptions.forEach(option => {
    option.addEventListener('click', () => {
      const format = option.dataset.format;
      exportDropdown.classList.remove('open');
      
      if (format === 'markdown') {
        vscode.postMessage({ type: 'exportMarkdown' });
      } else if (format === 'word') {
        vscode.postMessage({ type: 'exportWord' });
      } else if (format === 'latex') {
        vscode.postMessage({ type: 'exportLatex' });
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!exportDropdown.contains(e.target)) {
      exportDropdown.classList.remove('open');
    }
  });

  // Find bar listeners
  if (findInput) {
    findInput.addEventListener('input', (e) => {
      performSearch(e.target.value);
    });

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    });
  }

  if (findNextBtn) {
    findNextBtn.addEventListener('click', findNext);
  }

  if (findPrevBtn) {
    findPrevBtn.addEventListener('click', findPrevious);
  }

  if (findCloseBtn) {
    findCloseBtn.addEventListener('click', closeFindBar);
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

    // Ctrl+F - Find
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      toggleFindBar();
      return;
    }

    // Escape - Close find bar
    if (e.key === 'Escape' && state.findState.isOpen) {
      e.preventDefault();
      closeFindBar();
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

  // Handle window resize to recalculate heights and maintain center item in view
  let resizeTimeout;
  window.addEventListener('resize', () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = setTimeout(() => {
      // Clear height cache to force recalculation
      state.itemHeights.clear();

      // Measure new heights after layout recalculation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const pairRows = document.querySelectorAll('.pair-row');
          pairRows.forEach(row => {
            const pairId = row.dataset.pairId;
            const actualHeight = row.offsetHeight;
            state.itemHeights.set(pairId, actualHeight);
          });

          // Restore scroll position to keep center item in view
          if (state.centerItemId) {
            scrollToCenterItem(state.centerItemId);
          }
        });
      });
    }, 100); // Debounce resize events
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

    case 'orphanCitationsUpdate':
      handleOrphanCitationsUpdate(message);
      break;

    case 'error':
      showErrorNotification(message.message, message.pairId);
      break;

    case 'pairsUpdated':
      // Refresh the display with updated pairs while preserving scroll position
      if (message.pairs) {
        const scrollPosition = window.scrollY;
        state.pairs = message.pairs;
        renderPairs(message.pairs);
        window.scrollTo(0, scrollPosition);
        console.log('[WritingMode] Pairs updated from backend');
      }
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
    // Skip section header for break markers
    if (!pair.isBreakMarker) {
      // Add section header if this is a new section
      if (pair.section !== currentSection) {
        currentSection = pair.section;
        // Add insert zone before first item of new section
        if (index === 0) {
          html += renderInsertZone(-1);
        }
        html += renderSectionHeader(pair.section, index);
        // Add insert zone after section header (before first question in section)
        html += renderInsertZone(index - 1);
      }
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
        <button class="insert-zone-btn insert-break-btn" data-after-index="${afterIndex}">+ Break</button>
      </div>
      <div class="insert-zone-right"></div>
    </div>
  `;
}

/**
 * Render a single question-answer pair
 */
function renderPair(pair) {
  // Handle break markers specially
  if (pair.isBreakMarker) {
    return `
      <div class="pair-wrapper break-marker" data-pair-id="${pair.id}">
        <div class="break-marker-line"></div>
        <button class="delete-btn" data-pair-id="${pair.id}" title="Remove break">✕</button>
      </div>
    `;
  }

  console.log('[WritingMode] Rendering pair:', {
    id: pair.id,
    question: pair.question?.substring(0, 50),
    answerLength: pair.answer?.length || 0,
    displayAnswerLength: pair.displayAnswer?.length || 0,
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

  // Use displayAnswer for rendering (without Source comments), fall back to answer
  const displayText = pair.displayAnswer !== undefined ? pair.displayAnswer : pair.answer;

  return `
    <div class="pair-wrapper" data-pair-id="${pair.id}" draggable="true">
      <!-- Drag Handle -->
      <div class="drag-handle" title="Drag to reorder"></div>
      
      <!-- Three-column content row -->
      <div class="pair-row" data-pair-id="${pair.id}">
        <!-- Left column: Question -->
        <div class="left-column">
          <div class="question-text" contenteditable="true" data-pair-id="${pair.id}">
            ${escapeHtml(pair.question)}
          </div>
        </div>
        
        <!-- Middle column: Answer -->
        <div class="middle-column">
          <textarea 
            class="answer-editor" 
            data-pair-id="${pair.id}"
            placeholder="Write your answer here..."
          >${escapeHtml(displayText || '')}</textarea>
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
      
      <!-- Citations section (expandable, spans all columns) -->
      <div class="citations-section" data-pair-id="${pair.id}" style="display: none;">
        ${citationSidebarHtml}
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
 * Attach drag and drop listeners for reordering
 */
function attachDragAndDropListeners() {
  let draggedElement = null;
  let draggedPairId = null;

  document.querySelectorAll('.pair-wrapper').forEach(wrapper => {
    wrapper.addEventListener('dragstart', (e) => {
      // Only allow dragging from the drag handle
      if (!e.target.classList.contains('drag-handle') && e.target !== wrapper) {
        e.preventDefault();
        return;
      }

      draggedElement = wrapper;
      draggedPairId = wrapper.dataset.pairId;
      wrapper.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', wrapper.innerHTML);
      
      console.log('[WritingMode] Started dragging pair:', draggedPairId);
    });

    wrapper.addEventListener('dragend', (e) => {
      wrapper.classList.remove('dragging');
      document.querySelectorAll('.pair-wrapper').forEach(w => {
        w.classList.remove('drag-over');
      });
      draggedElement = null;
      draggedPairId = null;
    });

    wrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (draggedElement && draggedElement !== wrapper) {
        wrapper.classList.add('drag-over');
      }
    });

    wrapper.addEventListener('dragleave', (e) => {
      wrapper.classList.remove('drag-over');
    });

    wrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedElement || draggedElement === wrapper) {
        return;
      }

      wrapper.classList.remove('drag-over');

      // Find indices
      const draggedIndex = state.pairs.findIndex(p => p.id === draggedPairId);
      const targetIndex = state.pairs.findIndex(p => p.id === wrapper.dataset.pairId);

      if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
        return;
      }

      // Reorder pairs
      saveStateToUndo();
      const [draggedPair] = state.pairs.splice(draggedIndex, 1);
      state.pairs.splice(targetIndex, 0, draggedPair);

      // Update section to match target pair's section
      const targetPair = state.pairs[targetIndex];
      draggedPair.section = targetPair.section;

      // Update positions
      state.pairs.forEach((pair, index) => {
        pair.position = index;
      });

      console.log('[WritingMode] Reordered pair from index', draggedIndex, 'to', targetIndex, 'with section:', draggedPair.section);

      renderPairs();
      state.isDirty = true;
      scheduleAutoSave();

      showTemporaryNotification('Reordered. Press Ctrl+Z to undo', 'info');
    });
  });
}

/**
 * Attach event listeners to pairs
 */
function attachPairListeners() {
  // Clean up old tooltips before attaching new listeners
  cleanupAllTooltips();
  
  // Drag and drop handlers
  attachDragAndDropListeners();
  
  // Orphan citation tooltip listeners
  attachOrphanTooltipListeners();

  // Answer editors - with auto-expand
  document.querySelectorAll('.answer-editor').forEach(editor => {
    editor.addEventListener('input', (e) => {
      const pairId = e.target.dataset.pairId;
      updatePairAnswer(pairId, e.target.value);
      
      // Auto-expand textarea
      e.target.style.height = 'auto';
      const newHeight = Math.min(e.target.scrollHeight, 400);
      e.target.style.height = newHeight + 'px';
      
      // Recalculate pair height for scroll positioning
      const pairRow = e.target.closest('.pair-row');
      if (pairRow) {
        const pairId = pairRow.dataset.pairId;
        state.itemHeights.set(pairId, pairRow.offsetHeight);
      }
    });
    
    // Initial height calculation
    editor.style.height = 'auto';
    const initialHeight = Math.min(editor.scrollHeight, 400);
    editor.style.height = initialHeight + 'px';
    
    // Add hover listener for orphan citation tooltips
    editor.addEventListener('mouseover', (e) => {
      const target = e.target;
      if (target.classList.contains('orphan-citation')) {
        showOrphanCitationTooltip(target);
      }
    });
    
    editor.addEventListener('mouseout', (e) => {
      const target = e.target;
      if (target.classList.contains('orphan-citation')) {
        hideOrphanCitationTooltip();
      }
    });
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
        // Save current position before switching
        const currentCenterItem = getCenterItem();
        if (currentCenterItem) {
          vscode.postMessage({ 
            type: 'saveCenterItem', 
            itemId: currentCenterItem.id,
            position: currentCenterItem.position
          });
        }
        
        // Small delay to ensure message is processed
        setTimeout(() => {
          vscode.postMessage({
            type: 'openClaim',
            claimId: claimId
          });
        }, 50);
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
        
        // Update the citation badge count
        const citedCount = (pair.linkedSources || []).filter(s => s.cited).length;
        const btn = document.querySelector(`.citations-toggle-btn[data-pair-id="${pairId}"]`);
        if (btn) {
          const badge = btn.querySelector('.citation-badge');
          if (badge) {
            badge.textContent = citedCount;
            badge.style.display = citedCount > 0 ? 'inline' : 'none';
          }
        }
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

  document.querySelectorAll('.insert-break-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const afterIndex = parseInt(e.target.dataset.afterIndex);
      insertParagraphBreakAfter(afterIndex);
    });
  });

  // Insert zone hover delay (300ms before expanding)
  const insertZoneHoverTimers = new Map();
  
  document.querySelectorAll('.insert-zone').forEach(zone => {
    zone.addEventListener('mouseenter', (e) => {
      const timer = setTimeout(() => {
        e.target.classList.add('active');
      }, 300);
      insertZoneHoverTimers.set(zone, timer);
    });

    zone.addEventListener('mouseleave', (e) => {
      const timer = insertZoneHoverTimers.get(zone);
      if (timer) {
        clearTimeout(timer);
        insertZoneHoverTimers.delete(zone);
      }
      e.target.classList.remove('active');
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
    // Update displayAnswer (what user sees/edits)
    pair.displayAnswer = answer;
    // Also update answer for backward compatibility, but the server will restore Source comments
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
 * Insert paragraph break after a specific index
 */
function insertParagraphBreakAfter(afterIndex) {
  saveStateToUndo();
  
  // Create a break marker pair
  const breakMarker = {
    id: 'break_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    question: '',
    answer: '---',
    displayAnswer: '---',
    status: 'BREAK',
    claims: [],
    linkedSources: [],
    isBreakMarker: true
  };
  
  // Insert at the correct position
  state.pairs.splice(afterIndex + 1, 0, breakMarker);
  
  // Update positions
  state.pairs.forEach((pair, index) => {
    pair.position = index;
  });
  
  renderPairs();
  state.isDirty = true;
  scheduleAutoSave();
  
  showTemporaryNotification('Paragraph break inserted', 'info');
}

/**
 * Insert paragraph break after a pair (legacy function, kept for compatibility)
 * Adds a '---' marker that will be converted to a paragraph break on export
 */
function insertParagraphBreak(pairId) {
  console.log('[WritingMode] insertParagraphBreak called for pairId:', pairId);
  
  // Save current state before inserting
  saveStateToUndo();
  
  // Find the index of the pair
  const pairIndex = state.pairs.findIndex(p => p.id === pairId);
  if (pairIndex === -1) {
    console.warn('[WritingMode] Pair not found:', pairId);
    return;
  }
  
  insertParagraphBreakAfter(pairIndex);
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

/**
 * Toggle find bar visibility
 */
function toggleFindBar() {
  if (state.findState.isOpen) {
    closeFindBar();
  } else {
    openFindBar();
  }
}

/**
 * Open find bar and focus input
 */
function openFindBar() {
  if (!findBar) return;
  
  state.findState.isOpen = true;
  findBar.classList.remove('hidden');
  
  // Focus input and select any existing text
  findInput.focus();
  findInput.select();
  
  console.log('[WritingMode] Find bar opened');
}

/**
 * Close find bar and clear highlights
 */
function closeFindBar() {
  if (!findBar) return;
  
  state.findState.isOpen = false;
  findBar.classList.add('hidden');
  
  // Clear highlights
  clearAllHighlights();
  state.findState.matches = [];
  state.findState.currentMatchIndex = 0;
  
  // Return focus to content
  document.querySelector('.content')?.focus();
  
  console.log('[WritingMode] Find bar closed');
}

/**
 * Perform search and find all matches
 */
function performSearch(searchTerm) {
  const lowerSearchTerm = searchTerm.toLowerCase();
  state.findState.searchTerm = lowerSearchTerm;
  state.findState.matches = [];
  state.findState.currentMatchIndex = 0;
  
  // Clear previous highlights
  clearAllHighlights();
  
  if (!searchTerm) {
    updateFindCounter();
    return;
  }
  
  // Search in questions
  document.querySelectorAll('.question-text').forEach(element => {
    findMatchesInElement(element, lowerSearchTerm);
  });
  
  // Search in answers
  document.querySelectorAll('.answer-editor').forEach(element => {
    findMatchesInElement(element, lowerSearchTerm);
  });
  
  // Search in section titles
  document.querySelectorAll('.section-title').forEach(element => {
    findMatchesInElement(element, lowerSearchTerm);
  });
  
  // Highlight first match if any
  if (state.findState.matches.length > 0) {
    highlightMatch(0);
    scrollToMatch(0);
  }
  
  updateFindCounter();
  console.log(`[WritingMode] Found ${state.findState.matches.length} matches for "${searchTerm}"`);
}

/**
 * Find all matches in a single element
 */
function findMatchesInElement(element, searchTerm) {
  const text = element.textContent || element.value || '';
  const lowerText = text.toLowerCase();
  let startIndex = 0;
  
  console.log(`[WritingMode] Searching for "${searchTerm}" in element with text: "${text.substring(0, 50)}..."`);
  
  while (true) {
    const index = lowerText.indexOf(searchTerm, startIndex);
    if (index === -1) break;
    
    console.log(`[WritingMode] Found match at index ${index}`);
    
    state.findState.matches.push({
      element: element,
      text: text,
      startIndex: index,
      endIndex: index + searchTerm.length
    });
    
    startIndex = index + 1;
  }
}

/**
 * Highlight a specific match
 */
function highlightMatch(matchIndex) {
  if (matchIndex < 0 || matchIndex >= state.findState.matches.length) return;
  
  const match = state.findState.matches[matchIndex];
  const element = match.element;
  
  // Update current match index
  state.findState.currentMatchIndex = matchIndex;
  
  // For textarea elements, select the text
  if (element.tagName === 'TEXTAREA') {
    element.focus();
    element.setSelectionRange(match.startIndex, match.endIndex);
    return;
  }
  
  // For contenteditable elements, create a selection but keep focus on find input
  // This prevents the user's typing in the search box from replacing the selected text
  const range = document.createRange();
  const sel = window.getSelection();
  
  try {
    // Get the text node and position
    let charCount = 0;
    let nodeStack = [element];
    let node, foundStart = false, foundEnd = false;
    let startNode, startOffset, endNode, endOffset;
    
    while (!foundEnd && (node = nodeStack.pop())) {
      if (node.nodeType === 3) { // Text node
        const nextCharCount = charCount + node.length;
        
        if (!foundStart && match.startIndex < nextCharCount) {
          foundStart = true;
          startNode = node;
          startOffset = match.startIndex - charCount;
        }
        
        if (foundStart && match.endIndex <= nextCharCount) {
          foundEnd = true;
          endNode = node;
          endOffset = match.endIndex - charCount;
        }
        
        charCount = nextCharCount;
      } else {
        let i = node.childNodes.length;
        while (i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }
    
    if (foundStart && foundEnd) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      sel.removeAllRanges();
      sel.addRange(range);
      
      // Scroll the element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Keep focus on the find input to prevent text replacement
      if (findInput) {
        findInput.focus();
      }
    }
  } catch (e) {
    // Silently fail if we can't set selection
    console.debug('[WritingMode] Could not set selection for match:', e);
  }
}

/**
 * Scroll to a specific match
 */
function scrollToMatch(matchIndex) {
  if (matchIndex < 0 || matchIndex >= state.findState.matches.length) return;
  
  const match = state.findState.matches[matchIndex];
  const element = match.element;
  
  // Scroll element into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Go to next match
 */
function findNext() {
  if (state.findState.matches.length === 0) return;
  
  const nextIndex = (state.findState.currentMatchIndex + 1) % state.findState.matches.length;
  highlightMatch(nextIndex);
  scrollToMatch(nextIndex);
  updateFindCounter();
}

/**
 * Go to previous match
 */
function findPrevious() {
  if (state.findState.matches.length === 0) return;
  
  const prevIndex = state.findState.currentMatchIndex === 0 
    ? state.findState.matches.length - 1 
    : state.findState.currentMatchIndex - 1;
  
  highlightMatch(prevIndex);
  scrollToMatch(prevIndex);
  updateFindCounter();
}

/**
 * Clear all highlights
 */
function clearAllHighlights() {
  document.querySelectorAll('.find-match').forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      // Replace span with its text content
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  });
}

/**
 * Update find counter display
 */
function updateFindCounter() {
  if (!findCounter) return;
  
  if (state.findState.matches.length === 0) {
    findCounter.textContent = '0 of 0';
  } else {
    const current = state.findState.currentMatchIndex + 1;
    findCounter.textContent = `${current} of ${state.findState.matches.length}`;
  }
}

/**
 * Apply orphan citation highlighting to answer text
 * Highlights orphan citations in orange and matched citations in green
 * @param answerElement - The textarea element containing the answer
 * @param orphanCitations - Array of orphan author-years for this pair
 * @param matchedCitations - Array of matched author-years for this pair
 */
function applyOrphanCitationHighlighting(answerElement, orphanCitations = [], matchedCitations = []) {
  if (!answerElement || answerElement.tagName !== 'TEXTAREA') {
    return;
  }

  // Store original value
  const originalValue = answerElement.value;
  
  // Create a wrapper div to hold highlighted content
  const wrapper = document.createElement('div');
  wrapper.className = 'citation-highlight-wrapper';
  wrapper.style.display = 'none'; // Hidden, used only for highlighting display
  
  let highlightedHtml = escapeHtml(originalValue);
  
  // Apply highlighting for matched citations first (green)
  for (const authorYear of matchedCitations) {
    const escapedAuthorYear = authorYear.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedAuthorYear}\\b`, 'g');
    highlightedHtml = highlightedHtml.replace(
      regex,
      `<span class="matched-citation" title="Matched citation: ${escapeHtml(authorYear)}">${escapeHtml(authorYear)}</span>`
    );
  }
  
  // Apply highlighting for orphan citations (orange)
  for (const authorYear of orphanCitations) {
    const escapedAuthorYear = authorYear.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedAuthorYear}\\b`, 'g');
    highlightedHtml = highlightedHtml.replace(
      regex,
      `<span class="orphan-citation" title="Orphan citation: ${escapeHtml(authorYear)} - no supporting quote">${escapeHtml(authorYear)}</span>`
    );
  }
  
  wrapper.innerHTML = highlightedHtml;
  
  // Store highlighting data on the element
  answerElement.dataset.orphanCitations = JSON.stringify(orphanCitations);
  answerElement.dataset.matchedCitations = JSON.stringify(matchedCitations);
  answerElement.dataset.highlightedContent = highlightedHtml;
  
  // Add visual indicator class if there are orphan citations
  if (orphanCitations.length > 0) {
    answerElement.classList.add('has-orphan-citations');
  } else {
    answerElement.classList.remove('has-orphan-citations');
  }
}

/**
 * Update citation highlighting for a pair
 * Called when orphan citations data is received from the extension
 * @param pairId - The pair ID
 * @param orphanCitations - Array of orphan author-years
 * @param matchedCitations - Array of matched author-years
 */
function updateCitationHighlighting(pairId, orphanCitations = [], matchedCitations = []) {
  const answerEditor = document.querySelector(`.answer-editor[data-pair-id="${pairId}"]`);
  if (answerEditor) {
    applyOrphanCitationHighlighting(answerEditor, orphanCitations, matchedCitations);
  }
}

/**
 * Handle orphan citations data from extension
 * Updates highlighting for all pairs with orphan citations
 */
function handleOrphanCitationsUpdate(message) {
  if (!message.orphanCitations) {
    return;
  }

  // message.orphanCitations is a map of pairId -> { orphan: [], matched: [] }
  for (const [pairId, citationData] of Object.entries(message.orphanCitations)) {
    const orphanList = citationData.orphan || [];
    const matchedList = citationData.matched || [];
    updateCitationHighlighting(pairId, orphanList, matchedList);
  }
}

/**
 * Show tooltip for orphan citation on hover
 * @param element - The orphan citation span element
 */
function showOrphanCitationTooltip(element) {
  const authorYear = element.title.replace('Orphan citation: ', '').replace(' - no supporting quote', '');
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'orphan-citation-tooltip';
  tooltip.innerHTML = `
    <strong>Orphan Citation:</strong><br/>
    <span class="orphan-years">${escapeHtml(authorYear)}</span><br/>
    <small>No supporting quote found</small>
  `;
  
  // Position tooltip near the element
  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = '10000';
  tooltip.style.pointerEvents = 'none';
  
  document.body.appendChild(tooltip);
  
  // Position it above the element
  const rect = element.getBoundingClientRect();
  tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
  tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
  
  // Store reference for cleanup
  element.dataset.tooltipElement = 'true';
  element.dataset.currentTooltip = tooltip.id || 'orphan-tooltip-' + Date.now();
}

/**
 * Hide orphan citation tooltip
 */
function hideOrphanCitationTooltip() {
  const tooltips = document.querySelectorAll('.orphan-citation-tooltip');
  tooltips.forEach(tooltip => {
    tooltip.remove();
  });
}

/**
 * Tooltip Management
 * Handles display and positioning of orphan citation tooltips
 */

// Track active tooltips to prevent memory leaks
const activeTooltips = new Map(); // Map of element -> tooltip element

/**
 * Attach tooltip event listeners to orphan-highlighted citations
 * Called after rendering pairs to set up hover handlers
 */
function attachOrphanTooltipListeners() {
  // Find all elements with orphan citations
  document.querySelectorAll('.orphan-citation').forEach(element => {
    // Remove old listeners if any
    element.removeEventListener('mouseenter', handleOrphanCitationHover);
    element.removeEventListener('mouseleave', handleOrphanCitationLeave);
    
    // Attach new listeners
    element.addEventListener('mouseenter', handleOrphanCitationHover);
    element.addEventListener('mouseleave', handleOrphanCitationLeave);
  });
}

/**
 * Handle mouse enter on orphan citation
 * Displays tooltip with orphan author-years
 */
function handleOrphanCitationHover(event) {
  const element = event.currentTarget;
  
  // Check if tooltip already exists
  if (activeTooltips.has(element)) {
    const tooltip = activeTooltips.get(element);
    tooltip.classList.add('visible');
    return;
  }
  
  // Get tooltip content from data attribute
  const tooltipContent = element.getAttribute('data-tooltip');
  if (!tooltipContent) {
    return;
  }
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'orphan-tooltip';
  tooltip.innerHTML = tooltipContent;
  
  // Position tooltip relative to the citation element
  element.appendChild(tooltip);
  
  // Store reference for later cleanup
  activeTooltips.set(element, tooltip);
  
  // Show tooltip with slight delay for smooth animation
  requestAnimationFrame(() => {
    tooltip.classList.add('visible');
  });
  
  console.log('[WritingMode] Tooltip displayed for orphan citation');
}

/**
 * Handle mouse leave on orphan citation
 * Hides and removes tooltip
 */
function handleOrphanCitationLeave(event) {
  const element = event.currentTarget;
  const tooltip = activeTooltips.get(element);
  
  if (!tooltip) {
    return;
  }
  
  // Hide tooltip
  tooltip.classList.remove('visible');
  
  // Remove tooltip after animation completes
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
    activeTooltips.delete(element);
  }, 200);
}

/**
 * Create orphan citation highlight with tooltip
 * Wraps text in a span with orphan-citation class and tooltip data
 * @param {string} text - The text to highlight
 * @param {string} authorYears - Comma-separated author-years
 * @returns {string} HTML string with highlighted citation and tooltip
 */
function createOrphanCitationHighlight(text, authorYears) {
  const tooltipContent = `
    <div class="orphan-citation-tooltip">
      <strong>Orphan Citations:</strong><br/>
      <span class="orphan-years">${escapeHtml(authorYears)}</span><br/>
      <small>These citations lack supporting quotes</small>
    </div>
  `;
  
  return `<span class="orphan-citation" data-tooltip="${escapeHtml(tooltipContent)}">${escapeHtml(text)}</span>`;
}

/**
 * Highlight orphan citations in answer text
 * Scans answer for orphan author-year patterns and wraps them
 * @param {string} answerText - The answer text to process
 * @param {Array} orphanCitations - Array of {authorYear, claimId} objects
 * @returns {string} HTML with highlighted orphan citations
 */
function highlightOrphanCitationsInText(answerText, orphanCitations) {
  if (!orphanCitations || orphanCitations.length === 0) {
    return escapeHtml(answerText);
  }
  
  let result = answerText;
  
  // Sort by length descending to avoid partial replacements
  const sortedCitations = [...orphanCitations].sort((a, b) => 
    b.authorYear.length - a.authorYear.length
  );
  
  // Track replacements to adjust positions
  const replacements = [];
  
  for (const citation of sortedCitations) {
    const regex = new RegExp(`\\b${escapeRegex(citation.authorYear)}\\b`, 'g');
    let match;
    
    while ((match = regex.exec(result)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        authorYear: citation.authorYear
      });
    }
  }
  
  // Sort replacements by position (descending) to replace from end to start
  replacements.sort((a, b) => b.start - a.start);
  
  // Apply replacements
  for (const replacement of replacements) {
    const before = result.substring(0, replacement.start);
    const after = result.substring(replacement.end);
    const highlighted = createOrphanCitationHighlight(replacement.text, replacement.authorYear);
    result = before + highlighted + after;
  }
  
  return result;
}

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for regex
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clean up all active tooltips
 * Called when rendering new pairs to prevent memory leaks
 */
function cleanupAllTooltips() {
  for (const [element, tooltip] of activeTooltips.entries()) {
    if (tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
  }
  activeTooltips.clear();
}
