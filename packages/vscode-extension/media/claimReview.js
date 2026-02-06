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

  // Search box controls
  const minimizeBtn = document.getElementById('minimizeSearchBtn');
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      const container = document.getElementById('newQuotesContainer');
      if (container) {
        container.classList.toggle('minimized');
        minimizeBtn.textContent = container.classList.contains('minimized') ? '+' : '−';
      }
    });
  }

  const closeSearchBtn = document.getElementById('closeSearchBtn');
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener('click', () => {
      const container = document.getElementById('newQuotesContainer');
      if (container) {
        container.style.display = 'none';
      }
    });
  }

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
  'searchCandidatesFound': (msg) => displaySearchCandidates(msg),
  'verificationUpdate': (msg) => updateCandidateVerification(msg),
  'snippetTextLoaded': (msg) => handleSnippetTextLoaded(msg),
  'addSupportingQuote': (msg) => handleAddSupportingQuote(msg),
  'searchInternet': (msg) => displayInternetResults(msg.results),
  'supportValidated': (msg) => updateValidationResult(msg),
  'expandedContext': (msg) => handleExpandedContext(msg),
  'updateVerificationResults': (msg) => updateVerificationResults(msg),
  'updateValidationResult': (msg) => updateValidationResultStreaming(msg),
  'updateUsageLocations': (msg) => updateUsageLocationsStreaming(msg),
  'verificationProgress': (msg) => updateVerificationProgress(msg),
  'autoFindQuotesStarted': () => showAutoFindQuotesState(),
  'validationNotCached': () => showValidateButton(),
  'showHelp': () => toggleHelpOverlay(),
  'memoryWarning': (msg) => showNotification(msg.message, 'info'),
  'error': (msg) => showError(msg.message),
  'operationsCancelled': (msg) => handleOperationsCancelled(msg),
  'displayOrphanCitations': (msg) => displayOrphanCitations(msg.orphanCitations),
  'quotesFromPaper': (msg) => displayQuotesFromPaper(msg.results, msg.authorYear),
  'debugLog': (msg) => addDebugLogEntry(msg.entry),
  'quoteAttached': (msg) => {
    console.log('[ClaimReview] Quote attached successfully');
    // Reload claim to show updated quotes
    if (currentClaim) {
      vscode.postMessage({ type: 'loadClaim', claimId: currentClaim.id });
    }
  },
  'orphanCitationRemoved': (msg) => {
    console.log('[ClaimReview] Orphan citation removed');
    // Reload claim to show updated orphan citations
    if (currentClaim) {
      vscode.postMessage({ type: 'loadClaim', claimId: currentClaim.id });
    }
  }
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
  // Only reset validation result if a new one isn't being provided
  if (message.validationResult !== undefined) {
    currentValidationResult = message.validationResult || {};
  } else {
    currentValidationResult = {};
  }
  currentUsageLocations = message.usageLocations || [];

  console.log('[ClaimReview] Displaying claim:', currentClaim);

  // Close the quote viewer/search container when switching to a new claim
  const searchContainer = document.getElementById('newQuotesContainer');
  if (searchContainer) {
    searchContainer.style.display = 'none';
    const list = searchContainer.querySelector('.new-quotes-list');
    if (list) {
      list.innerHTML = '';
    }
  }

  // Display claim header
  const header = document.getElementById('claimHeader');
  if (header) {
    const idEl = header.querySelector('.claim-id');
    const textEl = header.querySelector('.claim-text');
    const categoryEl = header.querySelector('.category');
    
    if (idEl) idEl.textContent = currentClaim.id || '';
    if (textEl) textEl.textContent = currentClaim.text || '';
    if (categoryEl) categoryEl.textContent = currentClaim.category || 'Uncategorized';
  }

  // Display quotes
  displayQuotes();

  // Check if claim has quotes
  const hasQuotes = !!(
    (currentClaim.primaryQuote && (typeof currentClaim.primaryQuote === 'string' ? currentClaim.primaryQuote : currentClaim.primaryQuote.text)) ||
    (currentClaim.supportingQuotes && currentClaim.supportingQuotes.length > 0 && currentClaim.supportingQuotes.some(q => q && q.text))
  );

  // Display validation (only if we have data, and only show loading if claim has quotes)
  if (message.validationResult && message.validationResult.similarity) {
    displayValidation();
  } else if (message.isInitialLoad && hasQuotes) {
    // Show "Validate Support" button for on-demand validation
    showValidateButton();
  }

  // Display usage locations (only if we have data)
  if (message.usageLocations && message.usageLocations.length > 0) {
    displayUsageLocations();
  } else if (message.isInitialLoad) {
    // Show loading indicator for usage locations
    showUsageLocationsLoading();
  }
}

/**
 * Show loading indicator for validation section
 */
function showValidationLoading() {
  let validationSection = document.getElementById('validationSection');
  if (!validationSection) {
    validationSection = document.createElement('div');
    validationSection.id = 'validationSection';
    validationSection.className = 'validation-section';
    
    const quotesSection = document.getElementById('quotesSection');
    if (quotesSection && quotesSection.parentNode) {
      quotesSection.parentNode.insertBefore(validationSection, quotesSection.nextSibling);
    }
  }

  validationSection.innerHTML = `
    <h2>VALIDATION</h2>
    <div class="validation-result loading">
      <div class="validation-header">
        <span class="validation-icon">⏳</span>
        <span class="validation-title">Validating claim support...</span>
      </div>
      <div class="validation-analysis">Analyzing claim against literature...</div>
    </div>
  `;
}

/**
 * Update verification progress as quotes are verified
 */
function updateVerificationProgress(message) {
  const { current, total } = message;
  const quotesSection = document.getElementById('quotesSection');
  
  if (!quotesSection) return;
  
  // Find or create progress bar
  let progressBar = quotesSection.querySelector('.verification-progress-bar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.className = 'verification-progress-bar';
    quotesSection.insertBefore(progressBar, quotesSection.firstChild);
  }
  
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const progressFill = progressBar.querySelector('.progress-fill') || document.createElement('div');
  
  if (!progressBar.querySelector('.progress-fill')) {
    progressFill.className = 'progress-fill';
    progressBar.appendChild(progressFill);
  }
  
  progressFill.style.width = percentage + '%';
  
  // Update or create progress text
  let progressText = progressBar.querySelector('.progress-text');
  if (!progressText) {
    progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressBar.appendChild(progressText);
  }
  
  progressText.textContent = `Verifying quotes: ${current}/${total}`;
  
  console.log('[ClaimReview] Verification progress:', current, '/', total);
}

/**
 * Show auto-find quotes state when claim has no quotes
 */
function showAutoFindQuotesState() {
  console.log('[ClaimReview] Auto-find quotes started');
  
  // Show the new quotes container with searching state
  const container = document.getElementById('newQuotesContainer');
  if (container) {
    container.style.display = 'block';
    const header = container.querySelector('.new-quotes-header h3');
    if (header) {
      header.textContent = 'Automatically searching for supporting quotes...';
    }
    const status = container.querySelector('.new-quotes-status');
    if (status) {
      status.textContent = 'Searching literature for evidence to support this claim...';
    }
    const list = container.querySelector('.new-quotes-list');
    if (list) {
      list.innerHTML = '';
    }
  }
  
  // Hide the verification progress bar since there are no quotes to verify
  const progressBar = document.querySelector('.verification-progress-bar');
  if (progressBar) {
    progressBar.style.display = 'none';
  }
}

/**
 * Show loading indicator for usage locations
 */
function showUsageLocationsLoading() {
  const usageList = document.getElementById('usageList');
  if (usageList) {
    usageList.innerHTML = '<div style="padding: 12px; color: #999;">⏳ Searching manuscript...</div>';
  }
}

