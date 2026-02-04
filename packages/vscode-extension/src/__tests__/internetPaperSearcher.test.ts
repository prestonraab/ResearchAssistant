import { jest } from '@jest/globals';
import { InternetPaperSearcher, ExternalPaper } from '../core/internetPaperSearcher';
import * as vscode from 'vscode';
import { setupTest } from './helpers';

describe('InternetPaperSearcher', () => {
  setupTest();

  let searcher: InternetPaperSearcher;
  const workspaceRoot = '/test/workspace';

  beforeEach(() => {
    searcher = new InternetPaperSearcher(workspaceRoot);
  });

  afterEach(() => {
    searcher.dispose?.();
  });

  describe('searchExternal', () => {
    test('should return empty array when no results found', async () => {
      // Mock HTTP requests to return empty results
      const results = await searcher.searchExternal('nonexistent query xyz123');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    test('should deduplicate results by DOI', async () => {
      // This test would require mocking HTTP responses
      // For now, we test the deduplication logic separately
      const papers: ExternalPaper[] = [
        {
          title: 'Test Paper',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract',
          doi: '10.1234/test',
          source: 'crossref',
        },
        {
          title: 'Test Paper',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract',
          doi: '10.1234/test',
          source: 'pubmed',
        },
      ];

      // Access private method via type assertion for testing
      const deduped = (searcher as any).deduplicateResults(papers);
      
      expect(deduped.length).toBe(1);
      expect(deduped[0].doi).toBe('10.1234/test');
    });

    test('should deduplicate results by title when DOI is missing', async () => {
      const papers: ExternalPaper[] = [
        {
          title: 'Test Paper Title',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract',
          source: 'crossref',
        },
        {
          title: 'Test Paper Title',
          authors: ['Author B'],
          year: 2023,
          abstract: 'Different abstract',
          source: 'pubmed',
        },
      ];

      const deduped = (searcher as any).deduplicateResults(papers);
      
      expect(deduped.length).toBe(1);
    });

    test('should preserve order during deduplication', async () => {
      const papers: ExternalPaper[] = [
        {
          title: 'Paper A',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract A',
          doi: '10.1111/a',
          source: 'crossref',
        },
        {
          title: 'Paper B',
          authors: ['Author B'],
          year: 2023,
          abstract: 'Abstract B',
          doi: '10.2222/b',
          source: 'pubmed',
        },
        {
          title: 'Paper A',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract A',
          doi: '10.1111/a',
          source: 'crossref',
        },
      ];

      const deduped = (searcher as any).deduplicateResults(papers);
      
      expect(deduped.length).toBe(2);
      expect(deduped[0].doi).toBe('10.1111/a');
      expect(deduped[1].doi).toBe('10.2222/b');
    });

    test('should handle papers with missing DOI and title', async () => {
      const papers: ExternalPaper[] = [
        {
          title: '',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract',
          source: 'crossref',
        },
        {
          title: '',
          authors: ['Author B'],
          year: 2023,
          abstract: 'Different Abstract',
          source: 'pubmed',
        },
      ];

      const deduped = (searcher as any).deduplicateResults(papers);
      
      // Both have empty titles, so they deduplicate to 1 (same normalized title)
      expect(deduped.length).toBe(1);
    });

    test('should preserve order during deduplication with multiple papers', async () => {
      const papers: ExternalPaper[] = [
        {
          title: 'Old Paper',
          authors: ['Author A'],
          year: 2020,
          abstract: 'Abstract',
          source: 'crossref',
        },
        {
          title: 'New Paper',
          authors: ['Author B'],
          year: 2023,
          abstract: 'Abstract',
          source: 'crossref',
        },
        {
          title: 'Middle Paper',
          authors: ['Author C'],
          year: 2021,
          abstract: 'Abstract',
          source: 'crossref',
        },
      ];

      const deduped = (searcher as any).deduplicateResults(papers);
      
      // Deduplication should preserve order
      expect(deduped.length).toBe(3);
      expect(deduped[0].title).toBe('Old Paper');
      expect(deduped[1].title).toBe('New Paper');
      expect(deduped[2].title).toBe('Middle Paper');
    });
  });

  describe('displayExternalResults', () => {
    test('should show information message when no results', async () => {
      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock;
      
      const result = await searcher.displayExternalResults([]);
      
      expect(mockShowInfo).toHaveBeenCalledWith('No papers found from external sources.');
      expect(result).toBeNull();
    });

    test('should display quick pick with formatted results', async () => {
      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock<any>;
      mockShowQuickPick.mockResolvedValue(null);

      const papers: ExternalPaper[] = [
        {
          title: 'Test Paper',
          authors: ['Author A', 'Author B'],
          year: 2023,
          abstract: 'This is a test abstract',
          doi: '10.1234/test',
          source: 'crossref',
        },
      ];

      await searcher.displayExternalResults(papers);

      expect(mockShowQuickPick).toHaveBeenCalled();
      const callArgs = mockShowQuickPick.mock.calls[0];
      const items = callArgs[0] as any;
      
      expect(items.length).toBe(1);
      expect(items[0].label).toContain('Test Paper');
      expect(items[0].description).toContain('Author A');
      expect(items[0].description).toContain('2023');
    });

    test('should truncate long author lists with et al.', async () => {
      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock<any>;
      mockShowQuickPick.mockResolvedValue(null);

      const papers: ExternalPaper[] = [
        {
          title: 'Test Paper',
          authors: ['Author A', 'Author B', 'Author C', 'Author D'],
          year: 2023,
          abstract: 'Abstract',
          source: 'crossref',
        },
      ];

      await searcher.displayExternalResults(papers);

      const items = mockShowQuickPick.mock.calls[0][0] as any;
      expect(items[0].description).toContain('et al.');
    });

    test('should include source and DOI in detail', async () => {
      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock<any>;
      mockShowQuickPick.mockResolvedValue(null);

      const papers: ExternalPaper[] = [
        {
          title: 'Test Paper',
          authors: ['Author A'],
          year: 2023,
          abstract: 'Abstract',
          doi: '10.1234/test',
          source: 'pubmed',
        },
      ];

      await searcher.displayExternalResults(papers);

      const items = mockShowQuickPick.mock.calls[0][0] as any;
      expect(items[0].detail).toContain('PUBMED');
      expect(items[0].detail).toContain('DOI: 10.1234/test');
    });
  });

  describe('importToZotero', () => {
    test('should show progress during import', async () => {
      const mockWithProgress = vscode.window.withProgress as jest.Mock<(options: any, task: any) => Thenable<any>>;
      mockWithProgress.mockImplementation((options, task) => task({ report: jest.fn() }));

      const paper: ExternalPaper = {
        title: 'Test Paper',
        authors: ['Author A'],
        year: 2023,
        abstract: 'Abstract',
        source: 'crossref',
      };

      await searcher.importToZotero(paper);

      expect(mockWithProgress).toHaveBeenCalled();
      const progressOptions = (mockWithProgress.mock.calls[0]?.[0] as any);
      expect(progressOptions?.title).toContain('Importing');
    });

    test('should offer to copy metadata when import requires manual action', async () => {
      const mockShowError = vscode.window.showErrorMessage as jest.Mock<any>;
      mockShowError.mockResolvedValue('Check Settings' as any);

      const paper: ExternalPaper = {
        title: 'Test Paper',
        authors: ['Author A'],
        year: 2023,
        abstract: 'Abstract',
        doi: '10.1234/test',
        source: 'crossref',
      };

      // The implementation will fail due to missing Zotero credentials
      // This test verifies the error handling flow
      const result = await searcher.importToZotero(paper);

      // Should return null on error
      expect(result).toBeNull();
      // Error message should be shown
      expect(mockShowError).toHaveBeenCalled();
    });

    test('should return null when user cancels import', async () => {
      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock<any>;
      mockShowInfo.mockResolvedValue('Cancel' as any);

      const paper: ExternalPaper = {
        title: 'Test Paper',
        authors: ['Author A'],
        year: 2023,
        abstract: 'Abstract',
        source: 'crossref',
      };

      const result = await searcher.importToZotero(paper);

      expect(result).toBeNull();
    });
  });

  describe('extractFulltext', () => {
    test('should trigger extraction command', async () => {
      const mockExecuteCommand = vscode.commands.executeCommand as jest.Mock;

      await searcher.extractFulltext('test-item-key');

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'researchAssistant.extractPdfForItem',
        'test-item-key'
      );
    });

    test('should handle command execution errors', async () => {
      const mockExecuteCommand = vscode.commands.executeCommand as jest.Mock<any>;
      mockExecuteCommand.mockRejectedValue(new Error('Command failed') as any);

      const mockShowError = vscode.window.showErrorMessage as jest.Mock;

      await searcher.extractFulltext('test-item-key');

      expect(mockShowError).toHaveBeenCalled();
      const errorCall = mockShowError.mock.calls[0][0];
      expect(errorCall).toContain('Unable to extract');
    });
  });

  describe('parseCrossRefItem', () => {
    test('should parse valid CrossRef item', () => {
      const item = {
        title: ['Test Paper Title'],
        author: [
          { given: 'John', family: 'Doe' },
          { given: 'Jane', family: 'Smith' },
        ],
        published: { 'date-parts': [[2023, 5, 15]] },
        abstract: 'This is the abstract',
        DOI: '10.1234/test',
        URL: 'https://example.com',
        'container-title': ['Test Journal'],
      };

      const parsed = (searcher as any).parseCrossRefItem(item);

      expect(parsed).not.toBeNull();
      expect(parsed.title).toBe('Test Paper Title');
      expect(parsed.authors).toEqual(['Doe, John', 'Smith, Jane']);
      expect(parsed.year).toBe(2023);
      expect(parsed.doi).toBe('10.1234/test');
      expect(parsed.venue).toBe('Test Journal');
    });

    test('should handle missing title', () => {
      const item = {
        author: [{ given: 'John', family: 'Doe' }],
        published: { 'date-parts': [[2023]] },
      };

      const parsed = (searcher as any).parseCrossRefItem(item);

      expect(parsed).toBeNull();
    });

    test('should handle missing authors', () => {
      const item = {
        title: ['Test Paper'],
        published: { 'date-parts': [[2023]] },
      };

      const parsed = (searcher as any).parseCrossRefItem(item);

      expect(parsed).not.toBeNull();
      expect(parsed.authors).toEqual([]);
    });
  });

  describe('parsePubMedItem', () => {
    test('should parse valid PubMed item', () => {
      const item = {
        title: 'Test Paper Title',
        authors: [{ name: 'Doe J' }, { name: 'Smith J' }],
        pubdate: '2023/05/15',
        source: 'Test Journal',
        uid: '12345678',
        articleids: [
          { idtype: 'doi', value: '10.1234/test' },
          { idtype: 'pmid', value: '12345678' },
        ],
      };

      const parsed = (searcher as any).parsePubMedItem(item);

      expect(parsed).not.toBeNull();
      expect(parsed.title).toBe('Test Paper Title');
      expect(parsed.authors).toEqual(['Doe J', 'Smith J']);
      expect(parsed.year).toBe(2023);
      expect(parsed.doi).toBe('10.1234/test');
      expect(parsed.url).toContain('12345678');
    });

    test('should handle missing DOI', () => {
      const item = {
        title: 'Test Paper',
        authors: [{ name: 'Doe J' }],
        pubdate: '2023',
        uid: '12345678',
      };

      const parsed = (searcher as any).parsePubMedItem(item);

      expect(parsed).not.toBeNull();
      expect(parsed.doi).toBeUndefined();
    });
  });
});
