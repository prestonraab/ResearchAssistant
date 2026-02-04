/**
 * Minimal VSCode Mock Helpers
 * 
 * These helpers create the absolute minimum mock objects needed for tests.
 * Unlike the full mock factories, these return plain objects with only the
 * properties and methods actually used in tests.
 * 
 * **When to use:**
 * - Use these for simple, inline mocking in tests
 * - When you only need 1-2 VSCode APIs
 * - When you want to avoid importing the full vscode mock
 * 
 * **When NOT to use:**
 * - When testing complex VSCode integration (use full mocks)
 * - When you need many VSCode APIs (use mockFactories.ts)
 * 
 * **Based on:** Task 4.1 audit findings showing tests use only 5-10 VSCode APIs
 * 
 * @see .kiro/specs/testing-strategy-improvement/vscode-api-audit.md
 */

// ============================================================================
// Core Types - Used in 80% of tests
// ============================================================================

/**
 * Creates a minimal Position object
 * 
 * **Usage in tests:** Position is passed to provider methods and read for line/character
 * **Methods needed:** None - tests only read properties
 * 
 * @example
 * const pos = createMinimalPosition(5, 10);
 * await provider.provideHover(doc, pos, token);
 */
export function createMinimalPosition(line: number, character: number) {
  return { line, character };
}

/**
 * Creates a minimal Range object
 * 
 * **Usage in tests:** Range is used to specify text regions and returned from providers
 * **Methods needed:** None - tests only read properties
 * 
 * @example
 * const range = createMinimalRange(0, 3, 0, 7);
 * const text = document.getText(range);
 */
export function createMinimalRange(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number
) {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    isEmpty: startLine === endLine && startChar === endChar,
    isSingleLine: startLine === endLine
  };
}

/**
 * Creates a minimal Document object
 * 
 * **Usage in tests:** Document provides text content and line access
 * **Methods used:** getText(), lineAt(), getWordRangeAtPosition()
 * 
 * @example
 * const doc = createMinimalDocument({
 *   text: 'Line 1\nLine 2\nLine 3',
 *   languageId: 'markdown'
 * });
 * const text = doc.getText();
 * const line = doc.lineAt(1);
 */
export function createMinimalDocument(options: {
  text: string;
  languageId?: string;
  uri?: { fsPath: string };
  fileName?: string;
}) {
  const lines = options.text.split('\n');
  const uri = options.uri || { fsPath: options.fileName || '/test/file.md' };
  
  return {
    // Properties
    uri,
    fileName: options.fileName || uri.fsPath,
    languageId: options.languageId || 'markdown',
    lineCount: lines.length,
    
    // Methods actually used in tests
    getText: (range?: any) => {
      if (!range) return options.text;
      // Simple range extraction for testing
      const startOffset = lines.slice(0, range.start.line).join('\n').length + 
                         (range.start.line > 0 ? 1 : 0) + range.start.character;
      const endOffset = lines.slice(0, range.end.line).join('\n').length + 
                       (range.end.line > 0 ? 1 : 0) + range.end.character;
      return options.text.substring(startOffset, endOffset);
    },
    
    lineAt: (line: number) => ({
      lineNumber: line,
      text: lines[line] || '',
      range: createMinimalRange(line, 0, line, (lines[line] || '').length),
      rangeIncludingLineBreak: createMinimalRange(line, 0, line, (lines[line] || '').length + 1),
      firstNonWhitespaceCharacterIndex: (lines[line] || '').search(/\S/),
      isEmptyOrWhitespace: !(lines[line] || '').trim()
    }),
    
    getWordRangeAtPosition: (position: any, regex?: RegExp) => {
      const line = lines[position.line] || '';
      const wordRegex = regex || /\w+/;
      
      // Find word that contains or starts at the position
      let match: RegExpMatchArray | null = null;
      let matchStart = -1;
      
      // Try to match from the position forward
      const fromPosition = line.substring(position.character).match(wordRegex);
      if (fromPosition && fromPosition.index === 0) {
        match = fromPosition;
        matchStart = position.character;
      } else {
        // Search backwards to find if we're inside a word
        for (let i = position.character; i >= 0; i--) {
          const testMatch = line.substring(i).match(wordRegex);
          if (testMatch && testMatch.index === 0) {
            const matchEnd = i + testMatch[0].length;
            if (matchEnd > position.character) {
              match = testMatch;
              matchStart = i;
              break;
            }
          }
        }
      }
      
      if (!match || matchStart === -1) return undefined;
      
      return createMinimalRange(
        position.line,
        matchStart,
        position.line,
        matchStart + match[0].length
      );
    }
  };
}

// ============================================================================
// Provider Return Types - Used in provider tests
// ============================================================================

/**
 * Creates a minimal Hover object
 * 
 * **Usage in tests:** Returned from hover providers
 * **Properties used:** contents (array), range (optional)
 * 
 * @example
 * const hover = createMinimalHover('### C_01: Test Claim', range);
 * expect(hover.contents[0].value).toContain('C_01');
 */
export function createMinimalHover(content: string, range?: any) {
  return {
    contents: [{ value: content }],
    range
  };
}

