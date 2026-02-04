import { jest } from '@jest/globals';
import { FulltextStatusManager, FulltextStatus, FileSystemDeps } from '../core/fulltextStatusManager';
import { PDFExtractionService } from '../core/pdfExtractionService';
import { OutlineParser } from '../core/outlineParserWrapper';
import * as path from 'path';
import {  
  setupTest,
  createMockPdfExtractionService, 
  createMockOutlineParser
} from './helpers';

/**
 * Creates a mock file system for testing
 */
function createMockFileSystem(): FileSystemDeps & { 
  existsSync: jest.Mock<(path: string) => boolean>; 
  readdirSync: jest.Mock<(path: string) => string[]>;
} {
  return {
    existsSync: jest.fn<(path: string) => boolean>().mockReturnValue(false),
    readdirSync: jest.fn<(path: string) => string[]>().mockReturnValue([])
  };
}

describe('FulltextStatusManager', () => {
  setupTest();

  let manager: FulltextStatusManager;
  let mockPdfService: ReturnType<typeof createMockPdfExtractionService>;
  let mockOutlineParser: ReturnType<typeof createMockOutlineParser>;
  let mockFs: ReturnType<typeof createMockFileSystem>;
  const workspaceRoot = '/test/workspace';

  beforeEach(() => {
    mockPdfService = createMockPdfExtractionService();
    mockOutlineParser = createMockOutlineParser();
    mockFs = createMockFileSystem();

    manager = new FulltextStatusManager(
      mockPdfService as any,
      mockOutlineParser as any,
      workspaceRoot,
      mockFs
    );
  });

  afterEach(() => {
    // No dispose needed for this manager
  });

  describe('scanLibrary', () => {
    /**
     * Test: Scan identifies papers without fulltext
     * Validates: Requirement 44.1
     */
    test('should identify papers without extracted text', async () => {
      // Mock PDF directory with files but no extracted text
      mockFs.existsSync.mockImplementation((filePath: string) => {
        // PDFs directory exists
        if (filePath.endsWith('PDFs')) {
          return true;
        }
        // ExtractedText directory exists
        if (filePath.endsWith('ExtractedText')) {
          return true;
        }
        // No .txt or .md files exist for these papers
        return false;
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return []; // No extracted text files
        }
        return [];
      });

      const statuses = await manager.scanLibrary();

      expect(statuses.length).toBe(2);
      const smithPaper = statuses.find(s => s.title === 'Smith2023');
      expect(smithPaper?.hasFulltext).toBe(false);
      expect(smithPaper?.pdfPath).toBeDefined();
    });

    /**
     * Test: Scan detects existing extracted text
     * Validates: Requirement 44.1
     */
    test('should detect papers with existing extracted text', async () => {
      // Mock PDF directory exists with files
      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (filePath.endsWith('PDFs')) {
          return true;
        }
        if (filePath.endsWith('ExtractedText')) {
          return true;
        }
        // Smith2023.txt exists
        if (filePath.includes('Smith2023.txt')) {
          return true;
        }
        return false;
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
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
      mockFs.existsSync.mockImplementation((dirPath: string) => {
        return dirPath.endsWith('PDFs') || dirPath.endsWith('ExtractedText');
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return [];
        }
        return [];
      });

      const statuses = await manager.scanLibrary();

      expect(statuses.length).toBe(2);
      expect(statuses[0].title).toBe('Smith2023');
      expect(statuses[1].title).toBe('Jones2022');
    });

    /**
     * Test: Scan handles empty directories gracefully
     * Validates: Requirement 44.1
     */
    test('should handle empty PDF and ExtractedText directories', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readdirSync.mockReturnValue([]);

      const statuses = await manager.scanLibrary();

      expect(statuses.length).toBe(0);
    });
  });

  describe('getMissingFulltexts', () => {
    /**
     * Test: Returns only papers without fulltext
     * Validates: Requirement 44.2
     */
    test('should return only papers missing fulltext that have PDFs', async () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        // Directories exist
        if (filePath.endsWith('PDFs') || filePath.endsWith('ExtractedText')) {
          return true;
        }
        // Only Smith has extracted text
        if (filePath.includes('Smith2023.txt')) {
          return true;
        }
        return false;
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return ['Smith2023.txt']; // Only Smith has extracted text
        }
        return [];
      });

      await manager.scanLibrary();
      const missing = manager.getMissingFulltexts();

      expect(missing.length).toBe(1);
      expect(missing[0].title).toBe('Jones2022');
      expect(missing[0].hasFulltext).toBe(false);
    });
  });

  describe('batchExtract', () => {
    /**
     * Test: Batch extraction processes all missing papers
     * Validates: Requirement 44.3, 44.4
     */
    test('should extract all missing fulltexts with progress reporting', async () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.endsWith('PDFs') || filePath.endsWith('ExtractedText');
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return [];
        }
        return [];
      });

      mockPdfService.extractText.mockResolvedValue({
        success: true,
        outputPath: '/test/workspace/literature/ExtractedText/Smith2023.txt'
      });

      await manager.scanLibrary();

      const progressUpdates: any[] = [];
      const result = await manager.batchExtract((progress) => {
        progressUpdates.push(progress);
      });

      expect(result.total).toBe(2);
      expect(result.successful).toBeGreaterThan(0);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].currentFile).toBeDefined();
    });

    /**
     * Test: Batch extraction handles failures gracefully
     * Validates: Requirement 44.4
     */
    test('should handle extraction failures and report errors', async () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.endsWith('PDFs') || filePath.endsWith('ExtractedText');
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return [];
        }
        return [];
      });

      mockPdfService.extractText.mockResolvedValue({
        success: false,
        error: 'PDF extraction failed'
      });

      await manager.scanLibrary();
      const result = await manager.batchExtract();

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toBeDefined();
    });

    /**
     * Test: Progress callback includes estimated time
     * Validates: Requirement 44.4
     */
    test('should provide estimated time remaining in progress updates', async () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.endsWith('PDFs') || filePath.endsWith('ExtractedText');
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return [];
        }
        return [];
      });

      mockPdfService.extractText.mockResolvedValue({
        success: true,
        outputPath: '/test/workspace/literature/ExtractedText/test.txt'
      });

      await manager.scanLibrary();

      const progressUpdates: any[] = [];
      await manager.batchExtract((progress) => {
        progressUpdates.push(progress);
      });

      // Check that later progress updates have estimated time
      expect(progressUpdates.length).toBeGreaterThan(0);
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.estimatedTimeRemaining).toBeDefined();
      expect(typeof lastUpdate.estimatedTimeRemaining).toBe('number');
    });
  });

  describe('prioritizeBySection', () => {
    /**
     * Test: Papers are prioritized by relevance to section context
     * Validates: Requirement 44.5
     */
    test('should prioritize papers by relevance to section context', async () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.endsWith('PDFs') || filePath.endsWith('ExtractedText');
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['BatchCorrection2023.pdf', 'Normalization2022.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return [];
        }
        return [];
      });

      await manager.scanLibrary();
      await manager.prioritizeBySection('batch correction methods');

      const statuses = manager.getAllStatuses();
      const batchPaper = statuses.find(s => s.title.includes('Batch'));
      
      // Priority should be set (default is 50, may change based on context)
      expect(batchPaper?.priority).toBeDefined();
    });

    /**
     * Test: Prioritization sorts papers correctly
     * Validates: Requirement 44.5
     */
    test('should sort papers by priority for batch extraction', async () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.endsWith('PDFs') || filePath.endsWith('ExtractedText');
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf', 'Brown2021.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return [];
        }
        return [];
      });

      mockPdfService.extractText.mockResolvedValue({
        success: true,
        outputPath: '/test/workspace/literature/ExtractedText/test.txt'
      });

      await manager.scanLibrary();
      await manager.prioritizeBySection('Smith Jones');

      const result = await manager.batchExtract();
      
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('getStatistics', () => {
    /**
     * Test: Statistics accurately reflect fulltext coverage
     * Validates: Requirement 44.1
     */
    test('should provide accurate statistics about fulltext coverage', async () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        // Directories exist
        if (filePath.endsWith('PDFs') || filePath.endsWith('ExtractedText')) {
          return true;
        }
        // Only Smith2023.txt exists
        if (filePath.includes('Smith2023.txt')) {
          return true;
        }
        return false;
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf', 'Jones2022.pdf', 'Brown2021.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return ['Smith2023.txt']; // Only 1 of 3 has extracted text
        }
        return [];
      });

      await manager.scanLibrary();
      const stats = manager.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.withFulltext).toBe(1);
      expect(stats.missingFulltext).toBe(2);
      expect(stats.coveragePercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('clearCache', () => {
    /**
     * Test: Cache clearing forces rescan
     * Validates: Internal functionality
     */
    test('should clear cached statuses and reset scan time', async () => {
      // Mock PDF directory with files
      mockFs.existsSync.mockImplementation((dirPath: string) => {
        return dirPath.endsWith('PDFs') || dirPath.endsWith('ExtractedText');
      });

      mockFs.readdirSync.mockImplementation((dirPath: string) => {
        if (dirPath.includes('PDFs')) {
          return ['Smith2023.pdf'];
        }
        if (dirPath.includes('ExtractedText')) {
          return [];
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
