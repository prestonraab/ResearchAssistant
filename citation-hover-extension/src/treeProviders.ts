import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ClaimData {
  id: string;
  title: string;
  category: string;
  source: string;
  context: string;
  primaryQuote: string;
  verified?: boolean;
  similarity?: number;
  nearestMatch?: string;
  contextBefore?: string;
  contextAfter?: string;
  error?: string;
}

// Claims Tree Provider
export class ClaimsTreeProvider implements vscode.TreeDataProvider<ClaimTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ClaimTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ClaimTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ClaimTreeItem): Promise<ClaimTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return element.children || [];
  }

  private async getRootItems(): Promise<ClaimTreeItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('citationHover');
    const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
    const fullPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);

    if (!fs.existsSync(fullPath)) {
      return [new ClaimTreeItem('Claims file not found', vscode.TreeItemCollapsibleState.None)];
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const claims = this.parseClaims(content);

    // Group by category or just return flat list
    return claims;
  }

  private parseClaims(content: string): ClaimTreeItem[] {
    const claims: ClaimTreeItem[] = [];
    const claimRegex = /## (C_\d+): (.+?)$/gm;
    let match;

    while ((match = claimRegex.exec(content)) !== null) {
      const id = match[1];
      const title = match[2].trim();
      
      const item = new ClaimTreeItem(
        `${id}: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`,
        vscode.TreeItemCollapsibleState.None
      );
      
      item.command = {
        command: 'citationHover.jumpToClaim',
        title: 'Jump to Claim',
        arguments: [id]
      };
      
      item.contextValue = 'claim';
      item.iconPath = new vscode.ThemeIcon('file-text');
      
      claims.push(item);
    }

    return claims;
  }
}

class ClaimTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children?: ClaimTreeItem[]
  ) {
    super(label, collapsibleState);
  }
}

// Sources Tree Provider
export class SourcesTreeProvider implements vscode.TreeDataProvider<SourceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SourceTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SourceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SourceTreeItem): Promise<SourceTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return element.children || [];
  }

  private async getRootItems(): Promise<SourceTreeItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('citationHover');
    const zoteroStoragePath = config.get<string>('zoteroStoragePath', '~/Zotero/storage');
    const extractedTextPath = config.get<string>('extractedTextPath', 'literature/ExtractedText');
    
    const expandedZoteroPath = zoteroStoragePath.replace('~', require('os').homedir());
    const fullExtractedPath = path.join(workspaceFolders[0].uri.fsPath, extractedTextPath);

    const items: SourceTreeItem[] = [];

    // Get extracted text filenames for matching
    const extractedFiles = new Set<string>();
    if (fs.existsSync(fullExtractedPath)) {
      fs.readdirSync(fullExtractedPath)
        .filter(f => f.endsWith('.txt'))
        .forEach(f => extractedFiles.add(f.replace('.txt', '')));
    }

    // Get PDFs and categorize them
    const needsExtraction: SourceTreeItem[] = [];
    const extracted: SourceTreeItem[] = [];

    if (fs.existsSync(expandedZoteroPath)) {
      const pdfItems = await this.getZoteroPdfs(expandedZoteroPath, extractedFiles);
      
      for (const item of pdfItems) {
        if (item.contextValue === 'zoteroPdfExtracted') {
          extracted.push(item);
        } else {
          needsExtraction.push(item);
        }
      }
    }

    // Create groups
    if (needsExtraction.length > 0) {
      const needsItem = new SourceTreeItem(
        `📚 Needs Extraction (${needsExtraction.length})`,
        vscode.TreeItemCollapsibleState.Expanded
      );
      needsItem.contextValue = 'needsExtractionGroup';
      needsItem.children = needsExtraction;
      items.push(needsItem);
    }

    if (extracted.length > 0) {
      const extractedItem = new SourceTreeItem(
        `✅ Extracted (${extracted.length})`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      extractedItem.contextValue = 'extractedGroup';
      extractedItem.children = extracted;
      items.push(extractedItem);
    }

    return items;
  }

  private countPdfs(dirPath: string): number {
    let count = 0;
    try {
      const items = fs.readdirSync(dirPath);
      for (const item of items.slice(0, 100)) { // Limit to first 100 for performance
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(itemPath);
          count += files.filter(f => f.toLowerCase().endsWith('.pdf')).length;
        }
      }
    } catch (error) {
      console.error('Error counting PDFs:', error);
    }
    return count;
  }

  private async getZoteroPdfs(storagePath: string, extractedFiles: Set<string>): Promise<SourceTreeItem[]> {
    const items: SourceTreeItem[] = [];
    
    try {
      const folders = fs.readdirSync(storagePath).slice(0, 100); // Limit for performance
      
      for (const folder of folders) {
        const folderPath = path.join(storagePath, folder);
        const stat = fs.statSync(folderPath);
        
        if (stat.isDirectory()) {
          const files = fs.readdirSync(folderPath);
          const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
          
          if (pdfs.length > 0) {
            for (const pdf of pdfs) {
              const pdfPath = path.join(folderPath, pdf);
              const pdfBaseName = pdf.replace('.pdf', '');
              
              // Check if this PDF has been extracted
              // Match by checking if any extracted file contains the PDF name or folder name
              const hasExtracted = Array.from(extractedFiles).some(extracted => 
                extracted.includes(pdfBaseName) || 
                extracted.includes(folder) ||
                pdfBaseName.includes(extracted)
              );
              
              const item = new SourceTreeItem(pdf, vscode.TreeItemCollapsibleState.None);
              item.tooltip = pdfPath;
              item.contextValue = hasExtracted ? 'zoteroPdfExtracted' : 'zoteroPdf';
              item.iconPath = hasExtracted 
                ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
                : new vscode.ThemeIcon('file-pdf');
              item.resourceUri = vscode.Uri.file(pdfPath);
              
              if (hasExtracted) {
                // Add command to open extracted text
                item.command = {
                  command: 'citationHover.openExtractedText',
                  title: 'Open Extracted Text',
                  arguments: [pdfBaseName, folder]
                };
                item.description = '✓ extracted';
              } else {
                // Add command to extract - pass path as string
                item.command = {
                  command: 'citationHover.extractPdf',
                  title: 'Extract Text',
                  arguments: [pdfPath]  // Pass the string path, not the item
                };
              }
              
              items.push(item);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error reading Zotero PDFs:', error);
    }
    
    return items;
  }
}

class SourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public children?: SourceTreeItem[]
  ) {
    super(label, collapsibleState);
  }
}
