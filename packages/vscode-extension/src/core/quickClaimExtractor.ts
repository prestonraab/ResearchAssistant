import * as vscode from 'vscode';
import * as path from 'path';
import { ClaimsManager } from './claimsManagerWrapper';
import { ClaimExtractor } from './claimExtractor';
import { OutlineParser } from './outlineParserWrapper';
import { EmbeddingService } from '@research-assistant/core';
import { AutoQuoteVerifier } from './autoQuoteVerifier';
import type { Claim } from '@research-assistant/core';

export interface QuickClaimForm {
  claimText: string;
  category: string;
  suggestedSections: string[];
  sections?: string[];
  source: string;
  quote: string;
}

/**
 * QuickClaimExtractor enables one-click claim extraction with maximum automation.
 * 
 * Features:
 * - Auto-detects source from filename (e.g., "Smith2023.txt" -> "Smith2023")
 * - Auto-categorizes claim type using keyword matching
 * - Auto-suggests outline sections using embedding similarity
 * - Shows minimal input form (only claim text editable by default)
 * - Saves to claims_and_evidence.md immediately
 * - Triggers background verification without blocking
 * 
 * Validates Requirements: 42.1, 42.2, 42.3, 42.4, 42.5
 */
export class QuickClaimExtractor {
  private claimsManager: ClaimsManager;
  private claimExtractor: ClaimExtractor;
  private outlineParser: OutlineParser;
  private embeddingService: EmbeddingService;
  private autoQuoteVerifier: AutoQuoteVerifier;
  private extractedTextPath: string;
  private disposables: vscode.Disposable[] = [];

  constructor(
    claimsManager: ClaimsManager,
    claimExtractor: ClaimExtractor,
    outlineParser: OutlineParser,
    embeddingService: EmbeddingService,
    autoQuoteVerifier: AutoQuoteVerifier,
    extractedTextPath: string
  ) {
    this.claimsManager = claimsManager;
    this.claimExtractor = claimExtractor;
    this.outlineParser = outlineParser;
    this.embeddingService = embeddingService;
    this.autoQuoteVerifier = autoQuoteVerifier;
    this.extractedTextPath = extractedTextPath;
  }

  /**
   * Register commands and context menu for quick claim extraction.
   * Validates: Requirement 42.1
   */
  registerCommands(): vscode.Disposable[] {
    const commands = [
      // Quick Extract Claim command
      vscode.commands.registerCommand('researchAssistant.quickExtractClaim', async () => {
        await this.extractFromSelection();
      })
    ];

    this.disposables.push(...commands.filter(cmd => cmd !== undefined) as vscode.Disposable[]);
    return this.disposables;
  }

  /**
   * Register context menu for ExtractedText files.
   * Validates: Requirement 42.1
   */
  registerContextMenu(): void {
    // Context menu is registered in package.json
    // This method is for future dynamic registration if needed
  }