/**
 * Show "Validate Support" button when no cached validation exists
 */
function showValidateButton() {
  console.log('[ClaimReview] No cached validation - showing Validate button');
  
  // Find or create validation section
  let validationSection = document.getElementById('validationSection');
  if (!validationSection) {
    validationSection = document.createElement('div');
    validationSection.id = 'validationSection';
    validationSection.className = 'validation-section';
    
    const quotesSection = document.getElementById('quotesSection');
    if (quotesSection && quotesSection.parentNode) {
      quotesSection.parentNode.insertBefore(validationSection, quotesSection.nextSibling);
    }
  }

  validationSection.innerHTML = `
    <h2>VALIDATION</h2>
    <div class="validation-result not-validated">
      <div class="validation-header">
        <span class="validation-icon">○</span>
        <span class="validation-title">Claim-Quote Support: Not yet validated</span>
      </div>
      <div class="validation-analysis">Click the button below to analyze how well your quotes support this claim.</div>
      <div class="validation-actions">
        <button class="btn btn-primary" id="validateSupportBtn">Validate Support</button>
      </div>
    </div>
  `;

  // Attach event listener
  const validateBtn = validationSection.querySelector('#validateSupportBtn');
  if (validateBtn) {
    validateBtn.addEventListener('click', () => {
      validateSupport();
    });
  }
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
        <span class="quote-type">PRIMARY</span>
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
    supportingContainer.style.display = 'block';
  } else {
    supportingContainer.style.display = 'none';
  }
}

/**
 * Display quote container
 */
function displayQuoteContainer(container, quote, result, type) {
  const statusIcon = getStatusIcon(result);
  const verificationText = getVerificationText(result);
  const similarity = result?.similarity || 0;
  
  // Check if we have alternative sources or closest match
  const hasAlternativeSources = result?.alternativeSources && result.alternativeSources.length > 0;
  const hasClosestMatch = result && !result.verified && result.closestMatch;
  const bestMatch = hasAlternativeSources ? result.alternativeSources[0].matchedText : (hasClosestMatch ? result.closestMatch : null);
  
  // Get source paper name for display
  let sourcePaperHtml = '';
  if (hasAlternativeSources) {
    const topSource = result.alternativeSources[0];
    const sourceName = topSource.source;
    const sourceFile = topSource.metadata?.sourceFile || '';
    const lineRange = topSource.context || '';
    sourcePaperHtml = `<div class="quote-source-paper">📄 <strong>${escapeHtml(sourceName)}</strong> ${lineRange ? `(${lineRange})` : ''}</div>`;
  } else if (result?.source) {
    sourcePaperHtml = `<div class="quote-source-paper">📄 <strong>${escapeHtml(result.source)}</strong></div>`;
  }
  
  // Build Zotero metadata HTML (Requirements: 3.5, 3.6, 3.7, 3.8)
  const zoteroMetadataHtml = buildZoteroMetadataHtml(result);
  
  // Build Jump to PDF button HTML (Requirements: 2.1, 2.2, 2.8, 6.6)
  // TODO: Get Zotero availability status from extension state
  const jumpToPdfButtonHtml = buildJumpToPdfButtonHtml(result, true);
  
  // Build buttons HTML
  let buttonsHtml = `
    <button class="btn btn-danger" data-action="deleteQuote" data-quote="${escapeHtml(quote)}">Delete</button>
    <button class="btn btn-secondary" data-action="findNewQuotes">Find New</button>
  `;
  
  // Add Recheck Sources button if quote was not found
  if (result?.searchStatus === 'not_found') {
    buttonsHtml = `<button class="btn btn-primary" data-action="recheckSources" data-quote="${escapeHtml(quote)}">Recheck Sources</button>` + buttonsHtml;
  }
  
  // Add Jump to PDF button if available
  if (jumpToPdfButtonHtml) {
    buttonsHtml = jumpToPdfButtonHtml + buttonsHtml;
  }

  // Build verification and support info on same line
  let infoHtml = '';
  const confidence = result?.confidence;
  if (confidence !== undefined && confidence > 0) {
    const percentage = Math.round(confidence * 100);
    const stars = Math.round(confidence * 5);
    const starDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    infoHtml = `<div class="verification-info ${getStatusClass(result)}">${verificationText} • Support: ${starDisplay} ${percentage}%</div>`;
  } else {
    infoHtml = `<div class="verification-info ${getStatusClass(result)}">${verificationText}</div>`;
  }

  // Build the quote display - always with edit mode capability
  let quoteDisplayHtml = '';
  
  // Extract metadata if available
  const metadata = (hasAlternativeSources && result.alternativeSources[0].metadata) ? result.alternativeSources[0].metadata : null;
  const sourceForMetadata = hasAlternativeSources ? result.alternativeSources[0].source : null;
  
  if (bestMatch && metadata) {
    // Two-column edit mode with source text from metadata
    quoteDisplayHtml = `
      <div class="quote-text-wrapper" data-quote="${escapeHtml(quote)}" data-best-match="${escapeHtml(bestMatch)}" data-source-file="${escapeHtml(metadata.sourceFile)}" data-start-line="${metadata.startLine}" data-end-line="${metadata.endLine}" data-source-name="${escapeHtml(sourceForMetadata || '')}">
        <div class="quote-display-mode">
          <div class="quote-text editable-quote">${escapeHtml(quote)}</div>
        </div>
        <div class="quote-edit-mode" style="display: none;">
          <div class="quote-edit-column">
            <div class="quote-edit-label">Your Quote (editable)</div>
            <textarea class="quote-edit-textarea">${escapeHtml(quote)}</textarea>
          </div>
          <div class="quote-edit-column">
            <div class="quote-edit-label">
              Source Text
              <div class="quote-expand-controls">
                <button class="btn-icon" data-action="expandUp" title="Show more context above">▲</button>
                <button class="btn-icon" data-action="expandDown" title="Show more context below">▼</button>
                <button class="btn-icon" data-action="reset" title="Reset to original">↻</button>
              </div>
            </div>
            <div class="quote-edit-match">${escapeHtml(bestMatch)}</div>
          </div>
          <div class="quote-edit-actions">
            <button class="btn btn-secondary btn-small" data-action="cancelEdit">Cancel</button>
            <button class="btn btn-primary btn-small" data-action="saveEdit">Save</button>
          </div>
        </div>
      </div>
    `;
  } else {
    // Single-column edit mode without source text
    quoteDisplayHtml = `
      <div class="quote-text-wrapper" data-quote="${escapeHtml(quote)}">
        <div class="quote-display-mode">
          <div class="quote-text editable-quote">${escapeHtml(quote)}</div>
        </div>
        <div class="quote-edit-mode" style="display: none;">
          <div class="quote-edit-column" style="grid-column: 1 / -1;">
            <div class="quote-edit-label">Edit Quote</div>
            <textarea class="quote-edit-textarea">${escapeHtml(quote)}</textarea>
          </div>
          <div class="quote-edit-actions">
            <button class="btn btn-secondary btn-small" data-action="cancelEdit">Cancel</button>
            <button class="btn btn-primary btn-small" data-action="saveEdit">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="quote-header">
      <span class="quote-type">${type === 'primary' ? 'PRIMARY' : 'SUPPORTING'}</span>
      <span class="status-icon ${getStatusClass(result)}">${statusIcon}</span>
    </div>
    ${zoteroMetadataHtml}
    ${sourcePaperHtml}
    ${quoteDisplayHtml}
    ${infoHtml}
    <div class="quote-actions">
      ${buttonsHtml}
    </div>
  `;
  
  // Attach event listener to make quote text clickable
  const quoteWrapper = container.querySelector('.quote-text-wrapper');
  if (quoteWrapper) {
    const displayMode = quoteWrapper.querySelector('.quote-display-mode');
    const editMode = quoteWrapper.querySelector('.quote-edit-mode');
    
    if (displayMode && editMode) {
      // Click on quote text to enter edit mode
      displayMode.addEventListener('click', () => {
        displayMode.style.display = 'none';
        editMode.style.display = 'grid';
        const textarea = editMode.querySelector('.quote-edit-textarea');
        if (textarea) {
          textarea.focus();
        }
      });
      
      // Cancel edit
      const cancelBtn = editMode.querySelector('[data-action="cancelEdit"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          editMode.style.display = 'none';
          displayMode.style.display = 'block';
          // Reset textarea to original value
          const textarea = editMode.querySelector('.quote-edit-textarea');
          if (textarea) {
            textarea.value = quote;
          }
        });
      }
      
      // Save edit
      const saveBtn = editMode.querySelector('[data-action="saveEdit"]');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const textarea = editMode.querySelector('.quote-edit-textarea');
          const newQuote = textarea.value.trim();
          if (newQuote) {
            // Extract metadata if available
            const sourceFile = quoteWrapper.getAttribute('data-source-file');
            const startLine = quoteWrapper.getAttribute('data-current-start-line') || quoteWrapper.getAttribute('data-start-line');
            const endLine = quoteWrapper.getAttribute('data-current-end-line') || quoteWrapper.getAttribute('data-end-line');
            const sourceName = quoteWrapper.getAttribute('data-source-name');
            
            const metadata = sourceFile ? {
              sourceFile: sourceFile,
              startLine: parseInt(startLine),
              endLine: parseInt(endLine)
            } : undefined;
            
            // Extract author-year from source name if we have it
            let newSource = undefined;
            if (sourceName && newQuote !== quote) {
              // Only update source if quote text changed and we have source metadata
              const authorYearMatch = sourceName.match(/^([^-]+)\s*-\s*(\d{4})/);
              newSource = authorYearMatch ? `${authorYearMatch[1].trim().split(' ')[0]}${authorYearMatch[2]}` : undefined;
            }
            
            vscode.postMessage({
              type: 'acceptQuote',
              claimId: currentClaim.id,
              quote: quote,
              newQuote: newQuote,
              newSource: newSource,
              metadata: metadata
            });
          }
          editMode.style.display = 'none';
          displayMode.style.display = 'block';
        });
      }
      
      // Expand controls
      const expandUpBtn = editMode.querySelector('[data-action="expandUp"]');
      if (expandUpBtn) {
        expandUpBtn.addEventListener('click', () => {
          expandContext(quoteWrapper, 'up');
        });
      }
      
      const expandDownBtn = editMode.querySelector('[data-action="expandDown"]');
      if (expandDownBtn) {
        expandDownBtn.addEventListener('click', () => {
          expandContext(quoteWrapper, 'down');
        });
      }
      
      const resetBtn = editMode.querySelector('[data-action="reset"]');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          const originalMatch = quoteWrapper.getAttribute('data-best-match');
          const matchDiv = editMode.querySelector('.quote-edit-match');
          if (matchDiv && originalMatch) {
            matchDiv.textContent = originalMatch;
            // Reset stored line numbers
            const sourceFile = quoteWrapper.getAttribute('data-source-file');
            const startLine = parseInt(quoteWrapper.getAttribute('data-start-line') || '0');
            const endLine = parseInt(quoteWrapper.getAttribute('data-end-line') || '0');
            quoteWrapper.setAttribute('data-current-start-line', startLine.toString());
            quoteWrapper.setAttribute('data-current-end-line', endLine.toString());
          }
        });
      }
    }
  }
  
  // Attach event listeners for action buttons
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
  
  // Attach event listener for Jump to PDF button
  const jumpBtn = container.querySelector('[data-action="jumpToPdf"]');
  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => {
      const annotationKey = jumpBtn.getAttribute('data-annotation-key');
      const itemKey = jumpBtn.getAttribute('data-item-key');
      const pageNumber = jumpBtn.getAttribute('data-page-number');
      
      vscode.postMessage({
        type: 'jumpToPdf',
        annotationKey: annotationKey || undefined,
        itemKey: itemKey || undefined,
        pageNumber: pageNumber ? parseInt(pageNumber) : undefined
      });
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
  
  // If verified in claimed source, show that with source name
  if (result.verified) {
    // Try to get source name from alternativeSources or from the quote's source
    if (result.alternativeSources && result.alternativeSources.length > 0) {
      const sourceName = result.alternativeSources[0].source;
      return `✓ Verified in ${escapeHtml(sourceName)} (${similarity}% match)`;
    }
    return `✓ Verified in source (${similarity}% match)`;
  }
  
  // If we found it in alternative sources, show that prominently
  if (result.alternativeSources && result.alternativeSources.length > 0) {
    const topMatch = result.alternativeSources[0];
    const matchSimilarity = Math.round(topMatch.similarity * 100);
    if (matchSimilarity >= 90) {
      return `✓ Found in ${escapeHtml(topMatch.source)} (${matchSimilarity}% match)`;
    }
    return `Found in ${escapeHtml(topMatch.source)} (${matchSimilarity}% match)`;
  }
  
  // Only show "not found" if we truly couldn't find it anywhere
  if (result.searchStatus === 'not_found') {
    return '✗ Not found in any source';
  }
  
  // Default fallback
  return `Not verified (${similarity}% match in claimed source)`;
}

