import * as vscode from 'vscode';
import { MCPClientManager } from '../mcp/mcpClient';
import { ClaimsManager } from './claimsManager';
import { OutlineParser } from './outlineParser';
import { PDFExtractionService } from './pdfExtractionService';
import { EmbeddingService } from './embeddingService';

export interface ImportProgress {
  stage: 'papers' | 'extraction' | 'analysis' | 'parsing' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  papersImported: number;
  textsExtracted: number;
  claimsParsed: number;
  sectionsAnalyzed: number;
  errors: string[];
}

/**
 * Service for bulk importing papers from Zotero, extracting text, and analyzing outline
 * Requirements: 39.1, 39.2, 39.3, 39.4, 39.5
 */
export class BulkImportService {
  private mcpClient: MCPClientManager;
  private claimsManager: ClaimsManager;
  private outlineParser: OutlineParser;
  private pdfExtractionService: PDFExtractionService;
  private embeddingService: EmbeddingService;
  private progressCallback?: (progress: ImportProgress) => void;

  constructor(
    mcpClient: MCPClientManager,
    claimsManager: ClaimsManager,
    outlineParser: OutlineParser,
    pdfExtractionService: PDFExtractionService,
    embeddingService: EmbeddingService
  ) {
    this.mcpClient = mcpClient;
    this.claimsManager = claimsManager;
    this.outlineParser = outlineParser;
    this.pdfExtractionService = pdfExtractionService;
    this.embeddingService = embeddingService;
  }

