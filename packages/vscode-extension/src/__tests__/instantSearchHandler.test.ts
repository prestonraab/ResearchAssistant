import { jest } from '@jest/globals';
import { InstantSearchHandler } from '../core/instantSearchHandler';
import { ZoteroClient, ZoteroItem } from '@research-assistant/core';
import { ManuscriptContextDetector } from '../core/manuscriptContextDetector';
import * as vscode from 'vscode';
import * as fs from 'fs';
import {  
  setupTest, 
  aZoteroItem,
  aDocumentSection,
  createMockZoteroItem,
  createMockZoteroApiService,
  createMockManuscriptContextDetector
, setupFsMock } from './helpers';

// Mock modules
jest.mock('fs');
jest.mock('../services/zoteroApiService');
jest.mock('../core/manuscriptContextDetector');

describe('InstantSearchHandler', () => {
  setupTest();

  let handler: InstantSearchHandler;
  let mockZoteroApiService: ReturnType<typeof createMockZoteroApiService>;
  let mockManuscriptContextDetector: ReturnType<typeof createMockManuscriptContextDetector>;
  const workspaceRoot = '/test/workspace';
  const extractedTextPath = '/test/workspace/literature/ExtractedText';

  const mockZoteroItem = aZoteroItem()
    .withKey('ABC123')
    .withTitle('Test Paper on Machine Learning')
    .withAuthor('John', 'Smith')
    .withAuthor('Jane', 'Doe')
    .withYear(2023)
    .withAbstract('This is a test abstract about machine learning and neural networks.')
    .withDOI('10.1234/test')
    .build();

  const mockSection = aDocumentSection()
    .withId('section-1')
    .withLevel(2)
    .withTitle('Machine Learning Methods')
    .withContent(['Neural networks', 'Deep learning'])
    .withLineRange(10, 20)
    .build();

  beforeEach(() => {
    setupFsMock();
    mockZoteroApiService = createMockZoteroApiService();
    mockManuscriptContextDetector = createMockManuscriptContextDetector();

    handler = new InstantSearchHandler(
      mockZoteroApiService as any,
      mockManuscriptContextDetector as any,
      workspaceRoot,
      extractedTextPath
    );

    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    handler.dispose();
  });

  describe('registerContextMenu', () => {
    test('should register the findPapersForSelection command', () => {
      const mockRegisterCommand = jest.fn();
      (vscode.commands.registerCommand as jest.Mock) = mockRegisterCommand;

      handler.registerContextMenu();

      expect(mockRegisterCommand).toHaveBeenCalledWith(
        'researchAssistant.findPapersForSelection',
        expect.any(Function)
      );
    });
  });

  describe('searchFromSelection', () => {
    test('should search for papers using selected text', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.semanticSearch.mockResolvedValue(mockResults);

      // Mock vscode.window.withProgress
      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );

      // Mock vscode.window.showQuickPick to return null (cancel)
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(null);

      const results = await handler.searchFromSelection('machine learning');

      expect(mockZoteroApiService.semanticSearch).toHaveBeenCalledWith(
        'machine learning',
        10
      );
      expect(results).toEqual(mockResults);
    });

    test('should include section context in search query', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.semanticSearch.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(null);

      await handler.searchFromSelection('neural networks', 'Machine Learning Methods');

      expect(mockZoteroApiService.semanticSearch).toHaveBeenCalledWith(
        'neural networks Machine Learning Methods',
        10
      );
    });

    test('should use cached results for repeated queries', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.semanticSearch.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(null);

      // First search
      await handler.searchFromSelection('machine learning');
      expect(mockZoteroApiService.semanticSearch).toHaveBeenCalledTimes(1);

      // Second search with same query - should use cache
      await handler.searchFromSelection('machine learning');
      expect(mockZoteroApiService.semanticSearch).toHaveBeenCalledTimes(1);
    });

    test('should handle search timeout gracefully', async () => {
      // Mock a slow search that exceeds timeout
      mockZoteroApiService.semanticSearch.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 3000))
      );

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );

      const mockShowWarning = jest.fn();
      (vscode.window.showWarningMessage as jest.Mock) = mockShowWarning;

      const results = await handler.searchFromSelection('test query');

      expect(results).toEqual([]);
      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.stringContaining('took too long')
      );
    });

    test('should handle search errors', async () => {
      mockZoteroApiService.semanticSearch.mockRejectedValue(
        new Error('Network error')
      );

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );

      const mockShowError = jest.fn();
      (vscode.window.showErrorMessage as jest.Mock) = mockShowError;

      const results = await handler.searchFromSelection('test query');

      expect(results).toEqual([]);
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('search failed')
      );
    });

    test('should limit query length to 500 characters', async () => {
      const longQuery = 'a'.repeat(600);
      const longContext = 'b'.repeat(600);
      
      mockZoteroApiService.semanticSearch.mockResolvedValue([]);
      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(null);

      await handler.searchFromSelection(longQuery, longContext);

      const calledQuery = mockZoteroApiService.semanticSearch.mock.calls[0][0];
      expect(calledQuery.length).toBeLessThanOrEqual(500);
    });
  });

  describe('displayResults', () => {
    test('should show informational message when no results found and offer internet search', async () => {
      const mockShowInfo = jest.fn().mockResolvedValue(undefined);
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;

      const result = await handler.displayResults([]);

      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.stringContaining('No papers found'),
        'Search Internet',
        'Cancel'
      );
      expect(result).toBeNull();
    });

    test('should display results in quick pick with formatted metadata', async () => {
      const mockShowQuickPick = jest.fn().mockResolvedValue(null);
      (vscode.window.showQuickPick as jest.Mock) = mockShowQuickPick;

      await handler.displayResults([mockZoteroItem]);

      expect(mockShowQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: expect.stringContaining('Test Paper on Machine Learning'),
            description: expect.stringContaining('Smith, John'),
          }),
        ]),
        expect.any(Object)
      );
    });

    test('should truncate author list for papers with many authors', async () => {
      const manyAuthorsItem: ZoteroItem = {
        ...mockZoteroItem,
        authors: ['Author1', 'Author2', 'Author3', 'Author4'],
      };

      const mockShowQuickPick = jest.fn().mockResolvedValue(null);
      (vscode.window.showQuickPick as jest.Mock) = mockShowQuickPick;

      await handler.displayResults([manyAuthorsItem]);

      const callArgs = mockShowQuickPick.mock.calls[0][0];
      expect(callArgs[0].description).toContain('et al.');
    });

    test('should truncate long abstracts in detail field', async () => {
      const longAbstractItem: ZoteroItem = {
        ...mockZoteroItem,
        abstract: 'a'.repeat(200),
      };

      const mockShowQuickPick = jest.fn().mockResolvedValue(null);
      (vscode.window.showQuickPick as jest.Mock) = mockShowQuickPick;

      await handler.displayResults([longAbstractItem]);

      const callArgs = mockShowQuickPick.mock.calls[0][0];
      expect(callArgs[0].detail).toContain('...');
      expect(callArgs[0].detail.length).toBeLessThan(160);
    });

    test('should call openOrExtractPaper when item is selected', async () => {
      const mockShowQuickPick = jest.fn().mockResolvedValue({
        item: mockZoteroItem,
        index: 0,
      });
      (vscode.window.showQuickPick as jest.Mock) = mockShowQuickPick;

      // Mock openOrExtractPaper
      const openSpy = jest.spyOn(handler, 'openOrExtractPaper').mockResolvedValue();

      await handler.displayResults([mockZoteroItem]);

      expect(openSpy).toHaveBeenCalledWith(mockZoteroItem);
    });
  });

  describe('openOrExtractPaper', () => {
    test('should open existing extracted text file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const mockDocument = { uri: 'test-uri' };
      const mockOpenTextDocument = jest.fn().mockResolvedValue(mockDocument);
      const mockShowTextDocument = jest.fn().mockResolvedValue({});
      const mockShowInfo = jest.fn().mockResolvedValue(undefined);

      (vscode.workspace.openTextDocument as jest.Mock) = mockOpenTextDocument;
      (vscode.window.showTextDocument as jest.Mock) = mockShowTextDocument;
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockOpenTextDocument).toHaveBeenCalled();
      expect(mockShowTextDocument).toHaveBeenCalledWith(
        mockDocument,
        { preview: false }
      );
      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.stringContaining('Opened'),
        'Extract Claim'
      );
    });

    test('should offer to extract when text file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const mockShowInfo = jest.fn().mockResolvedValue('Extract Now');
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.stringContaining('has not been extracted'),
        'Extract Now',
        'Cancel'
      );
    });

    test('should trigger PDF extraction when PDF exists', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('.pdf');
      });

      const mockShowInfo = jest.fn().mockResolvedValue('Extract Now');
      const mockExecuteCommand = jest.fn();
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;
      (vscode.commands.executeCommand as jest.Mock) = mockExecuteCommand;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'researchAssistant.extractPdf',
        expect.stringContaining('.pdf')
      );
    });

    test('should offer to sync PDFs when PDF does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const mockShowInfo = jest.fn()
        .mockResolvedValueOnce('Extract Now')
        .mockResolvedValueOnce('Sync PDFs');
      const mockShowWarning = jest.fn().mockResolvedValue('Sync PDFs');
      
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;
      (vscode.window.showWarningMessage as jest.Mock) = mockShowWarning;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.stringContaining('PDF not found'),
        'Sync PDFs'
      );
    });

    test('should handle errors gracefully', async () => {
      (fs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('File system error');
      });

      const mockShowError = jest.fn();
      (vscode.window.showErrorMessage as jest.Mock) = mockShowError;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open paper')
      );
    });
  });

  describe('Cache Management', () => {
    test('should clear cache on demand', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.semanticSearch.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(null);

      // Populate cache
      await handler.searchFromSelection('test query');
      expect(mockZoteroApiService.semanticSearch).toHaveBeenCalledTimes(1);

      // Clear cache
      handler.clearCache();

      // Search again - should hit MCP again
      await handler.searchFromSelection('test query');
      expect(mockZoteroApiService.semanticSearch).toHaveBeenCalledTimes(2);
    });

    test('should limit cache size to 50 entries', async () => {
      mockZoteroApiService.semanticSearch.mockResolvedValue([mockZoteroItem]);

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(null);

      // Add 51 entries to cache
      for (let i = 0; i < 51; i++) {
        await handler.searchFromSelection(`query ${i}`);
      }

      // First query should have been evicted
      await handler.searchFromSelection('query 0');
      
      // Should have made 52 calls (51 initial + 1 for evicted entry)
      expect(mockZoteroApiService.semanticSearch).toHaveBeenCalledTimes(52);
    });
  });

  describe('Filename Generation', () => {
    test('should generate filename from author and year', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const mockOpenTextDocument = jest.fn().mockResolvedValue({});
      const mockShowTextDocument = jest.fn().mockResolvedValue({});
      (vscode.workspace.openTextDocument as jest.Mock) = mockOpenTextDocument;
      (vscode.window.showTextDocument as jest.Mock) = mockShowTextDocument;
      (vscode.window.showInformationMessage as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockOpenTextDocument).toHaveBeenCalledWith(
        expect.stringContaining('Smith_2023.txt')
      );
    });

    test('should handle authors with special characters', async () => {
      const specialItem: ZoteroItem = {
        ...mockZoteroItem,
        authors: ["O'Brien, Patrick"],
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      const mockOpenTextDocument = jest.fn().mockResolvedValue({});
      const mockShowTextDocument = jest.fn().mockResolvedValue({});
      (vscode.workspace.openTextDocument as jest.Mock) = mockOpenTextDocument;
      (vscode.window.showTextDocument as jest.Mock) = mockShowTextDocument;
      (vscode.window.showInformationMessage as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await handler.openOrExtractPaper(specialItem);

      // Should clean special characters from last name
      expect(mockOpenTextDocument).toHaveBeenCalledWith(
        expect.stringContaining('OBrien_2023.txt')
      );
    });
  });

  describe('Performance', () => {
    test('should complete search within 2 seconds for cached results', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.semanticSearch.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options, task) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(null);

      // First search to populate cache
      await handler.searchFromSelection('test query');

      // Second search should be instant from cache
      const startTime = Date.now();
      await handler.searchFromSelection('test query');
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(100); // Should be nearly instant
    });
  });
});
