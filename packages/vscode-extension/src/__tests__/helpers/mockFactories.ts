import { jest } from '@jest/globals';
import type { Claim, SourcedQuote } from '@research-assistant/core';
import * as vscode from 'vscode';
import type { VerificationResult, ZoteroItem } from '@research-assistant/core';
import type { ClaimsManager } from '../../core/claimsManagerWrapper';

/**
 * Factory functions for creating test mocks
 * These provide consistent, reusable mock objects across tests
 *
 * PRINCIPLES:
 * 1. Always use typed factories - maintains type safety and IDE support
 * 2. Provide sensible defaults - tests override only what they need
 * 3. Use overrides pattern - allows customization without duplication
 * 4. Keep factories focused - one responsibility per factory
 * 5. Document complex mocks - explain non-obvious behavior
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
  similarity: 0.5,
  confidence: 0.5,
  ...overrides
});

// ============================================================================
// Service Mocks
// ============================================================================

/**
 * Interface for the public methods of EmbeddingService that we need to mock.
 * This avoids TypeScript errors from trying to mock private properties.
 */
export interface MockableEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
  generateBatchParallel(texts: string[], batchSize?: number): Promise<number[][]>;
  cosineSimilarity(vec1: number[], vec2: number[]): number;
  trimCache(maxSize: number): void;
  clearCache(): void;
  getCacheSize(): number;
}

/**
 * Creates a properly typed mock EmbeddingService
 * Use this instead of creating inline mocks to maintain type safety
 * 
 * Note: We mock only the public interface, not private properties.
 */
export const createMockEmbeddingService = (): jest.Mocked<MockableEmbeddingService> => {
  return {
    generateEmbedding: jest.fn<(text: string) => Promise<number[]>>().mockResolvedValue(
      new Array(1536).fill(0).map(() => Math.random())
    ),
    generateBatch: jest.fn<(texts: string[]) => Promise<number[][]>>().mockResolvedValue([
      new Array(1536).fill(0).map(() => Math.random()),
      new Array(1536).fill(0).map(() => Math.random())
    ]),
    generateBatchParallel: jest.fn<(texts: string[], batchSize?: number) => Promise<number[][]>>().mockResolvedValue([]),
    cosineSimilarity: jest.fn<(vec1: number[], vec2: number[]) => number>().mockReturnValue(0.85),
    trimCache: jest.fn<(maxSize: number) => void>(),
    clearCache: jest.fn<() => void>(),
    getCacheSize: jest.fn<() => number>().mockReturnValue(0)
  } as jest.Mocked<MockableEmbeddingService>;
};

/**
 * Creates a properly typed mock ClaimsManager
 */
export const createMockClaimsManager = (): jest.Mocked<ClaimsManager> => {
  return {
    getClaim: jest.fn<(id: string) => Claim | null>().mockReturnValue(null),
    getClaims: jest.fn<() => Claim[]>().mockReturnValue([]),
    saveClaim: jest.fn<(claim: Claim) => Promise<void>>().mockResolvedValue(undefined),
    updateClaim: jest.fn<(claim: Claim) => Promise<void>>().mockResolvedValue(undefined),
    loadClaims: jest.fn<() => Promise<Claim[]>>().mockResolvedValue([]),
    getAllClaims: jest.fn<() => Claim[]>().mockReturnValue([]),
    deleteClaim: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
    updatePath: jest.fn<(path: string) => void>(),
    onClaimSaved: jest.fn<() => any>().mockReturnValue({
      dispose: jest.fn()
    })
  } as any as jest.Mocked<ClaimsManager>;
};

/**
 * Creates a mock MCP Client for Zotero/verification services
 */
export const createMockMCPClient = (): any => ({
  verifyQuote: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  zoteroSemanticSearch: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  getCollections: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  getItemMetadata: jest.fn<() => Promise<any>>().mockResolvedValue(null),
  getItemFulltext: jest.fn<() => Promise<string>>().mockResolvedValue(''),
  searchQuotes: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  verifyAllQuotes: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  convertDocument: jest.fn<() => Promise<string>>().mockResolvedValue(''),
  exportToMarkdown: jest.fn<() => Promise<string>>().mockResolvedValue(''),
  isConnected: jest.fn<() => boolean>().mockReturnValue(false),
  reconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  dispose: jest.fn<() => void>(),
  clearCache: jest.fn<() => void>(),
  getCacheStats: jest.fn<() => any>().mockReturnValue({ size: 0, keys: [] }),
});

/**
 * Creates a mock extension state object
 */
