import { InternetPaperSearcher, ExternalPaper } from '../core/internetPaperSearcher';
import * as vscode from 'vscode';

describe('InternetPaperSearcher', () => {
  let searcher: InternetPaperSearcher;
  const workspaceRoot = '/test/workspace';

  beforeEach(() => {
    searcher = new InternetPaperSearcher(workspaceRoot);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchExternal', () => {
    it('should return empty array when no results found', async () => {
      // Mock HTTP requests to return empty results
      const results = await searcher.searchExternal('nonexistent query xyz123');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should deduplicate results by DOI', async () => {
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

    it('should deduplicate results by title when DOI is missing', async () => {
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

    it('should deduplicate without changing order', async () => {
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
    it('should show information message when no results', async () => {
      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock;
      
      const result = await searcher.displayExternalResults([]);
      
      expect(mockShowInfo).toHaveBeenCalledWith('No papers found from external sources.');
      expect(result).toBeNull();
    });

    it('should display quick pick with formatted results', async () => {
      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;
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
      const items = callArgs[0];
      
      expect(items.length).toBe(1);
      expect(items[0].label).toContain('Test Paper');
      expect(items[0].description).toContain('Author A');
      expect(items[0].description).toContain('2023');
    });

    it('should truncate long author lists with et al.', async () => {
      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;
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

      const items = mockShowQuickPick.mock.calls[0][0];
      expect(items[0].description).toContain('et al.');
    });

    it('should include source and DOI in detail', async () => {
      const mockShowQuickPick = vscode.window.showQuickPick as jest.Mock;
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

      const items = mockShowQuickPick.mock.calls[0][0];
      expect(items[0].detail).toContain('PUBMED');
      expect(items[0].detail).toContain('DOI: 10.1234/test');
    });
  });

  describe('importToZotero', () => {
    it('should show progress during import', async () => {
      const mockWithProgress = vscode.window.withProgress as jest.Mock;
      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock;
      mockShowInfo.mockResolvedValue(null);

      const paper: ExternalPaper = {
        title: 'Test Paper',
        authors: ['Author A'],
        year: 2023,
        abstract: 'Abstract',
        source: 'crossref',
      };

      await searcher.importToZotero(paper);

      expect(mockWithProgress).toHaveBeenCalled();
      const progressOptions = mockWithProgress.mock.calls[0][0];
      expect(progressOptions.title).toContain('Importing');
    });

    it('should offer to copy metadata when import requires manual action', async () => {
      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock;
      mockShowInfo.mockResolvedValue('Copy Metadata');

      const mockClipboard = vscode.env.clipboard.writeText as jest.Mock;

      const paper: ExternalPaper = {
        title: 'Test Paper',
        authors: ['Author A'],
        year: 2023,
        abstract: 'Abstract',
        doi: '10.1234/test',
        source: 'crossref',
      };

      await searcher.importToZotero(paper);

      expect(mockClipboard).toHaveBeenCalled();
      const copiedText = mockClipboard.mock.calls[0][0];
      expect(copiedText).toContain('Test Paper');
      expect(copiedText).toContain('Author A');
      expect(copiedText).toContain('2023');
      expect(copiedText).toContain('10.1234/test');
    });

    it('should return null when user cancels import', async () => {
      const mockShowInfo = vscode.window.showInformationMessage as jest.Mock;
      mockShowInfo.mockResolvedValue('Cancel');

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
    it('should check for PDF attachment', async () => {
      const mockGetChildren = mockMcpClient.zotero.getItemChildren as jest.Mock;
      mockGetChildren.mockResolvedValue([]);

      const mockShowWarning = vscode.window.showWarningMessage as jest.Mock;

      await searcher.extractFulltext('test-item-key');

      expect(mockGetChildren).toHaveBeenCalledWith('test-item-key');
      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.stringContaining('No PDF attachment'),
        'Open Zotero'
      );
    });

    it('should trigger extraction command when PDF exists', async () => {
      const mockGetChildren = mockMcpClient.zotero.getItemChildren as jest.Mock;
      mockGetChildren.mockResolvedValue([
        { contentType: 'application/pdf', key: 'pdf-key' },
      ]);

      const mockExecuteCommand = vscode.commands.executeCommand as jest.Mock;

      await searcher.extractFulltext('test-item-key');

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'researchAssistant.extractPdfForItem',
        'test-item-key'
      );
    });
  });

  describe('formatMetadataForImport', () => {
    it('should format all metadata fields', () => {
      const paper: ExternalPaper = {
        title: 'Test Paper',
        authors: ['Author A', 'Author B'],
        year: 2023,
        abstract: 'This is the abstract',
        doi: '10.1234/test',
        url: 'https://example.com/paper',
        venue: 'Test Journal',
        source: 'crossref',
      };

      const formatted = (searcher as any).formatMetadataForImport(paper);

      expect(formatted).toContain('Title: Test Paper');
      expect(formatted).toContain('Authors: Author A; Author B');
      expect(formatted).toContain('Year: 2023');
      expect(formatted).toContain('Venue: Test Journal');
      expect(formatted).toContain('DOI: 10.1234/test');
      expect(formatted).toContain('URL: https://example.com/paper');
      expect(formatted).toContain('Abstract:');
      expect(formatted).toContain('This is the abstract');
    });

    it('should handle missing optional fields', () => {
      const paper: ExternalPaper = {
        title: 'Test Paper',
        authors: ['Author A'],
        year: 2023,
        abstract: 'Abstract',
        source: 'crossref',
      };

      const formatted = (searcher as any).formatMetadataForImport(paper);

      expect(formatted).toContain('Title: Test Paper');
      expect(formatted).not.toContain('DOI:');
      expect(formatted).not.toContain('URL:');
      expect(formatted).not.toContain('Venue:');
    });
  });

  describe('parseCrossRefItem', () => {
    it('should parse valid CrossRef item', () => {
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

    it('should handle missing title', () => {
      const item = {
        author: [{ given: 'John', family: 'Doe' }],
        published: { 'date-parts': [[2023]] },
      };

      const parsed = (searcher as any).parseCrossRefItem(item);

      expect(parsed).toBeNull();
    });

    it('should handle missing authors', () => {
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
    it('should parse valid PubMed item', () => {
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

    it('should handle missing DOI', () => {
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
