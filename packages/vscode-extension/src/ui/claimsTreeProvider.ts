import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import type { Claim } from '@research-assistant/core';

export class ClaimTreeItem extends vscode.TreeItem {
  constructor(
    public readonly claim: Claim
  ) {
    super(claim.id, vscode.TreeItemCollapsibleState.None);
    
    this.description = claim.text.substring(0, 50) + (claim.text.length > 50 ? '...' : '');
    
    // Enhanced tooltip with verification status (Requirement 43.5)
    const verificationStatus = claim.verified ? '✓ Verified' : '○ Not verified';
    this.tooltip = `${claim.text}\n\nSource: ${claim.source}\nCategory: ${claim.category}\nVerification: ${verificationStatus}`;
    this.contextValue = 'claim';
    
    // Set icon based on verification status (Requirement 43.5)
    // Verified: green checkmark, Not verified: gray circle
    if (claim.verified) {
      this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
    } else if (claim.primaryQuote && claim.source) {
      // Has quote but not verified - show warning
      this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconQueued'));
    } else {
      // No quote to verify
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    }
    
    // Make it clickable - show claim details when clicked
    this.command = {
      command: 'researchAssistant.showClaimDetails',
      title: 'Show Claim Details',
      arguments: [claim.id]
    };
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
    
    // Listen to verification events to update tree view (Requirement 43.5)
    this.state.autoQuoteVerifier.onDidVerify(() => {
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
    try {
      if (element) {
        return [];
      }

      const claims = this.state.claimsManager.getClaims();
      return claims.map(claim => new ClaimTreeItem(claim));
    } catch (error) {
      console.error('Failed to get claims:', error);
      return [];
    }
  }
}
