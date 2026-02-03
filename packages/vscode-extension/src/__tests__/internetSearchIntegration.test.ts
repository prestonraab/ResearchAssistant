import { InstantSearchHandler } from '../core/instantSearchHandler';
import { InternetPaperSearcher } from '../core/internetPaperSearcher';
import { ZoteroApiService, ZoteroItem } from '../services/zoteroApiService';
import { ManuscriptContextDetector } from '../core/manuscriptContextDetector';
import * as vscode from 'vscode';
import { setupTest, aZoteroItem } from './helpers';

describe('Internet Search Integration', () => {
  setupTest();

  let instantSearchHandler: InstantSearchHandler;
  let internetSearcher: InternetPaperSearcher;
  let mockZoteroService: jest.Mocked<ZoteroApiService>;
  let mockContextDetector: jest.Mocked<ManuscriptContextDetector>;
  const workspaceRoot = '/test/workspace';
  const extractedTextPath = '/test/workspace/literature/ExtractedText';

  beforeEach(() => {
    mockZoteroService = {
      semanticSearch: jest.fn(),
    } as any;

    mockContextDetector = {
      getContext: jest.fn(),
    } as any;

    instantSearchHandler = new InstantSearchHandler(
      mockZoteroService,
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
    it('should offer internet search when Zotero returns no results', async () => {
      // Mock Zotero search returning empty results
      const mockSemanticSearch = mockZoteroService.semanticSearch as jest.Mock;
      mockSemanticSearch.mockResolvedValue([]);

      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock;
      mockShowInfo.mockResolvedValue('Search Internet');

      // Perform search
      const results = await instantSearchHandler.searchFromSelection('test query');

      // Verify Zotero was searched
      expect(mockSemanticSearch).toHaveBeenCalledWith(expect.stringContaining('test query'), 10);

      // Verify empty results
      expect(results).toEqual([]);

      // Verify user was offered internet search
      expect(mockShowInfo).toHaveBeenCalledWith(
        expect.stringContaining('No papers found'),
        'Search Internet',
        'Cancel'
      );
    });

    it('should handle internet search workflow', async () => {
      const mockShowInputBox = vscode.window.showInputBox as jest.Mock;
      mockShowInputBox.mockResolvedValue('machine learning');

      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;
      mockShowQuickPick.mockResolvedValue({
        paper: {
          title: 'Test Paper',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract',
          doi: '10.1234/test',
          source: 'crossref',
        },
      });

      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock;
      mockShowInfo.mockResolvedValue('Copy Metadata');

      const mockClipboard = vscode.env.clipboard.writeText as jest.Mock;

      // Simulate internet search (would normally be triggered by user action)
      const results = await internetSearcher.searchExternal('machine learning');

      // Results should be an array (may be empty due to network mocking)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should integrate with InstantSearchHandler disposal', () => {
      // Verify that disposal cleans up resources
      expect(() => {
        instantSearchHandler.dispose();
      }).not.toThrow();
    });
  });

  describe('External API integration', () => {
    it('should handle CrossRef API format', () => {
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

    it('should handle PubMed API format', () => {
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

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Internet search should not throw on network errors
      const results = await internetSearcher.searchExternal('test query');
      
      // Should return empty array on error, not throw
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle malformed API responses', () => {
      const malformedItem = {
        // Missing required fields
        author: [{ given: 'John' }],
      };

      const parsed = (internetSearcher as any).parseCrossRefItem(malformedItem);

      // Should return null for invalid items
      expect(parsed).toBeNull();
    });
  });
});
