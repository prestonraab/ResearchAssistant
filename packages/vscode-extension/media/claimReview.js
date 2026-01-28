// Claim Review Mode Script

let currentClaim = null;
let currentVerificationResults = [];
let currentValidationResult = null;
let currentUsageLocations = [];
let sidebarVisible = true;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupKeyboardShortcuts();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Help button
  document.getElementById('helpBtn').addEventListener('click', () => {
    toggleHelpOverlay();
  });

  // Edit button
  document.getElementById('editBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'switchToEditingMode' });
  });

  // Toggle sidebar
  document.getElementById('toggleSidebar').addEventListener('click', () => {
    toggleSidebar();
  });

  // Action buttons
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.currentTarget.getAttribute('data-action');
      handleAction(action);
    });
  });

  // Help overlay close
  document.getElementById('helpOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'helpOverlay') {
      toggleHelpOverlay();
    }
  });

  // Listen for messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    handleMessage(message);
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  const shortcuts = {
    '?': { handler: toggleHelpOverlay, modifiers: [] },
    'Escape': { handler: () => vscode.postMessage({ type: 'switchToEditingMode' }), modifiers: [] },
    'v': { handler: verifyCurrentQuote, modifiers: [] },
    'a': { handler: acceptCurrentQuote, modifiers: [] },
    'd': { handler: deleteCurrentQuote, modifiers: [] },
    '*': { handler: toggleCurrentQuoteCitation, modifiers: [] },
    'f': { handler: findNewQuotes, modifiers: [] },
    'i': { handler: searchInternet, modifiers: [] },
    'V': { handler: validateSupport, modifiers: ['shift'] },
    'M': { handler: toggleSidebar, modifiers: ['shift'] },
    'n': { handler: nextClaim, modifiers: [] },
    'p': { handler: previousClaim, modifiers: [] },
    'w': { handler: () => vscode.postMessage({ type: 'switchToWritingMode' }), modifiers: ['shift'] },
    'e': { handler: () => vscode.postMessage({ type: 'switchToEditingMode' }), modifiers: ['shift'] }
  };

  function matchesModifiers(e, modifiers) {
    const hasShift = modifiers.includes('shift');
    const hasCtrl = modifiers.includes('ctrl');
    const hasMeta = modifiers.includes('meta');
    
    return e.shiftKey === hasShift && e.ctrlKey === hasCtrl && e.metaKey === hasMeta;
  }

  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    const shortcut = shortcuts[e.key];
    if (shortcut && matchesModifiers(e, shortcut.modifiers)) {
      e.preventDefault();
      shortcut.handler();
    }
  });
}

/**
 * Message handler dispatcher
 */
const messageHandlers = {
  'loadClaim': (msg) => displayClaim(msg),
  'quoteVerified': (msg) => updateQuoteVerification(msg),
  'newQuotesRound': (msg) => displayNewQuotesRound(msg),
  'newQuotesComplete': (msg) => displayNewQuotesComplete(msg),
  'snippetTextLoaded': (msg) => handleSnippetTextLoaded(msg),
  'internetSearchResults': (msg) => displayInternetResults(msg.results),
  'supportValidated': (msg) => updateValidationResult(msg),
  'showHelp': () => toggleHelpOverlay(),
  'memoryWarning': (msg) => showNotification(msg.message, 'info'),
  'error': (msg) => showError(msg.message)
};

/**
 * Handle messages from extension
 */
function handleMessage(message) {
  const handler = messageHandlers[message.type];
  if (handler) {
    handler(message);
  } else {
    console.warn('Unknown message type:', message.type);
  }
}

/**
 * Display claim
 */
function displayClaim(message) {
  currentClaim = message.claim;
  currentVerificationResults = message.verificationResults || [];
  currentValidationResult = message.validationResult || {};
  currentUsageLocations = message.usageLocations || [];

  console.log('[ClaimReview] Displaying claim:', currentClaim);

  // Display claim header
  const header = document.getElementById('claimHeader');
  if (header) {
    const idEl = header.querySelector('.claim-id');
    const textEl = header.querySelector('.claim-text');
    const categoryEl = header.querySelector('.category');
    const sourceEl = header.querySelector('.source');
    
    if (idEl) idEl.textContent = currentClaim.id || '';
    if (textEl) textEl.textContent = currentClaim.text || '';
    if (categoryEl) categoryEl.textContent = currentClaim.category || 'Uncategorized';
    if (sourceEl) sourceEl.textContent = currentClaim.source ? `Source: ${currentClaim.source}` : 'Source: (none)';
  }

  // Display quotes
  displayQuotes();

  // Display validation
  displayValidation();

  // Display usage locations
  displayUsageLocations();
}

