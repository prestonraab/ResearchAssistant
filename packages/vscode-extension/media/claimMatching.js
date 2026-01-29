// Claim Matching Mode - Client-side logic
// Note: vscode is already declared in the HTML template

let currentSentenceId = null;
let currentSentenceText = null;
let similarClaims = [];
let selectedCardIndex = -1;
let helpVisible = false;

// DOM elements
const sentenceTextEl = document.getElementById('sentenceText');
const claimsGridEl = document.getElementById('claimsGrid');
const helpOverlayEl = document.getElementById('helpOverlay');
const helpBtn = document.getElementById('helpBtn');
const closeBtn = document.getElementById('closeBtn');
const createBtn = document.getElementById('createBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  helpBtn.addEventListener('click', toggleHelp);
  closeBtn.addEventListener('click', returnToEditing);
  createBtn.addEventListener('click', createNewClaim);

  document.addEventListener('keydown', handleKeydown);
  helpOverlayEl.addEventListener('click', (e) => {
    if (e.target === helpOverlayEl) {
      toggleHelp();
    }
  });

  // Listen for messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'initialize':
        initializeClaimMatching(message);
        break;
      case 'loading':
        handleLoading(message);
        break;
      case 'error':
        handleError(message);
        break;
      case 'claimLinked':
        handleClaimLinked(message);
        break;
      case 'claimCreated':
        handleClaimCreated(message);
        break;
      case 'showHelp':
        toggleHelp();
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  });
}

/**
 * Initialize claim matching with sentence and similar claims
 */
function initializeClaimMatching(message) {
  currentSentenceId = message.sentenceId;
  currentSentenceText = message.sentenceText;
  similarClaims = message.claims || [];

  // Display sentence
  sentenceTextEl.textContent = currentSentenceText;

  // Display claims
  renderClaimsGrid();

  // Reset selection
  selectedCardIndex = -1;

  // Auto-select first card if available
  if (similarClaims.length > 0) {
    selectCard(0);
  }
}

/**
 * Handle loading state
 */
function handleLoading(message) {
  claimsGridEl.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon">⏳</div>
      <div class="empty-state-text">${message.message}</div>
    </div>
  `;
}

/**
 * Handle error state
 */
function handleError(message) {
  claimsGridEl.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon">❌</div>
      <div class="empty-state-text">Error</div>
      <div class="empty-state-hint">${message.message}</div>
    </div>
  `;
}

/**
 * Render claims grid with lazy-loading
 */
