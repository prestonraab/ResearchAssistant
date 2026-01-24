// @ts-check

(function () {
  const vscode = acquireVsCodeApi();

  let allClaims = [];
  let filteredClaims = [];
  let selectedClaims = new Set();
  let sortOrder = 'asc';
  let currentSortBy = 'id';

  // Get DOM elements
  const claimsList = document.getElementById('claims-list');
  const categoryFilter = document.getElementById('category-filter');
  const sourceFilter = document.getElementById('source-filter');
  const searchFilter = document.getElementById('search-filter');
  const sortBy = document.getElementById('sort-by');
  const sortOrderBtn = document.getElementById('sort-order');
  const selectionActions = document.getElementById('selection-actions');
  const selectionCount = document.getElementById('selection-count');
  const mergeSelectedBtn = document.getElementById('merge-selected');
  const clearSelectionBtn = document.getElementById('clear-selection');

  // Event listeners
  categoryFilter.addEventListener('change', applyFilters);
  sourceFilter.addEventListener('input', debounce(applyFilters, 300));
  searchFilter.addEventListener('input', debounce(applyFilters, 300));
  sortBy.addEventListener('change', (e) => {
    currentSortBy = e.target.value;
    applySorting();
  });
  sortOrderBtn.addEventListener('click', toggleSortOrder);
  mergeSelectedBtn.addEventListener('click', mergeSelected);
  clearSelectionBtn.addEventListener('click', clearSelection);

  // Handle messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'updateClaims':
        allClaims = message.claims || [];
        applyFilters();
        break;
    }
  });

  // Notify extension that webview is ready
  vscode.postMessage({ type: 'ready' });

  function applyFilters() {
    const category = categoryFilter.value;
    const source = sourceFilter.value.toLowerCase();
    const search = searchFilter.value.toLowerCase();

    filteredClaims = allClaims.filter(claim => {
      if (category && claim.category !== category) {
        return false;
      }
      if (source && !claim.source.toLowerCase().includes(source)) {
        return false;
      }
      if (search) {
        const searchableText = `${claim.text} ${claim.primaryQuote} ${claim.context}`.toLowerCase();
        if (!searchableText.includes(search)) {
          return false;
        }
      }
      return true;
    });

    applySorting();
  }

  function applySorting() {
    filteredClaims.sort((a, b) => {
      let aVal, bVal;
      
      switch (currentSortBy) {
        case 'id':
          aVal = parseInt(a.id.replace('C_', ''), 10);
          bVal = parseInt(b.id.replace('C_', ''), 10);
          break;
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        case 'source':
          aVal = a.source;
          bVal = b.source;
          break;
        case 'modified':
          aVal = new Date(a.modifiedAt).getTime();
          bVal = new Date(b.modifiedAt).getTime();
          break;
        default:
          aVal = a.id;
          bVal = b.id;
      }

      if (aVal < bVal) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });

    renderClaims();
  }

  function toggleSortOrder() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    sortOrderBtn.textContent = sortOrder === 'asc' ? '↓' : '↑';
    applySorting();
  }

  function renderClaims() {
    if (filteredClaims.length === 0) {
      claimsList.innerHTML = '<div class="empty-state">No claims found</div>';
      return;
    }

    claimsList.innerHTML = filteredClaims.map(claim => createClaimCard(claim)).join('');

    // Add event listeners to claim cards
    document.querySelectorAll('.claim-card').forEach(card => {
      const claimId = card.dataset.claimId;
      
      // Checkbox for selection
      const checkbox = card.querySelector('.claim-checkbox');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedClaims.add(claimId);
        } else {
          selectedClaims.delete(claimId);
        }
        updateSelectionUI();
      });

      // Action buttons
      card.querySelector('.edit-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'editClaim', claimId });
      });
      
      card.querySelector('.delete-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'deleteClaim', claimId });
      });
      
      card.querySelector('.verify-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'verifyClaim', claimId });
      });
      
      card.querySelector('.reassign-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'reassignClaim', claimId });
      });

      // Expand/collapse
      const header = card.querySelector('.claim-header');
      header.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
          card.classList.toggle('expanded');
        }
      });
    });
  }

  function createClaimCard(claim) {
    const isSelected = selectedClaims.has(claim.id);
    const verifiedBadge = claim.verified ? '<span class="badge verified">✓ Verified</span>' : '';
    const sectionsText = claim.sections.length > 0 
      ? `<div class="sections">Sections: ${claim.sections.join(', ')}</div>`
      : '';

    return `
      <div class="claim-card ${isSelected ? 'selected' : ''}" data-claim-id="${claim.id}">
        <div class="claim-header">
          <input type="checkbox" class="claim-checkbox" ${isSelected ? 'checked' : ''}>
          <div class="claim-id">${claim.id}</div>
          <div class="claim-category">${claim.category}</div>
          <div class="claim-source">${claim.source}</div>
          ${verifiedBadge}
          <div class="claim-actions">
            <button class="icon-button edit-btn" title="Edit">✏️</button>
            <button class="icon-button verify-btn" title="Verify Quote">✓</button>
            <button class="icon-button reassign-btn" title="Reassign Section">📌</button>
            <button class="icon-button delete-btn" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="claim-body">
          <div class="claim-text">${escapeHtml(claim.text)}</div>
          ${claim.context ? `<div class="claim-context"><strong>Context:</strong> ${escapeHtml(claim.context)}</div>` : ''}
          <div class="claim-quote">
            <strong>Primary Quote:</strong>
            <blockquote>${escapeHtml(claim.primaryQuote)}</blockquote>
          </div>
          ${claim.supportingQuotes.length > 0 ? `
            <div class="supporting-quotes">
              <strong>Supporting Quotes:</strong>
              <ul>
                ${claim.supportingQuotes.map(q => `<li>${escapeHtml(q)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${sectionsText}
          <div class="claim-meta">
            <span>Source ID: ${claim.sourceId}</span>
            <span>Modified: ${formatDate(claim.modifiedAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function updateSelectionUI() {
    const count = selectedClaims.size;
    selectionCount.textContent = `${count} selected`;
    selectionActions.style.display = count > 0 ? 'flex' : 'none';
    
    // Update card selection state
    document.querySelectorAll('.claim-card').forEach(card => {
      const claimId = card.dataset.claimId;
      if (selectedClaims.has(claimId)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  function mergeSelected() {
    if (selectedClaims.size < 2) {
      return;
    }
    vscode.postMessage({ 
      type: 'mergeClaims', 
      claimIds: Array.from(selectedClaims) 
    });
    clearSelection();
  }

  function clearSelection() {
    selectedClaims.clear();
    document.querySelectorAll('.claim-checkbox').forEach(cb => {
      cb.checked = false;
    });
    updateSelectionUI();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

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
})();