/**
 * Display quotes
 */
function displayQuotes() {
  const quotesSection = document.getElementById('quotesSection');
  const primaryContainer = document.getElementById('primaryQuoteContainer');
  const supportingContainer = document.getElementById('supportingQuotesContainer');

  // Clear supporting quotes
  supportingContainer.innerHTML = '';

  // Display primary quote
  if (currentClaim.primaryQuote && currentClaim.primaryQuote.text) {
    const primaryResult = currentVerificationResults.find(r => r.type === 'primary');
    // Merge quote object with verification result
    const quoteWithVerification = {
      ...currentClaim.primaryQuote,
      ...primaryResult
    };
    displayQuoteContainer(primaryContainer, currentClaim.primaryQuote.text, quoteWithVerification, 'primary');
    primaryContainer.style.display = 'block';
  } else {
    // Show empty state with prompt to add quote
    primaryContainer.innerHTML = `
      <div class="quote-header">
        <span class="quote-type">PRIMARY QUOTE</span>
        <span class="status-icon not-checked">○</span>
      </div>
      <div class="quote-empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-text">No primary quote yet</div>
        <div class="empty-state-hint">Search for supporting quotes below to add them</div>
      </div>
      <div class="quote-actions">
        <button class="btn btn-secondary" data-action="findNewQuotes">Find Quotes</button>
      </div>
    `;
    
    // Attach event listener for Find Quotes button
    const findBtn = primaryContainer.querySelector('[data-action="findNewQuotes"]');
    if (findBtn) {
      findBtn.addEventListener('click', () => {
        findNewQuotes();
      });
    }
    primaryContainer.style.display = 'block';
  }

  // Display supporting quotes
  if (currentClaim.supportingQuotes && currentClaim.supportingQuotes.length > 0) {
    currentClaim.supportingQuotes.forEach((quoteObj, index) => {
      if (quoteObj && quoteObj.text) {
        const result = currentVerificationResults.find(r => r.quote === quoteObj.text && r.type === 'supporting');
        // Merge quote object with verification result
        const quoteWithVerification = {
          ...quoteObj,
          ...result
        };
        const container = document.createElement('div');
        container.className = 'quote-container';
        displayQuoteContainer(container, quoteObj.text, quoteWithVerification, 'supporting');
        supportingContainer.appendChild(container);
      }
    });
  }
}

/**
 * Display quote container
 */
function displayQuoteContainer(container, quote, result, type) {
  const statusIcon = getStatusIcon(result);
  const verificationText = getVerificationText(result);
  const citationStatus = result?.citedForFinal ? '★' : '☆'; // Filled or empty star
  const citationTitle = result?.citedForFinal 
    ? 'Quote marked for citation (click to unmark)' 
    : 'Quote not marked for citation (click to mark)';
  
  // Determine if we should show "Fix Quote" button
  const similarity = result?.similarity || 0;
  const showFixQuote = result && similarity < 1.0 && result.closestMatch;
  
  // Build buttons HTML
  let buttonsHtml = `
    <button class="btn btn-citation" data-action="toggleCitation" data-quote="${escapeHtml(quote)}" title="${citationTitle}">
      ${citationStatus}
    </button>
    <button class="btn btn-primary" data-action="editQuote" data-quote="${escapeHtml(quote)}">Edit Quote</button>
  `;
  
  // Add Fix Quote button if verification < 100%
  if (showFixQuote) {
    buttonsHtml += `
      <button class="btn btn-secondary" data-action="fixQuote" data-quote="${escapeHtml(quote)}" data-closest-match="${escapeHtml(result.closestMatch)}">Fix Quote</button>
    `;
  }
  
  buttonsHtml += `
    <button class="btn btn-danger" data-action="deleteQuote" data-quote="${escapeHtml(quote)}">Delete</button>
    <button class="btn btn-secondary" data-action="findNewQuotes">Find New</button>
  `;

  container.innerHTML = `
    <div class="quote-header">
      <span class="quote-type">${type.toUpperCase()} QUOTE</span>
      <span class="status-icon ${getStatusClass(result)}">${statusIcon}</span>
    </div>
    <div class="quote-text">${escapeHtml(quote)}</div>
    <div class="verification-info ${getStatusClass(result)}">${verificationText}</div>
    <div class="quote-actions">
      ${buttonsHtml}
    </div>
  `;
  
  // Attach event listeners
  const citationBtn = container.querySelector('[data-action="toggleCitation"]');
  if (citationBtn) {
    citationBtn.addEventListener('click', () => {
      toggleQuoteCitation(quote);
    });
  }
  
  const editBtn = container.querySelector('[data-action="editQuote"]');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      editQuote(quote);
    });
  }
  
  const fixBtn = container.querySelector('[data-action="fixQuote"]');
  if (fixBtn) {
    fixBtn.addEventListener('click', () => {
      const closestMatch = fixBtn.getAttribute('data-closest-match');
      fixQuote(quote, closestMatch);
    });
  }
  
  const deleteBtn = container.querySelector('[data-action="deleteQuote"]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      deleteQuote(quote);
    });
  }
  
  const findBtn = container.querySelector('[data-action="findNewQuotes"]');
  if (findBtn) {
    findBtn.addEventListener('click', () => {
      findNewQuotes();
    });
  }
}

