import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import type { Claim } from '@research-assistant/core';

export class ClaimsPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'researchAssistant.claimsPanel';
  
  private _view?: vscode.WebviewView;
  private _currentSectionId?: string;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _extensionState: ExtensionState
  ) {
    // Listen for claims changes
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
        case 'editClaim':
          await this._editClaim(data.claimId);
          break;
        case 'deleteClaim':
          await this._deleteClaim(data.claimId);
          break;
        case 'verifyClaim':
          await this._verifyClaim(data.claimId);
          break;
        case 'reassignClaim':
          await this._reassignClaim(data.claimId);
          break;
        case 'mergeClaims':
          await this._mergeClaims(data.claimIds);
          break;
        case 'filterChanged':
          // Filter is handled in the webview, but we could persist preferences here
          break;
        case 'sortChanged':
          // Sort is handled in the webview, but we could persist preferences here
          break;
      }
    });
  }

  public showClaimsForSection(sectionId: string) {
    this._currentSectionId = sectionId;
    this._updateView();
  }

  public showClaim(claimId: string) {
    // Show all claims and highlight the specific one
    this._currentSectionId = undefined;
    this._updateView();
    
    // Send message to webview to highlight/scroll to the claim
    if (this._view) {
      this._view.webview.postMessage({
        type: 'highlightClaim',
        claimId: claimId
      });
    }
  }

  public showAllClaims() {
    this._currentSectionId = undefined;
    this._updateView();
  }

  private async _updateView() {
    if (!this._view) {
      return;
    }

    const claims = await this._extensionState.claimsManager.loadClaims();
    const filteredClaims = this._currentSectionId
      ? claims.filter(c => c.sections.includes(this._currentSectionId!))
      : claims;

    this._view.webview.postMessage({
      type: 'updateClaims',
      claims: filteredClaims,
      sectionId: this._currentSectionId
    });
  }

  private async _editClaim(claimId: string) {
    const claim = this._extensionState.claimsManager.getClaim(claimId);
    if (!claim) {
      vscode.window.showErrorMessage(`Claim ${claimId} not found`);
      return;
    }

    // Show input boxes for editing
    const newText = await vscode.window.showInputBox({
      prompt: 'Edit claim text',
      value: claim.text,
      validateInput: (value) => {
        return value.trim() ? null : 'Claim text cannot be empty';
      }
    });

    if (newText === undefined) {
      return; // User cancelled
    }

    const newCategory = await vscode.window.showQuickPick(
      ['Method', 'Result', 'Challenge', 'Data Source', 'Data Trend', 'Impact', 'Application', 'Phenomenon'],
      {
        placeHolder: 'Select category',
        canPickMany: false
      }
    );

    if (newCategory === undefined) {
      return; // User cancelled
    }

    try {
      await this._extensionState.claimsManager.updateClaim(claimId, {
        text: newText,
        category: newCategory
      });
      vscode.window.showInformationMessage(`Claim ${claimId} updated successfully`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update claim: ${error}`);
    }
  }

  private async _deleteClaim(claimId: string) {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete claim ${claimId}?`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') {
      return;
    }

    try {
      await this._extensionState.claimsManager.deleteClaim(claimId);
      vscode.window.showInformationMessage(`Claim ${claimId} deleted successfully`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete claim: ${error}`);
    }
  }

  private async _verifyClaim(claimId: string) {
    const claim = this._extensionState.claimsManager.getClaim(claimId);
    if (!claim) {
      vscode.window.showErrorMessage(`Claim ${claimId} not found`);
      return;
    }

    vscode.window.showInformationMessage('Quote verification feature coming soon');
    // TODO: Implement quote verification using Citation MCP
    // const result = await this._extensionState.quoteVerificationService.verifyQuote(
    //   claim.primaryQuote?.text,
    //   claim.primaryQuote?.source
    // );
  }

  private async _reassignClaim(claimId: string) {
    const claim = this._extensionState.claimsManager.getClaim(claimId);
    if (!claim) {
      vscode.window.showErrorMessage(`Claim ${claimId} not found`);
      return;
    }

    const sections = this._extensionState.outlineParser.getHierarchy();
    const sectionItems = sections.map(s => ({
      label: s.title,
      description: `Level ${s.level}`,
      id: s.id
    }));

    const selected = await vscode.window.showQuickPick(sectionItems, {
      placeHolder: 'Select section to assign claim to',
      canPickMany: true
    });

    if (!selected || selected.length === 0) {
      return;
    }

    const newSections = selected.map(s => s.id);

    try {
      await this._extensionState.claimsManager.updateClaim(claimId, {
        sections: newSections
      });
      vscode.window.showInformationMessage(`Claim ${claimId} reassigned successfully`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to reassign claim: ${error}`);
    }
  }

  private async _mergeClaims(claimIds: string[]) {
    if (claimIds.length < 2) {
      vscode.window.showWarningMessage('Please select at least 2 claims to merge');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Merge ${claimIds.length} claims into one?`,
      { modal: true },
      'Merge'
    );

    if (confirm !== 'Merge') {
      return;
    }

    try {
      const mergedClaim = await this._extensionState.claimsManager.mergeClaims(claimIds);
      vscode.window.showInformationMessage(
        `Claims merged successfully into ${mergedClaim.id}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to merge claims: ${error}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'claimsPanel.js')
    );

    // Get the local path to css styles
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'claimsPanel.css')
    );

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Claims Panel</title>
</head>
<body>
  <div id="root">
    <div class="claims-panel">
      <div class="controls">
        <div class="filter-section">
          <label for="category-filter">Category:</label>
          <select id="category-filter">
            <option value="">All Categories</option>
            <option value="Method">Method</option>
            <option value="Result">Result</option>
            <option value="Challenge">Challenge</option>
            <option value="Data Source">Data Source</option>
            <option value="Data Trend">Data Trend</option>
            <option value="Impact">Impact</option>
            <option value="Application">Application</option>
            <option value="Phenomenon">Phenomenon</option>
          </select>
        </div>
        
        <div class="filter-section">
          <label for="source-filter">Source:</label>
          <input type="text" id="source-filter" placeholder="Filter by source...">
        </div>
        
        <div class="filter-section">
          <label for="search-filter">Search:</label>
          <input type="text" id="search-filter" placeholder="Search claims...">
        </div>
        
        <div class="sort-section">
          <label for="sort-by">Sort by:</label>
          <select id="sort-by">
            <option value="id">ID</option>
            <option value="category">Category</option>
            <option value="source">Source</option>
            <option value="modified">Last Modified</option>
          </select>
          <button id="sort-order" class="icon-button" title="Toggle sort order">↓</button>
        </div>
      </div>
      
      <div class="claims-list" id="claims-list">
        <div class="loading">Loading claims...</div>
      </div>
      
      <div class="selection-actions" id="selection-actions" style="display: none;">
        <span id="selection-count">0 selected</span>
        <button id="merge-selected" class="action-button">Merge Selected</button>
        <button id="clear-selection" class="action-button secondary">Clear Selection</button>
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
