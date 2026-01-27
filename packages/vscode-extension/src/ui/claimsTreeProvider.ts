import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import type { Claim } from '@research-assistant/core';

export class ClaimTreeItem extends vscode.TreeItem {
  constructor(
    public readonly claim: Claim
  ) {
    super(claim.id, vscode.TreeItemCollapsibleState.None);
    
    this.description = claim.text.substring(0, 50) + (claim.text.length > 50 ? '...' : '');
    
    // Determine verification and validation status
    const verified = claim.verified === true;
    const validationStatus = (claim as any).validationStatus; // 'valid', 'partial', 'invalid', or undefined
    
    // Build tooltip
    let tooltip = `${claim.text}\n\nSource: ${claim.source}\nCategory: ${claim.category}\n`;
    if (verified) {
      tooltip += 'Verification: ✓ Verified\n';
    } else if (claim.primaryQuote && claim.source) {
      tooltip += 'Verification: ○ Not checked\n';
    } else {
      tooltip += 'Verification: ✗ No quote\n';
    }
    
    if (validationStatus === 'valid') {
      tooltip += 'Validation: ✓ Valid';
    } else if (validationStatus === 'partial') {
      tooltip += 'Validation: ⚠ Partial';
    } else if (validationStatus === 'invalid') {
      tooltip += 'Validation: ✗ Invalid';
    } else {
      tooltip += 'Validation: ○ Not checked';
    }
    
    this.tooltip = tooltip;
    this.contextValue = 'claim';
    
    // Set icon based on verification and validation status
    // Red: Quotes not in sources
    // Black circle: Quotes not yet checked
    // Blue: All quotes verified, not yet validated
    // Grey: Validation checked but unsure/partial
    // Green: Verified and validated
    // Orange: Verified but unsure/partial validation
    
    if (verified === false && claim.primaryQuote && claim.source) {
      // Quotes not yet checked - black circle
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    } else if (verified === false && !claim.primaryQuote) {
      // Quotes not in sources - red
      this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('errorForeground'));
    } else if (verified && validationStatus === 'valid') {
      // Verified and validated - green
      this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
    } else if (verified && validationStatus === 'partial') {
      // Verified but partial validation - orange
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    } else if (verified && validationStatus === 'invalid') {
      // Verified but invalid validation - grey
      this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('descriptionForeground'));
    } else if (verified && !validationStatus) {
      // All quotes verified, not yet validated - blue
      this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('symbolIcon.colorOffset'));
    } else {
      // Default - grey circle
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
