import * as vscode from 'vscode';
import * as path from 'path';
import { ClaimExtractor } from './claimExtractor';
import { ReadingStatusManager } from './readingStatusManager';
import { ClaimsManager } from './claimsManagerWrapper';
import type { PotentialClaim } from '@research-assistant/core';

/**
 * ReadingAssistant provides assistance during active reading of papers.
 * 
 * Features:
 * - Activates when opening files from literature/ExtractedText/
 * - Provides code lens actions for selected text
 * - Tracks reading progress and status
 * - Prompts for claim extraction when marking as read
 * 
 * Validates Requirements 5.1, 5.2, 5.3, 16.4
 */
export class ReadingAssistant {
  private claimExtractor: ClaimExtractor;
  private readingStatusManager: ReadingStatusManager;
  private claimsManager: ClaimsManager;
  private extractedTextPath: string;
  private codeLensProvider: ReadingCodeLensProvider;
  private disposables: vscode.Disposable[] = [];

  constructor(
    claimExtractor: ClaimExtractor,
    readingStatusManager: ReadingStatusManager,
    claimsManager: ClaimsManager,
    extractedTextPath: string
  ) {
    this.claimExtractor = claimExtractor;
    this.readingStatusManager = readingStatusManager;
    this.claimsManager = claimsManager;
    this.extractedTextPath = extractedTextPath;

    // Create code lens provider
    this.codeLensProvider = new ReadingCodeLensProvider(this);

    // Register code lens provider for text files in extracted text directory
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
      { scheme: 'file', pattern: '**/' + path.basename(extractedTextPath) + '/**/*.txt' },
      this.codeLensProvider
    );
    
    if (codeLensDisposable) {
      this.disposables.push(codeLensDisposable);
    }

    // Register commands
    this.registerCommands();

