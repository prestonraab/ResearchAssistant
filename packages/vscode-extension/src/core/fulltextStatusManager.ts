import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PDFExtractionService } from './pdfExtractionService';
import { OutlineParser } from './outlineParserWrapper';

/**
 * Status of fulltext availability for a Zotero item
 */
export interface FulltextStatus {
  itemKey: string;
  title: string;
  authors: string[];
  year: number;
  hasFulltext: boolean;
  extractedTextPath?: string;
  priority: number; // 0-100, based on relevance to current section
  pdfPath?: string;
}

/**
 * Progress callback for batch extraction
 */
export interface ExtractionProgress {
  current: number;
  total: number;
  currentFile: string;
  estimatedTimeRemaining?: number;
}

/**
 * Manages fulltext status detection and batch extraction
 * 
 * Features:
 * - Scans Zotero library for papers without extracted text
 * - Tracks fulltext availability status
 * - Batch extracts missing fulltexts with progress reporting
 * - Prioritizes papers by relevance to current manuscript section
 */
export class FulltextStatusManager {
  private fulltextStatuses: Map<string, FulltextStatus> = new Map();
  private lastScanTime: Date | null = null;
  private extractedTextPath: string;
  private pdfDir: string;

  constructor(
    private readonly pdfExtractionService: PDFExtractionService,
    private readonly outlineParser: OutlineParser,
    private readonly workspaceRoot: string
  ) {
    this.extractedTextPath = path.join(workspaceRoot, 'literature', 'ExtractedText');
    this.pdfDir = path.join(workspaceRoot, 'literature', 'PDFs');
  }

  /**
   * Scan Zotero library and local files to identify papers without fulltext
   */
  public async scanLibrary(): Promise<FulltextStatus[]> {
    try {
      // Scan local files directly since we're not using MCP anymore
      const statuses = this.scanLocalPDFs();
      
      for (const status of statuses) {
        this.fulltextStatuses.set(status.itemKey, status);
      }

      this.lastScanTime = new Date();
      return statuses;
    } catch (error) {
      console.error('Failed to scan library:', error);
      return [];
    }
  }

  /**
   * Scan local PDF directory for papers without extracted text
   */
  private scanLocalPDFs(): FulltextStatus[] {
    const statuses: FulltextStatus[] = [];
    const processedBasenames = new Set<string>();

    // First, scan PDFs directory
    if (fs.existsSync(this.pdfDir)) {
      const pdfFiles = fs.readdirSync(this.pdfDir)
        .filter(f => f.toLowerCase().endsWith('.pdf'));

      for (const pdfFile of pdfFiles) {
        const basename = path.basename(pdfFile, '.pdf');
        const pdfPath = path.join(this.pdfDir, pdfFile);
        
        // Check if extracted text exists
        const hasFulltext = this.checkLocalFulltext(basename);

        // Parse author-year from filename (e.g., "Smith2023.pdf")
        const match = basename.match(/^([A-Za-z]+)(\d{4})/);
        const author = match ? match[1] : basename;
        const year = match ? parseInt(match[2]) : new Date().getFullYear();

        statuses.push({
          itemKey: basename,
          title: basename,
          authors: [author],
          year,
          hasFulltext,
          extractedTextPath: hasFulltext ? this.getExtractedTextPath(basename) : undefined,
          priority: 50,
          pdfPath
        });
        
        processedBasenames.add(basename);
      }
    }

    // Also scan ExtractedText directory for files without PDFs
    if (fs.existsSync(this.extractedTextPath)) {
      const extractedFiles = fs.readdirSync(this.extractedTextPath)
        .filter(f => f.toLowerCase().endsWith('.txt') || f.toLowerCase().endsWith('.md'));

      for (const extractedFile of extractedFiles) {
        const basename = path.basename(extractedFile, path.extname(extractedFile));
        
        // Skip if already processed from PDF directory
        if (processedBasenames.has(basename)) {
          continue;
        }

        const extractedPath = path.join(this.extractedTextPath, extractedFile);
        const pdfPath = this.findPdfPath(basename);

        // Parse author-year from filename
        const match = basename.match(/^([A-Za-z]+)(\d{4})/);
        const author = match ? match[1] : basename;
        const year = match ? parseInt(match[2]) : new Date().getFullYear();

        statuses.push({
          itemKey: basename,
          title: basename,
          authors: [author],
          year,
          hasFulltext: true,
          extractedTextPath: extractedPath,
          priority: 50,
          pdfPath
        });
      }
    }

    return statuses;
  }

  /**
   * Check if extracted text exists locally for a given basename
   */
  private checkLocalFulltext(basename: string): boolean {
    const txtPath = path.join(this.extractedTextPath, `${basename}.txt`);
    const mdPath = path.join(this.extractedTextPath, `${basename}.md`);
    return fs.existsSync(txtPath) || fs.existsSync(mdPath);
  }

