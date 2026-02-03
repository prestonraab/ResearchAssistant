import * as path from 'path';
import * as fs from 'fs';
import type { DocumentModel } from '../documentModel';
import type { ManuscriptExportOptions } from '../exportService';
import { WordRenderer } from '../wordRenderer';

/**
 * Handles Word (.docx) export functionality
 * Generates Word documents with native footnotes and formatting
 */
export class WordExporter {
  /**
   * Export manuscript with marked citations as Word (.docx) with native footnotes
   * 
   * - Calls buildDocumentModel with manuscript text and options
   * - Creates WordRenderer instance and calls render
   * - Writes buffer to output path using fs
   */
  public async exportManuscriptWord(
    manuscriptText: string,
    documentModel: DocumentModel,
    options: ManuscriptExportOptions
  ): Promise<Buffer> {
    // Validate output path
    this.validateOutputPath(options.outputPath);

    // Create WordRenderer instance and render
    const renderer = new WordRenderer(documentModel);
    const buffer = await renderer.render(documentModel);

    return buffer;
  }

  /**
   * Write a buffer to a file
   * 
   * Used by exportManuscriptWord to write .docx files
   */
  public async writeBufferToFile(filePath: string, buffer: Buffer): Promise<void> {
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);
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