function renderClaimsGrid() {
  claimsGridEl.innerHTML = '';

  if (similarClaims.length === 0) {
    claimsGridEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">No similar claims found</div>
        <div class="empty-state-hint">Create a new claim or try different text</div>
      </div>
    `;
    return;
  }

  // Limit initial render to top 10 for memory efficiency
  const maxInitialCards = Math.min(10, similarClaims.length);
  
  // Create placeholder cards for lazy-loading
  similarClaims.slice(0, maxInitialCards).forEach((claim, index) => {
    const card = document.createElement('div');
    card.className = 'claim-card claim-card-placeholder';
    card.dataset.index = index;
    card.dataset.claimId = claim.id;
    card.innerHTML = '<div class="claim-card-loading">Loading...</div>';
    claimsGridEl.appendChild(card);
  });

  // Add "Load More" button if there are more claims
  if (similarClaims.length > maxInitialCards) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.textContent = `Load ${similarClaims.length - maxInitialCards} more claims`;
    loadMoreBtn.style.gridColumn = '1 / -1';
    loadMoreBtn.addEventListener('click', () => {
      loadMoreBtn.remove();
      renderRemainingClaims(maxInitialCards);
    });
    claimsGridEl.appendChild(loadMoreBtn);
  }

  // Setup lazy-loading with Intersection Observer
  setupLazyLoading();
}

/**
 * Render remaining claims
 */
function renderRemainingClaims(startIndex) {
  similarClaims.slice(startIndex).forEach((claim, offset) => {
    const index = startIndex + offset;
    const card = document.createElement('div');
    card.className = 'claim-card claim-card-placeholder';
    card.dataset.index = index;
    card.dataset.claimId = claim.id;
    card.innerHTML = '<div class="claim-card-loading">Loading...</div>';
    claimsGridEl.appendChild(card);
  });
  
  // Re-setup lazy loading for new cards
  setupLazyLoading();
}

/**
 * Setup lazy-loading for claim cards
 */
function setupLazyLoading() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = parseInt(entry.target.dataset.index);
        const claim = similarClaims[index];
        if (claim && entry.target.classList.contains('claim-card-placeholder')) {
          // Load the card content
          const card = createClaimCard(claim, index);
          entry.target.replaceWith(card);
          observer.unobserve(entry.target);
        }
      }
    });
  }, {
    rootMargin: '50px' // Start loading 50px before card enters viewport
  });

  // Observe all placeholder cards
  document.querySelectorAll('.claim-card-placeholder').forEach(card => {
    observer.observe(card);
  });
}

/**
 * Create claim card element
 */
function createClaimCard(claim, index) {
  const card = document.createElement('div');
  card.className = 'claim-card';
  card.dataset.index = index;
  card.dataset.claimId = claim.id;

  card.innerHTML = `
    <div class="claim-card-header">
      <span class="claim-id">${claim.id}</span>
      <span class="claim-similarity">${claim.similarity}%</span>
    </div>
    <div class="claim-text">${escapeHtml(claim.text)}</div>
    <div class="claim-card-footer">
      <span class="claim-category">${claim.category}</span>
      <button class="link-btn" data-claim-id="${claim.id}">Link</button>
    </div>
  `;

  // Add click handlers
  card.addEventListener('click', () => selectCard(index));
  const linkBtn = card.querySelector('.link-btn');
  linkBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    linkClaim(claim.id);
  });

  return card;
}

/**
 * Select a card
 */
function selectCard(index) {
  // Remove previous selection
  if (selectedCardIndex >= 0) {
    const prevCard = claimsGridEl.querySelector(`[data-index="${selectedCardIndex}"]`);
    if (prevCard) {
      prevCard.classList.remove('selected');
    }
  }

  // Add new selection
  selectedCardIndex = index;
  const card = claimsGridEl.querySelector(`[data-index="${index}"]`);
  if (card) {
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Link claim to sentence
 */
function linkClaim(claimId) {
  vscode.postMessage({
    type: 'linkClaim',
    claimId
  });
}

/**
 * Create new claim
 */
function createNewClaim() {
  vscode.postMessage({
    type: 'createNewClaim'
  });
}

/**
 * Return to editing mode
 */
function returnToEditing() {
  vscode.postMessage({
    type: 'returnToEditing'
  });
}

/**
 * Toggle help overlay
 */
function toggleHelp() {
  helpVisible = !helpVisible;
  if (helpVisible) {
    helpOverlayEl.classList.remove('hidden');
  } else {
    helpOverlayEl.classList.add('hidden');
  }
}

/**
 * Handle claim linked message
 */
function handleClaimLinked(message) {
  // Show visual feedback
  const card = claimsGridEl.querySelector(`[data-claim-id="${message.claimId}"]`);
  if (card) {
    card.style.opacity = '0.5';
    const linkBtn = card.querySelector('.link-btn');
    if (linkBtn) {
      linkBtn.textContent = '✓ Linked';
      linkBtn.disabled = true;
    }
  }
}

/**
 * Handle claim created message
 */
function handleClaimCreated(message) {
  // Show visual feedback
  const newClaim = {
    id: message.claimId,
    text: message.claimText,
    category: 'New',
    source: '',
    similarity: 100
  };

  // Add to beginning of list
  similarClaims.unshift(newClaim);
  renderClaimsGrid();

  // Highlight the new claim
  const newCard = claimsGridEl.querySelector(`[data-claim-id="${message.claimId}"]`);
  if (newCard) {
    newCard.style.backgroundColor = '#C8E6C9';
    setTimeout(() => {
      newCard.style.backgroundColor = '';
    }, 2000);
  }
}

/**
 * Handle keyboard events
 */
function handleKeydown(event) {
  // Don't handle if help is visible
  if (helpVisible) {
    if (event.key === 'Escape' || event.key === '?') {
      toggleHelp();
    }
    return;
  }

  switch (event.key) {
    case '?':
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      toggleHelp();
      break;

    case 'Escape':
      event.preventDefault();
      returnToEditing();
      break;

    case 'Enter':
      event.preventDefault();
      if (selectedCardIndex >= 0) {
        const claim = similarClaims[selectedCardIndex];
        linkClaim(claim.id);
      }
      break;

    case 'c':
      event.preventDefault();
      createNewClaim();
      break;

    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      selectNextCard();
      break;

    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      selectPreviousCard();
      break;

    default:
      break;
  }
}

/**
 * Select next card
 */
function selectNextCard() {
  if (similarClaims.length === 0) {
    return;
  }

  const nextIndex = selectedCardIndex + 1;
  if (nextIndex < similarClaims.length) {
    selectCard(nextIndex);
  }
}

/**
 * Select previous card
 */
function selectPreviousCard() {
  if (selectedCardIndex > 0) {
    selectCard(selectedCardIndex - 1);
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
