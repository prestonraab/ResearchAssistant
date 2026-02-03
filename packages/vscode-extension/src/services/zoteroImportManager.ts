import * as vscode from 'vscode';
import { ZoteroApiService, ZoteroAnnotation } from './zoteroApiService';
import { FuzzyMatcher } from '../core/fuzzyMatcher';

/**
 * ZoteroImportManager - Imports Zotero highlights as quotes
 * 
 * Orchestrates the import of highlights from Zotero, coordinates fuzzy matching,
 * and creates quote records with Zotero metadata.
 */

export interface ImportResult {
  success: boolean;
  quotesCreated: number;
  quotesWithWarnings: number;
  errors: string[];
}

export class ZoteroImportManager {
  private zoteroApi: ZoteroApiService;
  private fuzzyMatcher: FuzzyMatcher;

  private getLogger() {
    try {
      const loggingService = require('../core/loggingService');
      return loggingService.getLogger();
    } catch (error) {
      return {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        dispose: () => {},
      };
    }
  }

  constructor(zoteroApi: ZoteroApiService) {
    this.zoteroApi = zoteroApi;
    this.fuzzyMatcher = new FuzzyMatcher();
  }

  /**
   * Check if Zotero API is available
   */
  async isZoteroAvailable(): Promise<boolean> {
    try {
      return await this.zoteroApi.testConnection();
    } catch (error) {
      this.getLogger().error('Zotero availability check failed:', error);
      return false;
    }
  }

  /**
   * Import all highlights from a paper's PDF attachment
   * @param itemKey - The Zotero item key for the paper
   * @param extractedText - The extracted text from the paper (for fuzzy matching)
   * @returns Import result with statistics
   */
  async importHighlights(itemKey: string, extractedText: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      quotesCreated: 0,
      quotesWithWarnings: 0,
      errors: [],
    };

    try {
      this.getLogger().info(`Starting import of highlights for item: ${itemKey}`);

      // Get highlights from Zotero
      const highlights = await this.zoteroApi.getHighlights(itemKey);

      if (highlights.length === 0) {
        this.getLogger().info('No highlights found for item');
        result.success = true;
        return result;
      }

      this.getLogger().info(`Found ${highlights.length} highlights to import`);

      // Process each highlight
      for (const highlight of highlights) {
        try {
          await this.importSingleHighlight(highlight, itemKey, extractedText);
          result.quotesCreated++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.getLogger().warn(`Failed to import highlight ${highlight.key}: ${errorMessage}`);
          result.errors.push(errorMessage);
          result.quotesWithWarnings++;
        }
      }

      result.success = true;
      this.getLogger().info(
        `Import completed: ${result.quotesCreated} quotes created, ${result.quotesWithWarnings} warnings`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.getLogger().error(`Import failed: ${errorMessage}`);
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Import a single highlight
   * @param highlight - The Zotero annotation data
   * @param itemKey - The Zotero item key
   * @param extractedText - The extracted text from the paper
   */
  async importSingleHighlight(
    highlight: ZoteroAnnotation,
    itemKey: string,
    extractedText: string
  ): Promise<void> {
    try {
      // Attempt fuzzy matching
      const matchResult = this.fuzzyMatcher.findMatch(
        highlight.text,
        extractedText,
        highlight.pageLabel ? parseInt(highlight.pageLabel) : undefined
      );

      if (!matchResult.matched) {
        this.getLogger().warn(
          `Fuzzy match failed for highlight ${highlight.key}, using original text`
        );
      }

      // TODO: Create quote in database with Zotero metadata
      // This would call QuoteManager.createQuoteWithZoteroMetadata()
      // For now, just log the result
      this.getLogger().info(
        `Imported highlight: key=${highlight.key}, matched=${matchResult.matched}, confidence=${matchResult.confidence}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.getLogger().error(`Failed to import single highlight: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get all papers with PDF attachments
   */
  async getPapersWithPdfs(): Promise<Array<{ key: string; title: string }>> {
    try {
      const items = await this.zoteroApi.getItems(100);
      const papersWithPdfs: Array<{ key: string; title: string }> = [];

      for (const item of items) {
        if (item.attachments && item.attachments.length > 0) {
          const hasPdf = item.attachments.some(a => a.contentType === 'application/pdf');
          if (hasPdf) {
            papersWithPdfs.push({
              key: item.key,
              title: item.title,
            });
          }
        }
      }

      return papersWithPdfs;
    } catch (error) {
      this.getLogger().error('Failed to get papers with PDFs:', error);
      return [];
    }
  }
}