/**
 * Display validation results
 */
function displayValidation() {
  if (!currentValidationResult || !currentValidationResult.similarity) {
    return;
  }

  // Find or create validation section after quotes section
  let validationSection = document.getElementById('validationSection');
  if (!validationSection) {
    validationSection = document.createElement('div');
    validationSection.id = 'validationSection';
    validationSection.className = 'validation-section';
    
    const quotesSection = document.getElementById('quotesSection');
    if (quotesSection && quotesSection.parentNode) {
      quotesSection.parentNode.insertBefore(validationSection, quotesSection.nextSibling);
    }
  }

  const similarity = currentValidationResult.similarity;
  const supported = currentValidationResult.supported;
  const suggestedQuotes = currentValidationResult.suggestedQuotes || [];
  const analysis = currentValidationResult.analysis || '';

  // Determine status class
  let statusClass = 'weak';
  let statusIcon = '⚠';
  if (similarity >= 0.75) {
    statusClass = 'strong';
    statusIcon = '✓';
  } else if (similarity >= 0.6) {
    statusClass = 'moderate';
    statusIcon = '○';
  }

  // Build suggested quotes HTML
  let suggestedQuotesHtml = '';
  if (suggestedQuotes.length > 0) {
    suggestedQuotesHtml = `
      <div class="suggested-quotes">
        <h4>Suggested Alternative Quotes:</h4>
        ${suggestedQuotes.map((quote, i) => `
          <div class="suggested-quote-item">
            <div class="quote-number">${i + 1}</div>
            <div class="quote-text">${escapeHtml(quote)}</div>
            <button class="btn btn-small btn-primary" data-action="useSuggestedQuote" data-quote="${escapeHtml(quote)}">Use This Quote</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  validationSection.innerHTML = `
    <h2>VALIDATION</h2>
    <div class="validation-result ${statusClass}">
      <div class="validation-header">
        <span class="validation-icon">${statusIcon}</span>
        <span class="validation-title">Claim-Quote Support: ${Math.round(similarity * 100)}%</span>
      </div>
      <div class="validation-analysis">${escapeHtml(analysis)}</div>
      ${suggestedQuotesHtml}
    </div>
  `;

  // Attach event listeners for suggested quotes
  validationSection.querySelectorAll('[data-action="useSuggestedQuote"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const quote = btn.getAttribute('data-quote');
      useSuggestedQuote(quote);
    });
  });
}

