// Editing Mode UI Script
// Note: vscode is declared in the HTML inline script

let sentences = [];
let currentSentenceId = null;
let currentClaimId = null;
let editingSentenceId = null;
let editingClaimId = null;

// Virtual scrolling configuration
const ESTIMATED_ITEM_HEIGHT = 120; // Initial estimate, will be refined
const BUFFER_SIZE = 5; // Number of items to render outside visible area
let virtualScrollState = {
  startIndex: 0,
  endIndex: 0,
  visibleRange: { start: 0, end: 0 },
  itemHeights: new Map() // Cache of measured item heights by ID
};
let isScrolling = false;
let scrollTimeout = null;
let centerItemId = null;
let lastScrollTop = 0;

/**
 * Initialize editing mode
 */
function initialize(data) {
  console.log('[EditingMode WebView] Received initialize message:', {
    sentenceCount: data.sentences?.length || 0,
    centerItemId: data.centerItemId,
    virtualScrollingEnabled: data.virtualScrollingEnabled
  });
  
  sentences = data.sentences || [];
  centerItemId = data.centerItemId || null;
  
  console.log('[EditingMode WebView] Sentences array:', sentences.length);
  
  // Use virtual scrolling for large lists
  if (sentences.length > 50) {
    console.log('[EditingMode WebView] Using virtual scrolling');
    initializeVirtualScrolling();
  } else {
    console.log('[EditingMode WebView] Using regular rendering');
    renderSentences();
  }
  
  // Restore scroll to center item after rendering is complete
  if (centerItemId) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToCenterItem(centerItemId);
      });
    });
  }
}

/**
 * Initialize virtual scrolling
 */
function initializeVirtualScrolling() {
  const container = document.getElementById('sentencesList');
  const contentDiv = document.querySelector('.content');
  
  // Create virtual scroll container
  container.innerHTML = `
    <div class="virtual-scroll-container" style="height: 0px;">
      <div class="virtual-scroll-content"></div>
    </div>
  `;
  
  // Initial render
  updateVirtualScroll();
  
  // Listen to scroll events
  contentDiv.addEventListener('scroll', () => {
    isScrolling = true;
    const currentScrollTop = contentDiv.scrollTop;
    
    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    
    // Update virtual scroll immediately for responsiveness
    updateVirtualScroll();
    
    // Save center item after user stops scrolling (500ms)
    scrollTimeout = setTimeout(() => {
      const currentCenterItem = getCenterItem();
      if (currentCenterItem && currentCenterItem.id !== centerItemId) {
        centerItemId = currentCenterItem.id;
        vscode.postMessage({ 
          type: 'saveCenterItem', 
          itemId: centerItemId,
          position: currentCenterItem.position
        });
      }
      isScrolling = false;
    }, 500);
    
    lastScrollTop = currentScrollTop;
  });
}

/**
 * Get cumulative height up to a specific index
 */
function getCumulativeHeight(upToIndex) {
  let height = 0;
  for (let i = 0; i < upToIndex && i < sentences.length; i++) {
    const sentenceId = sentences[i].id;
    height += virtualScrollState.itemHeights.get(sentenceId) || ESTIMATED_ITEM_HEIGHT;
  }
  return height;
}

/**
 * Find which item is at a given scroll position
 */
function findItemAtScrollPosition(scrollTop) {
  let cumulativeHeight = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentenceId = sentences[i].id;
    const itemHeight = virtualScrollState.itemHeights.get(sentenceId) || ESTIMATED_ITEM_HEIGHT;
    if (cumulativeHeight + itemHeight > scrollTop) {
      return i;
    }
    cumulativeHeight += itemHeight;
  }
  return Math.max(0, sentences.length - 1);
}

/**
 * Update virtual scroll rendering
 */
