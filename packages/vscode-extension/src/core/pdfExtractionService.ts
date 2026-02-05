import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as util from 'util';

const execFile = util.promisify(cp.execFile);
const exec = util.promisify(cp.exec);

export interface ExtractionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export class PDFExtractionService {
  private debug: boolean = true; // Set to false in production

  constructor(
    private readonly workspaceRoot: string
  ) { }

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
   * Check if docling is installed, prompt user if missing
   */
  public async ensureDoclingInstalled(): Promise<boolean> {
    try {
      if (this.debug) console.log('DEBUG: Checking for docling availability...');
      // Try to run docling --version to check availability
      await exec('docling --version');
      return true;
    } catch (error) {
      if (this.debug) console.log(`DEBUG: Docling check failed: ${error}`);

      // If command fails, prompt the user
      const choice = await vscode.window.showErrorMessage(
        'The "docling" tool is required to extract text from PDFs but was not found in your environment.',
        'Install Docling (uv)',
        'Cancel'
      );

      if (choice === 'Install Docling (uv)') {
        await this.installDocling();
        // Return false here because the user needs to wait for install to finish
        return false;
      }

      return false;
    }
  }

  /**
   * Open terminal to install docling via uv
   */
  private async installDocling(): Promise<void> {
    // Create a terminal to show the installation process to the user
    const terminal = vscode.window.createTerminal('Docling Installation');
    terminal.show();

    // Use uv tool install for isolated, globally available CLI installation
    // This is the recommended best practice for installing Python CLI tools with uv
    terminal.sendText('uv tool install docling');

    // Notify user
    await vscode.window.showInformationMessage(
      'Installing Docling via uv tool... Please wait for the terminal command to finish, then try extracting again.'
    );
  }

  /**
   * Extract text from a PDF using the local Docling CLI
   */
  public async extractText(pdfPath: string): Promise<ExtractionResult> {
    try {
      // 1. Dependency Check
      const isInstalled = await this.ensureDoclingInstalled();
      if (!isInstalled) {
        return {
          success: false,
          error: 'Docling is not installed or installation is pending.'
        };
      }

      // 2. File Validation
      if (!fs.existsSync(pdfPath)) {
        if (this.debug) console.log(`DEBUG: PDF not found at ${pdfPath}`);
        return {
          success: false,
          error: `PDF file not found: ${pdfPath}`
        };
      }

      // 3. Check if already extracted
      const extractedPath = this.getExtractedTextPath(pdfPath);
      if (fs.existsSync(extractedPath)) {
        if (this.debug) console.log(`DEBUG: Skipping extraction. File exists at ${extractedPath}`);
        return {
          success: true,
          outputPath: extractedPath,
          error: 'Text already extracted (file exists)'
        };
      }

      if (this.debug) console.log(`DEBUG: Starting extraction for ${pdfPath}`);

      // 4. Ensure Output Directory Exists
      const outputDir = path.dirname(extractedPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 5. Construct Docling Command
      // Command: docling <input_path> --output <output_dir> --to md
      const command = 'docling';
      const args = [
        pdfPath,
        '--output', outputDir,
        '--to', 'md' // Export format
      ];

      if (this.debug) console.log(`DEBUG: Running command: ${command} ${args.join(' ')}`);

      // 6. Execute Python Process
      const { stdout, stderr } = await execFile(command, args, {
        maxBuffer: 10 * 1024 * 1024,
        shell: process.platform === 'win32' // Needed on Windows to resolve .cmd/.exe shims
      });

      if (this.debug && stderr) console.log(`DEBUG: CLI Stderr: ${stderr}`);

      // 7. Verification
      if (fs.existsSync(extractedPath)) {
        if (this.debug) console.log(`DEBUG: Extraction successful. Created: ${extractedPath}`);
        return {
          success: true,
          outputPath: extractedPath
        };
      } else {
        if (this.debug) console.error(`DEBUG: Expected output file missing. CLI Output: ${stdout}`);
        return {
          success: false,
          error: 'Docling ran but the output file was not found. Check if the PDF is valid.'
        };
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (this.debug) console.error(`DEBUG: Extraction exception: ${msg}`);

      return {
        success: false,
        error: `Extraction failed: ${msg}`
      };
    }
  }

  /**
   * Extract text from a PDF URL (for open access papers)
   * Downloads the PDF temporarily, extracts text, then cleans up
   */
  public async extractFromUrl(pdfUrl: string, paperTitle: string): Promise<ExtractionResult> {
    const https = await import('https');
    const http = await import('http');
    
    // Sanitize title for filename
    const sanitizedTitle = paperTitle
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
    
    const tempPdfPath = path.join(this.workspaceRoot, 'literature', 'PDFs', `${sanitizedTitle}_temp.pdf`);
    const extractedPath = this.getExtractedTextPath(tempPdfPath);
    
    try {
      // Check if already extracted
      if (fs.existsSync(extractedPath)) {
        if (this.debug) console.log(`DEBUG: Text already extracted for ${paperTitle}`);
        return {
          success: true,
          outputPath: extractedPath
        };
      }
      
      // Ensure PDFs directory exists
      const pdfsDir = path.dirname(tempPdfPath);
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }
      
      if (this.debug) console.log(`DEBUG: Downloading PDF from ${pdfUrl}`);
      
      // Download PDF
      await new Promise<void>((resolve, reject) => {
        const protocol = pdfUrl.startsWith('https') ? https : http;
        const file = fs.createWriteStream(tempPdfPath);
        
        protocol.get(pdfUrl, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              file.close();
              const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
              redirectProtocol.get(redirectUrl, (redirectResponse) => {
                redirectResponse.pipe(file);
                file.on('finish', () => {
                  file.close();
                  resolve();
                });
              }).on('error', (err) => {
                fs.unlinkSync(tempPdfPath);
                reject(err);
              });
            } else {
              reject(new Error('Redirect without location header'));
            }
            return;
          }
          
          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(tempPdfPath);
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', (err) => {
          fs.unlinkSync(tempPdfPath);
          reject(err);
        });
        
        file.on('error', (err) => {
          file.close();
          fs.unlinkSync(tempPdfPath);
          reject(err);
        });
      });
      
      if (this.debug) console.log(`DEBUG: PDF downloaded, extracting text...`);
      
      // Extract text using existing method
      const result = await this.extractText(tempPdfPath);
      
      // Clean up temp PDF
      try {
        fs.unlinkSync(tempPdfPath);
        if (this.debug) console.log(`DEBUG: Cleaned up temp PDF`);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temp PDF: ${cleanupError}`);
      }
      
      return result;
      
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temp PDF after error: ${cleanupError}`);
        }
      }
      
      const msg = error instanceof Error ? error.message : String(error);
      if (this.debug) console.error(`DEBUG: URL extraction exception: ${msg}`);
      
      return {
        success: false,
        error: `Failed to extract from URL: ${msg}`
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

    // Process sequentially to avoid spawning too many Python processes (CPU/RAM heavy)
    for (let i = 0; i < pdfPaths.length; i++) {
      const pdfPath = pdfPaths[i];

      if (progressCallback) {
        progressCallback(i + 1, pdfPaths.length, path.basename(pdfPath));
      }

      const result = await this.extractText(pdfPath);
      results.set(pdfPath, result);

      // Brief pause to let system I/O settle
      if (i < pdfPaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
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