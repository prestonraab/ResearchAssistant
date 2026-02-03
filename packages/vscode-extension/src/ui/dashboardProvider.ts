import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { getBenchmark, BenchmarkResult } from '../core/performanceBenchmark';

export interface DashboardMetrics {
  papersTotal: number;
  papersRead: number;
  papersReading: number;
  papersToRead: number;
  claimsTotal: number;
  claimsVerified: number;
  coveragePercentage: number;
  gapsCount: number;
  recentActivity: ActivityItem[];
  coverageTrend: CoverageTrendItem[];
  performance?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  results: BenchmarkResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgDuration: number;
    avgMemoryDelta: number;
  };
  currentMemory: number;
  timestamp: string;
}

export interface ActivityItem {
  type: 'paper_read' | 'claim_added' | 'claim_verified';
  timestamp: Date;
  description: string;
}

export interface CoverageTrendItem {
  date: string;
  papersRead: number;
  claimsAdded: number;
}

export class DashboardProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'researchAssistant.dashboard';
  
  private _view?: vscode.WebviewView;
  private _refreshInterval?: NodeJS.Timeout;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _extensionState: ExtensionState
  ) {
    // Listen for changes that affect metrics
    this._extensionState.claimsManager.onDidChange(() => {
      this._updateView();
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'ready':
          await this._updateView();
          break;
        case 'refresh':
          await this._updateView();
          break;
        case 'searchPapers':
          await this._searchPapers(data.sectionId);
          break;
        case 'viewGaps':
          await this._viewGaps();
          break;
        case 'viewClaims':
          await this._viewClaims();
          break;
        case 'runBenchmarks':
          await this._runBenchmarks();
          break;
        case 'exportBenchmarks':
          await this._exportBenchmarks();
          break;
        case 'clearBenchmarks':
          await this._clearBenchmarks();
          break;
      }
    });

    // Auto-refresh every 30 seconds
    this._refreshInterval = setInterval(() => {
      this._updateView();
    }, 30000);

    // Clean up on dispose
    webviewView.onDidDispose(() => {
      if (this._refreshInterval) {
        clearInterval(this._refreshInterval);
      }
    });
  }

  public async refresh() {
    await this._updateView();
  }

  private async _updateView() {
    if (!this._view) {
      return;
    }

    const metrics = await this._calculateMetrics();

    this._view.webview.postMessage({
      type: 'updateMetrics',
      metrics
    });
  }

  private async _calculateMetrics(): Promise<DashboardMetrics> {
    // Get claims data
    const claims = await this._extensionState.claimsManager.loadClaims();
    const claimsTotal = claims.length;
    const claimsVerified = claims.filter(c => c.verified).length;

    // Get reading status data
    const allProgress = this._extensionState.readingStatusManager.getAllProgress();
    const readingStatuses = Array.from(allProgress.entries()).map(([itemKey, progress]) => ({
      itemKey,
      status: progress.status,
      readingStarted: progress.startedAt,
      readingCompleted: progress.completedAt
    }));
    const papersTotal = readingStatuses.length;
    const papersRead = readingStatuses.filter(s => s.status === 'read' || s.status === 'deeply-read').length;
    const papersReading = readingStatuses.filter(s => s.status === 'some-read').length;
    const papersToRead = readingStatuses.filter(s => s.status === 'unread').length;

    // Get coverage data
    const sections = this._extensionState.outlineParser.getHierarchy();
    const coverageMetrics = this._extensionState.coverageAnalyzer.analyzeCoverage(sections, claims);
    const sectionsWithCoverage = coverageMetrics.filter(m => m.coverageLevel !== 'none').length;
    const coveragePercentage = sections.length > 0 
      ? Math.round((sectionsWithCoverage / sections.length) * 100)
      : 0;
    const gapsCount = coverageMetrics.filter(m => m.claimCount < 2).length;

    // Get recent activity
    const recentActivity = this._getRecentActivity(claims, readingStatuses);

    // Get coverage trend
    const coverageTrend = this._getCoverageTrend(claims, readingStatuses);

    // Get performance metrics
    const performance = this._getPerformanceMetrics();

    return {
      papersTotal,
      papersRead,
      papersReading,
      papersToRead,
      claimsTotal,
      claimsVerified,
      coveragePercentage,
      gapsCount,
      recentActivity,
      coverageTrend,
      performance
    };
  }

  private _getPerformanceMetrics(): PerformanceMetrics {
    const benchmark = getBenchmark();
    const results = benchmark.getResults();
    const summary = benchmark.getSummary();
    const currentMemory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    return {
      results,
      summary,
      currentMemory,
      timestamp: new Date().toISOString()
    };
  }

  private async _runBenchmarks() {
    try {
      vscode.window.showInformationMessage('Running performance benchmarks...');
      
      // Run benchmarks for each mode
      const benchmark = getBenchmark();
      
      // Benchmark writing mode
      await benchmark.benchmarkModeLoad('writing', async () => {
        // Simulate loading writing mode
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Benchmark editing mode
      await benchmark.benchmarkModeLoad('editing', async () => {
        // Simulate loading editing mode
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Benchmark claim matching
      const claims = await this._extensionState.claimsManager.loadClaims();
      await benchmark.benchmarkClaimMatching(claims.length, async () => {
        // Simulate claim matching
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      vscode.window.showInformationMessage('Benchmarks completed!');
      await this._updateView();
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to run benchmarks. Please try again.',
        'Retry'
      ).then(action => {
        if (action === 'Retry') {
          this._runBenchmarks();
        }
      });
    }
  }

  private async _exportBenchmarks() {
    try {
      const benchmark = getBenchmark();
      const exportData = benchmark.exportResults();
      
      // Save to workspace
      const workspaceRoot = vscode.Uri.file(this._extensionState.getWorkspaceRoot());
      const exportPath = vscode.Uri.joinPath(workspaceRoot, 'performance-benchmark.json');
      
      await vscode.workspace.fs.writeFile(
        exportPath,
        Buffer.from(exportData, 'utf8')
      );

      const action = await vscode.window.showInformationMessage(
        'Benchmark results exported to performance-benchmark.json',
        'Open File'
      );

      if (action === 'Open File') {
        const doc = await vscode.workspace.openTextDocument(exportPath);
        await vscode.window.showTextDocument(doc);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to export benchmark results. Please try again.',
        'Retry'
      ).then(action => {
        if (action === 'Retry') {
          this._exportBenchmarks();
        }
      });
    }
  }

  private async _clearBenchmarks() {
    const benchmark = getBenchmark();
    benchmark.clear();
    vscode.window.showInformationMessage('Benchmark results cleared');
    await this._updateView();
  }

  private _getRecentActivity(claims: any[], readingStatuses: any[]): ActivityItem[] {
    const activities: ActivityItem[] = [];

    // Add claim activities
    claims.forEach(claim => {
      if (claim.createdAt) {
        activities.push({
          type: 'claim_added',
          timestamp: new Date(claim.createdAt),
          description: `Added claim ${claim.id}: ${claim.text.substring(0, 50)}...`
        });
      }
      if (claim.verified && claim.modifiedAt) {
        activities.push({
          type: 'claim_verified',
          timestamp: new Date(claim.modifiedAt),
          description: `Verified claim ${claim.id}`
        });
      }
    });

    // Add reading activities
    readingStatuses.forEach(status => {
      if (status.readingCompleted) {
        activities.push({
          type: 'paper_read',
          timestamp: new Date(status.readingCompleted),
          description: `Completed reading: ${status.itemKey}`
        });
      }
    });

    // Sort by timestamp descending and take top 10
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }

  private _getCoverageTrend(claims: any[], readingStatuses: any[]): CoverageTrendItem[] {
    const trendMap = new Map<string, { papersRead: number; claimsAdded: number }>();

    // Process claims
    claims.forEach(claim => {
      if (claim.createdAt) {
        const date = new Date(claim.createdAt).toISOString().split('T')[0];
        const existing = trendMap.get(date) || { papersRead: 0, claimsAdded: 0 };
        existing.claimsAdded++;
        trendMap.set(date, existing);
      }
    });

    // Process reading statuses
    readingStatuses.forEach(status => {
      if (status.readingCompleted) {
        const date = new Date(status.readingCompleted).toISOString().split('T')[0];
        const existing = trendMap.get(date) || { papersRead: 0, claimsAdded: 0 };
        existing.papersRead++;
        trendMap.set(date, existing);
      }
    });

    // Convert to array and sort by date
    const trend = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        papersRead: data.papersRead,
        claimsAdded: data.claimsAdded
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Return last 30 days
    return trend.slice(-30);
  }

  private async _searchPapers(sectionId: string) {
    vscode.commands.executeCommand('researchAssistant.searchPapersForSection', sectionId);
  }

  private async _viewGaps() {
    vscode.commands.executeCommand('researchAssistant.analyzeGaps');
  }

  private async _viewClaims() {
    vscode.commands.executeCommand('researchAssistant.showClaimsPanel');
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Research Dashboard</title>
</head>
<body>
  <div id="root">
    <div class="dashboard">
      <div class="dashboard-header">
        <h2>Research Dashboard</h2>
        <button id="refresh-btn" class="icon-button" title="Refresh">↻</button>
      </div>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Papers</div>
          <div class="metric-value" id="papers-total">-</div>
          <div class="metric-breakdown">
            <span class="metric-detail">
              <span class="status-badge read">●</span>
              <span id="papers-read">-</span> Read
            </span>
            <span class="metric-detail">
              <span class="status-badge reading">●</span>
              <span id="papers-reading">-</span> Reading
            </span>
            <span class="metric-detail">
              <span class="status-badge to-read">●</span>
              <span id="papers-to-read">-</span> To Read
            </span>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Claims</div>
          <div class="metric-value" id="claims-total">-</div>
          <div class="metric-breakdown">
            <span class="metric-detail">
              <span class="status-badge verified">✓</span>
              <span id="claims-verified">-</span> Verified
            </span>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Coverage</div>
          <div class="metric-value" id="coverage-percentage">-</div>
          <div class="metric-breakdown">
            <div class="progress-bar">
              <div class="progress-fill" id="coverage-progress"></div>
            </div>
          </div>
        </div>
        
        <div class="metric-card clickable" id="gaps-card">
          <div class="metric-label">Gaps</div>
          <div class="metric-value" id="gaps-count">-</div>
          <div class="metric-breakdown">
            <span class="metric-detail">Sections needing attention</span>
          </div>
        </div>
      </div>
      
      <div class="dashboard-section">
        <h3>Activity Trend (Last 30 Days)</h3>
        <div class="chart-container">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>
      
      <div class="dashboard-section">
        <h3>Recent Activity</h3>
        <div class="activity-list" id="activity-list">
          <div class="loading">Loading activity...</div>
        </div>
      </div>
      
      <div class="dashboard-section">
        <h3>Performance Metrics</h3>
        <div class="performance-header">
          <div class="performance-summary">
            <span class="metric-detail">
              Memory: <strong id="current-memory">-</strong> MB
            </span>
            <span class="metric-detail">
              Tests: <strong id="tests-passed">-</strong>/<strong id="tests-total">-</strong>
            </span>
            <span class="metric-detail">
              Pass Rate: <strong id="pass-rate">-</strong>%
            </span>
          </div>
          <div class="performance-actions">
            <button id="run-benchmarks-btn" class="action-button-sm">Run Benchmarks</button>
            <button id="export-benchmarks-btn" class="action-button-sm">Export</button>
            <button id="clear-benchmarks-btn" class="action-button-sm">Clear</button>
          </div>
        </div>
        <div class="benchmark-results" id="benchmark-results">
          <div class="loading">No benchmark data yet. Click "Run Benchmarks" to start.</div>
        </div>
      </div>
      
      <div class="dashboard-actions">
        <button id="view-claims-btn" class="action-button">View All Claims</button>
        <button id="view-gaps-btn" class="action-button">Analyze Gaps</button>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