function updateVirtualScroll() {
  const contentDiv = document.querySelector('.content');
  const container = document.querySelector('.virtual-scroll-container');
  const content = document.querySelector('.virtual-scroll-content');
  
  if (!container || !content) return;
  
  const scrollTop = contentDiv.scrollTop;
  const containerHeight = contentDiv.clientHeight;
  
  // Find visible range based on actual measured heights
  const startIndex = findItemAtScrollPosition(scrollTop);
  let cumulativeHeight = getCumulativeHeight(startIndex);
  let endIndex = startIndex;
  
  // Find end index by accumulating heights until we exceed viewport
  while (endIndex < sentences.length && cumulativeHeight < scrollTop + containerHeight) {
    const sentenceId = sentences[endIndex].id;
    const itemHeight = virtualScrollState.itemHeights.get(sentenceId) || ESTIMATED_ITEM_HEIGHT;
    cumulativeHeight += itemHeight;
    endIndex++;
  }
  
  // Add buffer items
  const bufferStart = Math.max(0, startIndex - BUFFER_SIZE);
  const bufferEnd = Math.min(sentences.length, endIndex + BUFFER_SIZE);
  
  // Only re-render if range changed significantly
  if (bufferStart === virtualScrollState.startIndex && bufferEnd === virtualScrollState.endIndex) {
    return;
  }
  
  virtualScrollState.startIndex = bufferStart;
  virtualScrollState.endIndex = bufferEnd;
  
  // Calculate offset for positioning
  const offsetY = getCumulativeHeight(bufferStart);
  
  // Calculate total height for container
  const totalHeight = getCumulativeHeight(sentences.length);
  container.style.height = totalHeight + 'px';
  
  // Render visible items
  const visibleSentences = sentences.slice(bufferStart, bufferEnd);
  content.innerHTML = visibleSentences.map(sentence => renderSentenceBox(sentence)).join('');
  content.style.transform = `translateY(${offsetY}px)`;
  
  // Measure actual heights of rendered items
  requestAnimationFrame(() => {
    const sentenceBoxes = document.querySelectorAll('.sentence-box');
    sentenceBoxes.forEach(box => {
      const sentenceId = box.dataset.sentenceId;
      const actualHeight = box.offsetHeight;
      virtualScrollState.itemHeights.set(sentenceId, actualHeight);
    });
  });
  
  // Attach event listeners
  attachSentenceListeners();
}

/**
 * Get the sentence currently in the center of the viewport
 */
function getCenterItem() {
  const contentDiv = document.querySelector('.content');
  if (!contentDiv) return null;

  const centerY = contentDiv.scrollTop + contentDiv.clientHeight / 2;
  let cumulativeHeight = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentenceId = sentences[i].id;
    const itemHeight = virtualScrollState.itemHeights.get(sentenceId) || ESTIMATED_ITEM_HEIGHT;
    
    if (cumulativeHeight + itemHeight > centerY) {
      return sentences[i];
    }
    cumulativeHeight += itemHeight;
  }
  
  return sentences.length > 0 ? sentences[sentences.length - 1] : null;
}

/**
 * Scroll to center a specific item by ID
 */
