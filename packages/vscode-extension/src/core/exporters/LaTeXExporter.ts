import * as path from 'path';
import * as fs from 'fs';
import type { DocumentModel } from '../documentModel';
import type { ManuscriptExportOptions } from '../exportService';
import { LaTeXRenderer } from '../latexRenderer';
import { BibTeXGenerator } from './BibTeXGenerator';
import type { ZoteroApiService, ZoteroItem } from '../../services/zoteroApiService';

/**
 * Handles LaTeX (.tex) export functionality
 * Generates LaTeX documents with native footnotes and formatting
 * Also generates accompanying .bib file for citations
 */
export class LaTeXExporter {
  constructor(private zoteroApiService?: ZoteroApiService) {}

  /**
   * Export manuscript with marked citations as LaTeX (.tex) with native footnotes
   * 
   * - Calls buildDocumentModel with manuscript text and options
   * - Creates LaTeXRenderer instance and calls render
   * - Generates .bib file with BibTeX entries
   * - Writes string content to output path
   */
  public async exportManuscriptLatex(
    documentModel: DocumentModel,
    options: ManuscriptExportOptions
  ): Promise<string> {
    // Validate output path
    this.validateOutputPath(options.outputPath);

    // Create LaTeXRenderer instance and render
    const renderer = new LaTeXRenderer(documentModel);
    const content = renderer.render(documentModel);

    // Generate and write .bib file if citations exist
    if (documentModel.bibliography.length > 0) {
      await this.generateBibFile(documentModel, options.outputPath);
    }

    return content;
  }

  /**
   * Generate .bib file from bibliography entries
   */
  private async generateBibFile(
    documentModel: DocumentModel,
    texFilePath: string
  ): Promise<void> {
    if (!this.zoteroApiService || !this.zoteroApiService.isConfigured()) {
      // Fallback: generate basic .bib file without full metadata
      await this.generateBasicBibFile(documentModel, texFilePath);
      return;
    }

    try {
      // Extract citation keys from bibliography
      const citeKeys = new Set(
        documentModel.bibliography.map(entry => {
          // Try to extract key from source (e.g., "AuthorYear" or "ZOTEROKEY")
          return entry.source;
        })
      );

      // Fetch Zotero items
      const items = await this.zoteroApiService.getItems(100);
      
      // Filter items that match our citation keys
      const matchedItems = items.filter(item => citeKeys.has(item.key));
      
      // Create cite key map
      const citeKeyMap = new Map<string, string>();
      for (const item of matchedItems) {
        citeKeyMap.set(item.key, item.key);
      }

      // Generate BibTeX content
      const bibContent = BibTeXGenerator.generateBibFile(matchedItems, citeKeyMap);
      
      // Write .bib file
      const bibFilePath = texFilePath.replace(/\.tex$/, '.bib');
      await this.writeToFile(bibFilePath, bibContent);
    } catch (error) {
      console.warn('Failed to generate .bib file from Zotero:', error);
      // Fallback to basic generation
      await this.generateBasicBibFile(documentModel, texFilePath);
    }
  }

  /**
   * Generate basic .bib file without Zotero metadata
   */
  private async generateBasicBibFile(
    documentModel: DocumentModel,
    texFilePath: string
  ): Promise<void> {
    const entries: string[] = [];

    for (const entry of documentModel.bibliography) {
      const citeKey = entry.source;
      const year = entry.year || 'n.d.';
      
      // Create minimal BibTeX entry
      const bibEntry = `@misc{${citeKey},
  author = {Unknown},
  title = {${entry.source}},
  year = {${year}}
}`;
      entries.push(bibEntry);
    }

    const bibContent = entries.join('\n\n');
    const bibFilePath = texFilePath.replace(/\.tex$/, '.bib');
    await this.writeToFile(bibFilePath, bibContent);
  }

  /**
   * Write content to file
   */
  public async writeToFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Validate that the output path is writable
   * 
   * - Throws descriptive error for invalid paths
   */
  private validateOutputPath(outputPath: string): void {
    const dir = path.dirname(outputPath);

    // Check if directory exists, create if needed
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        throw new Error(
          `Cannot create output directory: ${dir}. ` +
          `Please ensure the path is valid and you have write permissions.`
        );
      }
    }

    // Check if directory is writable
    try {
      fs.accessSync(dir, fs.constants.W_OK);
    } catch (error) {
      throw new Error(
        `Output directory is not writable: ${dir}. ` +
        `Please check your file permissions.`
      );
    }
  }
}
