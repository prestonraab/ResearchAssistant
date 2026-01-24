import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MCPClientManager } from '../mcp/mcpClient';

export interface ExtractionResult {
  success: boolean;
  outputPath?: string;
  documentKey?: string;
  error?: string;
}

export class PDFExtractionService {
  constructor(
    private readonly mcpClient: MCPClientManager,
    private readonly workspaceRoot: string
  ) {}

  /**
   * Check if extracted text exists for a PDF file
   */
  public hasExtractedText(pdfPath: string): boolean {
    const extractedPath = this.getExtractedTextPath(pdfPath);
    return fs.existsSync(extractedPath);
  }

  /**
   * Get the path where extracted text should be stored
   */
  public getExtractedTextPath(pdfPath: string): string {
    const basename = path.basename(pdfPath, path.extname(pdfPath));
    const extractedTextDir = path.join(this.workspaceRoot, 'literature', 'ExtractedText');
    return path.join(extractedTextDir, `${basename}.md`);
  }

  /**
   * Extract text from a PDF using Docling MCP
   */
  public async extractText(pdfPath: string): Promise<ExtractionResult> {
    try {
      // Check if Docling MCP is available
      if (!this.mcpClient.isConnected('docling')) {
        return {
          success: false,
          error: 'Docling MCP server is not connected. Please check your MCP configuration.'
        };
      }

      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`
        };
      }

      // Check if already extracted
      const extractedPath = this.getExtractedTextPath(pdfPath);
      if (fs.existsSync(extractedPath)) {
        return {
          success: true,
          outputPath: extractedPath,
          error: 'Text already extracted (file exists)'
        };
      }

      // Convert document using Docling MCP
      const convertResult = await this.mcpClient.convertDocument(pdfPath);

      if (!convertResult) {
        return {
          success: false,
          error: 'Failed to convert document: No document key returned'
        };
      }

      // Export to markdown
      const markdown = await this.mcpClient.exportToMarkdown(convertResult);

      if (!markdown) {
        return {
          success: false,
          error: 'Failed to export document to markdown'
        };
      }

      // Ensure output directory exists
      const extractedTextDir = path.dirname(extractedPath);
      if (!fs.existsSync(extractedTextDir)) {
        fs.mkdirSync(extractedTextDir, { recursive: true });
      }

      // Write extracted text to file
      fs.writeFileSync(extractedPath, markdown, 'utf-8');

      return {
        success: true,
        outputPath: extractedPath,
        documentKey: convertResult
      };
    } catch (error) {
      return {
        success: false,
        error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract text from multiple PDFs in batch
   */
  public async extractBatch(
    pdfPaths: string[],
    progressCallback?: (current: number, total: number, file: string) => void
  ): Promise<Map<string, ExtractionResult>> {
    const results = new Map<string, ExtractionResult>();

    for (let i = 0; i < pdfPaths.length; i++) {
      const pdfPath = pdfPaths[i];
      
      if (progressCallback) {
        progressCallback(i + 1, pdfPaths.length, path.basename(pdfPath));
      }

      const result = await this.extractText(pdfPath);
      results.set(pdfPath, result);

      // Small delay to avoid overwhelming the MCP server
      if (i < pdfPaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Extract text from all PDFs in the literature/PDFs directory
   */
  public async extractAllPDFs(
    progressCallback?: (current: number, total: number, file: string) => void
  ): Promise<Map<string, ExtractionResult>> {
    const pdfsDir = path.join(this.workspaceRoot, 'literature', 'PDFs');

    if (!fs.existsSync(pdfsDir)) {
      throw new Error(`PDFs directory not found: ${pdfsDir}`);
    }

    // Find all PDF files
    const files = fs.readdirSync(pdfsDir);
    const pdfFiles = files
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(pdfsDir, f));

    if (pdfFiles.length === 0) {
      return new Map();
    }

    return this.extractBatch(pdfFiles, progressCallback);
  }

  /**
   * Get extraction status for all PDFs
   */
  public getExtractionStatus(): {
    total: number;
    extracted: number;
    pending: number;
    files: Array<{ path: string; extracted: boolean }>;
  } {
    const pdfsDir = path.join(this.workspaceRoot, 'literature', 'PDFs');

    if (!fs.existsSync(pdfsDir)) {
      return { total: 0, extracted: 0, pending: 0, files: [] };
    }

    const files = fs.readdirSync(pdfsDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    const fileStatus = pdfFiles.map(file => {
      const fullPath = path.join(pdfsDir, file);
      return {
        path: fullPath,
        extracted: this.hasExtractedText(fullPath)
      };
    });

    const extracted = fileStatus.filter(f => f.extracted).length;

    return {
      total: pdfFiles.length,
      extracted,
      pending: pdfFiles.length - extracted,
      files: fileStatus
    };
  }

  /**
   * Open extracted text file in editor
   */
  public async openExtractedText(pdfPath: string): Promise<void> {
    const extractedPath = this.getExtractedTextPath(pdfPath);

    if (!fs.existsSync(extractedPath)) {
      throw new Error(`Extracted text not found: ${extractedPath}`);
    }

    const document = await vscode.workspace.openTextDocument(extractedPath);
    await vscode.window.showTextDocument(document);
  }
}