/**
 * Use a suggested quote as the primary quote
 */
function useSuggestedQuote(quote) {
  if (!currentClaim) return;
  
  showConfirmModal(
    'Replace Primary Quote',
    'Replace the current primary quote with this suggested quote?',
    (confirmed) => {
      if (confirmed) {
        vscode.postMessage({
          type: 'acceptQuote',
          claimId: currentClaim.id,
          quote: currentClaim.primaryQuote?.text || '',
          newQuote: quote
        });
      }
    }
  );
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
 * Update verification results as they stream in
 */
function updateVerificationResults(message) {
  currentVerificationResults = message.verificationResults || [];
  console.log('[ClaimReview] Verification results updated:', currentVerificationResults.length, 'results');
  
  // Hide the progress bar since verification is complete
  const progressBar = document.querySelector('.verification-progress-bar');
  if (progressBar) {
    progressBar.style.display = 'none';
  }
  
  // Re-render quotes with updated verification data
  displayQuotes();
}

/**
 * Update validation result as it completes
 */
function updateValidationResultStreaming(message) {
  currentValidationResult = message.validationResult || {};
  console.log('[ClaimReview] Validation result updated:', {
    similarity: currentValidationResult.similarity,
    supported: currentValidationResult.supported,
    isCached: message.isCached
  });
  
  // Re-render validation section
  displayValidation();
}

/**
 * Update usage locations as they load
 */
function updateUsageLocationsStreaming(message) {
  currentUsageLocations = message.usageLocations || [];
  console.log('[ClaimReview] Usage locations updated:', currentUsageLocations.length, 'locations');
  
  // Re-render usage locations
  displayUsageLocations();
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
    case 'recheckSources':
      recheckQuoteSources();
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
 * Compare quote - show side-by-side comparison with closest match
 */
function compareQuote(currentQuote, closestMatch) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // Create modal dialog
  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog modal-compare';
  
  dialog.innerHTML = `
    <h3>Compare Quotes</h3>
    <div class="compare-container">
      <div class="compare-column">
        <h4>Current Quote</h4>
        <div class="compare-text">${escapeHtml(currentQuote)}</div>
      </div>
      <div class="compare-column">
        <h4>Suggested Quote (from source)</h4>
        <div class="compare-text compare-suggested">${escapeHtml(closestMatch)}</div>
      </div>
    </div>
    <div class="modal-buttons">
      <button class="btn btn-secondary" id="modalKeepCurrent">Keep Current</button>
      <button class="btn btn-primary" id="modalUseSuggested">Use Suggested</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Handle use suggested
  const useSuggestedBtn = dialog.querySelector('#modalUseSuggested');
  useSuggestedBtn.addEventListener('click', () => {
    overlay.remove();
    vscode.postMessage({
      type: 'acceptQuote',
      claimId: currentClaim.id,
      quote: currentQuote,
      newQuote: closestMatch
    });
  });
  
  // Handle keep current
  const keepCurrentBtn = dialog.querySelector('#modalKeepCurrent');
  keepCurrentBtn.addEventListener('click', () => {
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
 * Accept quote (legacy - kept for compatibility)
 */
function acceptQuote(quote) {
  editQuote(quote);
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
 * Recheck if a quote can be found in any source
 * Used when a quote was previously marked as "not found"
 */
function recheckQuoteSources() {
  if (!currentClaim || !currentClaim.primaryQuote) return;
  
  vscode.postMessage({
    type: 'recheckQuoteSources',
    claimId: currentClaim.id,
    quote: currentClaim.primaryQuote.text
  });
}

/**
 * Find new quotes
 */
function findNewQuotes() {
  if (!currentClaim) return;
  
  // Show/reuse the search container
  const container = document.getElementById('newQuotesContainer');
  
  if (container) {
    // Reset to expanded state
    container.classList.remove('minimized');
    container.style.display = 'block';
    
    // Clear previous results
    const list = container.querySelector('.new-quotes-list');
    list.innerHTML = '';
    
    // Update header
    const header = container.querySelector('.new-quotes-header h3');
    header.textContent = 'Searching for Quotes...';
    
    // Update status
    const status = container.querySelector('.new-quotes-status');
    status.textContent = 'Initializing search...';
  }
  
  vscode.postMessage({
    type: 'findNewQuotes',
    claimId: currentClaim.id,
    query: currentClaim.text
  });
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
 * This is called when a round completes with verified supporting quotes
 */
function displayNewQuotesRound(message) {
  const container = document.getElementById('newQuotesContainer');
  
  if (!container) {
    console.warn('[ClaimReview] Search container not found');
    return;
  }

  // Show container if hidden
  container.style.display = 'block';
  container.classList.remove('minimized');

  // Update header on first round
  if (message.round === 1) {
    const header = container.querySelector('.new-quotes-header h3');
    header.textContent = 'Found Quotes';
  }

  // Update allCandidates with the verified results from this round
  // This ensures the verification status is reflected
  message.quotes.forEach(q => {
    const existing = allCandidates.find(c => c.id === q.id);
    if (existing) {
      // Update existing candidate
      existing.verified = true;
      existing.supports = true; // These are supporting quotes
      existing.confidence = q.confidence || 0;
      console.log('[ClaimReview] Updated candidate from round complete:', q.id);
    } else {
      // Add new candidate (in case it wasn't streamed via searchCandidatesFound)
      allCandidates.push({
        id: q.id,
        text: q.summary,
        source: q.source,
        lineRange: q.lineRange,
        filePath: q.filePath,
        searchSource: q.searchSource || 'literature',
        round: message.round,
        verified: true,
        supports: true,
        confidence: q.confidence || 0
      });
      console.log('[ClaimReview] Added new candidate from round complete:', q.id);
    }
  });

  // Re-render with updated data
  renderTopCandidates(container);
  
  const status = container.querySelector('.new-quotes-status');
  const supporting = allCandidates.filter(c => c.verified && c.supports).length;
  const verifying = allCandidates.filter(c => !c.verified).length;
  
  if (verifying > 0) {
    status.textContent = `Found ${supporting} supporting quotes, verifying ${verifying} more...`;
  } else {
    status.textContent = `Round ${message.round} complete: ${supporting} supporting quotes`;
  }
}

/**
 * Display search candidates immediately (before verification)
 */
let allCandidates = []; // Track all candidates across rounds
const MAX_DISPLAYED_CANDIDATES = 10;

function displaySearchCandidates(message) {
  const container = document.getElementById('newQuotesContainer');
  
  if (!container) {
    console.warn('[ClaimReview] Search container not found');
    return;
  }

  // Show container if hidden
  container.style.display = 'block';
  container.classList.remove('minimized');

  // For round 1, reset candidates
  if (message.round === 1) {
    allCandidates = [];
  }

  // Add new candidates to tracking array
  message.candidates.forEach(candidate => {
    allCandidates.push({
      ...candidate,
      round: message.round,
      verified: false,
      supports: false,
      confidence: 0
    });
  });

  // Update header
  const header = container.querySelector('.new-quotes-header h3');
  header.textContent = `Round ${message.round}: Found ${message.candidates.length} candidates`;

  // Render the top candidates
  renderTopCandidates(container);
  
  const status = container.querySelector('.new-quotes-status');
  status.textContent = `Verifying ${allCandidates.filter(c => !c.verified).length} candidates...`;
}

/**
 * Render the top candidates, split into Verified Quotes (local) and Paper Leads (web)
 */
function renderTopCandidates(container) {
  const list = container.querySelector('.new-quotes-list');
  list.innerHTML = '';
  
  // Filter out rejected candidates - only show verifying and supporting
  const visibleCandidates = allCandidates.filter(c => !c.verified || c.supports);
  
  // Split into local quotes vs paper leads (web sources)
  const isLocalSource = (c) => c.searchSource === 'literature' || !c.searchSource;
  const localCandidates = visibleCandidates.filter(isLocalSource);
  const webCandidates = visibleCandidates.filter(c => !isLocalSource(c));
  
  // Sort each group: verified supporting (by confidence) > verifying
  const sortByConfidence = (a, b) => {
    if (a.verified && a.supports && b.verified && b.supports) {
      return b.confidence - a.confidence;
    }
    if (a.verified && a.supports) return -1;
    if (b.verified && b.supports) return 1;
    return 0;
  };
  
  const sortedLocal = [...localCandidates].sort(sortByConfidence);
  const sortedWeb = [...webCandidates].sort(sortByConfidence);
  
  // Render Verified Quotes section (local)
  if (sortedLocal.length > 0) {
    const localSection = document.createElement('div');
    localSection.className = 'candidates-section local-quotes-section';
    localSection.innerHTML = `
      <h4 class="candidates-section-header">📁 Verified Quotes <span class="section-count">(${sortedLocal.filter(c => c.verified && c.supports).length} supporting)</span></h4>
      <p class="section-description">From your indexed literature - ready to cite</p>
    `;
    
    const localList = document.createElement('div');
    localList.className = 'candidates-list';
    sortedLocal.slice(0, 5).forEach((candidate, i) => {
      localList.appendChild(renderCandidate(candidate, i, 'local'));
    });
    
    if (sortedLocal.length > 5) {
      const moreDiv = document.createElement('div');
      moreDiv.className = 'more-candidates-notice';
      moreDiv.textContent = `+ ${sortedLocal.length - 5} more local quotes`;
      localList.appendChild(moreDiv);
    }
    
    localSection.appendChild(localList);
    list.appendChild(localSection);
  }
  
  // Render Paper Leads section (web)
  if (sortedWeb.length > 0) {
    const webSection = document.createElement('div');
    webSection.className = 'candidates-section paper-leads-section';
    webSection.innerHTML = `
      <h4 class="candidates-section-header">🔍 Paper Leads <span class="section-count">(${sortedWeb.filter(c => c.verified && c.supports).length} relevant)</span></h4>
      <p class="section-description">Papers to consider adding to your library</p>
    `;
    
    const webList = document.createElement('div');
    webList.className = 'candidates-list';
    sortedWeb.slice(0, 5).forEach((candidate, i) => {
      webList.appendChild(renderCandidate(candidate, i, 'web'));
    });
    
    if (sortedWeb.length > 5) {
      const moreDiv = document.createElement('div');
      moreDiv.className = 'more-candidates-notice';
      moreDiv.textContent = `+ ${sortedWeb.length - 5} more paper leads`;
      webList.appendChild(moreDiv);
    }
    
    webSection.appendChild(webList);
    list.appendChild(webSection);
  }
  
  // Show message if nothing found
  if (sortedLocal.length === 0 && sortedWeb.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'no-candidates-notice';
    emptyDiv.textContent = 'No supporting evidence found yet...';
    list.appendChild(emptyDiv);
  }
}

/**
 * Render a single candidate item
 */
function renderCandidate(candidate, index, type) {
  const item = document.createElement('div');
  item.id = `candidate-${candidate.id}`;
  
  // Build search source indicator
  const searchSource = candidate.searchSource || 'literature';
  const sourceIndicators = {
    'literature': '<span class="quote-source-indicator local">📁 Local</span>',
    'semantic-scholar': '<span class="quote-source-indicator semantic-scholar">🎓 Semantic Scholar</span>',
    'pubmed': '<span class="quote-source-indicator pubmed">🏥 PubMed</span>',
    'arxiv': '<span class="quote-source-indicator arxiv">📄 arXiv</span>',
    'crossref': '<span class="quote-source-indicator crossref">🔗 CrossRef</span>',
    'web': '<span class="quote-source-indicator web">🌐 Web</span>'
  };
  const sourceIndicator = sourceIndicators[searchSource] || sourceIndicators['web'];
  
  // For web sources, show title if available
  const displaySource = candidate.metadata?.title 
    ? `${candidate.metadata.title} (${candidate.source})`
    : candidate.source;
  
  const lineInfo = type === 'local' ? ` (lines ${candidate.lineRange})` : '';
  
  if (!candidate.verified) {
    item.className = 'new-quote-item candidate-verifying';
    item.innerHTML = `
      <div class="quote-number">${index + 1}</div>
      <div class="quote-details">
        <div class="quote-summary">"${escapeHtml(candidate.text)}"</div>
        <div class="quote-source">${sourceIndicator} ${escapeHtml(displaySource)}${lineInfo}</div>
        <div class="verification-status verifying">
          <span class="status-spinner">⏳</span> Verifying...
        </div>
      </div>
    `;
  } else if (candidate.supports) {
    const percentage = Math.round(candidate.confidence * 100);
    const stars = Math.round(candidate.confidence * 5);
    const starDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    
    const buttonLabel = type === 'local' ? 'Add Quote' : 'Add as Lead';
    
    item.className = 'new-quote-item candidate-supports';
    item.innerHTML = `
      <div class="quote-number">${index + 1}</div>
      <div class="quote-details">
        <div class="quote-summary">"${escapeHtml(candidate.text)}"</div>
        <div class="quote-source">${sourceIndicator} ${escapeHtml(displaySource)}${lineInfo}</div>
        <div class="verification-status supports">
          <span class="status-icon">✓</span> ${type === 'local' ? 'Supports claim' : 'Relevant paper'}
          <div style="margin-top: 4px;">Relevance: ${starDisplay} ${percentage}%</div>
        </div>
        <button class="btn btn-small btn-primary" data-action="addQuote" data-snippet-id="${escapeHtml(candidate.id)}" data-confidence="${candidate.confidence}" data-search-source="${candidate.searchSource || 'literature'}" data-quote-text="${escapeHtml(candidate.text)}" data-quote-source="${escapeHtml(candidate.source)}" data-quote-url="${escapeHtml(candidate.filePath || '')}" data-candidate-index="${index}">${buttonLabel}</button>
      </div>
    `;
    
    // Attach add quote listener
    const addBtn = item.querySelector('[data-action="addQuote"]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const searchSource = addBtn.getAttribute('data-search-source');
        if (type === 'web' || searchSource !== 'literature') {
          // For web results, pass the full candidate data
          const quoteText = addBtn.getAttribute('data-quote-text');
          const quoteSource = addBtn.getAttribute('data-quote-source');
          const quoteUrl = addBtn.getAttribute('data-quote-url');
          const confidence = parseFloat(addBtn.getAttribute('data-confidence')) || 0;
          acceptWebQuote(quoteText, quoteSource, quoteUrl, confidence, candidate);
        } else {
          acceptNewQuote(candidate.id, candidate.filePath || '', candidate.confidence);
        }
      });
    }
  }
  
  return item;
}

/**
 * Update a candidate's verification status
 */
function updateCandidateVerification(message) {
  console.log('[ClaimReview] Verification update received:', message.snippetId, 'supports:', message.supports);
  
  // Find and update the candidate in our tracking array
  const candidate = allCandidates.find(c => c.id === message.snippetId);
  
  if (!candidate) {
    console.warn('[ClaimReview] Candidate not found:', message.snippetId, 'Available IDs:', allCandidates.map(c => c.id));
    return;
  }
  
  console.log('[ClaimReview] Updating candidate:', candidate.id, 'verified:', true, 'supports:', message.supports);
  
  candidate.verified = true;
  candidate.supports = message.supports;
  candidate.confidence = message.confidence || 0;
  
  // Re-render the list (will re-sort by confidence)
  const container = document.getElementById('newQuotesContainer');
  if (container) {
    renderTopCandidates(container);
    
    // Update status
    const verifying = allCandidates.filter(c => !c.verified).length;
    const supporting = allCandidates.filter(c => c.verified && c.supports).length;
    const status = container.querySelector('.new-quotes-status');
    
    if (verifying > 0) {
      status.textContent = `Found ${supporting} supporting quotes, verifying ${verifying} more...`;
    } else {
      status.textContent = `Complete: ${supporting} supporting quotes found`;
    }
  }
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
      ${quotes.map((q, i) => {
        // Build Zotero indicator for search results (Requirements: 4.2)
        const zoteroIndicator = q.zoteroMetadata && q.zoteroMetadata.fromZotero 
          ? '<span class="quote-result-zotero-indicator">Zotero</span>'
          : '';
        
        return `
          <div class="new-quote-item">
            <div class="quote-number">${i + 1}</div>
            <div class="quote-details">
              <div class="quote-text">"${escapeHtml(q.text)}"${zoteroIndicator}</div>
              <div class="quote-source">${escapeHtml(q.source)} (${Math.round(q.similarity * 100)}% match)</div>
              <button class="btn btn-small btn-primary" data-action="addQuote" data-quote="${escapeHtml(q.text)}">Add Quote</button>
            </div>
          </div>
        `;
      }).join('')}
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
      <h3>🌐 Found ${results.length} External Paper${results.length !== 1 ? 's' : ''}</h3>
      <button class="close-btn" data-action="closeResults">✕</button>
    </div>
    <div class="internet-results-list">
      ${results.map((r, i) => `
        <div class="internet-result-item">
          <div class="result-number">${i + 1}</div>
          <div class="result-details">
            <div class="result-title">${escapeHtml(r.title)}</div>
            ${r.authors ? `<div class="result-authors">${escapeHtml(r.authors)} (${r.year || 'n.d.'})</div>` : ''}
            ${r.venue ? `<div class="result-venue">${escapeHtml(r.venue)}</div>` : ''}
            ${r.doi ? `<div class="result-doi">DOI: <a href="https://doi.org/${escapeHtml(r.doi)}" target="_blank">${escapeHtml(r.doi)}</a></div>` : ''}
            ${r.url ? `<div class="result-url"><a href="${escapeHtml(r.url)}" target="_blank">View Paper</a></div>` : ''}
            ${r.abstract ? `<div class="result-snippet">${escapeHtml(r.abstract.substring(0, 300))}${r.abstract.length > 300 ? '...' : ''}</div>` : ''}
            <div class="result-source">Source: ${escapeHtml(r.source || 'unknown')}</div>
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
  
  showNotification(`Found ${results.length} paper${results.length !== 1 ? 's' : ''} from external sources`, 'success');
}

/**
 * Show error
 */
function showError(message) {
  showNotification(`Error: ${message}`, 'error');
}

/**
 * Handle operations cancelled (when switching claims)
 * Resets loading states and clears pending UI updates
 */
function handleOperationsCancelled(message) {
  console.log('[ClaimReview] Operations cancelled:', message.reason);
  
  // Always hide the search container when operations are cancelled (e.g., switching claims)
  const searchContainer = document.getElementById('newQuotesContainer');
  if (searchContainer) {
    searchContainer.style.display = 'none';
    // Clear the contents to prevent stale results from showing
    const list = searchContainer.querySelector('.new-quotes-list');
    if (list) {
      list.innerHTML = '';
    }
  }
  
  // Reset any progress indicators
  const progressBars = document.querySelectorAll('.progress-bar');
  progressBars.forEach(bar => bar.remove());
  
  // Clear any "verifying" status indicators
  const verifyingItems = document.querySelectorAll('.status-verifying');
  verifyingItems.forEach(item => item.classList.remove('status-verifying'));
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
 * Accept a web quote directly (web results aren't in local index)
 */
function acceptWebQuote(quoteText, source, url, confidence = 0, paperData = null) {
  if (!currentClaim) return;
  
  // For web quotes, we have the text already - just add it directly
  vscode.postMessage({
    type: 'addWebQuote',
    claimId: currentClaim.id,
    quote: quoteText,
    source: source,
    url: url,
    confidence: confidence,
    paperData: paperData // Pass full paper metadata
  });
  
  showNotification('Adding web quote...', 'info');
}

/**
 * Use alternative source - update the quote's source to the correct one
 */
function useAlternativeSource(quote, newSource, matchedText) {
  if (!currentClaim) return;
  
  // Extract author-year from filename (e.g., "Johnson et al. - 2007 - Title.txt" -> "Johnson2007")
  const authorYearMatch = newSource.match(/^([^-]+)\s*-\s*(\d{4})/);
  const authorYear = authorYearMatch ? `${authorYearMatch[1].trim().split(' ')[0]}${authorYearMatch[2]}` : newSource;
  
  showConfirmModal(
    'Update Quote Source',
    `Update the source to ${authorYear} and use the matched text from that source?`,
    (confirmed) => {
      if (confirmed) {
        // Update both the quote text (to the matched text) and source
        vscode.postMessage({
          type: 'acceptQuote',
          claimId: currentClaim.id,
          quote: quote,
          newQuote: matchedText,
          newSource: authorYear
        });
      }
    }
  );
}

/**
 * Expand context around a quote
 */
function expandContext(quoteWrapper, direction) {
  const sourceFile = quoteWrapper.getAttribute('data-source-file');
  if (!sourceFile) {
    console.warn('[ClaimReview] No source file metadata available');
    return;
  }
  
  // Get current line numbers (or use original if not set)
  let startLine = parseInt(quoteWrapper.getAttribute('data-current-start-line') || quoteWrapper.getAttribute('data-start-line'));
  let endLine = parseInt(quoteWrapper.getAttribute('data-current-end-line') || quoteWrapper.getAttribute('data-end-line'));
  
  // Expand by 5 lines in the requested direction
  const expandLines = 5;
  
  // Calculate new range based on direction
  let newStartLine = startLine;
  let newEndLine = endLine;
  
  if (direction === 'up') {
    newStartLine = Math.max(0, startLine - expandLines);
  } else if (direction === 'down') {
    newEndLine = endLine + expandLines;
  }
  
  vscode.postMessage({
    type: 'getExpandedContext',
    sourceFile: sourceFile,
    startLine: newStartLine,
    endLine: newEndLine,
    expandLines: 0  // We've already calculated the new range
  });
  
  // Store the wrapper element and direction for when we get the response
  quoteWrapper.setAttribute('data-expanding', 'true');
  quoteWrapper.setAttribute('data-expand-direction', direction);
}

/**
 * Handle expanded context response
 */
function handleExpandedContext(message) {
  if (message.error) {
    showNotification(message.error, 'error');
    return;
  }
  
  // Find the quote wrapper that requested expansion
  const quoteWrapper = document.querySelector('[data-expanding="true"]');
  if (!quoteWrapper) {
    console.warn('[ClaimReview] No quote wrapper found for expanded context');
    return;
  }
  
  const direction = quoteWrapper.getAttribute('data-expand-direction');
  quoteWrapper.removeAttribute('data-expanding');
  quoteWrapper.removeAttribute('data-expand-direction');
  
  // Update the match text
  const matchDiv = quoteWrapper.querySelector('.quote-edit-match');
  if (matchDiv) {
    matchDiv.textContent = message.text;
    
    // Update current line numbers
    quoteWrapper.setAttribute('data-current-start-line', message.startLine);
    quoteWrapper.setAttribute('data-current-end-line', message.endLine);
    
    console.log('[ClaimReview] Expanded context', direction, 'to lines', message.startLine, '-', message.endLine);
  }
}

/**
 * Build Zotero metadata HTML for a quote
 * Requirements: 3.5, 3.6, 3.7, 3.8
 */
function buildZoteroMetadataHtml(quote) {
  if (!quote || !quote.zoteroMetadata) {
    return '';
  }

  const metadata = quote.zoteroMetadata;
  if (!metadata.fromZotero) {
    return '';
  }

  // Build page number display
  let pageNumberHtml = '';
  if (quote.pageNumber) {
    pageNumberHtml = `<div class="zotero-page-number">Page ${quote.pageNumber}</div>`;
  }

  // Build highlight color display
  let colorSwatchHtml = '';
  if (metadata.highlightColor) {
    const colorHex = metadata.highlightColor.startsWith('#') ? metadata.highlightColor : `#${metadata.highlightColor}`;
    colorSwatchHtml = `
      <div class="zotero-highlight-color">
        <span>Color:</span>
        <div class="zotero-color-swatch" style="background-color: ${escapeHtml(colorHex)};"></div>
      </div>
    `;
  }

  // Build tooltip with annotation key and import timestamp
  let tooltipText = '';
  if (metadata.annotationKey) {
    const importDate = new Date(metadata.importedAt).toLocaleDateString();
    tooltipText = `Annotation: ${metadata.annotationKey} • Imported: ${importDate}`;
  }

  // Build the metadata container
  return `
    <div class="zotero-metadata">
      <div class="zotero-indicator">
        <div class="zotero-indicator-icon">Z</div>
        <span>Zotero</span>
      </div>
      <div class="zotero-metadata-info">
        ${pageNumberHtml}
        ${colorSwatchHtml}
        ${tooltipText ? `<div class="zotero-tooltip" data-tooltip="${escapeHtml(tooltipText)}">ℹ️</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Build Jump to PDF button HTML
 * Requirements: 2.1, 2.2, 2.8, 6.6
 */
function buildJumpToPdfButtonHtml(quote, isZoteroAvailable = true) {
  if (!quote) {
    return '';
  }

  const metadata = quote.zoteroMetadata;
  
  // Check if we have the required data for the button
  const hasAnnotationKey = metadata && metadata.annotationKey;
  const hasPageAndItemKey = quote.pageNumber && metadata && metadata.itemKey;
  
  // Show button if we have annotation key OR (page number AND item key)
  if (!hasAnnotationKey && !hasPageAndItemKey) {
    return '';
  }

  // Determine button state
  const isDisabled = !isZoteroAvailable;
  const disabledClass = isDisabled ? 'zotero-unavailable' : '';
  const disabledAttr = isDisabled ? 'disabled' : '';

  return `
    <button class="jump-to-pdf-btn ${disabledClass}" 
            data-action="jumpToPdf" 
            data-annotation-key="${metadata && metadata.annotationKey ? escapeHtml(metadata.annotationKey) : ''}"
            data-item-key="${metadata && metadata.itemKey ? escapeHtml(metadata.itemKey) : ''}"
            data-page-number="${quote.pageNumber || ''}"
            ${disabledAttr}
            title="${isDisabled ? 'Zotero is not available' : 'Open this quote in Zotero PDF reader'}">
      Jump to PDF
    </button>
    ${isDisabled ? '<div class="zotero-unavailable-notice">Zotero is not available</div>' : ''}
  `;
}

/**
 * Build Zotero indicator for search results
 * Requirements: 4.2
 */
function buildZoteroSearchIndicatorHtml(quote) {
  if (!quote || !quote.zoteroMetadata || !quote.zoteroMetadata.fromZotero) {
    return '';
  }

  return '<span class="quote-result-zotero-indicator">Zotero</span>';
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
 * Display orphan citations section
 * Requirements: 3.1
 */
function displayOrphanCitations(orphanCitations) {
  if (!orphanCitations || orphanCitations.length === 0) {
    // Hide orphan citations section if no orphans
    const section = document.getElementById('orphanCitationsSection');
    if (section) {
      section.style.display = 'none';
    }
    return;
  }

  // Find or create orphan citations section
  let section = document.getElementById('orphanCitationsSection');
  if (!section) {
    section = document.createElement('div');
    section.id = 'orphanCitationsSection';
    section.className = 'orphan-citations-section';
    
    const quotesSection = document.getElementById('quotesSection');
    if (quotesSection && quotesSection.parentNode) {
      quotesSection.parentNode.insertBefore(section, quotesSection.nextSibling);
    }
  }

  section.style.display = 'block';
  
  // Build orphan citations HTML
  let orphanHtml = '<h2>ORPHAN CITATIONS</h2>';
  orphanHtml += '<div class="orphan-citations-list">';
  
  orphanCitations.forEach(orphan => {
    const hasExtractedText = orphan.hasExtractedText;
    const buttonClass = hasExtractedText ? '' : 'disabled';
    const buttonDisabled = hasExtractedText ? '' : 'disabled';
    const buttonTitle = hasExtractedText 
      ? `Find quotes from ${orphan.authorYear}` 
      : `No extracted text available for ${orphan.authorYear}`;
    
    orphanHtml += `
      <div class="orphan-citation-item">
        <div class="orphan-citation-header">
          <span class="orphan-citation-author-year">${escapeHtml(orphan.authorYear)}</span>
          <span class="orphan-citation-status">⚠ No supporting quote</span>
        </div>
        <div class="orphan-citation-actions">
          <button class="btn btn-primary ${buttonClass}" 
                  data-action="findQuotesFromPaper" 
                  data-author-year="${escapeHtml(orphan.authorYear)}"
                  ${buttonDisabled}
                  title="${buttonTitle}">
            Find Quotes
          </button>
          <button class="btn btn-danger" 
                  data-action="removeOrphanCitation" 
                  data-author-year="${escapeHtml(orphan.authorYear)}"
                  title="Remove this orphan citation">
            Remove
          </button>
        </div>
      </div>
    `;
  });
  
  orphanHtml += '</div>';
  section.innerHTML = orphanHtml;
  
  // Attach event listeners
  section.querySelectorAll('[data-action="findQuotesFromPaper"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const authorYear = btn.getAttribute('data-author-year');
      findQuotesFromPaper(authorYear);
    });
  });
  
  section.querySelectorAll('[data-action="removeOrphanCitation"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const authorYear = btn.getAttribute('data-author-year');
      removeOrphanCitation(authorYear);
    });
  });
}

