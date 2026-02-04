import { jest } from '@jest/globals';
import { QuickClaimExtractor } from '../core/quickClaimExtractor';
import type { ClaimsManager } from '../core/claimsManagerWrapper';
import type { ClaimExtractor } from '../core/claimExtractor';
import type { OutlineParser } from '../core/outlineParserWrapper';
import type { EmbeddingService } from '@research-assistant/core';
import type { AutoQuoteVerifier } from '../core/autoQuoteVerifier';
import * as vscode from 'vscode';
import { 
  setupTest, 
  createMockClaim,
  createMinimalDocument,
  createMinimalUri
} from './helpers';

/**
 * Tests for QuickClaimExtractor
 * 
 * **Refactored:** Uses minimal mocks instead of createMockDocument for simple URI-only tests
 * to reduce mock maintenance burden (Task 4.4)
 */
describe('QuickClaimExtractor', () => {
  setupTest();

  let quickClaimExtractor: QuickClaimExtractor;
  let mockClaimsManager: jest.Mocked<any>;
  let mockClaimExtractor: jest.Mocked<any>;
  let mockOutlineParser: jest.Mocked<any>;
  let mockEmbeddingService: jest.Mocked<any>;
  let mockAutoQuoteVerifier: jest.Mocked<any>;
  const extractedTextPath = '/workspace/literature/ExtractedText';

  beforeEach(() => {
    mockClaimsManager = {
      saveClaim: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      generateClaimId: jest.fn<() => string>().mockReturnValue('C_01'),
      getClaims: jest.fn<() => any[]>().mockReturnValue([]),
      getClaim: jest.fn(),
      updateClaim: jest.fn(),
      deleteClaim: jest.fn(),
      loadClaims: jest.fn(),
      searchClaims: jest.fn(),
      findClaimsBySection: jest.fn(),
      findClaimsBySource: jest.fn(),
      detectSimilarClaims: jest.fn(),
      mergeClaims: jest.fn()
    } as any;

    mockClaimExtractor = {
      categorizeClaim: jest.fn<(text: string) => string>().mockReturnValue('method'),
      suggestSections: jest.fn<() => Promise<any[]>>().mockResolvedValue([
        { id: 'section1', title: 'Methods', level: 2, content: [], parent: null, children: [], lineStart: 0, lineEnd: 10 }
      ]),
      extractClaims: jest.fn(),
      extractFromText: jest.fn()
    } as any;

    mockOutlineParser = {
      parse: jest.fn<() => Promise<any[]>>().mockResolvedValue([
        { id: 'section1', title: 'Methods', level: 2, content: [], parent: null, children: [], lineStart: 0, lineEnd: 10 },
        { id: 'section2', title: 'Results', level: 2, content: [], parent: null, children: [], lineStart: 11, lineEnd: 20 }
      ]),
      getSectionAtPosition: jest.fn(),
      getSectionById: jest.fn(),
      getSections: jest.fn(),
      getFilePath: jest.fn()
    } as any;

    mockEmbeddingService = {
      generateEmbedding: jest.fn<() => Promise<number[]>>().mockResolvedValue([0.1, 0.2, 0.3]),
      cosineSimilarity: jest.fn<() => number>().mockReturnValue(0.8),
      generateBatch: jest.fn(),
      generateBatchParallel: jest.fn(),
      trimCache: jest.fn(),
      clearCache: jest.fn(),
      getCacheSize: jest.fn<() => number>().mockReturnValue(0)
    } as any;

    mockAutoQuoteVerifier = {
      verifyOnSave: jest.fn<() => void>().mockReturnValue(undefined),
      verifyClaimManually: jest.fn(),
      verifyAllUnverified: jest.fn(),
      processVerificationQueue: jest.fn(),
      getQueueSize: jest.fn<() => number>().mockReturnValue(0),
      isProcessingQueue: jest.fn<() => boolean>().mockReturnValue(false),
      clearQueue: jest.fn(),
      onDidVerify: { event: jest.fn() },
      dispose: jest.fn()
    } as any;

    quickClaimExtractor = new QuickClaimExtractor(
      mockClaimsManager,
      mockClaimExtractor,
      mockOutlineParser,
      mockEmbeddingService,
      mockAutoQuoteVerifier,
      extractedTextPath
    );
  });

  describe('autoDetectSource', () => {
    test('should extract source from filename', () => {
      // Use minimal mock - only needs uri property
      const mockDocument = createMinimalDocument({
        text: '',
        uri: createMinimalUri('/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/workspace/literature/ExtractedText/Smith2023.txt'
      });

      const source = quickClaimExtractor.autoDetectSource(mockDocument as any);
      expect(source).toBe('Smith2023');
    });

    test('should handle different file extensions', () => {
      const mockDocument = createMinimalDocument({
        text: '',
        uri: createMinimalUri('/workspace/literature/ExtractedText/Johnson2020.md'),
        fileName: '/workspace/literature/ExtractedText/Johnson2020.md'
      });

      const source = quickClaimExtractor.autoDetectSource(mockDocument as any);
      expect(source).toBe('Johnson2020');
    });

    test('should handle complex filenames', () => {
      const mockDocument = createMinimalDocument({
        text: '',
        uri: createMinimalUri('/workspace/literature/ExtractedText/VanDerWaal2019.txt'),
        fileName: '/workspace/literature/ExtractedText/VanDerWaal2019.txt'
      });

      const source = quickClaimExtractor.autoDetectSource(mockDocument as any);
      expect(source).toBe('VanDerWaal2019');
    });
  });

  describe('autoDetectCategory', () => {
    test('should detect method category', () => {
      const text = 'We propose a new algorithm for batch correction';
      const category = quickClaimExtractor.autoDetectCategory(text);
      // Verify output behavior: method text should be categorized as Method
      expect(category).toBe('Method');
    });

    test('should detect result category', () => {
      mockClaimExtractor.categorizeClaim.mockReturnValue('result');
      const text = 'Our results show a 95% accuracy improvement';
      const category = quickClaimExtractor.autoDetectCategory(text);
      // Verify output behavior: result text should be categorized as Result
      expect(category).toBe('Result');
    });

    test('should detect challenge category', () => {
      mockClaimExtractor.categorizeClaim.mockReturnValue('challenge');
      const text = 'However, batch effects remain a significant challenge';
      const category = quickClaimExtractor.autoDetectCategory(text);
      // Verify output behavior: challenge text should be categorized as Challenge
      expect(category).toBe('Challenge');
    });

    test('should default to Background for unknown types', () => {
      mockClaimExtractor.categorizeClaim.mockReturnValue('unknown' as any);
      const text = 'Some general statement';
      const category = quickClaimExtractor.autoDetectCategory(text);
      // Verify output behavior: unknown types should default to Background
      expect(category).toBe('Background');
    });
  });

  describe('suggestSections', () => {
    test('should suggest relevant sections using embeddings', async () => {
      const text = 'We developed a new batch correction method';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      // Verify output behavior: should return section IDs
      expect(sections).toEqual(['section1']);
    });

    test('should return empty array if no sections available', async () => {
      mockOutlineParser.parse.mockResolvedValue([]);
      const text = 'Some claim text';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      // Verify output behavior: no sections should return empty array
      expect(sections).toEqual([]);
    });

    test('should handle errors gracefully', async () => {
      mockOutlineParser.parse.mockRejectedValue(new Error('Parse error'));
      const text = 'Some claim text';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      // Verify output behavior: errors should return empty array
      expect(sections).toEqual([]);
    });

    test('should return top 3 sections at most', async () => {
      const allSections = [
        { id: 'section1', title: 'Methods', level: 2, content: [], parent: null, children: [], lineStart: 0, lineEnd: 10 },
        { id: 'section2', title: 'Results', level: 2, content: [], parent: null, children: [], lineStart: 11, lineEnd: 20 },
        { id: 'section3', title: 'Discussion', level: 2, content: [], parent: null, children: [], lineStart: 21, lineEnd: 30 },
        { id: 'section4', title: 'Conclusion', level: 2, content: [], parent: null, children: [], lineStart: 31, lineEnd: 40 }
      ];
      
      mockOutlineParser.parse.mockResolvedValue(allSections);
      // suggestSections returns top 3 from ClaimExtractor
      mockClaimExtractor.suggestSections.mockResolvedValue(allSections.slice(0, 3));

      const text = 'Some claim text';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      // Verify output behavior: should limit to 3 sections
      expect(sections.length).toBeLessThanOrEqual(3);
    });
  });

  describe('saveAndVerify', () => {
    test('should save claim to database', async () => {
      const claim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: {
          text: 'Test quote',
          source: 'Smith2023',
          sourceId: 1,
          verified: false
        },
        sections: ['section1']
      });

      (vscode.window.showInformationMessage as jest.Mock<() => Promise<string | undefined>>).mockResolvedValue(undefined);

      await quickClaimExtractor.saveAndVerify(claim);

      // Verify output behavior: user should see success message
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Claim C_01 saved successfully',
        'View Claim'
      );
    });

    test('should trigger background verification after saving', async () => {
      const claim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: {
          text: 'Test quote',
          source: 'Smith2023',
          sourceId: 1,
          verified: false
        },
        sections: ['section1']
      });

      (vscode.window.showInformationMessage as jest.Mock<() => Promise<string | undefined>>).mockResolvedValue(undefined);

      await quickClaimExtractor.saveAndVerify(claim);

      // Verify integration boundary: verification should be triggered
      expect(mockAutoQuoteVerifier.verifyOnSave).toHaveBeenCalledWith(claim);
    });

    test('should handle save errors', async () => {
      const claim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: {
          text: 'Test quote',
          source: 'Smith2023',
          sourceId: 1,
          verified: false
        }
      });

      mockClaimsManager.saveClaim.mockRejectedValue(new Error('Save failed'));

      await quickClaimExtractor.saveAndVerify(claim);

      // Verify output behavior: user should see error message
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save claim')
      );
    });
  });

  describe('registerCommands', () => {
    test('should register quickExtractClaim command', () => {
      // Mock registerCommand to return a disposable
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue({
        dispose: jest.fn()
      });
      
      const disposables = quickClaimExtractor.registerCommands();
      
      // Verify output behavior: should return disposables
      expect(disposables.length).toBeGreaterThan(0);
    });
  });

  describe('extractFromSelection - validation', () => {
    test('should warn if no active editor', async () => {
      (vscode.window as any).activeTextEditor = undefined;

      await quickClaimExtractor.extractFromSelection();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Please open a file first to extract claims.',
        'Open File'
      );
    });

    test('should warn if not in ExtractedText file', async () => {
      // Use minimal mock for document outside ExtractedText
      const mockDocument = createMinimalDocument({
        text: '',
        uri: createMinimalUri('/workspace/manuscript.md'),
        fileName: '/workspace/manuscript.md'
      });
      
      (vscode.window as any).activeTextEditor = {
        document: mockDocument,
        selection: { isEmpty: false }
      };

      await quickClaimExtractor.extractFromSelection();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Quick Extract Claim works only in ExtractedText files. Please open a file from the literature/ExtractedText folder.',
        'Browse Files'
      );
    });

    test('should warn if selection is empty', async () => {
      // Use minimal mock for ExtractedText file
      const mockDocument = createMinimalDocument({
        text: '',
        uri: createMinimalUri('/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/workspace/literature/ExtractedText/Smith2023.txt'
      });
      
      (vscode.window as any).activeTextEditor = {
        document: mockDocument,
        selection: { isEmpty: true }
      };

      await quickClaimExtractor.extractFromSelection();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Please select some text to extract as a claim.'
      );
    });
  });

  describe('Integration - full workflow', () => {
    test('should complete full extraction workflow', async () => {
      const selectedText = 'We developed a novel batch correction algorithm';
      
      // Use minimal mock with getText that returns selected text
      const mockDocument = createMinimalDocument({
        text: selectedText,
        uri: createMinimalUri('/workspace/literature/ExtractedText/Smith2023.txt'),
        fileName: '/workspace/literature/ExtractedText/Smith2023.txt'
      });
      
      // Create a proper selection with start/end properties
      const mockSelection = {
        isEmpty: false,
        start: { line: 0, character: 0 },
        end: { line: 0, character: selectedText.length }
      };
      
      (vscode.window as any).activeTextEditor = {
        document: mockDocument,
        selection: mockSelection
      };

      (vscode.window.showInputBox as jest.Mock<() => Promise<string | undefined>>).mockResolvedValue(selectedText);
      (vscode.window.showQuickPick as jest.Mock<() => Promise<any>>).mockResolvedValue({ action: 'save' });
      (vscode.window.showInformationMessage as jest.Mock<() => Promise<string | undefined>>).mockResolvedValue(undefined);

      await quickClaimExtractor.extractFromSelection();

      // Verify output behavior: claim should be saved with correct properties
      const savedClaim = (mockClaimsManager.saveClaim as jest.Mock).mock.calls[0][0] as any;
      expect(savedClaim.text).toBe(selectedText);
      expect(savedClaim.primaryQuote?.source).toBe('Smith2023');
      expect(savedClaim.category).toBe('Method');
    });
  });
});
