(function() {
  const vscode = acquireVsCodeApi();
  
  let currentMetrics = null;

  // Send ready message when loaded
  window.addEventListener('load', () => {
    vscode.postMessage({ type: 'ready' });
  });

  // Handle messages from extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
      case 'updateMetrics':
        currentMetrics = message.metrics;
        updateDashboard(message.metrics);
        break;
    }
  });

  // Set up event listeners
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    document.getElementById('gaps-card')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'viewGaps' });
    });

    document.getElementById('view-claims-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'viewClaims' });
    });

    document.getElementById('view-gaps-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'viewGaps' });
    });

    document.getElementById('run-benchmarks-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'runBenchmarks' });
    });

    document.getElementById('export-benchmarks-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'exportBenchmarks' });
    });

    document.getElementById('clear-benchmarks-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearBenchmarks' });
    });
  });

  function updateDashboard(metrics) {
    // Update paper metrics
    document.getElementById('papers-total').textContent = metrics.papersTotal;
    document.getElementById('papers-read').textContent = metrics.papersRead;
    document.getElementById('papers-reading').textContent = metrics.papersReading;
    document.getElementById('papers-to-read').textContent = metrics.papersToRead;

    // Update claim metrics
    document.getElementById('claims-total').textContent = metrics.claimsTotal;
    document.getElementById('claims-verified').textContent = metrics.claimsVerified;

    // Update coverage
    document.getElementById('coverage-percentage').textContent = `${metrics.coveragePercentage}%`;
    document.getElementById('coverage-progress').style.width = `${metrics.coveragePercentage}%`;

    // Update gaps
    document.getElementById('gaps-count').textContent = metrics.gapsCount;

    // Update activity list
    updateActivityList(metrics.recentActivity);

    // Update trend chart
    updateTrendChart(metrics.coverageTrend);

    // Update performance metrics
    if (metrics.performance) {
      updatePerformanceMetrics(metrics.performance);
    }
  }

  function updateActivityList(activities) {
    const activityList = document.getElementById('activity-list');
    
    if (!activities || activities.length === 0) {
      activityList.innerHTML = '<div class="loading">No recent activity</div>';
      return;
    }

    activityList.innerHTML = activities.map(activity => {
      const icon = getActivityIcon(activity.type);
      const time = formatTime(activity.timestamp);
      
      return `
        <div class="activity-item">
          <div class="activity-icon ${activity.type.split('_')[0]}">${icon}</div>
          <div class="activity-content">
            <div class="activity-description">${escapeHtml(activity.description)}</div>
            <div class="activity-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getActivityIcon(type) {
    switch (type) {
      case 'paper_read':
        return '📄';
      case 'claim_added':
        return '💡';
      case 'claim_verified':
        return '✓';
      default:
        return '•';
    }
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function updateTrendChart(trendData) {
    const chartContainer = document.querySelector('.chart-container');
    
    if (!trendData || trendData.length === 0) {
      chartContainer.innerHTML = '<div class="loading">No trend data available</div>';
      return;
    }

    // Simple bar chart implementation
    const maxValue = Math.max(
      ...trendData.map(d => Math.max(d.papersRead, d.claimsAdded))
    );

    // Show only last 14 days for readability
    const recentData = trendData.slice(-14);

    chartContainer.innerHTML = `
      <div class="simple-chart">
        ${recentData.map(item => {
          const paperHeight = maxValue > 0 ? (item.papersRead / maxValue) * 100 : 0;
          const claimHeight = maxValue > 0 ? (item.claimsAdded / maxValue) * 100 : 0;
          const date = new Date(item.date);
          const label = `${date.getMonth() + 1}/${date.getDate()}`;
          
          return `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;">
              <div style="display: flex; gap: 2px; align-items: flex-end; height: 180px;">
                <div class="chart-bar" 
                     style="height: ${paperHeight}%; background: #4caf50;" 
                     title="Papers: ${item.papersRead}">
                </div>
                <div class="chart-bar" 
                     style="height: ${claimHeight}%; background: #2196f3;" 
                     title="Claims: ${item.claimsAdded}">
                </div>
              </div>
              <div style="font-size: 0.7em; color: var(--vscode-descriptionForeground);">
                ${label}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-size: 0.85em;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 12px; height: 12px; background: #4caf50; border-radius: 2px;"></div>
          <span>Papers Read</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 12px; height: 12px; background: #2196f3; border-radius: 2px;"></div>
          <span>Claims Added</span>
        </div>
      </div>
    `;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updatePerformanceMetrics(performance) {
    // Update summary
    document.getElementById('current-memory').textContent = performance.currentMemory;
    document.getElementById('tests-passed').textContent = performance.summary.passed;
    document.getElementById('tests-total').textContent = performance.summary.total;
    document.getElementById('pass-rate').textContent = performance.summary.passRate.toFixed(1);

    // Update benchmark results
    const resultsContainer = document.getElementById('benchmark-results');
    
    if (!performance.results || performance.results.length === 0) {
      resultsContainer.innerHTML = '<div class="loading">No benchmark data yet. Click "Run Benchmarks" to start.</div>';
      return;
    }

    resultsContainer.innerHTML = `
      <div class="benchmark-table">
        <div class="benchmark-header">
          <div class="benchmark-col-name">Test</div>
          <div class="benchmark-col-duration">Duration</div>
          <div class="benchmark-col-memory">Memory Δ</div>
          <div class="benchmark-col-status">Status</div>
        </div>
        ${performance.results.map(result => {
          const statusIcon = result.passed ? '✓' : '✗';
          const statusClass = result.passed ? 'passed' : 'failed';
          const durationClass = result.duration > result.threshold ? 'warning' : '';
          
          return `
            <div class="benchmark-row">
              <div class="benchmark-col-name" title="${escapeHtml(result.name)}">
                ${escapeHtml(result.name)}
              </div>
              <div class="benchmark-col-duration ${durationClass}">
                ${result.duration.toFixed(2)}ms
                <span class="threshold">(${result.threshold.toFixed(0)}ms)</span>
              </div>
              <div class="benchmark-col-memory">
                ${result.memoryDelta > 0 ? '+' : ''}${result.memoryDelta}MB
              </div>
              <div class="benchmark-col-status ${statusClass}">
                ${statusIcon}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="benchmark-summary">
        <div class="summary-item">
          <span class="summary-label">Avg Duration:</span>
          <span class="summary-value">${performance.summary.avgDuration.toFixed(2)}ms</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Avg Memory Δ:</span>
          <span class="summary-value">${performance.summary.avgMemoryDelta.toFixed(1)}MB</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Last Updated:</span>
          <span class="summary-value">${formatTime(performance.timestamp)}</span>
        </div>
      </div>
    `;
  }
})();
