import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { Claim } from '../core/claimsManager';

export class ClaimTreeItem extends vscode.TreeItem {
  constructor(
    public readonly claim: Claim
  ) {
    super(claim.id, vscode.TreeItemCollapsibleState.None);
    
    this.description = claim.text.substring(0, 50) + (claim.text.length > 50 ? '...' : '');
    this.tooltip = `${claim.text}\n\nSource: ${claim.source}\nCategory: ${claim.category}`;
    this.contextValue = 'claim';
    
    // Set icon based on verification status
    this.iconPath = new vscode.ThemeIcon(
      claim.verified ? 'pass' : 'circle-outline'
    );
  }
}

export class ClaimsTreeProvider implements vscode.TreeDataProvider<ClaimTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ClaimTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private state: ExtensionState) {
    // Listen to claims changes
    this.state.claimsManager.onDidChange(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ClaimTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ClaimTreeItem): Promise<ClaimTreeItem[]> {
    if (element) {
      return [];
    }

    const claims = this.state.claimsManager.getClaims();
    return claims.map(claim => new ClaimTreeItem(claim));
  }
}
