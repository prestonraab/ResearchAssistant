import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';

/**
 * WritingFeedbackDecorator provides real-time feedback on draft writing
 * by highlighting vague statements and unsupported claims.
 * 
 * Implements Requirements 12.1, 12.2, 12.3, 12.4
 */
export class WritingFeedbackDecorator {
  private extensionState: ExtensionState;
  private vaguenessDecorationType: vscode.TextEditorDecorationType;
  private missingCitationDecorationType: vscode.TextEditorDecorationType;
  private debounceTimer: NodeJS.Timeout | undefined;
  private readonly debounceDelay = 500; // ms

  // Common vague terms to detect (Requirement 12.1)
  private readonly vagueTerms = [
    'some', 'many', 'often', 'sometimes', 'usually', 'generally',
    'mostly', 'frequently', 'rarely', 'seldom', 'occasionally',
    'several', 'various', 'numerous', 'a lot', 'a few',
    'quite', 'rather', 'fairly', 'somewhat', 'relatively',
    'pretty', 'very', 'extremely', 'highly', 'significantly'
  ];

  // Pattern to detect claim references (e.g., C_01, C_123)
  private readonly claimReferencePattern = /\bC_\d+\b/g;

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
    const vaguenessDecorations: vscode.DecorationOptions[] = [];
    const missingCitationDecorations: vscode.DecorationOptions[] = [];

    // Split text into sentences for analysis
    const sentences = this.splitIntoSentences(text);

    for (const sentence of sentences) {
      // Check for vague terms (Requirement 12.1)
      const vagueTermMatches = this.findVagueTerms(sentence);
      for (const match of vagueTermMatches) {
        const startPos = editor.document.positionAt(match.offset);
        const endPos = editor.document.positionAt(match.offset + match.length);
        const range = new vscode.Range(startPos, endPos);

        vaguenessDecorations.push({
          range,
          hoverMessage: new vscode.MarkdownString(
            `⚠️ **Vague term detected**: "${match.term}"\n\n` +
            `Consider providing specific evidence or data to support this statement.\n\n` +
            `💡 **Suggestion**: Add a claim reference (e.g., C_01) to strengthen this statement.`
          )
        });
      }

      // Check for unsupported statements (Requirement 12.2)
      if (this.isUnsupportedStatement(sentence)) {
        const startPos = editor.document.positionAt(sentence.offset);
        const endPos = editor.document.positionAt(sentence.offset + sentence.text.length);
        const range = new vscode.Range(startPos, endPos);

        // Get relevant claims that might support this statement
        const suggestions = this.getSuggestedClaims(sentence.text);
        let hoverMessage = `⚠️ **Unsupported statement**\n\n` +
          `This statement lacks a citation or claim reference.\n\n`;

        if (suggestions.length > 0) {
          hoverMessage += `💡 **Suggested claims**:\n`;
          for (const claim of suggestions.slice(0, 3)) {
            hoverMessage += `- **${claim.id}**: ${claim.text.substring(0, 80)}...\n`;
          }
        } else {
          hoverMessage += `💡 **Suggestion**: Add a claim reference (e.g., C_01) or search for relevant evidence.`;
        }

        missingCitationDecorations.push({
          range,
          hoverMessage: new vscode.MarkdownString(hoverMessage)
        });
      }
    }

    // Apply decorations (Requirement 12.3)
    editor.setDecorations(this.vaguenessDecorationType, vaguenessDecorations);
    editor.setDecorations(this.missingCitationDecorationType, missingCitationDecorations);
  }

  /**
   * Split text into sentences with their positions
   */
  private splitIntoSentences(text: string): Array<{ text: string; offset: number }> {
    const sentences: Array<{ text: string; offset: number }> = [];
    
    // Simple sentence splitting on period, exclamation, or question mark
    // followed by whitespace or end of string
    const sentencePattern = /[^.!?]+[.!?]+(?:\s+|$)/g;
    let match;

    while ((match = sentencePattern.exec(text)) !== null) {
      const sentenceText = match[0].trim();
      
      // Skip very short sentences (likely abbreviations or list items)
      if (sentenceText.length < 20) {
        continue;
      }

      // Skip sentences that are headers (start with #)
      if (sentenceText.startsWith('#')) {
        continue;
      }

      // Skip sentences that are list items
      if (/^\s*[-*+]\s/.test(sentenceText)) {
        continue;
      }

      sentences.push({
        text: sentenceText,
        offset: match.index
      });
    }

    return sentences;
  }

  /**
   * Find vague terms in a sentence
   */
  private findVagueTerms(sentence: { text: string; offset: number }): Array<{ term: string; offset: number; length: number }> {
    const matches: Array<{ term: string; offset: number; length: number }> = [];

    for (const term of this.vagueTerms) {
      // Create word boundary pattern for the term
      const pattern = new RegExp(`\\b${term}\\b`, 'gi');
      let match;

      while ((match = pattern.exec(sentence.text)) !== null) {
        matches.push({
          term: match[0],
          offset: sentence.offset + match.index,
          length: match[0].length
        });
      }
    }

    return matches;
  }

  /**
   * Check if a sentence is an unsupported statement
   * A statement is unsupported if it:
   * 1. Makes a factual claim (contains certain keywords)
   * 2. Does not have a nearby claim reference
   * 3. Is not a question or header
   */
  private isUnsupportedStatement(sentence: { text: string; offset: number }): boolean {
    const text = sentence.text;

    // Skip questions
    if (text.includes('?')) {
      return false;
    }

    // Skip if it already has a claim reference
    if (this.claimReferencePattern.test(text)) {
      return false;
    }

    // Check if it's a factual statement (contains certain keywords)
    const factualIndicators = [
      'research', 'study', 'studies', 'found', 'showed', 'demonstrated',
      'evidence', 'suggests', 'indicates', 'reveals', 'confirms',
      'reported', 'observed', 'measured', 'analyzed', 'compared',
      'results', 'findings', 'data', 'analysis', 'method', 'approach',
      'technique', 'algorithm', 'model', 'framework', 'system',
      'performance', 'accuracy', 'improvement', 'increase', 'decrease',
      'significant', 'effective', 'efficient', 'better', 'worse',
      'higher', 'lower', 'more', 'less', 'than'
    ];

    const lowerText = text.toLowerCase();
    const hasFactualIndicator = factualIndicators.some(indicator => 
      lowerText.includes(indicator)
    );

    return hasFactualIndicator;
  }

  /**
   * Get suggested claims that might support a statement
   */
  private getSuggestedClaims(statementText: string): Array<{ id: string; text: string }> {
    // Get all claims
    const allClaims = this.extensionState.claimsManager.getAllClaims();

    // Simple keyword-based matching for now
    // In a full implementation, this would use semantic similarity
    const keywords = this.extractKeywords(statementText);
    
    const scoredClaims = allClaims.map(claim => {
      let score = 0;
      const claimLower = claim.text.toLowerCase();
      
      for (const keyword of keywords) {
        if (claimLower.includes(keyword)) {
          score++;
        }
      }
      
      return { claim, score };
    });

    // Return top matches with score > 0
    return scoredClaims
      .filter(sc => sc.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(sc => ({ id: sc.claim.id, text: sc.claim.text }));
  }

  /**
   * Extract keywords from text for matching
   */
  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'it', 'its', 'they', 'their', 'them'
    ]);

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));

    return words;
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
