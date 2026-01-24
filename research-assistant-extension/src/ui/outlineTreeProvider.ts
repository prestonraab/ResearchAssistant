import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { OutlineSection } from '../core/outlineParser';

export class OutlineTreeItem extends vscode.TreeItem {
  constructor(
    public readonly section: OutlineSection,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(section.title, collapsibleState);
    
    this.tooltip = `${section.title} (${section.content.length} items)`;
    this.contextValue = 'section';
    
    // Set icon based on level
    this.iconPath = new vscode.ThemeIcon(
      section.level === 2 ? 'symbol-namespace' :
      section.level === 3 ? 'symbol-class' :
      'symbol-method'
    );
  }
}

export class OutlineTreeProvider implements vscode.TreeDataProvider<OutlineTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<OutlineTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private state: ExtensionState) {
    // Listen to outline changes
    this.state.outlineParser.onDidChange(() => {
      this.refresh();
    });
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
      
      return rootSections.map(section => 
        new OutlineTreeItem(
          section,
          section.children.length > 0 
            ? vscode.TreeItemCollapsibleState.Collapsed 
            : vscode.TreeItemCollapsibleState.None
        )
      );
    } else {
      // Get children of this section
      const sections = this.state.outlineParser.getSections();
      const childSections = sections.filter(s => s.parent === element.section.id);
      
      return childSections.map(section =>
        new OutlineTreeItem(
          section,
          section.children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None
        )
      );
    }
  }
}
