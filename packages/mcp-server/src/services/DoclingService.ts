import * as fs from 'fs';
import * as path from 'path';

export interface ExtractionResult {
  success: boolean;
  text?: string;
  outputPath?: string;
  error?: string;
}

export class DoclingService {
  private doclingAvailable: boolean = false;
  private DocumentConverter: any;

  constructor() {
    this.checkDoclingAvailability();
  }

  private checkDoclingAvailability(): void {
    try {
      // Try to import docling
      // Note: This requires docling to be installed in the environment
      // For now, we'll provide a graceful fallback
      this.doclingAvailable = false;
      console.warn('Docling library not available. Install with: pip install docling');
    } catch (error) {
      this.doclingAvailable = false;
    }
  }

  async extractPDF(pdfPath: string, outputPath?: string): Promise<ExtractionResult> {
    try {
      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`
        };
      }

      if (!this.doclingAvailable) {
        return {
          success: false,
          error: 'Docling library not available. Install with: pip install docling'
        };
      }

      // This would be the actual docling extraction
      // For now, returning a placeholder since docling is a Python library
      // In production, you'd either:
      // 1. Use child_process to call the Python script
      // 2. Use a Python bridge library
      // 3. Reimplement in TypeScript

      return {
        success: false,
        error: 'Docling extraction requires Python environment. Use extract_with_docling.py script or implement Python bridge.'
      };
    } catch (error) {
      return {
        success: false,
        error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract PDF using child process (calls Python script)
   */
  async extractPDFViaScript(pdfPath: string, outputPath?: string): Promise<ExtractionResult> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`
        };
      }

      // Determine output path
      const finalOutputPath = outputPath || this.getDefaultOutputPath(pdfPath);

      // Call Python script
      const args = ['--pdf', pdfPath, '--output', finalOutputPath];
      
      try {
        await execFileAsync('uv', ['run', 'python3', 'extract_with_docling.py', ...args]);
        
        // Read the extracted text
        if (fs.existsSync(finalOutputPath)) {
          const text = fs.readFileSync(finalOutputPath, 'utf-8');
          return {
            success: true,
            text,
            outputPath: finalOutputPath
          };
        }

        return {
          success: false,
          error: 'Extraction completed but output file not found'
        };
      } catch (error) {
        return {
          success: false,
          error: `Python script failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private getDefaultOutputPath(pdfPath: string): string {
    const basename = path.basename(pdfPath, path.extname(pdfPath));
    return path.join(path.dirname(pdfPath), '..', 'ExtractedText', `${basename}.md`);
  }
}