export const createMockExtensionState = (overrides?: {
  claimsManager?: Partial<any>;
  quoteManager?: any;
  [key: string]: any;
}): any => {
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
  } as any; // Cast to any to allow partial mock in tests
};

// ============================================================================
// VSCode API Mocks
// ============================================================================

/**
 * Creates a mock VSCode TextDocument
 * Provides all required methods with sensible defaults
 * Lazy-loads vscode constants to avoid issues with mock initialization order
 */
export const createMockDocument = (overrides?: Partial<vscode.TextDocument>): any => {
  // Lazy-load vscode constants to handle mock initialization timing
  const eol = vscode.EndOfLine?.LF ?? 1;
  
  return {
    uri: createMockUri('/test/file.md'),
    fileName: '/test/file.md',
    isUntitled: false,
    languageId: 'markdown',
    version: 1,
    isDirty: false,
    isClosed: false,
    eol,
    lineCount: 10,
    getText: jest.fn().mockReturnValue('Test content'),
    getWordRangeAtPosition: jest.fn<() => vscode.Range | undefined>().mockReturnValue(undefined),
    validateRange: jest.fn((range: vscode.Range) => range),
    validatePosition: jest.fn((position: vscode.Position) => position),
    offsetAt: jest.fn().mockReturnValue(0),
    positionAt: jest.fn().mockReturnValue(createMockPosition(0, 0)),
    lineAt: jest.fn().mockReturnValue({
      lineNumber: 0,
      text: 'Test line',
      range: createMockRange(0, 0, 0, 9),
      rangeIncludingLineBreak: createMockRange(0, 0, 0, 10),
      firstNonWhitespaceCharacterIndex: 0,
      isEmptyOrWhitespace: false
    } as vscode.TextLine),
    save: jest.fn<() => Thenable<boolean>>().mockResolvedValue(true),
    ...overrides
  };
};

/**
 * Creates a mock VSCode TextEditor
 * Lazy-loads vscode constants to avoid issues with mock initialization order
 */
export const createMockTextEditor = (overrides?: Partial<vscode.TextEditor>): vscode.TextEditor => {
  const viewColumn = vscode.ViewColumn?.One ?? 1;
  
  return {
    document: createMockDocument(),
    selection: createMockSelection(0, 0, 0, 0),
    selections: [createMockSelection(0, 0, 0, 0)],
    visibleRanges: [createMockRange(0, 0, 10, 0)],
    options: { tabSize: 2, insertSpaces: true },
    viewColumn,
    edit: jest.fn<() => Thenable<boolean>>().mockResolvedValue(true),
    insertSnippet: jest.fn<() => Thenable<boolean>>().mockResolvedValue(true),
    setDecorations: jest.fn(),
    revealRange: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    ...overrides
  } as vscode.TextEditor;
};

/**
 * Creates a mock VSCode CancellationToken
 */
export const createMockCancellationToken = (overrides?: Partial<vscode.CancellationToken>): vscode.CancellationToken => ({
  isCancellationRequested: false,
  onCancellationRequested: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  ...overrides
} as vscode.CancellationToken);

/**
 * Creates a mock VSCode Position
 */
export const createMockPosition = (line: number = 0, character: number = 0): vscode.Position => {
  return { line, character } as vscode.Position;
};

/**
 * Creates a mock VSCode Range
 */
export const createMockRange = (
  startLine: number = 0,
  startChar: number = 0,
  endLine: number = 0,
  endChar: number = 0
): vscode.Range => {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    isEmpty: startLine === endLine && startChar === endChar,
    isSingleLine: startLine === endLine
  } as vscode.Range;
};

/**
 * Creates a mock VSCode Selection
 */
export const createMockSelection = (
  startLine: number = 0,
  startChar: number = 0,
  endLine: number = 0,
  endChar: number = 0
): vscode.Selection => {
  return {
    anchor: { line: startLine, character: startChar },
    active: { line: endLine, character: endChar },
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    isEmpty: startLine === endLine && startChar === endChar,
    isSingleLine: startLine === endLine,
    isReversed: false
  } as vscode.Selection;
};

/**
 * Creates a mock VSCode Uri
 * Handles cases where vscode.Uri.file might not be available during module loading
 */
export const createMockUri = (fsPath: string = '/test/file.md'): vscode.Uri => {
  // If vscode.Uri.file is available, use it
  if (vscode.Uri?.file) {
    return vscode.Uri.file(fsPath);
  }
  // Fallback for when vscode mock isn't loaded yet
  return { fsPath, scheme: 'file', authority: '', path: fsPath, query: '', fragment: '' } as vscode.Uri;
};

/**
 * Creates a mock VSCode WorkspaceFolder
 */
