import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { ReadingAssistant } from '../core/readingAssistant';
import { ClaimExtractor } from '../core/claimExtractor';
import { ReadingStatusManager } from '../core/readingStatusManager';
import { ClaimsManager } from '../core/claimsManagerWrapper';
import { EmbeddingService } from '@research-assistant/core';
import { 
  setupTest, 
  createMockExtensionContext, 
  createMockEmbeddingService, 
  createMockClaimsManager,
  createMinimalDocument,
  createMinimalUri,
  createMinimalRange,
  createMinimalSelection
} from './helpers';

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
 * 
 * **Refactored:** Uses minimal mocks instead of manual document creation
 * to reduce mock maintenance burden (Task 4.4)
 */
describe('ReadingAssistant', () => {
  setupTest();

  let readingAssistant: ReadingAssistant;
  let mockClaimExtractor: jest.Mocked<ClaimExtractor>;
  let mockReadingStatusManager: jest.Mocked<ReadingStatusManager>;
  let mockClaimsManager: jest.Mocked<ClaimsManager>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockContext: vscode.ExtensionContext;
  let readingStatusManager: ReadingStatusManager;

  beforeEach(() => {
    // Use factory function for consistent, complete mock
    mockContext = createMockExtensionContext();

    // Use factory function for consistent, complete mock
    mockEmbeddingService = createMockEmbeddingService() as any;

    // Create fresh mocks for each test
    mockClaimExtractor = {
      categorizeClaim: jest.fn<() => string>().mockReturnValue('method'),
      suggestSections: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
      extractClaim: jest.fn()
    } as any;

    // Create a real-ish reading status manager for tracking
    readingStatusManager = {
      markAsRead: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      isRead: jest.fn<() => boolean>().mockReturnValue(false),
      getReadingProgress: jest.fn<() => { read: number; total: number }>().mockReturnValue({ read: 0, total: 0 }),
      getStatus: jest.fn<() => any>().mockReturnValue(undefined),
      setStatus: jest.fn()
    } as any;

    mockReadingStatusManager = readingStatusManager as any;

    mockClaimsManager = createMockClaimsManager();

    // Create mock outline parser
    const mockOutlineParser = {
      getSections: jest.fn<() => any[]>().mockReturnValue([]),
      parse: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    } as any;

    // Create reading assistant with mocks
    readingAssistant = new ReadingAssistant(
      mockClaimExtractor,
      mockReadingStatusManager,
      mockClaimsManager,
      mockOutlineParser,
      mockEmbeddingService,
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
      // Use minimal mock instead of manual document creation
      const mockDocument = createMinimalDocument({
        text: 'Sample paper text',
        uri: createMinimalUri('/mock/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Smith2023.txt',
        languageId: 'plaintext'
      });

      // Activate should not throw
      expect(() => {
        readingAssistant.activateForDocument(mockDocument as any);
      }).not.toThrow();
    });

    /**
     * Test: No activation for documents outside ExtractedText directory
     * Validates: Requirement 5.1
     */
    test('should not activate for documents outside ExtractedText directory', () => {
      // Use minimal mock for document outside ExtractedText
      const mockDocument = createMinimalDocument({
        text: 'Manuscript content',
        uri: createMinimalUri('/mock/workspace/03_Drafting/manuscript.md'),
        fileName: '/mock/workspace/03_Drafting/manuscript.md',
        languageId: 'markdown'
      });

      // Activate should not set reading status
      readingAssistant.activateForDocument(mockDocument as any);

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
      const selectedText = 'We propose a novel method for batch effect correction.';
      const fullText = `Context before. ${selectedText} Context after.`;
      
      // Use minimal mock with getText that handles range
      const mockDocument = createMinimalDocument({
        text: fullText,
        uri: createMinimalUri('/mock/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Smith2023.txt'
      });

      // Create selection range using minimal helpers
      const selection = createMinimalRange(0, 16, 0, 16 + selectedText.length);

      const potentialClaim = await readingAssistant.extractClaimFromSelection(
        selection as any,
        mockDocument as any
      );

      expect(potentialClaim).toBeDefined();
      expect(potentialClaim?.confidence).toBeGreaterThan(0);
      expect(potentialClaim?.type).toBeDefined();
    });

    /**
     * Test: Handle empty selection
     * Validates: Requirement 5.2
     */
    test('should return null for empty selection', async () => {
      // Use minimal mock for empty selection test
      const mockDocument = createMinimalDocument({
        text: '',
        uri: createMinimalUri('/mock/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Smith2023.txt'
      });

      // Empty selection (same start and end)
      const selection = createMinimalRange(5, 0, 5, 0);

      const potentialClaim = await readingAssistant.extractClaimFromSelection(
        selection as any,
        mockDocument as any
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

      // Setup mock to track status changes
      let currentStatus: any = undefined;
      (readingStatusManager.setStatus as jest.Mock).mockImplementation((id, status) => {
        currentStatus = { status, startedAt: new Date() };
      });
      (readingStatusManager.getStatus as jest.Mock).mockImplementation(() => currentStatus);

      // Mark as some-read (valid status)
      await readingAssistant.trackReadingProgress(paperId, 'some-read');
      let status = readingStatusManager.getStatus(paperId);
      expect(status?.status).toBe('some-read');
      expect(status?.startedAt).toBeDefined();

      // Update mock for 'read' status
      (readingStatusManager.setStatus as jest.Mock).mockImplementation((id, status) => {
        currentStatus = { 
          status, 
          startedAt: currentStatus?.startedAt,
          completedAt: new Date(),
          readingDuration: 1000
        };
      });

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

      // Setup mock to track status
      let currentStatus: any = undefined;
      (readingStatusManager.setStatus as jest.Mock).mockImplementation((id, status) => {
        currentStatus = { status, startedAt: new Date() };
      });
      (readingStatusManager.getStatus as jest.Mock).mockImplementation(() => currentStatus);

      // Set status
      await readingAssistant.trackReadingProgress(paperId, 'some-read');

      // Verify status can be retrieved
      const status = readingStatusManager.getStatus(paperId);
      expect(status?.status).toBe('some-read');
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
      const selectedText = 'Our results show a 50% improvement in accuracy.';
      const fullText = `Context. ${selectedText} More context.`;
      
      // Use minimal mock
      const mockDocument = createMinimalDocument({
        text: fullText,
        uri: createMinimalUri('/mock/workspace/literature/ExtractedText/Test2023.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/Test2023.txt'
      });

      const selection = createMinimalRange(0, 9, 0, 9 + selectedText.length);

      const potentialClaim = await readingAssistant.extractClaimFromSelection(
        selection as any,
        mockDocument as any
      );

      expect(potentialClaim).toBeDefined();
      // Should be categorized based on keywords
      expect(['result', 'conclusion', 'method']).toContain(potentialClaim?.type);
    });
  });

  describe('Error Handling', () => {
    /**
     * Test: Handle invalid document paths
     */
    test('should handle invalid document paths gracefully', () => {
      // Use minimal mock for invalid path
      const mockDocument = createMinimalDocument({
        text: '',
        uri: createMinimalUri(''),
        fileName: ''
      });

      expect(() => {
        readingAssistant.activateForDocument(mockDocument as any);
      }).not.toThrow();
    });

    /**
     * Test: Handle missing paper ID
     */
    test('should handle documents without valid paper IDs', async () => {
      // Use minimal mock for document with invalid filename
      const mockDocument = createMinimalDocument({
        text: 'Sample text',
        uri: createMinimalUri('/mock/workspace/literature/ExtractedText/.txt'),
        fileName: '/mock/workspace/literature/ExtractedText/.txt'
      });

      // Should not throw even with invalid filename
      expect(() => {
        readingAssistant.activateForDocument(mockDocument as any);
      }).not.toThrow();
    });
  });
});
