import { jest } from '@jest/globals';
import { InstantSearchHandler } from '../core/instantSearchHandler';
import { InternetPaperSearcher } from '../core/internetPaperSearcher';
import { ZoteroClient, ZoteroItem } from '@research-assistant/core';
import { ManuscriptContextDetector } from '../core/manuscriptContextDetector';
import * as vscode from 'vscode';
import { setupTest, aZoteroItem } from './helpers';

describe('Internet Search Integration', () => {
  setupTest();

  let instantSearchHandler: InstantSearchHandler;
  let internetSearcher: InternetPaperSearcher;
  let mockZoteroClient: jest.Mocked<ZoteroClient>;
  let mockContextDetector: jest.Mocked<ManuscriptContextDetector>;
  const workspaceRoot = '/test/workspace';
  const extractedTextPath = '/test/workspace/literature/ExtractedText';

  beforeEach(() => {
    // Create minimal mock for ZoteroClient - only needs getItems method
    mockZoteroClient = {
      getItems: jest.fn<any>().mockResolvedValue([]),
    } as any;

    // Create minimal mock for ContextDetector - only needs getContext method
    mockContextDetector = {
      getContext: jest.fn<any>().mockReturnValue(null),
    } as any;

    instantSearchHandler = new InstantSearchHandler(
      mockZoteroClient,
      mockContextDetector,
      workspaceRoot,
      extractedTextPath
    );

    internetSearcher = new InternetPaperSearcher(workspaceRoot);
  });

  afterEach(() => {
    instantSearchHandler.dispose?.();
    internetSearcher.dispose?.();
  });

  describe('Complete workflow: Zotero search fails -> Internet search -> Import', () => {
    test('should offer internet search when Zotero returns no results', async () => {
      // Mock Zotero search returning empty results
      mockZoteroClient.getItems.mockResolvedValue([]);

      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock<any>;
      mockShowInfo.mockResolvedValue('Search Internet' as any);

      // Perform search
      const results = await instantSearchHandler.searchFromSelection('test query');

      // Verify empty results returned
      expect(results).toEqual([]);

      // Verify user was offered internet search option
      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.stringContaining('No papers found'),
        'Search Internet',
        'Cancel'
      );
    });

    test('should handle internet search workflow', async () => {
      const mockShowInputBox = vscode.window.showInputBox as jest.Mock<any>;
      mockShowInputBox.mockResolvedValue('machine learning' as any);

      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock<any>;
      mockShowQuickPick.mockResolvedValue({
        paper: {
          title: 'Test Paper',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract',
          doi: '10.1234/test',
          source: 'crossref',
        },
      } as any);

      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock<any>;
      mockShowInfo.mockResolvedValue('Copy Metadata' as any);

      // Simulate internet search (would normally be triggered by user action)
      const results = await internetSearcher.searchExternal('machine learning');

      // Results should be an array (may be empty due to network mocking)
      expect(Array.isArray(results)).toBe(true);
    });

    test('should integrate with InstantSearchHandler disposal', () => {
      // Verify that disposal cleans up resources
      expect(() => {
        instantSearchHandler.dispose();
      }).not.toThrow();
    });
  });

  describe('External API integration', () => {
    test('should handle CrossRef API format', () => {
      const crossrefItem = {
        title: ['Test Paper'],
        author: [
          { given: 'John', family: 'Doe' },
        ],
        published: { 'date-parts': [[2023]] },
        DOI: '10.1234/test',
      };

      const parsed = (internetSearcher as any).parseCrossRefItem(crossrefItem);

      expect(parsed).not.toBeNull();
      expect(parsed.title).toBe('Test Paper');
      expect(parsed.authors).toEqual(['Doe, John']);
      expect(parsed.year).toBe(2023);
      expect(parsed.source).toBe('crossref');
    });

    test('should handle PubMed API format', () => {
      const pubmedItem = {
        title: 'Test Paper',
        authors: [{ name: 'Doe J' }],
        pubdate: '2023/05/15',
        uid: '12345678',
        articleids: [
          { idtype: 'doi', value: '10.1234/test' },
        ],
      };

      const parsed = (internetSearcher as any).parsePubMedItem(pubmedItem);

      expect(parsed).not.toBeNull();
      expect(parsed.title).toBe('Test Paper');
      expect(parsed.authors).toEqual(['Doe J']);
      expect(parsed.year).toBe(2023);
      expect(parsed.source).toBe('pubmed');
    });
  });
});