function scrollToCenterItem(itemId) {
  const itemIndex = sentences.findIndex(s => s.id === itemId);
  if (itemIndex < 0) return;
  
  const contentDiv = document.querySelector('.content');
  
  // Calculate scroll position to center this item
  let cumulativeHeight = getCumulativeHeight(itemIndex);
  const itemHeight = virtualScrollState.itemHeights.get(itemId) || ESTIMATED_ITEM_HEIGHT;
  const itemCenter = cumulativeHeight + itemHeight / 2;
  const viewportCenter = contentDiv.clientHeight / 2;
  const scrollTarget = Math.max(0, itemCenter - viewportCenter);
  
  contentDiv.scrollTop = scrollTarget;
  console.log('[EditingMode WebView] Scrolled to center item:', itemId);
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Render all sentences
 */
function renderSentences() {
  const container = document.getElementById('sentencesList');
  
  if (sentences.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-text">No sentences found</div>
        <div class="empty-state-hint">Load a manuscript to get started</div>
      </div>
    `;
    return;
  }

  container.innerHTML = sentences.map(sentence => renderSentenceBox(sentence)).join('');
  
  // Attach event listeners
  attachSentenceListeners();
}

/**
 * Render a single sentence box
 */
function renderSentenceBox(sentence) {
  const statusColor = getStatusColor(sentence.claims);
  const claimsHtml = sentence.claims.length > 0 
    ? renderClaimsContainer(sentence)
    : '<div class="claims-container"><div style="color: #999; font-size: 11px; padding: 4px;">⚠ No claims yet</div></div>';

  return `
    <div class="sentence-box status-${statusColor}" data-sentence-id="${sentence.id}">
      <div class="sentence-header">
        <div class="sentence-text" data-sentence-id="${sentence.id}" title="Original: ${sentence.originalText}">
          ${escapeHtml(sentence.text)}
        </div>
        <div class="sentence-actions">
          <button class="action-btn" data-action="match" data-sentence-id="${sentence.id}" title="Match Claims">Match</button>
          <button class="action-btn primary" data-action="create" data-sentence-id="${sentence.id}" title="Create Claim (c)">+Claim</button>
        </div>
      </div>
      ${claimsHtml}
    </div>
  `;
}

/**
 * Render claims container for a sentence
 */
function renderClaimsContainer(sentence) {
  if (sentence.claims.length === 0) {
    return '';
  }

  const claimsHtml = sentence.claims.map(claim => renderClaimBox(sentence.id, claim)).join('');

  return `
    <div class="claims-container">
      <div class="claims-header">
        <span>${sentence.claims.length} claim${sentence.claims.length !== 1 ? 's' : ''}</span>
        <button class="claims-toggle" data-sentence-id="${sentence.id}" title="Toggle claims">▼</button>
      </div>
      <div class="claims-list" data-sentence-id="${sentence.id}">
        ${claimsHtml}
      </div>
    </div>
  `;
}

/**
 * Render a single claim box
 */
function renderClaimBox(sentenceId, claim) {
  const statusIcon = getClaimStatusIcon(claim);
  
  return `
    <div class="claim-box" data-claim-id="${claim.id}" data-sentence-id="${sentenceId}">
      <div class="claim-content">
        <div class="claim-status-icon ${getClaimStatusClass(claim)}">${statusIcon}</div>
        <div class="claim-text-wrapper">
          <div class="claim-id clickable" data-claim-id="${claim.id}" title="Click to open in Claim Review">${claim.id}</div>
          <div class="claim-text" title="Original: ${claim.originalText}">
            ${escapeHtml(claim.text)}
          </div>
        </div>
      </div>
      <div class="claim-actions">
        <button class="claim-action-btn delete" data-action="delete" data-claim-id="${claim.id}" data-sentence-id="${sentenceId}" title="Delete (x)">✕</button>
      </div>
    </div>
  `;
}

/**
 * Get status color for sentence
 */
function getStatusColor(claims) {
  if (claims.length === 0) {
    return 'red'; // No claims
  }

  const hasVerified = claims.some(c => c.verified === true);
  const hasUnverified = claims.some(c => c.verified !== true);

  if (hasVerified && !hasUnverified) {
    return 'green'; // All verified
  } else if (hasVerified && hasUnverified) {
    return 'blue'; // Mixed
  } else if (hasUnverified) {
    return 'orange'; // Unverified claims
  }

  return 'grey'; // Unknown status
}

/**
 * Get claim status icon
 */
function getClaimStatusIcon(claim) {
  if (claim.verified === true) {
    return '✓';
  } else if (claim.verified === false) {
    return '✗';
  }
  return '○';
}

/**
 * Get claim status class
 */
function getClaimStatusClass(claim) {
  if (claim.verified === true) {
    return 'verified';
  } else if (claim.verified === false) {
    return 'invalid';
  }
  return 'not-checked';
}

/**
 * Attach event listeners to sentence elements
 */
function attachSentenceListeners() {
  // Sentence text click to edit
  document.querySelectorAll('.sentence-text').forEach(el => {
    el.addEventListener('click', (e) => {
      const sentenceId = e.target.dataset.sentenceId;
      editSentenceText(sentenceId);
    });
  });

  // Sentence action buttons
  document.querySelectorAll('.sentence-actions .action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const sentenceId = e.target.dataset.sentenceId;
      
      switch (action) {
        case 'match':
          vscode.postMessage({ type: 'matchClaims', sentenceId });
          break;
        case 'create':
          vscode.postMessage({ type: 'createClaim', sentenceId });
          break;
      }
    });
  });

  // Claim ID click to open in Claim Review
  document.querySelectorAll('.claim-id.clickable').forEach(el => {
    el.addEventListener('click', (e) => {
      const claimId = e.target.dataset.claimId;
      const sentenceBox = e.target.closest('.sentence-box');
      const sentenceId = sentenceBox ? sentenceBox.dataset.sentenceId : null;
      
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
          claimId,
          sentenceId // Pass sentence ID so we can return to it
        });
      }, 50);
    });
  });

  // Claim text click to edit
  document.querySelectorAll('.claim-text').forEach(el => {
    el.addEventListener('click', (e) => {
      const claimId = e.target.closest('.claim-box').dataset.claimId;
      editClaimText(claimId);
    });
  });

  // Claim action buttons
  document.querySelectorAll('.claim-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const claimId = e.target.dataset.claimId;
      const sentenceId = e.target.dataset.sentenceId;
      
      switch (action) {
        case 'delete':
          vscode.postMessage({ type: 'deleteClaim', sentenceId, claimId });
          break;
      }
    });
  });

  // Claims toggle
  document.querySelectorAll('.claims-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sentenceId = e.target.dataset.sentenceId;
      const claimsList = document.querySelector(`.claims-list[data-sentence-id="${sentenceId}"]`);
      if (claimsList) {
        claimsList.classList.toggle('collapsed');
        e.target.textContent = claimsList.classList.contains('collapsed') ? '▶' : '▼';
      }
    });
  });
}

/**
 * Edit sentence text
 */
function editSentenceText(sentenceId) {
  if (editingSentenceId === sentenceId) {
    return; // Already editing
  }

  const sentence = sentences.find(s => s.id === sentenceId);
  if (!sentence) return;

  const textEl = document.querySelector(`.sentence-text[data-sentence-id="${sentenceId}"]`);
  if (!textEl) return;

  editingSentenceId = sentenceId;
  textEl.classList.add('editing');

  const textarea = document.createElement('textarea');
  textarea.className = 'sentence-text-input';
  textarea.value = sentence.text;

  textEl.replaceWith(textarea);
  textarea.focus();
  textarea.select();

  const saveSentence = () => {
    const newText = textarea.value.trim();
    if (newText && newText !== sentence.text) {
      sentence.text = newText;
      vscode.postMessage({ type: 'editSentence', sentenceId, newText });
    }
    editingSentenceId = null;
    renderSentences();
  };

  const cancelEdit = () => {
    editingSentenceId = null;
    renderSentences();
  };

  textarea.addEventListener('blur', saveSentence);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveSentence();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  });
}

/**
 * Edit claim text
 */
function editClaimText(claimId) {
  if (editingClaimId === claimId) {
    return; // Already editing
  }

  let claim = null;
  for (const sentence of sentences) {
    claim = sentence.claims.find(c => c.id === claimId);
    if (claim) break;
  }

  if (!claim) return;

  const textEl = document.querySelector(`.claim-text[data-claim-id="${claimId}"]`);
  if (!textEl) return;

  editingClaimId = claimId;
  textEl.classList.add('editing');

  const textarea = document.createElement('textarea');
  textarea.className = 'claim-text-input';
  textarea.value = claim.text;

  textEl.replaceWith(textarea);
  textarea.focus();
  textarea.select();

  const saveClaim = () => {
    const newText = textarea.value.trim();
    if (newText && newText !== claim.text) {
      claim.text = newText;
      vscode.postMessage({ type: 'editClaim', claimId, newText });
    }
    editingClaimId = null;
    renderSentences();
  };

  const cancelEdit = () => {
    editingClaimId = null;
    renderSentences();
  };

  textarea.addEventListener('blur', saveClaim);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveClaim();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle keyboard shortcuts
 */
document.addEventListener('keydown', (e) => {
  // Mode switching is handled by VS Code keybindings (Cmd/Ctrl+Alt+W/E/R)
  // No Shift+letter shortcuts to avoid conflicts with typing
  
  if (e.key === '?' && !editingSentenceId && !editingClaimId) {
    toggleHelpOverlay();
  } else if (e.key === 'Escape') {
    const helpOverlay = document.getElementById('helpOverlay');
    if (!helpOverlay.classList.contains('hidden')) {
      toggleHelpOverlay();
    }
  } else if (e.key === 'c' && !editingSentenceId && !editingClaimId) {
    // Create claim from current sentence
    if (currentSentenceId) {
      vscode.postMessage({ type: 'createClaim', sentenceId: currentSentenceId });
    }
  } else if (e.key === 'x' && !editingSentenceId && !editingClaimId) {
    // Delete claim from current sentence
    if (currentSentenceId && currentClaimId) {
      vscode.postMessage({ type: 'deleteClaim', sentenceId: currentSentenceId, claimId: currentClaimId });
    }
  } else if (e.key === 'Enter' && !editingSentenceId && !editingClaimId) {
    // Open claim in review mode
    if (currentClaimId) {
      vscode.postMessage({ type: 'openClaim', claimId: currentClaimId });
    }
  } else if (e.key === 'n' && !editingSentenceId && !editingClaimId) {
    // Next sentence
    navigateToNextSentence();
  } else if (e.key === 'p' && !editingSentenceId && !editingClaimId) {
    // Previous sentence
    navigateToPreviousSentence();
  } else if (e.key === 'j') {
    // Scroll down
    document.querySelector('.content').scrollBy(0, 50);
  } else if (e.key === 'k') {
    // Scroll up
    document.querySelector('.content').scrollBy(0, -50);
  } else if (e.key === 'f' && e.ctrlKey) {
    // Find/search
    e.preventDefault();
    // Could implement search functionality here
  }
});

/**
 * Navigate to next sentence
 */
function navigateToNextSentence() {
  const currentIndex = sentences.findIndex(s => s.id === currentSentenceId);
  if (currentIndex < sentences.length - 1) {
    currentSentenceId = sentences[currentIndex + 1].id;
    scrollToSentence(currentSentenceId);
  }
}

/**
 * Navigate to previous sentence
 */
function navigateToPreviousSentence() {
  const currentIndex = sentences.findIndex(s => s.id === currentSentenceId);
  if (currentIndex > 0) {
    currentSentenceId = sentences[currentIndex - 1].id;
    scrollToSentence(currentSentenceId);
  }
}

/**
 * Scroll to sentence
 */
function scrollToSentence(sentenceId) {
  const el = document.querySelector(`[data-sentence-id="${sentenceId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
 * Handle messages from extension
 */
window.addEventListener('message', (event) => {
  const message = event.data;

  switch (message.type) {
    case 'initialize':
      initialize(message);
      break;

    case 'sentenceUpdated':
      const sentence = sentences.find(s => s.id === message.sentenceId);
      if (sentence) {
        sentence.text = message.text;
        renderSentences();
      }
      break;

    case 'sentencesUpdated':
      // Update all sentences with new data (used when claims change)
      sentences = message.sentences;
      if (sentences.length > 50) {
        updateVirtualScroll();
      } else {
        renderSentences();
      }
      // Re-center on the same item if it still exists
      if (centerItemId) {
        requestAnimationFrame(() => {
          scrollToCenterItem(centerItemId);
        });
      }
      break;

    case 'sentenceDeleted':
      sentences = sentences.filter(s => s.id !== message.sentenceId);
      renderSentences();
      break;

    case 'claimCreated':
      const sentenceForClaim = sentences.find(s => s.id === message.sentenceId);
      if (sentenceForClaim) {
        sentenceForClaim.claims.push(message.claim);
        renderSentences();
      }
      break;

    case 'claimUpdated':
      for (const sentence of sentences) {
        const claim = sentence.claims.find(c => c.id === message.claimId);
        if (claim) {
          claim.text = message.text;
          renderSentences();
          break;
        }
      }
      break;

    case 'claimDeleted':
      const sentenceForDelete = sentences.find(s => s.id === message.sentenceId);
      if (sentenceForDelete) {
        sentenceForDelete.claims = sentenceForDelete.claims.filter(c => c.id !== message.claimId);
        renderSentences();
      }
      break;

    case 'saved':
      // Show save indicator
      console.log('Saved at', message.timestamp);
      break;

    case 'showHelp':
      toggleHelpOverlay();
      break;
  }
});

// Setup help overlay close button
document.addEventListener('DOMContentLoaded', () => {
  const helpOverlay = document.getElementById('helpOverlay');
  if (helpOverlay) {
    helpOverlay.addEventListener('click', (e) => {
      if (e.target === helpOverlay) {
        toggleHelpOverlay();
      }
    });
  }

  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn) {
    helpBtn.addEventListener('click', toggleHelpOverlay);
  }

  const writeBtn = document.getElementById('writeBtn');
  if (writeBtn) {
    writeBtn.addEventListener('click', () => {
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
        vscode.postMessage({ type: 'switchToWritingMode' });
      }, 50);
    });
  }

  // Save scroll position when leaving the page
  window.addEventListener('beforeunload', () => {
    const content = document.querySelector('.content');
    if (content) {
      const currentPosition = content.scrollTop;
      if (Math.abs(currentPosition - lastSavedScrollPosition) > 10) {
        vscode.postMessage({ type: 'saveScrollPosition', position: currentPosition });
      }
    }
  });
});