export const createMockWorkspaceFolder = (overrides?: Partial<vscode.WorkspaceFolder>): vscode.WorkspaceFolder => {
  return {
    uri: createMockUri('/test/workspace'),
    name: 'test-workspace',
    index: 0,
    ...overrides
  } as vscode.WorkspaceFolder;
};

/**
 * Creates a mock VSCode ExtensionContext
 * Lazy-loads vscode constants to avoid issues with mock initialization order
 */
export const createMockExtensionContext = (overrides?: Partial<vscode.ExtensionContext>): vscode.ExtensionContext => {
  const extensionMode = vscode.ExtensionMode?.Test ?? 3;
  
  return {
    subscriptions: [],
    extensionPath: '/test/extension',
    globalState: {
      get: jest.fn(),
      update: jest.fn<() => Thenable<void>>().mockResolvedValue(undefined),
      keys: jest.fn().mockReturnValue([]),
      setKeysForSync: jest.fn()
    } as any,
    workspaceState: {
      get: jest.fn(),
      update: jest.fn<() => Thenable<void>>().mockResolvedValue(undefined),
      keys: jest.fn().mockReturnValue([]),
      setKeysForSync: jest.fn()
    } as any,
    extensionUri: createMockUri('/test/extension'),
    environmentVariableCollection: {} as any,
    storagePath: '/test/storage',
    globalStoragePath: '/test/global-storage',
    logPath: '/test/logs',
    extensionMode,
    asAbsolutePath: jest.fn((path: string) => `/test/extension/${path}`),
    storageUri: createMockUri('/test/storage'),
    globalStorageUri: createMockUri('/test/global-storage'),
    logUri: createMockUri('/test/logs'),
    extension: {} as any,
    secrets: {
      get: jest.fn(),
      store: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      delete: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      onDidChange: jest.fn()
    } as any,
    languageModelAccessInformation: {} as any,
    ...overrides
  } as vscode.ExtensionContext;
};

/**
 * Creates a mock VSCode FileSystemWatcher
 * Properly tracks disposables for cleanup verification
 */
export const createMockFileSystemWatcher = (): vscode.FileSystemWatcher => {
  return {
    onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    ignoreChangeEvents: false,
    ignoreCreateEvents: false,
    ignoreDeleteEvents: false,
    dispose: jest.fn()
  } as vscode.FileSystemWatcher;
};

// ============================================================================
// Additional Service Mocks
// ============================================================================

/**
 * Creates a mock ZoteroApiService
 * Use this for tests that interact with Zotero API
 */
export const createMockZoteroApiService = () => {
  return {
    isConfigured: jest.fn<() => boolean>().mockReturnValue(true),
    testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    semanticSearch: jest.fn<(query: string) => Promise<any[]>>().mockResolvedValue([]),
    getCollectionItems: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    getRecentItems: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    getItemChildren: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    getPdfAttachments: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    initialize: jest.fn<() => void>(),
    dispose: jest.fn<() => void>()
  };
};

/**
 * Creates a mock PDFExtractionService
 */
export const createMockPdfExtractionService = () => {
  return {
    extractText: jest.fn<() => Promise<any>>().mockResolvedValue({
      success: true,
      outputPath: ''
    }),
    hasExtractedText: jest.fn<() => boolean>().mockReturnValue(false),
    getExtractedTextPath: jest.fn<() => string>().mockReturnValue('')
  };
};

/**
 * Creates a mock OutlineParser
 */
export const createMockOutlineParser = () => {
  return {
    parse: jest.fn<() => any[]>().mockReturnValue([]),
    getSections: jest.fn<() => any[]>().mockReturnValue([]),
    getSection: jest.fn<() => any>().mockReturnValue(null),
    getSectionById: jest.fn<() => any>().mockReturnValue(null),
    findSectionByTitle: jest.fn<() => any>().mockReturnValue(null)
  };
};

/**
 * Creates a mock ManuscriptContextDetector
 */
export const createMockManuscriptContextDetector = () => {
  return {
    getContext: jest.fn<() => any>().mockReturnValue(null),
    getCurrentSection: jest.fn<() => any>().mockReturnValue(null),
    isInManuscript: jest.fn<() => boolean>().mockReturnValue(false)
  };
};

/**
 * Creates a mock UnifiedQuoteSearch
 */
export const createMockUnifiedQuoteSearch = () => {
  return {
    findBestMatch: jest.fn<(quote: string, context?: string) => Promise<VerificationResult>>().mockResolvedValue({
      verified: false,
      similarity: 0,
      confidence: 0
    }),
    search: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    dispose: jest.fn<() => void>()
  };
};

