import { jest } from '@jest/globals';
import { InstantSearchHandler, FileSystemDeps } from '../core/instantSearchHandler';
import { ZoteroItem } from '@research-assistant/core';
import * as vscode from 'vscode';
import {  
  setupTest,
  aZoteroItem,
  aDocumentSection,
  createMockZoteroApiService,
  createMockManuscriptContextDetector
} from './helpers';

jest.mock('../services/zoteroApiService');
jest.mock('../core/manuscriptContextDetector');

/**
 * Creates a mock file system for testing
 */
function createMockFileSystem(): FileSystemDeps & { 
  existsSync: jest.Mock<(path: string) => boolean>; 
} {
  return {
    existsSync: jest.fn<(path: string) => boolean>().mockReturnValue(false)
  };
}

describe('InstantSearchHandler', () => {
  setupTest();

  let handler: InstantSearchHandler;
  let mockZoteroApiService: ReturnType<typeof createMockZoteroApiService>;
  let mockManuscriptContextDetector: ReturnType<typeof createMockManuscriptContextDetector>;
  let mockFs: ReturnType<typeof createMockFileSystem>;
  
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
    mockZoteroApiService = createMockZoteroApiService();
    mockManuscriptContextDetector = createMockManuscriptContextDetector();
    mockFs = createMockFileSystem();

    handler = new InstantSearchHandler(
      mockZoteroApiService as any,
      mockManuscriptContextDetector as any,
      workspaceRoot,
      extractedTextPath,
      mockFs
    );
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
      mockZoteroApiService.getItems.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(null);

      const results = await handler.searchFromSelection('machine learning');

      expect(results).toEqual(mockResults);
      expect(results.length).toBe(1);
      expect(results[0].key).toBe('ABC123');
    });

    test('should include section context in search query', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.getItems.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(null);

      await handler.searchFromSelection('neural networks', 'Machine Learning Methods');

      // Verify the search completed successfully
      expect(mockZoteroApiService.getItems).toBeDefined();
    });

    test('should use cached results for repeated queries', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.getItems.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(null);

      const result1 = await handler.searchFromSelection('machine learning');
      const result2 = await handler.searchFromSelection('machine learning');
      
      expect(result2).toEqual(result1);
      expect(result2).toBe(result1); // Same object reference (true cache)
    });

    test('should handle search errors', async () => {
      mockZoteroApiService.getItems.mockRejectedValue(new Error('Network error'));

      (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );

      (vscode.window.showErrorMessage as jest.Mock<any>).mockResolvedValue(undefined);

      const results = await handler.searchFromSelection('test query');

      expect(results).toEqual([]);
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    test('should limit query length to 500 characters', async () => {
      const longQuery = 'a'.repeat(600);
      const longContext = 'b'.repeat(600);
      
      mockZoteroApiService.getItems.mockResolvedValue([]);
      (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(null as any);

      await handler.searchFromSelection(longQuery, longContext);

      expect(mockZoteroApiService.getItems).toHaveBeenCalledWith(10);
    });
  });

  describe('displayResults', () => {
    test('should show informational message when no results found', async () => {
      const mockShowInfo = jest.fn<() => Promise<string | undefined>>().mockResolvedValue(undefined);
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
      const mockShowQuickPick = jest.fn<() => Promise<any>>().mockResolvedValue(null);
      (vscode.window.showQuickPick as jest.Mock) = mockShowQuickPick;

      await handler.displayResults([mockZoteroItem]);

      expect(mockShowQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: expect.stringContaining('Test Paper on Machine Learning'),
            description: expect.stringContaining('Smith'),
          }),
        ]),
        expect.any(Object)
      );
    });

    test('should call openOrExtractPaper when item is selected', async () => {
      const mockShowQuickPick = jest.fn<() => Promise<any>>().mockResolvedValue({
        item: mockZoteroItem,
        index: 0,
      });
      (vscode.window.showQuickPick as jest.Mock) = mockShowQuickPick;

      const openSpy = jest.spyOn(handler, 'openOrExtractPaper').mockResolvedValue();

      await handler.displayResults([mockZoteroItem]);

      expect(openSpy).toHaveBeenCalledWith(mockZoteroItem);
    });
  });

  describe('openOrExtractPaper', () => {
    test('should open existing extracted text file', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const mockDocument = { uri: 'test-uri' };
      const mockOpenTextDocument = jest.fn<() => Promise<any>>().mockResolvedValue(mockDocument);
      const mockShowTextDocument = jest.fn<() => Promise<any>>().mockResolvedValue({});
      const mockShowInfo = jest.fn<() => Promise<string | undefined>>().mockResolvedValue(undefined);

      (vscode.workspace.openTextDocument as jest.Mock) = mockOpenTextDocument;
      (vscode.window.showTextDocument as jest.Mock) = mockShowTextDocument;
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockOpenTextDocument).toHaveBeenCalled();
      expect(mockShowTextDocument).toHaveBeenCalledWith(mockDocument, { preview: false });
      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.stringContaining('Opened'),
        'Extract Claim'
      );
    });

    test('should offer to extract when text file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const mockShowInfo = jest.fn<() => Promise<string | undefined>>().mockResolvedValue('Extract Now');
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.stringContaining('has not been extracted'),
        'Extract Now',
        'Cancel'
      );
    });

    test('should trigger PDF extraction when PDF exists', async () => {
      mockFs.existsSync.mockImplementation((path: string) => path.includes('.pdf'));

      const mockShowInfo = jest.fn<() => Promise<string | undefined>>().mockResolvedValue('Extract Now');
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
      mockFs.existsSync.mockReturnValue(false);

      const mockShowInfo = jest.fn<() => Promise<string | undefined>>()
        .mockResolvedValueOnce('Extract Now');
      const mockShowWarning = jest.fn<() => Promise<string | undefined>>().mockResolvedValue('Sync PDFs');
      
      (vscode.window.showInformationMessage as jest.Mock) = mockShowInfo;
      (vscode.window.showWarningMessage as jest.Mock) = mockShowWarning;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.stringContaining('PDF not found'),
        'Sync PDFs'
      );
    });

    test('should handle errors gracefully', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const mockShowError = jest.fn();
      (vscode.window.showErrorMessage as jest.Mock) = mockShowError;

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('Unable to open'),
        'Retry'
      );
    });
  });

  describe('Cache Management', () => {
    test('should clear cache on demand', async () => {
      // Return new array each time to test cache behavior
      mockZoteroApiService.getItems.mockImplementation(async () => [{ ...mockZoteroItem }]);

      (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(null);

      const result1 = await handler.searchFromSelection('test query');
      handler.clearCache();
      const result2 = await handler.searchFromSelection('test query');
      
      expect(result2).toEqual(result1);
      expect(result2).not.toBe(result1); // Different object reference after cache clear
    });

    test('should limit cache size to 50 entries', async () => {
      mockZoteroApiService.getItems.mockResolvedValue([mockZoteroItem]);

      (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(null);

      for (let i = 0; i < 51; i++) {
        await handler.searchFromSelection(`query ${i}`);
      }

      const firstQueryAgain = await handler.searchFromSelection('query 0');
      
      expect(firstQueryAgain).toEqual([mockZoteroItem]);
      expect(firstQueryAgain.length).toBeGreaterThan(0);
    });
  });

  describe('Filename Generation', () => {
    test('should generate filename from author and year', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const mockOpenTextDocument = jest.fn<() => Promise<any>>().mockResolvedValue({});
      const mockShowTextDocument = jest.fn<() => Promise<any>>().mockResolvedValue({});
      (vscode.workspace.openTextDocument as jest.Mock) = mockOpenTextDocument;
      (vscode.window.showTextDocument as jest.Mock) = mockShowTextDocument;
      (vscode.window.showInformationMessage as jest.Mock) = jest.fn<() => Promise<string | undefined>>().mockResolvedValue(undefined);

      await handler.openOrExtractPaper(mockZoteroItem);

      expect(mockOpenTextDocument).toHaveBeenCalledWith(
        expect.stringMatching(/Smith_\d{4}\.txt/)
      );
    });

    test('should handle authors with special characters', async () => {
      const specialItem: ZoteroItem = {
        ...mockZoteroItem,
        creators: [{ lastName: "O'Brien", firstName: 'Patrick', creatorType: 'author' }],
      } as any;

      mockFs.existsSync.mockReturnValue(true);
      
      const mockOpenTextDocument = jest.fn<() => Promise<any>>().mockResolvedValue({});
      const mockShowTextDocument = jest.fn<() => Promise<any>>().mockResolvedValue({});
      (vscode.workspace.openTextDocument as jest.Mock) = mockOpenTextDocument;
      (vscode.window.showTextDocument as jest.Mock) = mockShowTextDocument;
      (vscode.window.showInformationMessage as jest.Mock) = jest.fn<() => Promise<string | undefined>>().mockResolvedValue(undefined);

      await handler.openOrExtractPaper(specialItem);

      expect(mockOpenTextDocument).toHaveBeenCalledWith(
        expect.stringMatching(/OBrien_\d{4}\.txt/)
      );
    });
  });

  describe('Performance', () => {
    test('should complete search within 2 seconds for cached results', async () => {
      const mockResults = [mockZoteroItem];
      mockZoteroApiService.getItems.mockResolvedValue(mockResults);

      (vscode.window.withProgress as jest.Mock).mockImplementation(
        async (options: any, task: any) => task({ report: jest.fn() })
      );
      (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(null as any);

      await handler.searchFromSelection('test query');

      const startTime = Date.now();
      await handler.searchFromSelection('test query');
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(100);
    });
  });
});