/**
 * Get status icon
 */
function getStatusIcon(result) {
  if (!result) return '○';
  if (result.verified) return '✓';
  if (result.similarity > 0.8) return '⚠';
  return '✗';
}

/**
 * Get status class
 */
function getStatusClass(result) {
  if (!result) return 'not-checked';
  if (result.verified) return 'verified';
  if (result.similarity > 0.8) return 'unverified';
  return 'invalid';
}

/**
 * Get verification text
 */
function getVerificationText(result) {
  if (!result) return 'Not verified';
  
  const similarity = Math.round(result.similarity * 100);
  
  let baseText = '';
  if (result.verified) {
    baseText = `Verified in source (${similarity}% match)`;
  } else if (result.nearestMatch) {
    baseText = `Not verified (nearest: ${similarity}% match)`;
  } else {
    baseText = 'Not found in sources';
  }
  
  // Add support confidence if available (from Find Quotes workflow)
  if (result.confidence !== undefined && result.confidence > 0) {
    const stars = Math.round(result.confidence * 5);
    const starDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    const confidencePercentage = Math.round(result.confidence * 100);
    return `${baseText} • Support: ${starDisplay} ${confidencePercentage}%`;
  }
  
  return baseText;
}

/**
 * Display validation (hidden - kept for compatibility)
 */
function displayValidation() {
  // Validation section is now hidden
  // Support information is shown inline with each quote
}

/**
 * Display usage locations
 */
function displayUsageLocations() {
  const usageList = document.getElementById('usageList');
  usageList.innerHTML = '';

  if (currentUsageLocations.length === 0) {
    usageList.innerHTML = '<div style="padding: 12px; color: #999;">No usage locations found</div>';
    return;
  }

  currentUsageLocations.forEach((location, index) => {
    const item = document.createElement('div');
    item.className = 'usage-item';
    item.innerHTML = `
      <div class="usage-item-section">${escapeHtml(location.section)}</div>
      <div class="usage-item-context">${escapeHtml(location.context)}</div>
    `;
    item.addEventListener('click', () => {
      vscode.postMessage({
        type: 'navigateToManuscript',
        lineNumber: location.lineNumber
      });
    });
    usageList.appendChild(item);
  });
}

/**
 * Handle action
 */
function handleAction(action) {
  switch (action) {
    case 'acceptQuote':
      acceptCurrentQuote();
      break;
    case 'deleteQuote':
      deleteCurrentQuote();
      break;
    case 'findNewQuotes':
      findNewQuotes();
      break;
    case 'searchInternet':
      searchInternet();
      break;
    case 'validateSupport':
      validateSupport();
      break;
    case 'switchToEditingMode':
      vscode.postMessage({ type: 'switchToEditingMode' });
      break;
  }
}

/**
 * Verify current quote
 */
function verifyCurrentQuote() {
  if (!currentClaim || !currentClaim.primaryQuote) return;
  vscode.postMessage({
    type: 'verifyQuote',
    quote: currentClaim.primaryQuote,
    source: currentClaim.source
  });
}

/**
 * Show modal dialog for editing text
 */
