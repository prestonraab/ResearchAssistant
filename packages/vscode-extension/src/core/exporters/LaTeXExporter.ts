import * as path from 'path';
import * as fs from 'fs';
import type { DocumentModel } from '../documentModel';
import type { ManuscriptExportOptions } from '../exportService';
import { LaTeXRenderer } from '../latexRenderer';

/**
 * Handles LaTeX (.tex) export functionality
 * Generates LaTeX documents with native footnotes and formatting
 */
export class LaTeXExporter {
  /**
   * Export manuscript with marked citations as LaTeX (.tex) with native footnotes
   * 
   * - Calls buildDocumentModel with manuscript text and options
   * - Creates LaTeXRenderer instance and calls render
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

    return content;
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