/**
 * Creates a mock SentenceClaimQuoteLinkManager
 * Used for managing relationships between sentences, claims, and quotes
 */
export const createMockSentenceClaimQuoteLinkManager = (): jest.Mocked<any> => {
  return {
    getCitationsForSentence: jest.fn<() => any[]>().mockReturnValue([]),
    addCitation: jest.fn<() => void>(),
    removeCitation: jest.fn<() => void>(),
    getAllCitations: jest.fn<() => any[]>().mockReturnValue([]),
    clearCitations: jest.fn<() => void>(),
    saveCitations: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    loadCitations: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  } as jest.Mocked<any>;
};

/**
 * Creates a mock fs module for file system operations
 * Use with jest.mock('fs') in your test file
 */
export const createMockFs = () => {
  return {
    existsSync: jest.fn<() => boolean>().mockReturnValue(false),
    readFileSync: jest.fn<() => string>().mockReturnValue(''),
    writeFileSync: jest.fn<() => void>(),
    readdirSync: jest.fn<() => string[]>().mockReturnValue([]),
    mkdirSync: jest.fn<() => void>(),
    unlinkSync: jest.fn<() => void>(),
    statSync: jest.fn<() => any>().mockReturnValue({ isFile: () => true, isDirectory: () => false })
  };
};

/**
 * Creates properly typed VSCode window mocks for UI interactions
 * Use this to mock vscode.window.showInformationMessage, showQuickPick, etc.
 */
export const createMockVSCodeWindow = () => {
  return {
    showInformationMessage: jest.fn<(message: string, ...items: string[]) => Thenable<string | undefined>>()
      .mockResolvedValue(undefined),
    showWarningMessage: jest.fn<(message: string, ...items: string[]) => Thenable<string | undefined>>()
      .mockResolvedValue(undefined),
    showErrorMessage: jest.fn<(message: string, ...items: string[]) => Thenable<string | undefined>>()
      .mockResolvedValue(undefined),
    showQuickPick: jest.fn<(items: any[], options?: any) => Thenable<any | undefined>>()
      .mockResolvedValue(undefined),
    showInputBox: jest.fn<(options?: any) => Thenable<string | undefined>>()
      .mockResolvedValue(undefined),
    showOpenDialog: jest.fn<(options?: any) => Thenable<vscode.Uri[] | undefined>>()
      .mockResolvedValue(undefined),
    showSaveDialog: jest.fn<(options?: any) => Thenable<vscode.Uri | undefined>>()
      .mockResolvedValue(undefined),
    withProgress: jest.fn<(options: any, task: any) => Thenable<any>>()
      .mockImplementation((options, task) => task({ report: jest.fn() }))
  };
};

/**
 * Creates a mock QuoteManager
 * Use for tests that need to manage quotes
 */
export const createMockQuoteManager = () => {
  return {
    getQuote: jest.fn<() => any>().mockReturnValue(null),
    getAllQuotes: jest.fn<() => any[]>().mockReturnValue([]),
    saveQuote: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteQuote: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    findQuotesBySource: jest.fn<() => any[]>().mockReturnValue([]),
    verifyQuote: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
    onQuoteSaved: jest.fn<() => any>().mockReturnValue({
      dispose: jest.fn()
    })
  };
};

/**
 * Creates a mock CoverageAnalyzer
 * Use for tests that analyze claim coverage
 */
export const createMockCoverageAnalyzer = () => {
  return {
    analyzeCoverage: jest.fn<() => any>().mockReturnValue({
      totalClaims: 0,
      verifiedClaims: 0,
      coverage: 0,
      byCategory: {}
    }),
    getCoverageBySection: jest.fn<() => any>().mockReturnValue({
      coverage: 0,
      claims: []
    }),
    getUncoveredSections: jest.fn<() => any[]>().mockReturnValue([]),
    suggestClaims: jest.fn<() => any[]>().mockReturnValue([])
  };
};

/**
 * Creates a mock SearchService
 * Use for tests that search claims or papers
 */
export const createMockSearchService = () => {
  return {
    searchClaims: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    searchPapers: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    searchQuotes: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    indexClaim: jest.fn<() => void>(),
    indexPaper: jest.fn<() => void>(),
    clearIndex: jest.fn<() => void>(),
    getIndexStats: jest.fn<() => any>().mockReturnValue({ claims: 0, papers: 0 })
  };
};

/**
 * Creates a mock SynthesisEngine
 * Use for tests that synthesize information
 */
