import * as vscode from 'vscode';
import * as path from 'path';
import type { OutlineSection, Claim, ManuscriptContext } from '@research-assistant/core';
import { OutlineParser } from './outlineParser';
import { ClaimsManager } from './claimsManager';

/**
 * ManuscriptContextDetector understands what the user is currently writing about.
 * 
 * Features:
 * - Parses manuscript.md using same logic as OutlineParser
 * - Detects current section based on cursor position
 * - Shows section name and coverage in status bar
 * - Filters paper/claim suggestions by current section
 * - Auto-includes section context in search queries
 * - Updates on cursor movement with 500ms debounce
 * 
 * Requirements: 48.1, 48.2, 48.3, 48.4, 48.5
 */
export class ManuscriptContextDetector {
  private manuscriptParser: OutlineParser;
  private claimsManager: ClaimsManager;
  private statusBarItem: vscode.StatusBarItem;
  private currentContext: ManuscriptContext | null = null;
  private debounceTimer: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];
  private workspaceRoot: string;
  private manuscriptPath: string;
  private coverageThresholds: { low: number; moderate: number; strong: number };

  constructor(
    workspaceRoot: string,
    claimsManager: ClaimsManager,
    coverageThresholds: { low: number; moderate: number; strong: number }
  ) {
    this.workspaceRoot = workspaceRoot;
    this.manuscriptPath = path.join(workspaceRoot, '03_Drafting', 'manuscript.md');
    this.claimsManager = claimsManager;
    this.coverageThresholds = coverageThresholds;

    // Create a separate parser for manuscript.md
    this.manuscriptParser = new OutlineParser(this.manuscriptPath);

    // Create status bar item (Requirement 48.4)
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200
    );
    this.statusBarItem.tooltip = 'Current manuscript section';
    this.disposables.push(this.statusBarItem);

    // Set up cursor movement listener with debouncing (Requirement 48.5)
    this.setupCursorListener();

    // Set up file watcher for manuscript.md
    this.setupFileWatcher();

    // Initial parse
    this.parseManuscript();
  }

  /**
   * Parse manuscript.md to detect sections (Requirement 48.1)
   * Uses same logic as OutlineParser
   */
  public async parseManuscript(): Promise<OutlineSection[]> {
    try {
      const sections = await this.manuscriptParser.parse();
      // Update context if we're currently in manuscript.md
      const editor = vscode.window.activeTextEditor;
      if (editor && this.isManuscriptDocument(editor.document)) {
        this.updateContext(editor.selection.active);
      }
      return sections;
    } catch (error) {
      console.error('Error parsing manuscript:', error);
      return [];
    }
  }

  /**
   * Detect current section based on cursor position (Requirement 48.2)
   */
  public detectCurrentSection(position: vscode.Position): OutlineSection | null {
    return this.manuscriptParser.getSectionAtPosition(position);
  }

  /**
   * Get the current manuscript context
   */
  public getContext(): ManuscriptContext | null {
    return this.currentContext;
  }

  /**
   * Update status bar with current section and coverage (Requirement 48.3)
   */
  private updateStatusBar(context: ManuscriptContext): void {
    if (!context.currentSection) {
      this.statusBarItem.text = '$(file-text) Manuscript';
      this.statusBarItem.show();
      return;
    }

    const section = context.currentSection;
    const claimCount = context.relevantClaims.length;
    
    // Choose icon based on coverage level
    let icon = '$(circle-outline)'; // none
    if (context.coverageLevel === 'low') {
      icon = '$(circle-slash)';
    } else if (context.coverageLevel === 'moderate') {
      icon = '$(circle-large-outline)';
    } else if (context.coverageLevel === 'strong') {
      icon = '$(pass-filled)';
    }

    this.statusBarItem.text = `${icon} ${section.title} (${claimCount} claims)`;
    this.statusBarItem.tooltip = `Section: ${section.title}\nCoverage: ${context.coverageLevel}\nClaims: ${claimCount}`;
    this.statusBarItem.show();
  }

  /**
   * Filter items by current section context (Requirement 48.2)
   */
  public filterByContext<T extends { sections?: string[] }>(items: T[]): T[] {
    if (!this.currentContext || !this.currentContext.currentSection) {
      return items;
    }

    const currentSectionId = this.currentContext.currentSection.id;
    return items.filter(item => 
      item.sections && item.sections.includes(currentSectionId)
    );
  }

  /**
   * Auto-include section context in search queries (Requirement 48.4)
   */
  public enhanceSearchQuery(query: string): string {
    if (!this.currentContext || !this.currentContext.currentSection) {
      return query;
    }

    const section = this.currentContext.currentSection;
    // Add section title as context to improve search relevance
    return `${query} (context: ${section.title})`;
  }

  /**
   * Get section text for context
   */
  private getSectionText(section: OutlineSection): string {
    return `${section.title}\n${section.content.join('\n')}`;
  }

  /**
   * Calculate coverage level based on claim count
   */
  private calculateCoverageLevel(claimCount: number): 'none' | 'low' | 'moderate' | 'strong' {
    if (claimCount === 0) {
      return 'none';
    } else if (claimCount < this.coverageThresholds.low) {
      return 'low';
    } else if (claimCount < this.coverageThresholds.moderate) {
      return 'moderate';
    } else {
      return 'strong';
    }
  }

  /**
   * Get claims relevant to a section
   */
  private getRelevantClaims(sectionId: string): Claim[] {
    const allClaims = this.claimsManager.getClaims();
    return allClaims.filter(claim => 
      claim.sections && claim.sections.includes(sectionId)
    );
  }

  /**
   * Update context based on cursor position
   */
  private updateContext(position: vscode.Position): void {
    const section = this.detectCurrentSection(position);
    
    if (!section) {
      this.currentContext = {
        currentSection: null,
        sectionText: '',
        coverageLevel: 'none',
        relevantClaims: []
      };
      this.updateStatusBar(this.currentContext);
      return;
    }

    const relevantClaims = this.getRelevantClaims(section.id);
    const coverageLevel = this.calculateCoverageLevel(relevantClaims.length);

    this.currentContext = {
      currentSection: section,
      sectionText: this.getSectionText(section),
      coverageLevel,
      relevantClaims
    };

    this.updateStatusBar(this.currentContext);
  }

  /**
   * Set up cursor movement listener with debouncing (Requirement 48.5)
   */
  private setupCursorListener(): void {
    // Listen to active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && this.isManuscriptDocument(editor.document)) {
          this.debouncedUpdateContext(editor.selection.active);
        } else {
          // Hide status bar when not in manuscript
          this.statusBarItem.hide();
          this.currentContext = null;
        }
      })
    );

    // Listen to selection changes (cursor movement)
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(event => {
        if (this.isManuscriptDocument(event.textEditor.document)) {
          this.debouncedUpdateContext(event.selections[0].active);
        }
      })
    );

    // Initial update if manuscript is already open
    const editor = vscode.window.activeTextEditor;
    if (editor && this.isManuscriptDocument(editor.document)) {
      this.updateContext(editor.selection.active);
    }
  }

  /**
   * Debounced context update (500ms delay)
   */
  private debouncedUpdateContext(position: vscode.Position): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.updateContext(position);
      this.debounceTimer = undefined;
    }, 500);
  }

  /**
   * Set up file watcher for manuscript.md
   */
  private setupFileWatcher(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, '03_Drafting/manuscript.md')
    );

    watcher.onDidChange(() => {
      // Re-parse manuscript when it changes
      this.parseManuscript();
    });

    this.disposables.push(watcher);
  }

  /**
   * Check if a document is the manuscript
   */
  private isManuscriptDocument(document: vscode.TextDocument): boolean {
    return document.fileName.endsWith('manuscript.md') && 
           document.fileName.includes('03_Drafting');
  }

  /**
   * Get all sections from manuscript
   */
  public getSections(): OutlineSection[] {
    return this.manuscriptParser.getSections();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
