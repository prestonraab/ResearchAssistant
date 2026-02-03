import { jest } from '@jest/globals';
import type { Claim, SourcedQuote } from '@research-assistant/core';
import * as vscode from 'vscode';
import type { MCPClientManager, VerificationResult } from '../../mcp/mcpClient';
import type { ZoteroItem } from '../../services/zoteroApiService';
import type { ClaimsManager } from '../../core/claimsManagerWrapper';

/**
 * Factory functions for creating test mocks
 * These provide consistent, reusable mock objects across tests
 */

// ============================================================================
// Domain Model Mocks
// ============================================================================

export const createMockClaim = (overrides?: Partial<Claim>): Claim => ({
  id: 'C_01',
  text: 'Test claim',
  category: 'Method',
  context: '',
  primaryQuote: {
    text: '',
    source: 'Test2024',
    sourceId: 1,
    verified: false
  },
  supportingQuotes: [],
  sections: [],
  verified: false,
  createdAt: new Date('2024-01-01'),
  modifiedAt: new Date('2024-01-01'),
  ...overrides
});

export const createMockQuote = (overrides?: Partial<SourcedQuote>): SourcedQuote => ({
  text: 'Test quote',
  source: 'Test2024',
  verified: false,
  ...overrides
});

export const createMockZoteroItem = (overrides?: Partial<ZoteroItem>): ZoteroItem => ({
  key: 'ABC123',
  title: 'Test Paper',
  creators: [{ firstName: 'John', lastName: 'Smith' }],
  date: '2023',
  itemType: 'journalArticle',
  abstractNote: 'Test abstract',
  ...overrides
});

export const createMockVerificationResult = (overrides?: Partial<VerificationResult>): VerificationResult => ({
  verified: false,
  similarity: 0,
  closestMatch: undefined,
  context: undefined,
  ...overrides
});


// ============================================================================
// VSCode API Mocks
// ============================================================================

export const createMockDocument = (overrides?: Partial<vscode.TextDocument>): any => {
  const defaultDoc = {
    uri: vscode.Uri.file('/test/document.md'),
    fileName: '/test/document.md',
    isUntitled: false,
    languageId: 'markdown',
    version: 1,
    isDirty: false,
    isClosed: false,
    eol: vscode.EndOfLine.LF,
    lineCount: 10,
    save: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    getText: jest.fn<(range?: vscode.Range) => string>().mockReturnValue(''),
    getWordRangeAtPosition: jest.fn<(position: vscode.Position, regex?: RegExp) => vscode.Range | undefined>(),
    lineAt: jest.fn<(line: number | vscode.Position) => vscode.TextLine>(),
    offsetAt: jest.fn<(position: vscode.Position) => number>(),
    positionAt: jest.fn<(offset: number) => vscode.Position>(),
    validateRange: jest.fn<(range: vscode.Range) => vscode.Range>(),
    validatePosition: jest.fn<(position: vscode.Position) => vscode.Position>(),
  };

  return {
    ...defaultDoc,
    ...overrides
  };
};

export const createMockTextEditor = (overrides?: Partial<vscode.TextEditor>): any => {
  const mockDoc = createMockDocument();
  
  return {
    document: mockDoc,
    selection: new vscode.Selection(0, 0, 0, 0),
    selections: [new vscode.Selection(0, 0, 0, 0)],
    visibleRanges: [new vscode.Range(0, 0, 10, 0)],
    options: {},
    viewColumn: vscode.ViewColumn.One,
    edit: jest.fn<(callback: (editBuilder: vscode.TextEditorEdit) => void) => Promise<boolean>>().mockResolvedValue(true),
    insertSnippet: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    setDecorations: jest.fn<() => void>(),
    revealRange: jest.fn<() => void>(),
    show: jest.fn<() => void>(),
    hide: jest.fn<() => void>(),
    ...overrides
  };
};