export const createMockSynthesisEngine = () => {
  return {
    synthesizeClaims: jest.fn<() => Promise<string>>().mockResolvedValue('Synthesized text'),
    generateSummary: jest.fn<() => Promise<string>>().mockResolvedValue('Summary'),
    generateOutline: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    suggestConnections: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    validateConsistency: jest.fn<() => Promise<any>>().mockResolvedValue({ consistent: true })
  };
};

/**
 * Creates a mock ClaimStrengthCalculator
 * Use for tests that calculate claim strength
 */
export const createMockClaimStrengthCalculator = () => {
  return {
    calculateStrength: jest.fn<() => number>().mockReturnValue(0.5),
    calculateQuoteStrength: jest.fn<() => number>().mockReturnValue(0.5),
    calculateCategoryStrength: jest.fn<() => number>().mockReturnValue(0.5),
    getStrengthBreakdown: jest.fn<() => any>().mockReturnValue({
      quoteStrength: 0.5,
      categoryStrength: 0.5,
      verificationStrength: 0.5,
      overall: 0.5
    })
  };
};

/**
 * Creates a mock LiteratureIndexer
 * Use for tests that index literature
 */
export const createMockLiteratureIndexer = () => {
  return {
    indexPaper: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    indexBatch: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    searchByTitle: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    searchByAuthor: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    searchByKeyword: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    getIndexStats: jest.fn<() => any>().mockReturnValue({ indexed: 0, pending: 0 }),
    clearIndex: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };
};

/**
 * Creates a mock PaperRanker
 * Use for tests that rank papers
 */
export const createMockPaperRanker = () => {
  return {
    rankPapers: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    rankByRelevance: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    rankByRecency: jest.fn<() => any[]>().mockReturnValue([]),
    rankByCitations: jest.fn<() => any[]>().mockReturnValue([]),
    getRelevanceScore: jest.fn<() => number>().mockReturnValue(0.5)
  };
};

/**
 * Creates a mock InternetPaperSearcher
 * Use for tests that search the internet for papers
 */
export const createMockInternetPaperSearcher = () => {
  return {
    search: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    searchByDOI: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    searchByTitle: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    searchByAuthor: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    getSearchStats: jest.fn<() => any>().mockReturnValue({ searches: 0, results: 0 })
  };
};

/**
 * Creates a mock SnippetExtractor
 * Use for tests that extract snippets from text
 */
export const createMockSnippetExtractor = () => {
  return {
    extractSnippet: jest.fn<() => string>().mockReturnValue(''),
    extractSnippets: jest.fn<() => string[]>().mockReturnValue([]),
    extractAroundPosition: jest.fn<() => string>().mockReturnValue(''),
    highlightMatches: jest.fn<() => string>().mockReturnValue('')
  };
};

/**
 * Creates a mock SyncManager
 * Use for tests that sync data
 */
export const createMockSyncManager = () => {
  return {
    sync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    syncClaims: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    syncPapers: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    getSyncStatus: jest.fn<() => any>().mockReturnValue({ syncing: false, lastSync: null }),
    onSyncComplete: jest.fn<() => any>().mockReturnValue({
      dispose: jest.fn()
    })
  };
};

/**
 * Creates a mock ZoteroImportManager
 * Use for tests that import from Zotero
 */
export const createMockZoteroImportManager = () => {
  return {
    importCollection: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    importItem: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    importBatch: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    getImportStatus: jest.fn<() => any>().mockReturnValue({ importing: false, progress: 0 }),
    cancelImport: jest.fn<() => void>()
  };
};

/**
 * Creates a mock ExportService
 * Use for tests that export documents
 */
export const createMockExportService = () => {
  return {
    buildDocumentModel: jest.fn<() => Promise<any>>().mockResolvedValue({
      sections: [],
      bibliography: [],
      metadata: { footnotes: [] }
    }),
    exportToWord: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    exportToMarkdown: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    exportToPdf: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    dispose: jest.fn<() => void>()
  };
};

/**
 * Creates a mock DocumentModel
 * Use for tests that work with document structures
 */
export const createMockDocumentModel = (overrides?: any) => {
  return {
    sections: [],
    bibliography: [],
    metadata: {
      footnotes: [],
      footnoteScope: 'document',
      includeFootnotes: true,
      includeBibliography: true
    },
    ...overrides
  };
};

/**
 * Creates a mock DocumentSection
 * Use for tests that work with document sections
 */
export const createMockDocumentSection = (overrides?: any) => {
  return {
    heading: 'Test Section',
    level: 1,
    paragraphs: [],
    ...overrides
  };
};

/**
 * Creates a mock DocumentParagraph
 * Use for tests that work with paragraphs
 */
export const createMockDocumentParagraph = (overrides?: any) => {
  return {
    runs: [],
    ...overrides
  };
};
