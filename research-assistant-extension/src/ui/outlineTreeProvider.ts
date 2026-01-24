import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { OutlineSection } from '../core/outlineParser';
import { CoverageMetrics } from '../core/coverageAnalyzer';

export class OutlineTreeItem extends vscode.TreeItem {
  constructor(
    public readonly section: OutlineSection,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly coverage?: CoverageMetrics
  ) {
    super(section.title, collapsibleState);
    
    // Build tooltip with coverage information
    const claimInfo = coverage ? ` - ${coverage.claimCount} claim${coverage.claimCount !== 1 ? 's' : ''}` : '';
    const coverageInfo = coverage ? ` (${coverage.coverageLevel})` : '';
    this.tooltip = `${section.title}${claimInfo}${coverageInfo}\n${section.content.length} content item${section.content.length !== 1 ? 's' : ''}`;
    
    this.contextValue = 'section';
    
    // Set description to show claim count
    if (coverage) {
      this.description = `${coverage.claimCount} claim${coverage.claimCount !== 1 ? 's' : ''}`;
    }
    
    // Set icon based on coverage level with color coding
    if (coverage) {
      this.iconPath = this.getCoverageIcon(coverage.coverageLevel);
    } else {
      // Default icon based on level if no coverage data
      this.iconPath = new vscode.ThemeIcon(
        section.level === 2 ? 'symbol-namespace' :
        section.level === 3 ? 'symbol-class' :
        'symbol-method'
      );
    }
  }

  private getCoverageIcon(level: 'none' | 'low' | 'moderate' | 'strong'): vscode.ThemeIcon {
    switch (level) {
      case 'none':
        // Red circle for no coverage
        return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconErrored'));
      case 'low':
        // Yellow/orange circle for low coverage
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconQueued'));
      case 'moderate':
        // Blue circle for moderate coverage
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconSkipped'));
      case 'strong':
        // Green check for strong coverage
        return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
    }
  }
}

export class OutlineTreeProvider implements vscode.TreeDataProvider<OutlineTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<OutlineTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private coverageMetrics: Map<string, CoverageMetrics> = new Map();

  constructor(private state: ExtensionState) {
    // Listen to outline changes
    this.state.outlineParser.onDidChange(() => {
      this.updateCoverageAndRefresh();
    });

    // Listen to claims changes
    this.state.claimsManager.onDidChange(() => {
      this.updateCoverageAndRefresh();
    });

    // Initial coverage calculation
    this.updateCoverage();
  }

  private async updateCoverage(): Promise<void> {
    const sections = this.state.outlineParser.getSections();
    const claims = await this.state.claimsManager.loadClaims();
    const metrics = this.state.coverageAnalyzer.analyzeCoverage(sections, claims);
    
    // Store metrics in a map for quick lookup
    this.coverageMetrics.clear();
    for (const metric of metrics) {
      this.coverageMetrics.set(metric.sectionId, metric);
    }
  }

  private async updateCoverageAndRefresh(): Promise<void> {
    await this.updateCoverage();
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OutlineTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: OutlineTreeItem): Promise<OutlineTreeItem[]> {
    if (!element) {
      // Root level - get top-level sections
      const sections = this.state.outlineParser.getSections();
      const rootSections = sections.filter(s => s.parent === null);
      
      return rootSections.map(section => {
        const coverage = this.coverageMetrics.get(section.id);
        return new OutlineTreeItem(
          section,
          section.children.length > 0 
            ? vscode.TreeItemCollapsibleState.Collapsed 
            : vscode.TreeItemCollapsibleState.None,
          coverage
        );
      });
    } else {
      // Get children of this section
      const sections = this.state.outlineParser.getSections();
      const childSections = sections.filter(s => s.parent === element.section.id);
      
      return childSections.map(section => {
        const coverage = this.coverageMetrics.get(section.id);
        return new OutlineTreeItem(
          section,
          section.children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          coverage
        );
      });
    }
  }

  /**
   * Get coverage metrics for a section
   */
  getCoverageForSection(sectionId: string): CoverageMetrics | undefined {
    return this.coverageMetrics.get(sectionId);
  }
}
