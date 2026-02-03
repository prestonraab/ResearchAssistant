import { getLogger } from './loggingService';

/**
 * Content change representation
 */
export interface ContentChange {
  lineNumber: number;
  type: 'add' | 'remove' | 'modify';
  oldValue?: string;
  newValue?: string;
}

/**
 * Parse result from incremental parser
 */
export interface ParseResult {
  type: 'full' | 'incremental';
  ast?: unknown;
  changes?: ContentChange[];
}

/**
 * IncrementalMarkdownParser - Efficient markdown parsing with incremental updates
 * 
 * Provides:
 * - Content diffing to detect changed sections
 * - Incremental parsing for small changes
 * - Full reparse fallback for large changes
 * - Performance optimization for large files
 * 
 * Validates: Requirements US-4 (Efficient File Watching)
 */
export class IncrementalMarkdownParser {
  private lastContent: string = '';
  private lastAST: unknown = null;
  private logger = getLogger();

  /**
   * Parse markdown content, using incremental parsing when possible
   * 
   * @param content - The markdown content to parse
   * @param fullParser - Function to perform full parse
   * @returns Parse result with type and AST or changes
   */
  async parseIncremental(
    content: string,
    fullParser: (content: string) => Promise<unknown>
  ): Promise<ParseResult> {
    // First parse: full parse
    if (!this.lastAST) {
      this.logger.debug('First parse: performing full parse');
      this.lastContent = content;
      this.lastAST = await fullParser(content);
      return { type: 'full', ast: this.lastAST };
    }

    // Find changed sections
    const changes = this.diffContent(this.lastContent, content);

    // If changes are small, do incremental update
    if (changes.length < 5 && changes.every(c => c.type === 'modify')) {
      this.logger.debug(`Incremental parse: ${changes.length} small change(s)`);
      const updatedSections = await this.parseChangedSections(changes, fullParser);
      this.updateAST(updatedSections);

      this.lastContent = content;
      return { type: 'incremental', changes: updatedSections };
    }

    // Otherwise, do full reparse
    this.logger.debug('Full reparse: changes too large for incremental parsing');
    this.lastContent = content;
    this.lastAST = await fullParser(content);
    return { type: 'full', ast: this.lastAST };
  }

  /**
   * Diff content to find changed lines
   * 
   * @private
   */
  private diffContent(oldContent: string, newContent: string): ContentChange[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const changes: ContentChange[] = [];

    // Simple line-based diffing
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        // Line added
        changes.push({
          lineNumber: i,
          type: 'add',
          newValue: newLine
        });
      } else if (newLine === undefined) {
        // Line removed
        changes.push({
          lineNumber: i,
          type: 'remove',
          oldValue: oldLine
        });
      } else if (oldLine !== newLine) {
        // Line modified
        changes.push({
          lineNumber: i,
          type: 'modify',
          oldValue: oldLine,
          newValue: newLine
        });
      }
    }

    return changes;
  }

  /**
   * Parse only changed sections
   * 
   * @private
   */
  private async parseChangedSections(
    changes: ContentChange[],
    fullParser: (content: string) => Promise<unknown>
  ): Promise<ContentChange[]> {
    // For now, just return the changes as-is
    // In a real implementation, this would parse only the changed sections
    // and update the AST accordingly
    return changes;
  }

  /**
   * Update AST with changed sections
   * 
   * @private
   */
  private updateAST(changes: ContentChange[]): void {
    // Update the AST based on changes
    // This is a simplified implementation
    if (this.lastAST && Array.isArray(this.lastAST)) {
      for (const change of changes) {
        if (change.type === 'modify' && change.lineNumber < (this.lastAST as unknown[]).length) {
          // Update the corresponding AST node
          const astArray = this.lastAST as Array<Record<string, unknown>>;
          astArray[change.lineNumber] = {
            ...astArray[change.lineNumber],
            content: change.newValue
          };
        }
      }
    }
  }

  /**
   * Get the last parsed AST
   */
  getLastAST(): unknown {
    return this.lastAST;
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.lastContent = '';
    this.lastAST = null;
    this.logger.debug('IncrementalMarkdownParser reset');
  }
}