/**
 * Creates a minimal CompletionItem object
 * 
 * **Usage in tests:** Returned from completion providers
 * **Properties used:** label, kind, insertText, detail, documentation, sortText
 * 
 * @example
 * const item = createMinimalCompletionItem('C_01', 9); // 9 = CompletionItemKind.Reference
 * item.detail = 'Test claim';
 */
export function createMinimalCompletionItem(label: string, kind?: number) {
  return {
    label,
    kind: kind || 0,
    insertText: label,
    detail: '',
    documentation: undefined as string | undefined,
    sortText: undefined as string | undefined,
    command: undefined as any
  };
}

/**
 * Creates a minimal CompletionList object
 * 
 * **Usage in tests:** Returned from completion providers
 * **Properties used:** items (array), isIncomplete (boolean)
 * 
 * @example
 * const list = createMinimalCompletionList([item1, item2], false);
 * expect(list.items.length).toBe(2);
 */
export function createMinimalCompletionList(items: any[], isIncomplete: boolean = false) {
  return {
    items,
    isIncomplete
  };
}

// ============================================================================
// Other Common Types
// ============================================================================

/**
 * Creates a minimal Selection object
 * 
 * **Usage in tests:** Represents text selection in editor
 * **Properties used:** start, end, anchor, active, isEmpty, isSingleLine
 * 
 * @example
 * const selection = createMinimalSelection(5, 0, 5, 55);
 * const text = document.getText(selection);
 */
export function createMinimalSelection(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number
) {
  return {
    anchor: { line: startLine, character: startChar },
    active: { line: endLine, character: endChar },
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    isEmpty: startLine === endLine && startChar === endChar,
    isSingleLine: startLine === endLine,
    isReversed: false
  };
}

/**
 * Creates a minimal Uri object
 * 
 * **Usage in tests:** File/resource identifiers
 * **Properties used:** fsPath (most common)
 * 
 * @example
 * const uri = createMinimalUri('/workspace/manuscript.md');
 * const doc = createMinimalDocument({ text: 'content', uri });
 */
export function createMinimalUri(fsPath: string) {
  return {
    fsPath,
    scheme: 'file',
    authority: '',
    path: fsPath,
    query: '',
    fragment: ''
  };
}

/**
 * Creates a minimal CancellationToken object
 * 
 * **Usage in tests:** Passed to provider methods
 * **Properties used:** isCancellationRequested (boolean)
 * 
 * @example
 * const token = createMinimalCancellationToken();
 * await provider.provideHover(doc, pos, token);
 */
export function createMinimalCancellationToken(cancelled: boolean = false) {
  return {
    isCancellationRequested: cancelled,
    onCancellationRequested: () => ({ dispose: () => {} })
  };
}

// ============================================================================
// Convenience Helpers
// ============================================================================

/**
 * Creates a minimal document with claim references
 * 
 * **Common test pattern:** Testing claim detection in documents
 * 
 * @example
 * const doc = createDocumentWithClaims(['C_01', 'C_02']);
 * // Document contains: "This references C_01.\nThis references C_02."
 */
export function createDocumentWithClaims(claimIds: string[]) {
  const text = claimIds.map(id => `This sentence references ${id}.`).join('\n');
  return createMinimalDocument({ text });
}

/**
 * Creates a minimal document with specific word at position
 * 
 * **Common test pattern:** Testing word-based providers (hover, completion)
 * 
 * @example
 * const { document, range } = createDocumentWithWord('C_01', 0, 5);
 * const hover = await provider.provideHover(document, { line: 0, character: 6 }, token);
 */
export function createDocumentWithWord(
  word: string,
  line: number = 0,
  startChar: number = 0
) {
  const text = ' '.repeat(startChar) + word;
  const document = createMinimalDocument({ text });
  const range = createMinimalRange(line, startChar, line, startChar + word.length);
  
  // Override getWordRangeAtPosition to return our specific word
  const originalGetWord = document.getWordRangeAtPosition;
  document.getWordRangeAtPosition = (position: any, regex?: RegExp) => {
    if (position.line === line && 
        position.character >= startChar && 
        position.character < startChar + word.length) {
      return range;
    }
    return originalGetWord(position, regex);
  };
  
  return { document, range, word };
}

/**
 * Creates position at start of document
 * 
 * @example
 * const pos = startOfDocument();
 * // Same as: createMinimalPosition(0, 0)
 */
export function startOfDocument() {
  return createMinimalPosition(0, 0);
}

/**
 * Creates position at start of specific line
 * 
 * @example
 * const pos = startOfLine(5);
 * // Same as: createMinimalPosition(5, 0)
 */
export function startOfLine(line: number) {
  return createMinimalPosition(line, 0);
}

/**
 * Creates range spanning entire line
 * 
 * @example
 * const range = entireLine(3, 50);
 * // Range from (3,0) to (3,50)
 */
export function entireLine(line: number, length: number = 100) {
  return createMinimalRange(line, 0, line, length);
}

/**
 * Creates range for a word at specific position
 * 
 * @example
 * const range = wordRange(2, 10, 5);
 * // Range from (2,10) to (2,15) - word of length 5
 */
export function wordRange(line: number, start: number, wordLength: number) {
  return createMinimalRange(line, start, line, start + wordLength);
}
