import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { Claim, OutlineSection } from '@research-assistant/core';
import { CoverageMetrics } from './coverageAnalyzer';
import { SentenceClaimQuoteLinkManager } from './sentenceClaimQuoteLinkManager';
import { ClaimsManager } from './claimsManagerWrapper';
import { SentenceParser } from '@research-assistant/core';
import type { DocumentModel } from './documentModel';
import { MarkdownExporter } from './exporters/MarkdownExporter';
import { WordExporter } from './exporters/WordExporter';
import { LaTeXExporter } from './exporters/LaTeXExporter';
import { CSVExporter } from './exporters/CSVExporter';
import { DocumentBuilder } from './exporters/DocumentBuilder';
import type { ZoteroApiService } from '../services/zoteroApiService';

export type ExportFormat = 'markdown' | 'csv' | 'json';

export interface ManuscriptExportOptions {
  outputPath: string;
  includeFootnotes?: boolean;
  includeBibliography?: boolean;
  footnoteStyle?: 'pandoc' | 'native'; // pandoc for markdown, native for Word
  footnoteScope?: 'document' | 'section'; // continuous or per-section numbering
  manuscriptId?: string; // Document URI for sentence ID generation
  enrichCitations?: boolean; // Fetch citation metadata from Zotero
}

export interface ExportOptions {
  format: ExportFormat;
  outputPath: string;
  includeMetadata?: boolean;
  filterBySection?: string;
  filterBySource?: string;
  filterByCategory?: string;
}

export interface CitedQuote {
  quoteText: string;
  source: string;
  year?: string;
  claimId: string;
  sentenceId: string;
  quoteIndex: number;
}

export class ExportService {
  private documentBuilder: DocumentBuilder;
  private markdownExporter: MarkdownExporter;
  private wordExporter: WordExporter;
  private csvExporter: CSVExporter;

  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager,
    private sentenceParser?: SentenceParser,
    private zoteroApiService?: ZoteroApiService
  ) {
    this.documentBuilder = new DocumentBuilder(
      sentenceClaimQuoteLinkManager,
      claimsManager,
      sentenceParser,
      zoteroApiService
    );
    this.markdownExporter = new MarkdownExporter(
      sentenceClaimQuoteLinkManager,
      claimsManager
    );
    this.wordExporter = new WordExporter();
    this.csvExporter = new CSVExporter();
  }

  /**
   * Export manuscript with marked citations as Markdown with Pandoc-style footnotes
   */
  public async exportManuscriptMarkdown(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<void> {
    const content = await this.markdownExporter.exportManuscriptMarkdown(manuscriptText, options);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Export manuscript with marked citations as Word (.docx) with native footnotes
   */
  public async exportManuscriptWord(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<void> {
    // Prefetch Zotero metadata for enriched citations if enabled
    if (options.enrichCitations !== false) {
      await this.documentBuilder.prefetchZoteroMetadata(manuscriptText);
    }
    
    const model = await this.documentBuilder.buildDocumentModel(manuscriptText, options);
    const buffer = await this.wordExporter.exportManuscriptWord(manuscriptText, model, options);
    await this.wordExporter.writeBufferToFile(options.outputPath, buffer);
  }

  /**
   * Export manuscript with marked citations as LaTeX (.tex) with native footnotes
   */
  public async exportManuscriptLatex(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<void> {
    // Prefetch Zotero metadata for enriched citations if enabled
    if (options.enrichCitations !== false) {
      await this.documentBuilder.prefetchZoteroMetadata(manuscriptText);
    }
    
    const model = await this.documentBuilder.buildDocumentModel(manuscriptText, options);
    const latexExporter = new LaTeXExporter(this.zoteroApiService);
    const content = await latexExporter.exportManuscriptLatex(model, options);
    await latexExporter.writeToFile(options.outputPath, content);
  }

  /**
   * Build a format-agnostic document model from manuscript text
   */
  public async buildDocumentModel(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<DocumentModel> {
    return this.documentBuilder.buildDocumentModel(manuscriptText, options);
  }

  /**
   * Export coverage analysis report
   */
  public async exportCoverageAnalysis(
    coverageMetrics: CoverageMetrics[],
    sections: OutlineSection[],
    options: ExportOptions
  ): Promise<void> {
    const content = this.generateCoverageReport(coverageMetrics, sections, options.format);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Export coverage report (convenience method)
   */
  public async exportCoverageReport(
    outputPath: string,
    format: 'markdown' | 'csv'
  ): Promise<void> {
    throw new Error('Use exportCoverageAnalysis with coverageMetrics and sections instead');
  }

  /**
   * Export claims list
   */
  public async exportClaims(
    claims: Claim[],
    options: ExportOptions
  ): Promise<void> {
    // Apply filters
    let filteredClaims = claims;

    if (options.filterBySection) {
      filteredClaims = filteredClaims.filter(c => 
        c.sections.includes(options.filterBySection!)
      );
    }

    if (options.filterBySource) {
      filteredClaims = filteredClaims.filter(c => 
        (c.primaryQuote?.source || '').toLowerCase().includes(options.filterBySource!.toLowerCase())
      );
    }

    if (options.filterByCategory) {
      filteredClaims = filteredClaims.filter(c => 
        c.category === options.filterByCategory
      );
    }

    const content = this.generateClaimsReport(filteredClaims, options.format, options.includeMetadata);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Export reading progress report
   */
  public async exportReadingProgress(
    readingStatuses: unknown[],
    options: ExportOptions
  ): Promise<void> {
    const content = this.generateReadingProgressReport(readingStatuses, options.format);
    await this.writeToFile(options.outputPath, content);
  }

  /**
   * Generate coverage report in specified format
   */
  private generateCoverageReport(
    metrics: CoverageMetrics[],
    sections: OutlineSection[],
    format: ExportFormat
  ): string {
    switch (format) {
      case 'markdown':
        return this.markdownExporter.generateCoverageMarkdown(metrics, sections);
      case 'csv':
        return this.csvExporter.generateCoverageCSV(metrics);
      case 'json':
        return JSON.stringify({ metrics, sections }, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate claims report in specified format
   */
  private generateClaimsReport(
    claims: Claim[],
    format: ExportFormat,
    includeMetadata: boolean = true
  ): string {
    switch (format) {
      case 'markdown':
        return this.markdownExporter.generateClaimsMarkdown(claims, includeMetadata);
      case 'csv':
        return this.csvExporter.generateClaimsCSV(claims);
      case 'json':
        return JSON.stringify(claims, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate reading progress report
   */
  private generateReadingProgressReport(
    statuses: unknown[],
    format: ExportFormat
  ): string {
    switch (format) {
      case 'markdown':
        return this.markdownExporter.generateReadingProgressMarkdown(statuses);
      case 'csv':
        return this.csvExporter.generateReadingProgressCSV(statuses);
      case 'json':
        return JSON.stringify(statuses, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Write content to file
   */
  private async writeToFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Prompt user for export location
   */
  public async promptForExportLocation(
    defaultFilename: string,
    format: ExportFormat
  ): Promise<string | undefined> {
    const extension = format === 'markdown' ? 'md' : format;
    
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFilename),
      filters: {
        [format.toUpperCase()]: [extension]
      }
    });

    return uri?.fsPath;
  }
}