  /**
   * Get the path to extracted text for a basename
   */
  private getExtractedTextPath(basename: string): string | undefined {
    const txtPath = path.join(this.extractedTextPath, `${basename}.txt`);
    const mdPath = path.join(this.extractedTextPath, `${basename}.md`);
    
    if (fs.existsSync(txtPath)) {
      return txtPath;
    }
    if (fs.existsSync(mdPath)) {
      return mdPath;
    }
    return undefined;
  }

  /**
   * Find PDF path for a given basename
   */
  private findPdfPath(basename: string): string | undefined {
    const pdfPath = path.join(this.pdfDir, `${basename}.pdf`);
    return fs.existsSync(pdfPath) ? pdfPath : undefined;
  }

  /**
   * Get all papers missing fulltext
   */
  public getMissingFulltexts(): FulltextStatus[] {
    return Array.from(this.fulltextStatuses.values())
      .filter(status => !status.hasFulltext && status.pdfPath);
  }

  /**
   * Prioritize papers by relevance to current manuscript section
   */
  public async prioritizeBySection(sectionContext?: string): Promise<void> {
    if (!sectionContext) {
      // No context, use default priorities
      return;
    }

    // Simple keyword-based prioritization
    // In a real implementation, we'd use embeddings for semantic similarity
    const contextWords = new Set(
      sectionContext.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
    );

    for (const status of this.fulltextStatuses.values()) {
      const titleWords = status.title.toLowerCase().split(/\s+/);
      let matches = 0;

      for (const word of titleWords) {
        if (contextWords.has(word)) {
          matches++;
        }
      }

      // Priority: 0-100 based on word overlap
      status.priority = Math.min(100, (matches / contextWords.size) * 100);
    }
  }

  /**
   * Batch extract missing fulltexts with progress reporting
   */
  public async batchExtract(
    progressCallback?: (progress: ExtractionProgress) => void
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    errors: Array<{ file: string; error: string }>;
  }> {
    const missing = this.getMissingFulltexts();

    if (missing.length === 0) {
      return { total: 0, successful: 0, failed: 0, errors: [] };
    }

    // Sort by priority (highest first)
    missing.sort((a, b) => b.priority - a.priority);

    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    const errors: Array<{ file: string; error: string }> = [];

    for (let i = 0; i < missing.length; i++) {
      const status = missing[i];
      const current = i + 1;

      // Calculate estimated time remaining
      const elapsed = Date.now() - startTime;
      const avgTimePerFile = elapsed / current;
      const remaining = (missing.length - current) * avgTimePerFile;

      if (progressCallback) {
        progressCallback({
          current,
          total: missing.length,
          currentFile: status.title,
          estimatedTimeRemaining: Math.round(remaining / 1000) // seconds
        });
      }

      if (!status.pdfPath) {
        failed++;
        errors.push({
          file: status.title,
          error: 'PDF file not found'
        });
        continue;
      }

      try {
        const result = await this.pdfExtractionService.extractText(status.pdfPath);

        if (result.success) {
          successful++;
          // Update status
          status.hasFulltext = true;
          status.extractedTextPath = result.outputPath;
        } else {
          failed++;
          errors.push({
            file: status.title,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        failed++;
        errors.push({
          file: status.title,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Small delay to avoid overwhelming Docling MCP
      if (i < missing.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      total: missing.length,
      successful,
      failed,
      errors
    };
  }

  /**
   * Get fulltext status for a specific item
   */
  public getStatus(itemKey: string): FulltextStatus | undefined {
    return this.fulltextStatuses.get(itemKey);
  }

  /**
   * Get all fulltext statuses
   */
  public getAllStatuses(): FulltextStatus[] {
    return Array.from(this.fulltextStatuses.values());
  }

  /**
   * Get statistics about fulltext coverage
   */
  public getStatistics(): {
    total: number;
    withFulltext: number;
    missingFulltext: number;
    missingPdf: number;
    coveragePercentage: number;
  } {
    const all = this.getAllStatuses();
    const withFulltext = all.filter(s => s.hasFulltext).length;
    const missingFulltext = all.filter(s => !s.hasFulltext && s.pdfPath).length;
    const missingPdf = all.filter(s => !s.pdfPath).length;

    return {
      total: all.length,
      withFulltext,
      missingFulltext,
      missingPdf,
      coveragePercentage: all.length > 0 ? (withFulltext / all.length) * 100 : 0
    };
  }

  /**
   * Get time since last scan
   */
  public getLastScanTime(): Date | null {
    return this.lastScanTime;
  }

  /**
   * Clear cached statuses (force rescan on next call)
   */
  public clearCache(): void {
    this.fulltextStatuses.clear();
    this.lastScanTime = null;
  }
}
