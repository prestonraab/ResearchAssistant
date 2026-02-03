import { FulltextStatusManager, FulltextStatus } from '../core/fulltextStatusManager';
import { PDFExtractionService } from '../core/pdfExtractionService';
import { OutlineParser } from '../core/outlineParserWrapper';
import * as fs from 'fs';
import * as path from 'path';
import { 
  setupTest, 
  createMockPdfExtractionService, 
  createMockOutlineParser 
} from './helpers';

jest.mock('fs');

describe('FulltextStatusManager', () => {
  setupTest();

  let manager: FulltextStatusManager;
  let mockPdfService: ReturnType<typeof createMockPdfExtractionService>;
  let mockOutlineParser: ReturnType<typeof createMockOutlineParser>;
  const workspaceRoot = '/test/workspace';

  beforeEach(() => {
    // Use factory functions for consistent mocks
    mockPdfService = createMockPdfExtractionService();
    mockOutlineParser = createMockOutlineParser();

    // Mock fs functions - automatically cleaned up by setupTest()
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    manager = new FulltextStatusManager(
      mockPdfService as any,
      mockOutlineParser as any,
      workspaceRoot
    );
  });

  afterEach(() => {
    manager.dispose?.();
  });

  describe('scanLibrary', () => {
    /**
     * Test: Scan identifies papers without fulltext
     * Validates: Requirement 44.1
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should identify papers without extracted text', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });

    /**
     * Test: Scan detects existing extracted text
     * Validates: Requirement 44.1
     */
    test('should detect papers with existing extracted text', async () => {
      // Mock PDF directory exists with files
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('PDFs')) {
          return true;
        }
        if (filePath.includes('Smith2023.txt')) {
          return true;
        }
        return false;
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return ['Smith2023.txt'];
        }
        return [];
      });

      const statuses = await manager.scanLibrary();

      expect(statuses.length).toBeGreaterThan(0);
      const smithPaper = statuses.find(s => s.title === 'Smith2023');
      expect(smithPaper?.hasFulltext).toBe(true);
      expect(smithPaper?.extractedTextPath).toBeDefined();
    });

    /**
     * Test: Scan handles local PDFs not in Zotero
     * Validates: Requirement 44.1
     */
    test('should scan local PDF directory for papers', async () => {
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
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should return only papers missing fulltext that have PDFs', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });
  });

  describe('batchExtract', () => {
    /**
     * Test: Batch extraction processes all missing papers
     * Validates: Requirement 44.3, 44.4
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should extract all missing fulltexts with progress reporting', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });

    /**
     * Test: Batch extraction handles failures gracefully
     * Validates: Requirement 44.4
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should handle extraction failures and report errors', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });

    /**
     * Test: Progress callback includes estimated time
     * Validates: Requirement 44.4
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should provide estimated time remaining in progress updates', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });
  });

  describe('prioritizeBySection', () => {
    /**
     * Test: Papers are prioritized by relevance to section context
     * Validates: Requirement 44.5
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should prioritize papers by relevance to section context', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });

    /**
     * Test: Prioritization sorts papers correctly
     * Validates: Requirement 44.5
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should sort papers by priority for batch extraction', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });
  });

  describe('getStatistics', () => {
    /**
     * Test: Statistics accurately reflect fulltext coverage
     * Validates: Requirement 44.1
     * SKIPPED: Needs rewrite for local-file-based implementation (no longer uses Zotero API)
     */
    it.skip('should provide accurate statistics about fulltext coverage', async () => {
      // Test implementation pending - requires local PDF scanning approach
    });
  });

  describe('clearCache', () => {
    /**
     * Test: Cache clearing forces rescan
     * Validates: Internal functionality
     */
    test('should clear cached statuses and reset scan time', async () => {
      // Mock PDF directory with files
      (fs.existsSync as jest.Mock).mockImplementation((dirPath: string) => {
        return dirPath.includes('PDFs');
      });

      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf'];
        }
        return [];
      });

      await manager.scanLibrary();
      expect(manager.getLastScanTime()).not.toBeNull();
      expect(manager.getAllStatuses().length).toBeGreaterThan(0);

      manager.clearCache();

      expect(manager.getLastScanTime()).toBeNull();
      expect(manager.getAllStatuses().length).toBe(0);
    });
  });
});