export const createMockCancellationToken = (overrides?: Partial<vscode.CancellationToken>): any => ({
  isCancellationRequested: false,
  onCancellationRequested: jest.fn<() => vscode.Disposable>(),
  ...overrides
});

export const createMockPosition = (line: number = 0, character: number = 0): vscode.Position => {
  return new vscode.Position(line, character);
};

export const createMockRange = (
  startLine: number = 0,
  startChar: number = 0,
  endLine: number = 0,
  endChar: number = 0
): vscode.Range => {
  return new vscode.Range(startLine, startChar, endLine, endChar);
};

export const createMockUri = (fsPath: string = '/test/file.md'): vscode.Uri => {
  return vscode.Uri.file(fsPath);
};

export const createMockWorkspaceFolder = (overrides?: Partial<vscode.WorkspaceFolder>): vscode.WorkspaceFolder => ({
  uri: createMockUri('/test/workspace'),
  name: 'test-workspace',
  index: 0,
  ...overrides
});

// ============================================================================
// Service Mocks
// ============================================================================

export const createMockMCPClient = (): any => ({
  verifyQuote: jest.fn<(quote: string, authorYear: string) => Promise<VerificationResult>>(),
  zoteroSemanticSearch: jest.fn<(query: string, limit: number) => Promise<ZoteroItem[]>>(),
  getCollections: jest.fn<() => Promise<any[]>>(),
  getItemMetadata: jest.fn<(itemKey: string) => Promise<ZoteroItem | null>>(),
  getItemFulltext: jest.fn<(itemKey: string) => Promise<string>>(),
  searchQuotes: jest.fn<(searchTerm: string, source?: string) => Promise<any[]>>(),
  verifyAllQuotes: jest.fn<() => Promise<any>>(),
  convertDocument: jest.fn<(path: string) => Promise<string>>(),
  exportToMarkdown: jest.fn<(docKey: string) => Promise<string>>(),
  isConnected: jest.fn<(serverName: string) => boolean>(),
  reconnect: jest.fn<(serverName: string) => Promise<void>>(),
  dispose: jest.fn<() => void>(),
  clearCache: jest.fn<() => void>(),
  getCacheStats: jest.fn<() => { size: number; keys: string[] }>(),
});

export const createMockClaimsManager = (): any => ({
  getClaim: jest.fn<(id: string) => Claim | null>(),
  getClaims: jest.fn<() => Claim[]>().mockReturnValue([]),
  saveClaim: jest.fn<(claim: Claim) => Promise<void>>(),
  updateClaim: jest.fn<(id: string, updates: Partial<Claim>) => Promise<void>>(),
  deleteClaim: jest.fn<(id: string) => Promise<void>>(),
  loadClaims: jest.fn<() => Promise<Claim[]>>().mockResolvedValue([]),
  searchClaims: jest.fn<(query: string) => Promise<Claim[]>>().mockResolvedValue([]),
  generateClaimId: jest.fn<() => string>().mockReturnValue('C_01'),
  findClaimsBySection: jest.fn<(sectionId: string) => Claim[]>().mockReturnValue([]),
  findClaimsBySource: jest.fn<(source: string) => Claim[]>().mockReturnValue([]),
  detectSimilarClaims: jest.fn<(text: string, threshold: number) => Promise<Array<{ claim: Claim; similarity: number }>>>().mockResolvedValue([]),
  mergeClaims: jest.fn<(claimIds: string[]) => Promise<Claim>>(),
});

export const createMockExtensionState = (overrides?: {
  claimsManager?: Partial<any>;
  quoteManager?: any;
  [key: string]: any;
}) => {
  const defaultClaimsManager = createMockClaimsManager();
  
  return {
    claimsManager: {
      ...defaultClaimsManager,
      ...overrides?.claimsManager
    },
    quoteManager: {
      getQuote: jest.fn(),
      getAllQuotes: jest.fn().mockReturnValue([]),
      ...overrides?.quoteManager
    },
    ...overrides
  };
};