/**
 * Find quotes from a specific paper
 * Requirements: 3.2
 */
function findQuotesFromPaper(authorYear) {
  if (!currentClaim) return;
  
  console.log('[ClaimReview] Finding quotes from paper:', authorYear);
  
  // Show loading state
  const container = document.getElementById('newQuotesContainer');
  if (container) {
    container.style.display = 'block';
    const header = container.querySelector('.new-quotes-header h3');
    if (header) {
      header.textContent = `Searching for quotes from ${authorYear}...`;
    }
    const list = container.querySelector('.new-quotes-list');
    if (list) {
      list.innerHTML = '<div class="loading-spinner">Searching...</div>';
    }
  }
  
  // Request quote search from extension
  vscode.postMessage({
    type: 'findQuotesFromPaper',
    claimId: currentClaim.id,
    authorYear: authorYear
  });
}

/**
 * Display search results from paper
 * Requirements: 3.2
 */
function displayQuotesFromPaper(results, authorYear) {
  const container = document.getElementById('newQuotesContainer');
  if (!container) return;
  
  container.style.display = 'block';
  const header = container.querySelector('.new-quotes-header h3');
  if (header) {
    header.textContent = `Quotes from ${authorYear}`;
  }
  
  const list = container.querySelector('.new-quotes-list');
  if (!list) return;
  
  if (!results || results.length === 0) {
    list.innerHTML = '<div class="no-results">No quotes found in this paper</div>';
    return;
  }
  
  list.innerHTML = '';
  
  results.forEach((result, index) => {
    const item = document.createElement('div');
    item.className = 'quote-search-result';
    
    const similarity = Math.round(result.similarity * 100);
    const similarityClass = similarity >= 90 ? 'high' : similarity >= 70 ? 'medium' : 'low';
    
    item.innerHTML = `
      <div class="result-header">
        <div class="result-similarity ${similarityClass}">${similarity}% match</div>
        <div class="result-location">${result.sourceFile} (lines ${result.startLine}-${result.endLine})</div>
      </div>
      <div class="result-text">${escapeHtml(result.text)}</div>
      <div class="result-actions">
        <button class="btn btn-primary" data-action="attachQuote" data-index="${index}">
          Attach Quote
        </button>
      </div>
    `;
    
    list.appendChild(item);
  });
  
  // Attach event listeners
  list.querySelectorAll('[data-action="attachQuote"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'));
      if (results[index]) {
        attachQuoteToClaim(results[index], authorYear);
      }
    });
  });
}

