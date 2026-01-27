import * as vscode from 'vscode';
import { OutlineParser } from './outlineParserWrapper';
import type { OutlineSection } from '@research-assistant/core';
import { ClaimsPanelProvider } from '../ui/claimsPanelProvider';
import { ClaimsManager } from './claimsManagerWrapper';

/**
 * PositionMapper detects the current section based on cursor position
 * and updates the claims panel to show relevant claims.
 * 
 * Implements Requirements 10.1 and 10.2:
 * - Detects current section based on cursor position
 * - Displays relevant claims in sidebar
 * - Updates on cursor movement with debouncing
 */
export class PositionMapper implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: NodeJS.Timeout | undefined;
  private currentSection: OutlineSection | null = null;
  private readonly debounceDelay = 300; // milliseconds

  constructor(
    private readonly outlineParser: OutlineParser,
    private readonly claimsPanel: ClaimsPanelProvider,
    private readonly claimsManager: ClaimsManager,
    private readonly draftingPath: string
  ) {
    this.initialize();
  }

  private initialize(): void {
    // Watch for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.onEditorChanged(editor);
        }
      })
    );

    // Watch for cursor position changes
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(event => {
        this.onSelectionChanged(event);
      })
    );

    // Watch for text document changes (to update section boundaries)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        this.onDocumentChanged(event);
      })
    );

    // Initialize with current editor if it's a draft file
    if (vscode.window.activeTextEditor) {
      this.onEditorChanged(vscode.window.activeTextEditor);
    }
  }

  private onEditorChanged(editor: vscode.TextEditor): void {
    // Check if the editor is editing a file in the drafting directory
    if (this.isDraftFile(editor.document)) {
      this.updateCurrentSection(editor.document, editor.selection.active);
    } else {
      // Clear current section if not in a draft file
      this.clearCurrentSection();
    }
  }

  private onSelectionChanged(event: vscode.TextEditorSelectionChangeEvent): void {
    // Only process if the editor is editing a draft file
    if (this.isDraftFile(event.textEditor.document)) {
      this.debouncedUpdateSection(event.textEditor.document, event.selections[0].active);
    }
  }

  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    // If the document is a draft file and has changes, update section boundaries
    if (this.isDraftFile(event.document) && event.contentChanges.length > 0) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        this.debouncedUpdateSection(event.document, editor.selection.active);
      }
    }
  }

  private isDraftFile(document: vscode.TextDocument): boolean {
    // Check if the file is in the drafting directory (03_Drafting/)
    const filePath = document.uri.fsPath;
    return filePath.includes(this.draftingPath) && document.languageId === 'markdown';
  }

  private debouncedUpdateSection(document: vscode.TextDocument, position: vscode.Position): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.updateCurrentSection(document, position);
    }, this.debounceDelay);
  }

  private updateCurrentSection(document: vscode.TextDocument, position: vscode.Position): void {
    // Get the section at the cursor position
    const section = this.outlineParser.getSectionAtPosition(position);

    // Only update if the section has changed
    if (this.hasSectionChanged(section)) {
      this.currentSection = section;
      this.updateClaimsPanel(section);
    }
  }

  private hasSectionChanged(newSection: OutlineSection | null): boolean {
    if (this.currentSection === null && newSection === null) {
      return false;
    }
    
    if (this.currentSection === null || newSection === null) {
      return true;
    }
    
    return this.currentSection.id !== newSection.id;
  }

  private updateClaimsPanel(section: OutlineSection | null): void {
    if (section) {
      // Show claims for the current section
      this.claimsPanel.showClaimsForSection(section.id);
      
      // Optionally show a status bar message
      vscode.window.setStatusBarMessage(
        `Section: ${section.title} (${this.getClaimCount(section.id)} claims)`,
        3000
      );
    } else {
      // No section detected, show all claims
      this.claimsPanel.showAllClaims();
    }
  }

  private clearCurrentSection(): void {
    if (this.currentSection !== null) {
      this.currentSection = null;
      this.claimsPanel.showAllClaims();
    }
  }

  private getClaimCount(sectionId: string): number {
    // Get the count of claims for this section
    const claims = this.claimsManager.findClaimsBySection(sectionId);
    return claims.length;
  }

  /**
   * Get the current section being edited
   */
  public getCurrentSection(): OutlineSection | null {
    return this.currentSection;
  }

  /**
   * Manually trigger section detection for the current cursor position
   */
  public async detectCurrentSection(): Promise<OutlineSection | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.isDraftFile(editor.document)) {
      return null;
    }

    const section = this.outlineParser.getSectionAtPosition(editor.selection.active);
    this.currentSection = section;
    this.updateClaimsPanel(section);
    
    return section;
  }

  dispose(): void {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Dispose all subscriptions
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