function showEditModal(title, initialText, onConfirm) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // Create modal dialog
  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  
  dialog.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <textarea id="modalTextarea">${escapeHtml(initialText)}</textarea>
    <div class="modal-buttons">
      <button class="btn btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn btn-primary" id="modalConfirm">Confirm</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Focus textarea
  const textarea = dialog.querySelector('#modalTextarea');
  textarea.focus();
  textarea.select();
  
  // Handle confirm
  const confirmBtn = dialog.querySelector('#modalConfirm');
  confirmBtn.addEventListener('click', () => {
    const newText = textarea.value;
    overlay.remove();
    onConfirm(newText);
  });
  
  // Handle cancel
  const cancelBtn = dialog.querySelector('#modalCancel');
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  
  // Handle escape key
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
    }
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

/**
 * Show confirmation modal dialog
 */
function showConfirmModal(title, message, onConfirm) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // Create modal dialog
  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  
  dialog.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
    <div class="modal-buttons">
      <button class="btn btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn btn-danger" id="modalConfirm">Confirm</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Handle confirm
  const confirmBtn = dialog.querySelector('#modalConfirm');
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    onConfirm(true);
  });
  
  // Handle cancel
  const cancelBtn = dialog.querySelector('#modalCancel');
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    onConfirm(false);
  });
  
  // Handle escape key
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      onConfirm(false);
    }
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onConfirm(false);
    }
  });
}

/**
 * Accept current quote
 */
function acceptCurrentQuote() {
  if (!currentClaim || !currentClaim.primaryQuote) return;
  editQuote(currentClaim.primaryQuote);
}

/**
 * Edit quote
 */
function editQuote(quote) {
  showEditModal('Edit Quote', quote, (newQuote) => {
    if (newQuote && newQuote.trim()) {
      vscode.postMessage({
        type: 'acceptQuote',
        claimId: currentClaim.id,
        quote: quote,
        newQuote: newQuote
      });
    }
  });
}

/**
 * Fix quote - replace with verified text from source
 */
function fixQuote(quote, closestMatch) {
  showEditModal('Fix Quote', closestMatch, (newQuote) => {
    if (newQuote && newQuote.trim()) {
      vscode.postMessage({
        type: 'acceptQuote',
        claimId: currentClaim.id,
        quote: quote,
        newQuote: newQuote
      });
    }
  });
}

/**
 * Accept quote (legacy - kept for compatibility)
 */
function acceptQuote(quote) {
  editQuote(quote);
}

/**
 * Toggle citation status for a quote
 */
function toggleQuoteCitation(quote) {
  if (!currentClaim) return;
  
  vscode.postMessage({
    type: 'toggleQuoteCitation',
    claimId: currentClaim.id,
    quote: quote
  });
}

/**
 * Delete current quote
 */
function deleteCurrentQuote() {
  if (!currentClaim || !currentClaim.primaryQuote) return;
  deleteQuote(currentClaim.primaryQuote);
}

/**
 * Delete quote
 */
function deleteQuote(quote) {
  showConfirmModal('Delete Quote', 'Are you sure you want to delete this quote?', (confirmed) => {
    if (confirmed) {
      vscode.postMessage({
        type: 'deleteQuote',
        claimId: currentClaim.id,
        quote: quote
      });
    }
  });
}

/**
 * Find new quotes
 */
function findNewQuotes() {
  if (!currentClaim) return;
  
  // Show loading state
  const btn = document.querySelector('[data-action="findNewQuotes"]');
  const originalText = btn.textContent;
  btn.textContent = 'Searching...';
  btn.disabled = true;
  
  vscode.postMessage({
    type: 'findNewQuotes',
    claimId: currentClaim.id,
    query: currentClaim.text
  });
  
  // Reset button after 3 seconds
  setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
  }, 3000);
}

/**
 * Search internet
 */
function searchInternet() {
  if (!currentClaim) return;
  
  // Show loading state
  const btn = document.getElementById('searchInternetBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Searching...';
  btn.disabled = true;
  
  vscode.postMessage({
    type: 'searchInternet',
    query: currentClaim.text
  });
  
  // Reset button after 3 seconds
  setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
  }, 3000);
}

/**
 * Validate support
 */
function validateSupport() {
  if (!currentClaim) return;
  vscode.postMessage({
    type: 'validateSupport',
    claimId: currentClaim.id
  });
}

