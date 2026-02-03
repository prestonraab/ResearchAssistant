import * as vscode from 'vscode';
import { ReadingAssistant } from '../core/readingAssistant';
import { ClaimExtractor } from '../core/claimExtractor';
import { ReadingStatusManager } from '../core/readingStatusManager';
import { ClaimsManager } from '../core/claimsManagerWrapper';
import { EmbeddingService } from '@research-assistant/core';
import { setupTest } from './helpers';

/**
 * Integration tests for ReadingAssistant class.
 * 
 * Tests:
 * - Activation on file open from extracted text directory
 * - Code lens actions for selected text
 * - Reading progress tracking
 * - Claim extraction prompts
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 16.4
 */
describe('ReadingAssistant', () => {
  setupTest();

  let readingAssistant: ReadingAssistant;
  let mockClaimExtractor: jest.Mocked<ClaimExtractor>;
  let mockReadingStatusManager: jest.Mocked<ReadingStatusManager>;
  let mockClaimsManager: jest.Mocked<ClaimsManager>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Create mock extension context with all required properties
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn().mockReturnValue({}),
        update: jest.fn().mockResolvedValue(undefined),
        keys: jest.fn().mockReturnValue([])
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([]),
        setKeysForSync: jest.fn()
      },
      extensionPath: '/mock/path',
      extensionUri: vscode.Uri.file('/mock/path'),
      environmentVariableCollection: {} as any,
      extensionMode: vscode.ExtensionMode.Test,
      storageUri: undefined,
      storagePath: undefined,
      globalStorageUri: vscode.Uri.file('/mock/global'),
      globalStoragePath: '/mock/global',
      logUri: vscode.Uri.file('/mock/log'),
      logPath: '/mock/log',
      asAbsolutePath: (relativePath: string) => `/mock/path/${relativePath}`,
      secrets: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any
    } as unknown as vscode.ExtensionContext;

    // Create fresh mocks for each test
    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generateBatch: jest.fn(),
      cosineSimilarity: jest.fn(),
      cacheEmbedding: jest.fn(),
      getCachedEmbedding: jest.fn()
    } as any;

    mockClaimExtractor = {
      categorizeClaim: jest.fn().mockReturnValue('method'),
      suggestSections: jest.fn().mockResolvedValue([]),
      extractClaim: jest.fn()
    } as any;

    mockReadingStatusManager = {
      markAsRead: jest.fn().mockResolvedValue(undefined),
      isRead: jest.fn().mockReturnValue(false),
      getReadingProgress: jest.fn().mockReturnValue({ read: 0, total: 0 })
    } as any;

    mockClaimsManager = {
      saveClaim: jest.fn().mockResolvedValue(undefined),
      getClaim: jest.fn(),
      getClaims: jest.fn().mockReturnValue([]),
      generateClaimId: jest.fn().mockReturnValue('C_01')
    } as any;

    // Create reading assistant with mocks
    readingAssistant = new ReadingAssistant(
      mockClaimExtractor,
      mockReadingStatusManager,
      mockClaimsManager,
      '/mock/workspace/literature/ExtractedText'
    );
  });

  afterEach(() => {
    readingAssistant.dispose();
  });

  describe('Document Activation', () => {
    /**
     * Test: Activation on file open from extracted text directory
     * Validates: Requirement 5.1
     */
    test('should activate for documents from ExtractedText directory', () => {
      // Create mock document from extracted text directory
      const mockDocument = {
        uri: vscode.Uri.file('/mock/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Smith2023.txt',
        isUntitled: false,
        languageId: 'plaintext',
        version: 1,
        isDirty: false,
        isClosed: false,
        save: jest.fn(),
        eol: vscode.EndOfLine.LF,
        lineCount: 100,
        getText: jest.fn().mockReturnValue('Sample paper text'),
        getWordRangeAtPosition: jest.fn(),
        validateRange: jest.fn(),
        validatePosition: jest.fn(),
        positionAt: jest.fn(),
        offsetAt: jest.fn(),
        lineAt: jest.fn()
      } as unknown as vscode.TextDocument;

      // Activate should not throw
      expect(() => {
        readingAssistant.activateForDocument(mockDocument);
      }).not.toThrow();

      // Reading status should be set to 'reading'
      const status = readingStatusManager.getStatus('Smith2023');
      expect(status).toBeDefined();
      expect(status?.status).toBe('reading');
    });

    /**
     * Test: No activation for documents outside ExtractedText directory
     * Validates: Requirement 5.1
     */
    test('should not activate for documents outside ExtractedText directory', () => {
      // Create mock document from different directory
      const mockDocument = {
        uri: vscode.Uri.file('/mock/workspace/03_Drafting/manuscript.md'),
        fileName: '/mock/workspace/03_Drafting/manuscript.md',
        isUntitled: false,
        languageId: 'markdown',
        version: 1,
        isDirty: false,
        isClosed: false
      } as unknown as vscode.TextDocument;

      // Activate should not set reading status
      readingAssistant.activateForDocument(mockDocument);

      const status = readingStatusManager.getStatus('manuscript');
      expect(status).toBeUndefined();
    });
  });

  describe('Claim Extraction', () => {
    /**
     * Test: Extract claim from selection
     * Validates: Requirement 5.2, 5.3
     */
    test('should extract claim from selected text', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/mock/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Smith2023.txt',
        getText: jest.fn((range?: vscode.Range) => {
          if (range) {
            return 'We propose a novel method for batch effect correction.';
          }
          return 'Context before. We propose a novel method for batch effect correction. Context after.';
        }),
        lineCount: 10
      } as unknown as vscode.TextDocument;

      const selection = new vscode.Range(
        new vscode.Position(5, 0),
        new vscode.Position(5, 55)
      );

      const potentialClaim = await readingAssistant.extractClaimFromSelection(
        selection,
        mockDocument
      );

      expect(potentialClaim).toBeDefined();
      expect(potentialClaim?.text).toBe('We propose a novel method for batch effect correction.');
      expect(potentialClaim?.confidence).toBeGreaterThan(0);
      expect(potentialClaim?.type).toBeDefined();
    });

    /**
     * Test: Handle empty selection
     * Validates: Requirement 5.2
     */
    test('should return null for empty selection', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/mock/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Smith2023.txt',
        getText: jest.fn().mockReturnValue(''),
        lineCount: 10
      } as unknown as vscode.TextDocument;

      const selection = new vscode.Range(
        new vscode.Position(5, 0),
        new vscode.Position(5, 0)
      );

      const potentialClaim = await readingAssistant.extractClaimFromSelection(
        selection,
        mockDocument
      );

      expect(potentialClaim).toBeNull();
    });
  });

  describe('Reading Progress Tracking', () => {
    /**
     * Test: Track reading progress
     * Validates: Requirement 16.1, 16.2
     */
    test('should track reading progress for papers', async () => {
      const paperId = 'Smith2023';

      // Mark as reading
      await readingAssistant.trackReadingProgress(paperId, 'reading');
      let status = readingStatusManager.getStatus(paperId);
      expect(status?.status).toBe('reading');
      expect(status?.startedAt).toBeDefined();

      // Mark as read
      await readingAssistant.trackReadingProgress(paperId, 'read');
      status = readingStatusManager.getStatus(paperId);
      expect(status?.status).toBe('read');
      expect(status?.completedAt).toBeDefined();
      expect(status?.readingDuration).toBeDefined();
    });

    /**
     * Test: Reading status persistence
     * Validates: Requirement 16.3
     */
    test('should persist reading status across sessions', async () => {
      const paperId = 'Johnson2020';

      // Set status
      await readingAssistant.trackReadingProgress(paperId, 'reading');

      // Verify status is stored
      expect(mockContext.workspaceState.update).toHaveBeenCalled();

      // Verify status can be retrieved
      const status = readingStatusManager.getStatus(paperId);
      expect(status?.status).toBe('reading');
    });
  });

  describe('Code Lens Provider', () => {
    /**
     * Test: Code lens actions are provided
     * Validates: Requirement 5.2
     */
    test('should provide code lens actions for extracted text files', () => {
      // The code lens provider is registered during construction
      // Verify that registerCodeLensProvider was called
      expect(vscode.languages.registerCodeLensProvider).toHaveBeenCalled();
    });
  });

  describe('Integration with ClaimExtractor', () => {
    /**
     * Test: Claim categorization
     * Validates: Requirement 5.3
     */
    test('should categorize extracted claims correctly', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/mock/workspace/literature/ExtractedText/Test2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Test2023.txt',
        getText: jest.fn((range?: vscode.Range) => {
          if (range) {
            return 'Our results show a 50% improvement in accuracy.';
          }
          return 'Context. Our results show a 50% improvement in accuracy. More context.';
        }),
        lineCount: 10
      } as unknown as vscode.TextDocument;

      const selection = new vscode.Range(
        new vscode.Position(3, 0),
        new vscode.Position(3, 50)
      );

      const potentialClaim = await readingAssistant.extractClaimFromSelection(
        selection,
        mockDocument
      );

      expect(potentialClaim).toBeDefined();
      // Should be categorized as 'result' based on keywords
      expect(['result', 'conclusion', 'method']).toContain(potentialClaim?.type);
    });
  });

  describe('Error Handling', () => {
    /**
     * Test: Handle invalid document paths
     */
    test('should handle invalid document paths gracefully', () => {
      const mockDocument = {
        uri: vscode.Uri.file(''),
        fileName: '',
        isUntitled: true
      } as unknown as vscode.TextDocument;

      expect(() => {
        readingAssistant.activateForDocument(mockDocument);
      }).not.toThrow();
    });

    /**
     * Test: Handle missing paper ID
     */
    test('should handle documents without valid paper IDs', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/mock/workspace/literature/ExtractedText/.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/.txt',
        getText: jest.fn().mockReturnValue('Sample text'),
        lineCount: 10
      } as unknown as vscode.TextDocument;

      // Should not throw even with invalid filename
      expect(() => {
        readingAssistant.activateForDocument(mockDocument);
      }).not.toThrow();
    });
  });
});