/**
 * Attach a found quote to the claim
 * Requirements: 3.3
 */
function attachQuoteToClaim(quote, authorYear) {
  if (!currentClaim) return;
  
  console.log('[ClaimReview] Attaching quote to claim:', {
    claimId: currentClaim.id,
    authorYear,
    similarity: quote.similarity
  });
  
  vscode.postMessage({
    type: 'attachQuoteToClaim',
    claimId: currentClaim.id,
    quote: quote,
    authorYear: authorYear
  });
}

/**
 * Remove an orphan citation from the claim
 * Requirements: 3.4
 */
function removeOrphanCitation(authorYear) {
  if (!currentClaim) return;
  
  showConfirmModal(
    'Remove Orphan Citation',
    `Remove the citation to ${authorYear} from this claim?`,
    (confirmed) => {
      if (confirmed) {
        console.log('[ClaimReview] Removing orphan citation:', authorYear);
        
        vscode.postMessage({
          type: 'removeOrphanCitation',
          claimId: currentClaim.id,
          authorYear: authorYear
        });
      }
    }
  );
}

/**
 * Show confirmation modal
 */
function showConfirmModal(title, message, callback) {
  const modal = document.createElement('div');
  modal.className = 'confirm-modal-overlay';
  modal.innerHTML = `
    <div class="confirm-modal">
      <div class="confirm-modal-header">${escapeHtml(title)}</div>
      <div class="confirm-modal-body">${escapeHtml(message)}</div>
      <div class="confirm-modal-actions">
        <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
        <button class="btn btn-primary" id="confirmOk">Confirm</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#confirmCancel').addEventListener('click', () => {
    modal.remove();
    callback(false);
  });
  
  modal.querySelector('#confirmOk').addEventListener('click', () => {
    modal.remove();
    callback(true);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      callback(false);
    }
  });
}

// ============================================================================
// Debug Panel
// ============================================================================

let debugLogs = [];
let debugPanelVisible = false;

/**
 * Add a debug log entry
 */
function addDebugLogEntry(entry) {
  debugLogs.push(entry);
  
  // Update debug panel if visible
  if (debugPanelVisible) {
    renderDebugPanel();
  }
  
  // Update badge count
  updateDebugBadge();
}

/**
 * Update the debug badge count
 */
function updateDebugBadge() {
  const badge = document.getElementById('debugBadge');
  if (badge) {
    badge.textContent = debugLogs.length;
    badge.style.display = debugLogs.length > 0 ? 'inline' : 'none';
  }
}

/**
 * Toggle debug panel visibility
 */
function toggleDebugPanel() {
  debugPanelVisible = !debugPanelVisible;
  
  const panel = document.getElementById('debugPanel');
  if (panel) {
    panel.style.display = debugPanelVisible ? 'block' : 'none';
    if (debugPanelVisible) {
      renderDebugPanel();
    }
  }
}

/**
 * Render the debug panel content
 */
function renderDebugPanel() {
  const content = document.getElementById('debugPanelContent');
  if (!content) return;
  
  if (debugLogs.length === 0) {
    content.innerHTML = '<div class="debug-empty">No LLM interactions yet. Start a quote search to see debug info.</div>';
    return;
  }
  
  content.innerHTML = debugLogs.map((entry, i) => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    
    if (entry.type === 'query-refinement') {
      return `
        <div class="debug-entry">
          <div class="debug-header">
            <span class="debug-type">🔄 Query Refinement</span>
            <span class="debug-time">${time}</span>
            <span class="debug-round">Round ${entry.data.round}</span>
          </div>
          <details class="debug-details">
            <summary>Prompt</summary>
            <pre class="debug-prompt">${escapeHtml(entry.data.prompt)}</pre>
          </details>
          <details class="debug-details" open>
            <summary>Response</summary>
            <pre class="debug-response">${escapeHtml(entry.data.response)}</pre>
          </details>
          <div class="debug-queries">
            <strong>Generated Queries:</strong>
            <ul>
              ${entry.data.generatedQueries.map(q => `<li>${escapeHtml(q)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }
    
    if (entry.type === 'verification') {
      return `
        <div class="debug-entry ${entry.data.supports ? 'supports' : 'rejects'}">
          <div class="debug-header">
            <span class="debug-type">${entry.data.supports ? '✓' : '✗'} Verification</span>
            <span class="debug-time">${time}</span>
            <span class="debug-confidence">${Math.round(entry.data.confidence * 100)}%</span>
          </div>
          <div class="debug-snippet">"${escapeHtml(entry.data.snippetText?.substring(0, 100) || '')}..."</div>
          <div class="debug-reasoning">${escapeHtml(entry.data.reasoning || '')}</div>
        </div>
      `;
    }
    
    return `
      <div class="debug-entry">
        <div class="debug-header">
          <span class="debug-type">${entry.type}</span>
          <span class="debug-time">${time}</span>
        </div>
        <pre class="debug-raw">${escapeHtml(JSON.stringify(entry.data, null, 2))}</pre>
      </div>
    `;
  }).join('');
}

/**
 * Clear debug logs
 */
function clearDebugLogs() {
  debugLogs = [];
  updateDebugBadge();
  renderDebugPanel();
}

/**
 * Initialize debug panel in the DOM
 */
function initDebugPanel() {
  // Add debug toggle button to header
  const header = document.querySelector('.claim-header') || document.querySelector('.header');
  if (header && !document.getElementById('debugToggle')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'debugToggle';
    toggleBtn.className = 'btn btn-small btn-secondary debug-toggle';
    toggleBtn.innerHTML = '🐛 Debug <span id="debugBadge" class="debug-badge" style="display:none">0</span>';
    toggleBtn.onclick = toggleDebugPanel;
    header.appendChild(toggleBtn);
  }
  
  // Add debug panel container
  if (!document.getElementById('debugPanel')) {
    const panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.className = 'debug-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="debug-panel-header">
        <h4>🐛 LLM Debug Log</h4>
        <button class="btn btn-small" onclick="clearDebugLogs()">Clear</button>
      </div>
      <div id="debugPanelContent" class="debug-panel-content"></div>
    `;
    document.body.appendChild(panel);
  }
}

// Initialize debug panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDebugPanel);
} else {
  initDebugPanel();
}