/**
 * Next claim
 */
function nextClaim() {
  // This would be implemented with claim navigation
  console.log('Next claim');
}

/**
 * Previous claim
 */
function previousClaim() {
  // This would be implemented with claim navigation
  console.log('Previous claim');
}

/**
 * Toggle sidebar
 */
function toggleSidebar() {
  const sidebar = document.querySelector('.manuscript-sidebar');
  const mainPanel = document.querySelector('.main-panel');
  sidebarVisible = !sidebarVisible;

  if (sidebarVisible) {
    sidebar.style.display = 'flex';
    mainPanel.style.flex = '1';
  } else {
    sidebar.style.display = 'none';
    mainPanel.style.flex = '1';
  }
}

/**
 * Toggle help overlay
 */
function toggleHelpOverlay() {
  const overlay = document.getElementById('helpOverlay');
  overlay.classList.toggle('hidden');
}

/**
 * Update quote verification
 */
function updateQuoteVerification(message) {
  const result = {
    quote: message.quote,
    type: 'primary',
    verified: message.verified,
    similarity: message.similarity,
    nearestMatch: message.nearestMatch
  };

  const index = currentVerificationResults.findIndex(r => r.quote === message.quote);
  if (index >= 0) {
    currentVerificationResults[index] = result;
  } else {
    currentVerificationResults.push(result);
  }

  displayQuotes();
}

/**
 * Update validation result
 */
function updateValidationResult(message) {
  currentValidationResult = {
    supported: message.supported,
    similarity: message.similarity,
    suggestedQuotes: message.suggestedQuotes || [],
    analysis: message.analysis
  };

  displayValidation();
}

/**
 * Display new quotes from a round (streaming)
 */
function displayNewQuotesRound(message) {
  const container = document.getElementById('newQuotesContainer');
  
  // Create container on first round
  if (!container) {
    const newContainer = document.createElement('div');
    newContainer.id = 'newQuotesContainer';
    newContainer.className = 'new-quotes-container';
    newContainer.innerHTML = `
      <div class="new-quotes-header">
        <h3>Found Quotes</h3>
        <button class="close-btn" data-action="closeNewQuotes">✕</button>
      </div>
      <div class="new-quotes-list"></div>
      <div class="new-quotes-status">Searching round ${message.round}...</div>
    `;
    
    // Attach close button listener
    const closeBtn = newContainer.querySelector('[data-action="closeNewQuotes"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        newContainer.remove();
      });
    }
    
    const mainPanel = document.querySelector('.main-panel');
    if (mainPanel) {
      mainPanel.insertBefore(newContainer, mainPanel.firstChild);
    }
  }

  // Add quotes from this round
  const list = document.getElementById('newQuotesContainer').querySelector('.new-quotes-list');
  const status = document.getElementById('newQuotesContainer').querySelector('.new-quotes-status');
  
  message.quotes.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'new-quote-item';
    const quoteNumber = list.children.length + 1; // Calculate number when adding
    
    // Calculate support percentage and stars from confidence
    const confidence = q.confidence || 0;
    const percentage = Math.round(confidence * 100);
    const stars = Math.round(confidence * 5);
    const starDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    
    item.innerHTML = `
      <div class="quote-number">${quoteNumber}</div>
      <div class="quote-details">
        <div class="quote-summary">"${escapeHtml(q.summary)}"</div>
        <div class="quote-source">${escapeHtml(q.source)} (lines ${q.lineRange})</div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc; display: flex; align-items: center; gap: 12px; font-size: 12px; color: #000;">
          Support: ${starDisplay} ${percentage}%
        </div>
        <button class="btn btn-small btn-primary" data-action="addQuote" data-snippet-id="${escapeHtml(q.id)}" data-file-path="${escapeHtml(q.filePath)}" data-confidence="${confidence}">Add Quote</button>
      </div>
    `;
    
    // Attach add quote listener
    const addBtn = item.querySelector('[data-action="addQuote"]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const snippetId = addBtn.getAttribute('data-snippet-id');
        const filePath = addBtn.getAttribute('data-file-path');
        const confidence = parseFloat(addBtn.getAttribute('data-confidence')) || 0;
        acceptNewQuote(snippetId, filePath, confidence);
      });
    }
    
    list.appendChild(item);
  });
  
  status.textContent = `Searching round ${message.round}...`;
}

