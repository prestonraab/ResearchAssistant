import { FulltextStatusManager, FulltextStatus } from '../core/fulltextStatusManager';
import { MCPClientManager, ZoteroItem } from '../mcp/mcpClient';
import { PDFExtractionService } from '../core/pdfExtractionService';
import { OutlineParser } from '../core/outlineParserWrapper';
import * as fs from 'fs';
import * as path from 'path';

describe('FulltextStatusManager', () => {
  let manager: FulltextStatusManager;
  let mockMcpClient: jest.Mocked<MCPClientManager>;
  let mockPdfService: jest.Mocked<PDFExtractionService>;
  let mockOutlineParser: jest.Mocked<OutlineParser>;
  let mockGetRecent: jest.Mock;
  let mockExtractText: jest.Mock;
  const workspaceRoot = '/test/workspace';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create individual mock functions
    mockGetRecent = jest.fn();
    mockExtractText = jest.fn();

    // Create mock instances with proper jest.fn() mocks
    mockMcpClient = {
      zotero: {
        getRecent: mockGetRecent,
        getItemChildren: jest.fn(),
        semanticSearch: jest.fn(),
      },
    } as any;

    mockPdfService = {
      extractText: mockExtractText,
      hasExtractedText: jest.fn(),
      getExtractedTextPath: jest.fn(),
    } as any;

    mockOutlineParser = {} as any;

    // Mock fs.existsSync
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    manager = new FulltextStatusManager(
      mockMcpClient,
      mockPdfService,
      mockOutlineParser,
      workspaceRoot
    );
  });

  describe('scanLibrary', () => {
    /**
     * Test: Scan identifies papers without fulltext
     * Validates: Requirement 44.1
     */
    it('should identify papers without extracted text', async () => {
      const mockItems: ZoteroItem[] = [
        {
          itemKey: 'item1',
          title: 'Test Paper 1',
          authors: ['Smith'],
          year: 2023,
        },
        {
          itemKey: 'item2',
          title: 'Test Paper 2',
          authors: ['Jones'],
          year: 2022,
        },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      // Mock that no extracted text exists
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const statuses = await manager.scanLibrary();

      expect(statuses.length).toBe(2);
      expect(statuses[0].hasFulltext).toBe(false);
      expect(statuses[1].hasFulltext).toBe(false);
    });

    /**
     * Test: Scan detects existing extracted text
     * Validates: Requirement 44.1
     */
    it('should detect papers with existing extracted text', async () => {
      const mockItems: ZoteroItem[] = [
        {
          itemKey: 'item1',
          title: 'Test Paper',
          authors: ['Smith'],
          year: 2023,
        },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      // Mock that extracted text exists
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('Smith2023.txt');
      });

      const statuses = await manager.scanLibrary();

      expect(statuses.length).toBe(1);
      expect(statuses[0].hasFulltext).toBe(true);
      expect(statuses[0].extractedTextPath).toBeDefined();
    });

    /**
     * Test: Scan handles local PDFs not in Zotero
     * Validates: Requirement 44.1
     */
    it('should scan local PDF directory for papers not in Zotero', async () => {
      mockGetRecent.mockResolvedValue([]);

      // Mock PDF directory exists with files
      (fs.existsSync as jest.Mock).mockImplementation((dirPath: string) => {
        return dirPath.includes('PDFs');
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf'];
        }
        return [];
      });

      const statuses = await manager.scanLibrary();

      expect(statuses.length).toBe(2);
      expect(statuses[0].title).toBe('Smith2023');
      expect(statuses[1].title).toBe('Jones2022');
    });
  });

  describe('getMissingFulltexts', () => {
    /**
     * Test: Returns only papers without fulltext
     * Validates: Requirement 44.2
     */
    it('should return only papers missing fulltext that have PDFs', async () => {
      const mockItems: ZoteroItem[] = [
        {
          itemKey: 'item1',
          title: 'Paper With Text',
          authors: ['Smith'],
          year: 2023,
        },
        {
          itemKey: 'item2',
          title: 'Paper Without Text',
          authors: ['Jones'],
          year: 2022,
        },
        {
          itemKey: 'item3',
          title: 'Paper No PDF',
          authors: ['Brown'],
          year: 2021,
        },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      // Mock: Smith2023 has text, Jones2022 has PDF but no text, Brown2021 has neither
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('Smith2023')) {
          return true; // Has extracted text or PDF
        }
        if (filePath.includes('Jones2022.pdf')) {
          return true; // Has PDF
        }
        if (filePath.includes('Jones2022.txt') || filePath.includes('Jones2022.md')) {
          return false; // No extracted text
        }
        return false;
      });

      await manager.scanLibrary();
      const missing = manager.getMissingFulltexts();

      expect(missing.length).toBe(1);
      expect(missing[0].title).toBe('Paper Without Text');
      expect(missing[0].hasFulltext).toBe(false);
      expect(missing[0].pdfPath).toBeDefined();
    });
  });

  describe('batchExtract', () => {
    /**
     * Test: Batch extraction processes all missing papers
     * Validates: Requirement 44.3, 44.4
     */
    it('should extract all missing fulltexts with progress reporting', async () => {
      // Setup: 3 papers without fulltext
      const mockItems: ZoteroItem[] = [
        { itemKey: 'item1', title: 'Paper 1', authors: ['Smith'], year: 2023 },
        { itemKey: 'item2', title: 'Paper 2', authors: ['Jones'], year: 2022 },
        { itemKey: 'item3', title: 'Paper 3', authors: ['Brown'], year: 2021 },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      // Mock: All have PDFs but no extracted text
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('.pdf')) {
          return true;
        }
        return false;
      });

      await manager.scanLibrary();

      // Mock successful extraction
      mockExtractText.mockResolvedValue({
        success: true,
        outputPath: '/test/output.txt',
      });

      const progressUpdates: any[] = [];
      const result = await manager.batchExtract((progress) => {
        progressUpdates.push(progress);
      });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(progressUpdates.length).toBe(3);
      expect(progressUpdates[0].current).toBe(1);
      expect(progressUpdates[2].current).toBe(3);
      expect(mockExtractText).toHaveBeenCalledTimes(3);
    });

    /**
     * Test: Batch extraction handles failures gracefully
     * Validates: Requirement 44.4
     */
    it('should handle extraction failures and report errors', async () => {
      const mockItems: ZoteroItem[] = [
        { itemKey: 'item1', title: 'Paper 1', authors: ['Smith'], year: 2023 },
        { itemKey: 'item2', title: 'Paper 2', authors: ['Jones'], year: 2022 },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('.pdf');
      });

      await manager.scanLibrary();

      // Mock: First succeeds, second fails
      mockPdfService.extractText
        .mockResolvedValueOnce({ success: true, outputPath: '/test/output1.txt' })
        .mockResolvedValueOnce({ success: false, error: 'Extraction failed' });

      const result = await manager.batchExtract();

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toBe('Extraction failed');
    });

    /**
     * Test: Progress callback includes estimated time
     * Validates: Requirement 44.4
     */
    it('should provide estimated time remaining in progress updates', async () => {
      const mockItems: ZoteroItem[] = [
        { itemKey: 'item1', title: 'Paper 1', authors: ['Smith'], year: 2023 },
        { itemKey: 'item2', title: 'Paper 2', authors: ['Jones'], year: 2022 },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('.pdf');
      });

      await manager.scanLibrary();

      mockExtractText.mockResolvedValue({
        success: true,
        outputPath: '/test/output.txt',
      });

      const progressUpdates: any[] = [];
      await manager.batchExtract((progress) => {
        progressUpdates.push(progress);
      });

      // Second update should have estimated time
      expect(progressUpdates[1].estimatedTimeRemaining).toBeDefined();
      expect(typeof progressUpdates[1].estimatedTimeRemaining).toBe('number');
    });
  });

  describe('prioritizeBySection', () => {
    /**
     * Test: Papers are prioritized by relevance to section context
     * Validates: Requirement 44.5
     */
    it('should prioritize papers by relevance to section context', async () => {
      const mockItems: ZoteroItem[] = [
        { itemKey: 'item1', title: 'Machine Learning Methods', authors: ['Smith'], year: 2023 },
        { itemKey: 'item2', title: 'Database Systems', authors: ['Jones'], year: 2022 },
        { itemKey: 'item3', title: 'Neural Networks and Learning', authors: ['Brown'], year: 2021 },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('.pdf');
      });

      await manager.scanLibrary();

      // Prioritize by section about machine learning
      const sectionContext = 'machine learning neural networks deep learning methods';
      await manager.prioritizeBySection(sectionContext);

      const missing = manager.getMissingFulltexts();
      
      // Papers with "machine learning" and "neural networks" should have higher priority
      const mlPaper = missing.find(p => p.title.includes('Machine Learning'));
      const nnPaper = missing.find(p => p.title.includes('Neural Networks'));
      const dbPaper = missing.find(p => p.title.includes('Database'));

      expect(mlPaper?.priority).toBeGreaterThan(dbPaper?.priority || 0);
      expect(nnPaper?.priority).toBeGreaterThan(dbPaper?.priority || 0);
    });

    /**
     * Test: Prioritization sorts papers correctly
     * Validates: Requirement 44.5
     */
    it('should sort papers by priority for batch extraction', async () => {
      const mockItems: ZoteroItem[] = [
        { itemKey: 'item1', title: 'Relevant Paper', authors: ['Smith'], year: 2023 },
        { itemKey: 'item2', title: 'Unrelated Paper', authors: ['Jones'], year: 2022 },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes('.pdf');
      });

      await manager.scanLibrary();
      await manager.prioritizeBySection('relevant important');

      mockExtractText.mockResolvedValue({
        success: true,
        outputPath: '/test/output.txt',
      });

      const extractionOrder: string[] = [];
      mockExtractText.mockImplementation(async (pdfPath: string) => {
        extractionOrder.push(path.basename(pdfPath));
        return { success: true, outputPath: '/test/output.txt' };
      });

      await manager.batchExtract();

      // Relevant paper should be extracted first (higher priority)
      expect(extractionOrder[0]).toContain('Smith2023');
    });
  });

  describe('getStatistics', () => {
    /**
     * Test: Statistics accurately reflect fulltext coverage
     * Validates: Requirement 44.1
     */
    it('should provide accurate statistics about fulltext coverage', async () => {
      const mockItems: ZoteroItem[] = [
        { itemKey: 'item1', title: 'Paper 1', authors: ['Smith'], year: 2023 },
        { itemKey: 'item2', title: 'Paper 2', authors: ['Jones'], year: 2022 },
        { itemKey: 'item3', title: 'Paper 3', authors: ['Brown'], year: 2021 },
        { itemKey: 'item4', title: 'Paper 4', authors: ['Davis'], year: 2020 },
      ];

      mockGetRecent.mockResolvedValue(mockItems);

      // Mock: 2 with fulltext, 1 with PDF but no text, 1 with neither
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('Smith2023') || filePath.includes('Jones2022')) {
          return true; // Has fulltext
        }
        if (filePath.includes('Brown2021.pdf')) {
          return true; // Has PDF only
        }
        return false;
      });

      await manager.scanLibrary();
      const stats = manager.getStatistics();

      expect(stats.total).toBe(4);
      expect(stats.withFulltext).toBe(2);
      expect(stats.missingFulltext).toBe(1);
      expect(stats.coveragePercentage).toBe(50);
    });
  });

  describe('clearCache', () => {
    /**
     * Test: Cache clearing forces rescan
     * Validates: Internal functionality
     */
    it('should clear cached statuses and reset scan time', async () => {
      const mockItems: ZoteroItem[] = [
        { itemKey: 'item1', title: 'Paper 1', authors: ['Smith'], year: 2023 },
      ];

      mockGetRecent.mockResolvedValue(mockItems);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await manager.scanLibrary();
      expect(manager.getLastScanTime()).not.toBeNull();
      expect(manager.getAllStatuses().length).toBe(1);

      manager.clearCache();

      expect(manager.getLastScanTime()).toBeNull();
      expect(manager.getAllStatuses().length).toBe(0);
    });
  });
});
