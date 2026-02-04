import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { analyzeWritingQuality, generateFeedbackItems } from '../core/writingFeedbackLogic';

/**
 * WritingFeedbackDecorator provides real-time feedback on draft writing
 * by highlighting vague statements and unsupported claims.
 * 
 * Implements Requirements 12.1, 12.2, 12.3, 12.4
 * 
 * This is a thin VSCode integration layer that delegates to pure logic functions.
 */
export class WritingFeedbackDecorator {
  private extensionState: ExtensionState;
  private vaguenessDecorationType: vscode.TextEditorDecorationType;
  private missingCitationDecorationType: vscode.TextEditorDecorationType;
  private debounceTimer: NodeJS.Timeout | undefined;
  private readonly debounceDelay = 500; // ms

  constructor(extensionState: ExtensionState) {
    this.extensionState = extensionState;

    // Create decoration type for vague statements (yellow warning)
    this.vaguenessDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 200, 0, 0.15)',
      borderRadius: '2px',
      border: '1px solid rgba(255, 200, 0, 0.4)',
      overviewRulerColor: 'rgba(255, 200, 0, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    // Create decoration type for missing citations (orange warning)
    this.missingCitationDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 140, 0, 0.15)',
      borderRadius: '2px',
      border: '1px solid rgba(255, 140, 0, 0.4)',
      overviewRulerColor: 'rgba(255, 140, 0, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  /**
   * Activate the decorator for the given editor
   */
  activate(editor: vscode.TextEditor): void {
    this.updateDecorations(editor);
  }

  /**
   * Handle text document changes with debouncing (Requirement 12.4)
   */
  onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent, editor: vscode.TextEditor): void {
    // Only process markdown files in drafting directory
    if (!this.shouldProcessDocument(event.document)) {
      return;
    }

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer to update decorations after debounce delay
    this.debounceTimer = setTimeout(() => {
      this.updateDecorations(editor);
    }, this.debounceDelay);
  }

  /**
   * Check if document should be processed for feedback
   */
  private shouldProcessDocument(document: vscode.TextDocument): boolean {
    // Only process markdown files
    if (document.languageId !== 'markdown') {
      return false;
    }

    // Only process files in drafting directory
    const draftingPath = this.extensionState.getAbsolutePath('03_Drafting');
    return document.uri.fsPath.startsWith(draftingPath);
  }

  /**
   * Update decorations for the given editor
   */
  private updateDecorations(editor: vscode.TextEditor): void {
    if (!this.shouldProcessDocument(editor.document)) {
      return;
    }

    const text = editor.document.getText();
    const allClaims = this.extensionState.claimsManager.getAllClaims();

    // Use pure logic to analyze text
    const analysis = analyzeWritingQuality(text, allClaims);
    const feedbackItems = generateFeedbackItems(analysis);

    const vaguenessDecorations: vscode.DecorationOptions[] = [];
    const missingCitationDecorations: vscode.DecorationOptions[] = [];

    // Convert feedback items to VSCode decorations
    for (const item of feedbackItems) {
      const startPos = editor.document.positionAt(item.offset);
      const endPos = editor.document.positionAt(item.offset + item.length);
      const range = new vscode.Range(startPos, endPos);

      const decoration: vscode.DecorationOptions = {
        range,
        hoverMessage: new vscode.MarkdownString(item.message)
      };

      if (item.type === 'vagueness') {
        vaguenessDecorations.push(decoration);
      } else {
        missingCitationDecorations.push(decoration);
      }
    }

    // Apply decorations (Requirement 12.3)
    editor.setDecorations(this.vaguenessDecorationType, vaguenessDecorations);
    editor.setDecorations(this.missingCitationDecorationType, missingCitationDecorations);
  }

  /**
   * Clear all decorations
   */
  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.vaguenessDecorationType, []);
    editor.setDecorations(this.missingCitationDecorationType, []);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.vaguenessDecorationType.dispose();
    this.missingCitationDecorationType.dispose();
  }
}
