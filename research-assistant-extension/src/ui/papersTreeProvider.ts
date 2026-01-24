import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';

export class PaperTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    
    this.contextValue = 'paper';
    this.iconPath = new vscode.ThemeIcon('file-pdf');
  }
}

export class PapersTreeProvider implements vscode.TreeDataProvider<PaperTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PaperTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private state: ExtensionState) {
    // Placeholder - will implement paper tracking later
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PaperTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PaperTreeItem): Promise<PaperTreeItem[]> {
    if (element) {
      return [];
    }

    // Placeholder - will fetch papers from Zotero MCP
    return [
      new PaperTreeItem('Papers coming soon...', vscode.TreeItemCollapsibleState.None)
    ];
  }
}