  /**
   * Extract claim from current selection with one-click workflow.
   * Validates: Requirements 42.1, 42.2, 42.3, 42.4, 42.5
   */
  async extractFromSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(
        'Please open a file first to extract claims.',
        'Open File'
      ).then(action => {
        if (action === 'Open File') {
          vscode.commands.executeCommand('workbench.action.files.openFile');
        }
      });
      return;
    }

    // Check if we're in an ExtractedText file
    const docPath = editor.document.uri.fsPath;
    const normalizedExtractedPath = path.normalize(this.extractedTextPath);
    const normalizedDocPath = path.normalize(docPath);

    if (!normalizedDocPath.includes(normalizedExtractedPath)) {
      vscode.window.showWarningMessage(
        'Quick Extract Claim works only in ExtractedText files. Please open a file from the literature/ExtractedText folder.',
        'Browse Files'
      ).then(action => {
        if (action === 'Browse Files') {
          vscode.commands.executeCommand('workbench.action.files.openFile');
        }
      });
      return;
    }

    // Get selection
    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage(
        'Please select some text to extract as a claim.'
      );
      return;
    }

    const selectedText = editor.document.getText(selection);
    if (!selectedText || selectedText.trim().length === 0) {
      vscode.window.showWarningMessage(
        'Please select some text to extract as a claim.'
      );
      return;
    }

    // Auto-detect source from filename
    // Validates: Requirement 42.3
    const source = this.autoDetectSource(editor.document);

    // Auto-detect category
    // Validates: Requirement 42.5
    const category = this.autoDetectCategory(selectedText);

    // Auto-suggest sections using embeddings
    // Validates: Requirement 42.4
    const suggestedSections = await this.suggestSections(selectedText);

    // Create quick form
    const form: QuickClaimForm = {
      claimText: selectedText.trim(),
      category,
      suggestedSections,
      source,
      quote: selectedText.trim()
    };

    // Show streamlined form
    // Validates: Requirement 42.2
    const claim = await this.showQuickForm(form);

    if (claim) {
      // Save and verify
      // Validates: Requirement 42.5
      await this.saveAndVerify(claim);
    }
  }

  /**
   * Auto-detect source from filename.
   * Extracts author-year format from filename (e.g., "Smith2023.txt" -> "Smith2023")
   * 
   * Validates: Requirement 42.3
   */
  autoDetectSource(document: vscode.TextDocument): string {
    const basename = path.basename(document.uri.fsPath);
    // Remove extension
    const source = basename.replace(/\.[^/.]+$/, '');
    return source;
  }

  /**
   * Auto-detect category using keyword matching.
   * Uses the ClaimExtractor's categorization logic.
   * 
   * Validates: Requirement 42.5
   */
  autoDetectCategory(text: string): string {
    const type = this.claimExtractor.categorizeClaim(text);
    
    // Map type to category name
    const categoryMap: Record<string, string> = {
      'method': 'Method',
      'result': 'Result',
      'conclusion': 'Conclusion',
      'background': 'Background',
      'challenge': 'Challenge',
      'data_source': 'Data Source',
      'data_trend': 'Data Trend',
      'impact': 'Impact',
      'application': 'Application',
      'phenomenon': 'Phenomenon'
    };

    return categoryMap[type] || 'Background';
  }

  /**
   * Suggest outline sections using embedding similarity.
   * Returns top 3 most relevant sections.
   * 
   * Validates: Requirement 42.4
   */
  async suggestSections(text: string): Promise<string[]> {
    try {
      // Get all outline sections
      const sections = await this.outlineParser.parse();
      
      if (sections.length === 0) {
        return [];
      }

      // Use ClaimExtractor's suggestSections method
      const suggestedSections = await this.claimExtractor.suggestSections(text, sections);
      
      // Return section IDs
      return suggestedSections.map(s => s.id);
    } catch (error) {
      console.error('Error suggesting sections:', error);
      return [];
    }
  }

  /**
   * Show streamlined claim form with auto-populated fields.
   * Only claim text is editable by default, other fields can be modified if needed.
   * 
   * Validates: Requirement 42.2
   */
  async showQuickForm(form: QuickClaimForm): Promise<Claim | null> {
    // Step 1: Allow user to edit claim text
    const claimText = await vscode.window.showInputBox({
      prompt: 'Edit claim text if needed',
      value: form.claimText,
      placeHolder: 'Claim text',
      validateInput: (value) => {
        return value.trim().length === 0 ? 'Claim text cannot be empty' : null;
      }
    });

    if (!claimText) {
      return null; // User cancelled
    }

    // Step 2: Show quick pick with auto-detected info and option to modify
    const action = await vscode.window.showQuickPick(
      [
        {
          label: '$(check) Save Claim',
          description: `Category: ${form.category} | Source: ${form.source}`,
          detail: form.suggestedSections.length > 0 
            ? `Suggested sections: ${form.suggestedSections.join(', ')}`
            : 'No sections suggested',
          action: 'save'
        },
        {
          label: '$(edit) Modify Category',
          description: `Current: ${form.category}`,
          action: 'category'
        },
        {
          label: '$(edit) Modify Source',
          description: `Current: ${form.source}`,
          action: 'source'
        },
        {
          label: '$(edit) Modify Sections',
          description: form.suggestedSections.length > 0 
            ? `Current: ${form.suggestedSections.join(', ')}`
            : 'No sections selected',
          action: 'sections'
        },
        {
          label: '$(x) Cancel',
          action: 'cancel'
        }
      ],
      {
        placeHolder: 'Save claim or modify auto-detected fields'
      }
    );

    if (!action || action.action === 'cancel') {
      return null;
    }

    // Handle modifications
    let finalCategory = form.category;
    let finalSource = form.source;
    let finalSections = form.suggestedSections;

    if (action.action === 'category') {
      const categories = [
        'Method', 'Result', 'Conclusion', 'Background', 'Challenge',
        'Data Source', 'Data Trend', 'Impact', 'Application', 'Phenomenon'
      ];
      const selectedCategory = await vscode.window.showQuickPick(categories, {
        placeHolder: 'Select category'
      });
      if (selectedCategory) {
        finalCategory = selectedCategory;
      }
      // Recursively show form again
      return this.showQuickForm({
        ...form,
        claimText,
        category: finalCategory
      });
    }

    if (action.action === 'source') {
      const newSource = await vscode.window.showInputBox({
        prompt: 'Enter source (AuthorYear format)',
        value: finalSource,
        validateInput: (value) => {
          return value.trim().length === 0 ? 'Source cannot be empty' : null;
        }
      });
      if (newSource) {
        finalSource = newSource;
      }
      // Recursively show form again
      return this.showQuickForm({
        ...form,
        claimText,
        source: finalSource
      });
    }

    if (action.action === 'sections') {
      const sections = await this.outlineParser.parse();
      const sectionItems = sections.map(s => ({
        label: s.title,
        description: `Level ${s.level}`,
        picked: finalSections.includes(s.id),
        id: s.id
      }));

      const selectedSections = await vscode.window.showQuickPick(sectionItems, {
        placeHolder: 'Select sections (can select multiple)',
        canPickMany: true
      });

      if (selectedSections) {
        finalSections = selectedSections.map(s => s.id);
      }
      // Recursively show form again
      return this.showQuickForm({
        ...form,
        claimText,
        sections: finalSections
      });
    }

    // Create claim object
    const claimId = this.claimsManager.generateClaimId();
    
    // Get source ID (placeholder - should be from Zotero metadata)
    const sourceId = this.getSourceId(finalSource);

    const claim: Claim = {
      id: claimId,
      text: claimText,
      category: finalCategory,
      context: '', // Context can be added later if needed
      primaryQuote: {
        text: form.quote,
        source: finalSource,
        sourceId: sourceId,
        verified: false
      },
      supportingQuotes: [],
      sections: finalSections,
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    return claim;
  }

  /**
   * Save claim to database and trigger background verification.
   * Validates: Requirement 42.5
   * 
   * Background verification is triggered asynchronously via AutoQuoteVerifier
   * to avoid blocking the UI. The claim is saved immediately as unverified,
   * and verification status is updated in the background.
   */
  async saveAndVerify(claim: Claim): Promise<void> {
    try {
      // Save to claims_and_evidence.md
      await this.claimsManager.saveClaim(claim);

      // Show success message
      vscode.window.showInformationMessage(
        `Claim ${claim.id} saved successfully`,
        'View Claim'
      ).then(selection => {
        if (selection === 'View Claim') {
          vscode.commands.executeCommand('researchAssistant.showClaimDetails', claim.id);
        }
      });

      // Trigger background verification (non-blocking)
      // The AutoQuoteVerifier will queue the claim for verification and process it
      // in the background without blocking the UI. Verification results are
      // automatically updated in the claims database when complete.
      this.autoQuoteVerifier.verifyOnSave(claim);
      
    } catch (error) {
      console.error('Error saving claim:', error);
      vscode.window.showErrorMessage(`Failed to save claim: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get source ID for a source.
   * This is a placeholder - should query Zotero metadata in production.
   */
  private getSourceId(source: string): number {
    // For now, generate a simple numeric ID based on existing claims
    const existingClaims = this.claimsManager.getClaims();
    const sourceIds = existingClaims
      .filter(c => c.primaryQuote?.source === source)
      .map(c => c.primaryQuote?.sourceId)
      .filter(id => id !== undefined) as number[];
    
    if (sourceIds.length > 0) {
      // Use existing source ID
      return sourceIds[0];
    }
    
    // Generate new source ID
    const allSourceIds = existingClaims
      .map(c => c.primaryQuote?.sourceId)
      .filter(id => id !== undefined) as number[];
    const maxId = allSourceIds.length > 0 ? Math.max(...allSourceIds) : 0;
    return maxId + 1;
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