/**
 * Display completion message
 */
function displayNewQuotesComplete(message) {
  const container = document.getElementById('newQuotesContainer');
  if (container) {
    const status = container.querySelector('.new-quotes-status');
    if (status) {
      status.textContent = `Search complete: ${message.metadata.supportingFound} supporting quotes found across ${message.metadata.roundsCompleted} rounds`;
    }
  }
}

/**
 * Display new quotes (legacy - kept for compatibility)
 */
function displayNewQuotes(quotes) {
  if (!quotes || quotes.length === 0) {
    showNotification('No new quotes found', 'info');
    return;
  }

  // Create a container for new quotes
  const container = document.createElement('div');
  container.className = 'new-quotes-container';
  container.innerHTML = `
    <div class="new-quotes-header">
      <h3>Found ${quotes.length} Potential Quote${quotes.length !== 1 ? 's' : ''}</h3>
      <button class="close-btn" data-action="closeQuotes">✕</button>
    </div>
    <div class="new-quotes-list">
      ${quotes.map((q, i) => `
        <div class="new-quote-item">
          <div class="quote-number">${i + 1}</div>
          <div class="quote-details">
            <div class="quote-text">"${escapeHtml(q.text)}"</div>
            <div class="quote-source">${escapeHtml(q.source)} (${Math.round(q.similarity * 100)}% match)</div>
            <button class="btn btn-small btn-primary" data-action="addQuote" data-quote="${escapeHtml(q.text)}">Add Quote</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Attach close button listener
  const closeBtn = container.querySelector('[data-action="closeQuotes"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      container.remove();
    });
  }

  // Attach add quote listeners
  container.querySelectorAll('[data-action="addQuote"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const quote = btn.getAttribute('data-quote');
      acceptNewQuote(quote);
    });
  });

  // Insert at top of main panel
  const mainPanel = document.querySelector('.main-panel');
  if (mainPanel) {
    mainPanel.insertBefore(container, mainPanel.firstChild);
  }
}

/**
 * Display internet results
 */
function displayInternetResults(results) {
  if (!results || results.length === 0) {
    showNotification('No internet results found', 'info');
    return;
  }

  // Create a container for internet results
  const container = document.createElement('div');
  container.className = 'internet-results-container';
  container.innerHTML = `
    <div class="internet-results-header">
      <h3>Found ${results.length} Web Result${results.length !== 1 ? 's' : ''}</h3>
      <button class="close-btn" data-action="closeResults">✕</button>
    </div>
    <div class="internet-results-list">
      ${results.map((r, i) => `
        <div class="internet-result-item">
          <div class="result-number">${i + 1}</div>
          <div class="result-details">
            <div class="result-title">${escapeHtml(r.title)}</div>
            <div class="result-url"><a href="${escapeHtml(r.url)}" target="_blank">${escapeHtml(r.url)}</a></div>
            <div class="result-snippet">${escapeHtml(r.snippet)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Attach close button listener
  const closeBtn = container.querySelector('[data-action="closeResults"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      container.remove();
    });
  }

  // Insert at top of main panel
  const mainPanel = document.querySelector('.main-panel');
  if (mainPanel) {
    mainPanel.insertBefore(container, mainPanel.firstChild);
  }
}

/**
 * Show error
 */
function showError(message) {
  showNotification(`Error: ${message}`, 'error');
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  const container = document.querySelector('.main-panel');
  if (container) {
    container.insertBefore(notification, container.firstChild);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

/**
 * Handle snippet text loaded
 */
function handleSnippetTextLoaded(message) {
  if (!currentClaim) return;
  
  const quote = message.text;
  
  // Send message to add quote to supporting quotes
  vscode.postMessage({
    type: 'addSupportingQuote',
    claimId: currentClaim.id,
    quote: quote,
    source: message.source,
    lineRange: message.lineRange,
    confidence: message.confidence || 0
  });
  
  showNotification('Adding quote to supporting quotes...', 'info');
}

/**
 * Accept new quote
 */
function acceptNewQuote(snippetId, filePath, confidence = 0) {
  if (!currentClaim) return;
  
  // Request full text from extension
  vscode.postMessage({
    type: 'loadSnippetText',
    snippetId: snippetId,
    filePath: filePath,
    confidence: confidence
  });
  
  // Show loading state
  showNotification('Loading quote text...', 'info');
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