    // Watch for document opens to activate reading mode
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.activateForDocument(editor.document);
      }
    });
    
    if (editorChangeDisposable) {
      this.disposables.push(editorChangeDisposable);
    }

    // Activate for currently open editor if applicable
    if (vscode.window.activeTextEditor) {
      this.activateForDocument(vscode.window.activeTextEditor.document);
    }
  }

  /**
   * Activate reading assistance for a document.
   * Checks if the document is from the extracted text directory.
   * 
   * Validates: Requirement 5.1
   */
  activateForDocument(document: vscode.TextDocument): void {
    // Check if document is from literature/ExtractedText/
    const docPath = document.uri.fsPath;
    const normalizedExtractedPath = path.normalize(this.extractedTextPath);
    const normalizedDocPath = path.normalize(docPath);

    if (!normalizedDocPath.includes(normalizedExtractedPath)) {
      return;
    }

    // Document is from extracted text directory - activate reading mode
    console.log(`Reading assistant activated for: ${path.basename(docPath)}`);

    // Get paper ID from filename (e.g., "Smith2023.txt" -> "Smith2023")
    const paperId = this.getPaperIdFromPath(docPath);

    // Check reading status
    const status = this.readingStatusManager.getStatus(paperId);

    if (!status || status.status === 'to-read') {
      // Automatically mark as "reading" when opening
      this.readingStatusManager.setStatus(paperId, 'reading');
      
      vscode.window.showInformationMessage(
        `Reading: ${paperId}`,
        'Mark as Read',
        'Extract Claims'
      ).then(selection => {
        if (selection === 'Mark as Read') {
          this.markAsRead(paperId, document);
        } else if (selection === 'Extract Claims') {
          this.extractClaimsFromDocument(document);
        }
      });
    }
  }

  /**
   * Extract a claim from the currently selected text.
   * 
   * Validates: Requirement 5.2, 5.3
   */
  async extractClaimFromSelection(selection: vscode.Range, document: vscode.TextDocument): Promise<PotentialClaim | null> {
    const selectedText = document.getText(selection);

    if (!selectedText || selectedText.trim().length === 0) {
      vscode.window.showWarningMessage('Please select text to extract as a claim');
      return null;
    }

    // Get paper ID from document
    const paperId = this.getPaperIdFromPath(document.uri.fsPath);

    // Get context (surrounding text)
    const contextRange = new vscode.Range(
      Math.max(0, selection.start.line - 2),
      0,
      Math.min(document.lineCount - 1, selection.end.line + 2),
      Number.MAX_SAFE_INTEGER
    );
    const contextText = document.getText(contextRange);

    // Create potential claim
    const potentialClaim: PotentialClaim = {
      text: selectedText.trim(),
      context: contextText,
      confidence: 0.8, // User-selected text has high confidence
      type: this.claimExtractor.categorizeClaim(selectedText),
      lineNumber: selection.start.line + 1
    };

    return potentialClaim;
  }

  /**
   * Extract all potential claims from a document.
   * 
   * Validates: Requirement 5.2
   */
  async extractClaimsFromDocument(document: vscode.TextDocument): Promise<void> {
    const text = document.getText();
    const paperId = this.getPaperIdFromPath(document.uri.fsPath);

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Extracting claims from ${paperId}...`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // Extract potential claims
        const potentialClaims = this.claimExtractor.extractFromText(text, paperId);

        progress.report({ increment: 50 });

        if (potentialClaims.length === 0) {
          vscode.window.showInformationMessage('No potential claims found in this document');
          return;
        }

        progress.report({ increment: 100 });

        // Show potential claims to user
        const claimItems = potentialClaims.slice(0, 10).map(claim => ({
          label: `${claim.type} (${(claim.confidence * 100).toFixed(0)}% confidence)`,
          description: claim.text.substring(0, 80) + (claim.text.length > 80 ? '...' : ''),
          detail: `Line ${claim.lineNumber}`,
          claim
        }));

        const selected = await vscode.window.showQuickPick(claimItems, {
          placeHolder: `Found ${potentialClaims.length} potential claims. Select one to add to database:`,
          canPickMany: false
        });

        if (selected) {
          await this.addClaimToDatabase(selected.claim, paperId, document);
        }
      }
    );
  }

  /**
   * Add a potential claim to the claims database.
   * Prompts user for confirmation and section assignment.
   * 
   * Validates: Requirement 5.3, 5.4, 5.5
   */
  private async addClaimToDatabase(
    potentialClaim: PotentialClaim,
    paperId: string,
    document: vscode.TextDocument
  ): Promise<void> {
    // Generate claim ID
    const claimId = this.claimsManager.generateClaimId();

    // Get source ID (for now, use a placeholder - should be from Zotero metadata)
    const sourceId = 1; // TODO: Get from Zotero MCP

    // Suggest sections (placeholder - would use outline parser in full implementation)
    // Validates: Requirement 5.4
    const sections: string[] = []; // TODO: Use claimExtractor.suggestSections()

    // Show claim form
    const claimText = await vscode.window.showInputBox({
      prompt: 'Edit claim text if needed',
      value: potentialClaim.text,
      validateInput: (value) => {
        return value.trim().length === 0 ? 'Claim text cannot be empty' : null;
      }
    });

    if (!claimText) {
      return; // User cancelled
    }

    // Create claim object
    const claim = {
      id: claimId,
      text: claimText,
      category: this.formatCategory(potentialClaim.type),
      source: paperId,
      sourceId: sourceId,
      context: potentialClaim.context,
      primaryQuote: potentialClaim.text,
      supportingQuotes: [],
      sections: sections,
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    // Save claim
    // Validates: Requirement 5.5
    await this.claimsManager.saveClaim(claim);

    vscode.window.showInformationMessage(
      `Claim ${claimId} added to database`,
      'View Claim'
    ).then(selection => {
      if (selection === 'View Claim') {
        vscode.commands.executeCommand('researchAssistant.viewAllQuotes', claimId);
      }
    });
  }

  /**
   * Mark a paper as read and prompt for claim extraction.
   * 
   * Validates: Requirement 16.4
   */
  private async markAsRead(paperId: string, document: vscode.TextDocument): Promise<void> {
    // Update reading status
    await this.readingStatusManager.setStatus(paperId, 'read');

    // Prompt for claim extraction
    // Validates: Requirement 16.4
    const result = await vscode.window.showInformationMessage(
      `${paperId} marked as read. Would you like to extract claims?`,
      'Extract Claims',
      'Skip'
    );

    if (result === 'Extract Claims') {
      await this.extractClaimsFromDocument(document);
    }
  }

  /**
   * Track reading progress for a paper.
   * 
   * Validates: Requirement 16.1, 16.2
   */
  async trackReadingProgress(paperId: string, status: 'reading' | 'read'): Promise<void> {
    await this.readingStatusManager.setStatus(paperId, status);
  }

  /**
   * Get paper ID from file path.
   * Extracts the filename without extension (e.g., "Smith2023.txt" -> "Smith2023")
   */
  private getPaperIdFromPath(filePath: string): string {
    const basename = path.basename(filePath);
    const paperId = basename.replace(/\.[^/.]+$/, ''); // Remove extension
    return paperId;
  }

  /**
   * Format category name for database.
   */
  private formatCategory(type: PotentialClaim['type']): string {
    const categoryMap: Record<PotentialClaim['type'], string> = {
      method: 'Method',
      result: 'Result',
      conclusion: 'Conclusion',
      background: 'Background',
      challenge: 'Challenge',
      data_source: 'Data Source',
      data_trend: 'Data Trend',
      impact: 'Impact',
      application: 'Application',
      phenomenon: 'Phenomenon'
    };

    return categoryMap[type] || 'Background';
  }

  /**
   * Register commands for reading assistant.
   */
  private registerCommands(): void {
    const commands = [
      vscode.commands.registerCommand('researchAssistant.extractClaimFromSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
          vscode.window.showWarningMessage('Please select text to extract as a claim');
          return;
        }

        const potentialClaim = await this.extractClaimFromSelection(selection, editor.document);
        if (potentialClaim) {
          const paperId = this.getPaperIdFromPath(editor.document.uri.fsPath);
          await this.addClaimToDatabase(potentialClaim, paperId, editor.document);
        }
      }),

      vscode.commands.registerCommand('researchAssistant.extractAllClaims', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        await this.extractClaimsFromDocument(editor.document);
      }),

      vscode.commands.registerCommand('researchAssistant.markPaperAsRead', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const paperId = this.getPaperIdFromPath(editor.document.uri.fsPath);
        await this.markAsRead(paperId, editor.document);
      }),

      vscode.commands.registerCommand('researchAssistant.markPaperAsReading', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const paperId = this.getPaperIdFromPath(editor.document.uri.fsPath);
        await this.trackReadingProgress(paperId, 'reading');
        vscode.window.showInformationMessage(`${paperId} marked as reading`);
      })
    ];

    // Only push non-undefined disposables
    commands.forEach(cmd => {
      if (cmd) {
        this.disposables.push(cmd);
      }
    });
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this.disposables.forEach(d => {
      if (d && typeof d.dispose === 'function') {
        d.dispose();
      }
    });
  }
}

/**
 * Code lens provider for reading assistance.
 * Provides inline actions for selected text in extracted text files.
 * 
 * Validates: Requirement 5.2
 */
class ReadingCodeLensProvider implements vscode.CodeLensProvider {
  private readingAssistant: ReadingAssistant;
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  constructor(readingAssistant: ReadingAssistant) {
    this.readingAssistant = readingAssistant;
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    // Add code lens at the top of the document for quick actions
    const topRange = new vscode.Range(0, 0, 0, 0);

    codeLenses.push(
      new vscode.CodeLens(topRange, {
        title: '$(book) Extract All Claims',
        command: 'researchAssistant.extractAllClaims',
        tooltip: 'Automatically extract potential claims from this document'
      }),
      new vscode.CodeLens(topRange, {
        title: '$(check) Mark as Read',
        command: 'researchAssistant.markPaperAsRead',
        tooltip: 'Mark this paper as read and extract claims'
      }),
      new vscode.CodeLens(topRange, {
        title: '$(eye) Mark as Reading',
        command: 'researchAssistant.markPaperAsReading',
        tooltip: 'Mark this paper as currently reading'
      })
    );

    return codeLenses;
  }

  refresh(): void {
    this.onDidChangeCodeLensesEmitter.fire();
  }
}