  /**
   * Set callback for progress updates
   */
  setProgressCallback(callback: (progress: ImportProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Import papers from Zotero library in batch
   * Requirements: 39.1, 39.2
   */
  async importPapersFromZotero(
    collectionKey?: string,
    limit?: number
  ): Promise<ImportResult> {
    const result: ImportResult = {
      papersImported: 0,
      textsExtracted: 0,
      claimsParsed: 0,
      sectionsAnalyzed: 0,
      errors: []
    };

    try {
      // Stage 1: Import papers from Zotero
      this.reportProgress({
        stage: 'papers',
        current: 0,
        total: 0,
        message: 'Fetching papers from Zotero...'
      });

      let papers;
      if (collectionKey) {
        papers = await this.mcpClient.zotero.getCollectionItems(collectionKey, limit);
      } else {
        // Get recent papers if no collection specified
        papers = await this.mcpClient.zotero.getRecent(limit || 50);
      }

      result.papersImported = papers.length;

      // Stage 2: Extract text from PDFs
      this.reportProgress({
        stage: 'extraction',
        current: 0,
        total: papers.length,
        message: 'Extracting text from PDFs...'
      });

      for (let i = 0; i < papers.length; i++) {
        const paper = papers[i];
        
        try {
          // Check if paper has attachments
          const children = await this.mcpClient.zotero.getItemChildren(paper.key);
          const pdfAttachment = children.find((child: any) => 
            child.data?.contentType === 'application/pdf'
          );

          if (pdfAttachment) {
            // Extract text using Docling MCP
            const extractResult = await this.pdfExtractionService.extractText(
              pdfAttachment.data.path || pdfAttachment.data.filename
            );

            if (extractResult.success && extractResult.outputPath) {
              result.textsExtracted++;
            }
          }
        } catch (error) {
          result.errors.push(`Failed to extract PDF for ${paper.data.title}: ${error}`);
        }

        this.reportProgress({
          stage: 'extraction',
          current: i + 1,
          total: papers.length,
          message: `Extracted ${result.textsExtracted} of ${papers.length} papers`
        });
      }

      // Stage 3: Analyze existing outline
      this.reportProgress({
        stage: 'analysis',
        current: 0,
        total: 1,
        message: 'Analyzing outline structure...'
      });

      const sections = await this.outlineParser.parse();
      result.sectionsAnalyzed = sections.length;

      // Generate embeddings for sections to enable paper-to-section mapping
      for (const section of sections) {
        const sectionText = `${section.title} ${section.content.join(' ')}`;
        await this.embeddingService.generateEmbedding(sectionText);
      }

      this.reportProgress({
        stage: 'analysis',
        current: 1,
        total: 1,
        message: `Analyzed ${sections.length} outline sections`
      });

      // Stage 4: Parse existing claims database
      this.reportProgress({
        stage: 'parsing',
        current: 0,
        total: 1,
        message: 'Parsing existing claims database...'
      });

      const claims = await this.claimsManager.loadClaims();
      result.claimsParsed = claims.length;

      // Generate embeddings for claims to enable similarity search
      for (const claim of claims) {
        await this.embeddingService.generateEmbedding(claim.text);
      }

      this.reportProgress({
        stage: 'parsing',
        current: 1,
        total: 1,
        message: `Parsed ${claims.length} existing claims`
      });

      // Stage 5: Complete
      this.reportProgress({
        stage: 'complete',
        current: 1,
        total: 1,
        message: 'Import complete!'
      });

      return result;

    } catch (error) {
      result.errors.push(`Bulk import failed: ${error}`);
      throw error;
    }
  }

  /**
   * Suggest initial paper-to-section mappings based on semantic similarity
   * Requirements: 39.3
   */
  async suggestPaperMappings(
    papers: any[],
    sections: any[]
  ): Promise<Map<string, string[]>> {
    const mappings = new Map<string, string[]>();

    for (const paper of papers) {
      const paperText = `${paper.data.title} ${paper.data.abstractNote || ''}`;
      const paperEmbedding = await this.embeddingService.generateEmbedding(paperText);

      const sectionScores: Array<{ sectionId: string; score: number }> = [];

      for (const section of sections) {
        const sectionText = `${section.title} ${section.content.join(' ')}`;
        const sectionEmbedding = await this.embeddingService.generateEmbedding(sectionText);

        const similarity = this.embeddingService.cosineSimilarity(
          paperEmbedding,
          sectionEmbedding
        );

        sectionScores.push({ sectionId: section.id, score: similarity });
      }

      // Sort by similarity and take top 3
      sectionScores.sort((a, b) => b.score - a.score);
      const topSections = sectionScores.slice(0, 3).map(s => s.sectionId);

      mappings.set(paper.key, topSections);
    }

    return mappings;
  }

  /**
   * Import papers from a specific Zotero collection
   * Requirements: 39.1
   */
  async importFromCollection(collectionKey: string): Promise<ImportResult> {
    return this.importPapersFromZotero(collectionKey);
  }

  /**
   * Import recent papers from Zotero
   * Requirements: 39.1
   */
  async importRecentPapers(limit: number = 50): Promise<ImportResult> {
    return this.importPapersFromZotero(undefined, limit);
  }

  /**
   * Extract text from all PDFs in a directory
   * Requirements: 39.2
   */
  async extractAllPDFs(pdfDirectory: string): Promise<number> {
    let extracted = 0;

    try {
      const fs = require('fs');
      const path = require('path');

      if (!fs.existsSync(pdfDirectory)) {
        throw new Error(`PDF directory not found: ${pdfDirectory}`);
      }

      const files = fs.readdirSync(pdfDirectory);
      const pdfFiles = files.filter((file: string) => file.toLowerCase().endsWith('.pdf'));

      this.reportProgress({
        stage: 'extraction',
        current: 0,
        total: pdfFiles.length,
        message: `Extracting ${pdfFiles.length} PDFs...`
      });

      for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i];
        const pdfPath = path.join(pdfDirectory, pdfFile);

        try {
          const extractResult = await this.pdfExtractionService.extractText(pdfPath);

          if (extractResult.success) {
            extracted++;
          }
        } catch (error) {
          console.error(`Failed to extract ${pdfFile}:`, error);
        }

        this.reportProgress({
          stage: 'extraction',
          current: i + 1,
          total: pdfFiles.length,
          message: `Extracted ${extracted} of ${pdfFiles.length} PDFs`
        });
      }

      return extracted;

    } catch (error) {
      console.error('Failed to extract PDFs:', error);
      throw error;
    }
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: ImportProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}
