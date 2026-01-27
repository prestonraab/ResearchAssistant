// Claim Review Mode Script

const vscode = acquireVsCodeApi();

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
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key) {
      case '?':
        e.preventDefault();
        toggleHelpOverlay();
        break;

      case 'Escape':
        e.preventDefault();
        vscode.postMessage({ type: 'switchToEditingMode' });
        break;

      case 'v':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          verifyCurrentQuote();
        }
        break;

      case 'a':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          acceptCurrentQuote();
        }
        break;

      case 'd':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          deleteCurrentQuote();
        }
        break;

      case 'f':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          findNewQuotes();
        }
        break;

      case 'i':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          searchInternet();
        }
        break;

      case 'V':
        if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          validateSupport();
        }
        break;

      case 'M':
        if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          toggleSidebar();
        }
        break;

      case 'n':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          nextClaim();
        }
        break;

      case 'p':
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          previousClaim();
        }
        break;

      case 'w':
        if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          vscode.postMessage({ type: 'switchToWritingMode' });
        }
        break;

      case 'e':
        if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          vscode.postMessage({ type: 'switchToEditingMode' });
        }
        break;
    }
  });
}

/**
 * Handle messages from extension
 */
function handleMessage(message) {
  switch (message.type) {
    case 'loadClaim':
      displayClaim(message);
      break;

    case 'quoteVerified':
      updateQuoteVerification(message);
      break;

    case 'newQuotesFound':
      displayNewQuotes(message.quotes);
      break;

    case 'internetSearchResults':
      displayInternetResults(message.results);
      break;

    case 'supportValidated':
      updateValidationResult(message);
      break;

    case 'showHelp':
      toggleHelpOverlay();
      break;

    case 'error':
      showError(message.message);
      break;

    default:
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

  // Display claim header
  const header = document.getElementById('claimHeader');
  header.querySelector('.claim-id').textContent = currentClaim.id;
  header.querySelector('.claim-text').textContent = currentClaim.text;
  header.querySelector('.category').textContent = currentClaim.category;
  header.querySelector('.source').textContent = `Source: ${currentClaim.source}`;

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
  if (currentClaim.primaryQuote) {
    const primaryResult = currentVerificationResults.find(r => r.type === 'primary');
    displayQuoteContainer(primaryContainer, currentClaim.primaryQuote, primaryResult, 'primary');
  } else {
    primaryContainer.style.display = 'none';
  }

  // Display supporting quotes
  if (currentClaim.supportingQuotes && currentClaim.supportingQuotes.length > 0) {
    currentClaim.supportingQuotes.forEach((quote, index) => {
      const result = currentVerificationResults.find(r => r.quote === quote && r.type === 'supporting');
      const container = document.createElement('div');
      container.className = 'quote-container';
      displayQuoteContainer(container, quote, result, 'supporting');
      supportingContainer.appendChild(container);
    });
  }
}

/**
 * Display quote container
 */
function displayQuoteContainer(container, quote, result, type) {
  const statusIcon = getStatusIcon(result);
  const verificationText = getVerificationText(result);

  container.innerHTML = `
    <div class="quote-header">
      <span class="quote-type">${type.toUpperCase()} QUOTE</span>
      <span class="status-icon ${getStatusClass(result)}">${statusIcon}</span>
    </div>
    <div class="quote-text">${escapeHtml(quote)}</div>
    <div class="verification-info ${getStatusClass(result)}">${verificationText}</div>
    <div class="quote-actions">
      <button class="btn btn-primary" onclick="acceptQuote('${escapeHtml(quote)}')">Accept</button>
      <button class="btn btn-danger" onclick="deleteQuote('${escapeHtml(quote)}')">Delete</button>
      <button class="btn btn-secondary" onclick="findNewQuotes()">Find New</button>
    </div>
  `;
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
  if (result.verified) return `Verified in source (${Math.round(result.similarity * 100)}% match)`;
  if (result.nearestMatch) return `Not verified (nearest: ${Math.round(result.similarity * 100)}% match)`;
  return 'Not found in sources';
}

/**
 * Display validation
 */
function displayValidation() {
  const gaugeProgress = document.getElementById('gaugeProgress');
  const gaugePercentage = document.getElementById('gaugePercentage');
  const validationStatus = document.getElementById('validationStatus');

  if (currentValidationResult) {
    const percentage = Math.round(currentValidationResult.similarity * 100) || 0;
    gaugeProgress.style.width = `${percentage}%`;
    gaugePercentage.textContent = `${percentage}%`;
    validationStatus.textContent = currentValidationResult.analysis || 'Validation pending';
  }
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
 * Accept current quote
 */
function acceptCurrentQuote() {
  if (!currentClaim || !currentClaim.primaryQuote) return;
  const newQuote = prompt('Enter new quote:', currentClaim.primaryQuote);
  if (newQuote) {
    vscode.postMessage({
      type: 'acceptQuote',
      claimId: currentClaim.id,
      quote: currentClaim.primaryQuote,
      newQuote: newQuote
    });
  }
}

/**
 * Accept quote
 */
function acceptQuote(quote) {
  const newQuote = prompt('Enter new quote:', quote);
  if (newQuote) {
    vscode.postMessage({
      type: 'acceptQuote',
      claimId: currentClaim.id,
      quote: quote,
      newQuote: newQuote
    });
  }
}

/**
 * Delete current quote
 */
function deleteCurrentQuote() {
  if (!currentClaim || !currentClaim.primaryQuote) return;
  if (confirm('Delete this quote?')) {
    vscode.postMessage({
      type: 'deleteQuote',
      claimId: currentClaim.id,
      quote: currentClaim.primaryQuote
    });
  }
}

/**
 * Delete quote
 */
function deleteQuote(quote) {
  if (confirm('Delete this quote?')) {
    vscode.postMessage({
      type: 'deleteQuote',
      claimId: currentClaim.id,
      quote: quote
    });
  }
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
 * Display new quotes
 */
function displayNewQuotes(quotes) {
  if (!quotes || quotes.length === 0) {
    alert('No new quotes found');
    return;
  }

  // Create a list of quotes to display
  let message = `Found ${quotes.length} potential quotes:\n\n`;
  quotes.forEach((q, i) => {
    message += `${i + 1}. "${q.text}"\n   Source: ${q.source} (${Math.round(q.similarity * 100)}% match)\n\n`;
  });

  // Show in information message
  vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Display internet results
 */
function displayInternetResults(results) {
  if (!results || results.length === 0) {
    alert('No internet results found');
    return;
  }

  // Create a list of results to display
  let message = `Found ${results.length} web results:\n\n`;
  results.forEach((r, i) => {
    message += `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}\n\n`;
  });

  // Show in information message
  vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Show error
 */
function showError(message) {
  alert(`Error: ${message}`);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
