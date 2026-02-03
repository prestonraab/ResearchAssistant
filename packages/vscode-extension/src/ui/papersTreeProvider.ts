import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { ReadingStatus } from '../core/readingStatusManager';

export class PaperTreeItem extends vscode.TreeItem {
  public readingStatus?: ReadingStatus;

  constructor(
    public readonly label: string,
    public readonly filePath?: string,
    public readonly pdfPath?: string,
    public readonly needsExtraction?: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly children?: PaperTreeItem[],
    readingStatus?: ReadingStatus
  ) {
    super(label, collapsibleState);
    this.readingStatus = readingStatus;
    
    if (children) {
      // This is a group node
      this.contextValue = 'group';
      this.iconPath = new vscode.ThemeIcon('folder');
    } else if (needsExtraction && pdfPath) {
      // PDF needs extraction
      this.contextValue = 'pdfNeedsExtraction';
      this.iconPath = new vscode.ThemeIcon('file-pdf', new vscode.ThemeColor('list.warningForeground'));
      this.tooltip = `${label}\n\nPDF: ${pdfPath}\n⚠️ Text not extracted yet`;
      this.command = {
        command: 'researchAssistant.extractPdf',
        title: 'Extract PDF Text',
        arguments: [pdfPath]
      };
    } else if (pdfPath && fs.existsSync(pdfPath)) {
      // PDF exists and extracted
      this.contextValue = 'pdfExtracted';
      this.iconPath = new vscode.ThemeIcon('file-pdf');
      this.tooltip = this.buildTooltip(label, pdfPath, filePath, readingStatus);
      this.command = {
        command: 'vscode.open',
        title: 'Open PDF',
        arguments: [vscode.Uri.file(pdfPath)]
      };
    } else if (filePath) {
      // Only extracted text exists
      this.contextValue = 'extractedOnly';
      this.iconPath = new vscode.ThemeIcon('file-text');
      this.tooltip = this.buildTooltip(label, undefined, filePath, readingStatus);
      this.command = {
        command: 'vscode.open',
        title: 'Open Extracted Text',
        arguments: [vscode.Uri.file(filePath)]
      };
    } else {
      this.contextValue = 'paper';
      this.iconPath = new vscode.ThemeIcon('file');
    }

    // Update label with reading status indicator
    this.label = this.buildLabel(label, readingStatus);
  }

  private buildLabel(label: string, status?: ReadingStatus): string {
    if (!status || status === 'unread') {
      return label;
    }

    const statusIcons: Record<ReadingStatus, string> = {
      'unread': '',
      'some-read': '◐',
      'skimmed': '👁️',
      'read': '✓',
      'deeply-read': '★'
    };

    const icon = statusIcons[status];
    return icon ? `${icon} ${label}` : label;
  }

  private buildTooltip(label: string, pdfPath?: string, filePath?: string, status?: ReadingStatus): string {
    let tooltip = label;

    if (pdfPath) {
      tooltip += `\n\nPDF: ${pdfPath}`;
    }

    if (filePath) {
      tooltip += `\n\nExtracted text: ${filePath}`;
    }

    if (status && status !== 'unread') {
      const statusLabels: Record<ReadingStatus, string> = {
        'unread': 'Not started',
        'some-read': 'Partially read',
        'skimmed': 'Skimmed',
        'read': 'Fully read',
        'deeply-read': 'Deeply read with notes'
      };
      tooltip += `\n\nReading Status: ${statusLabels[status]}`;
    }

    return tooltip;
  }
}

export class PapersTreeProvider implements vscode.TreeDataProvider<PaperTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PaperTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private state: ExtensionState) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PaperTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PaperTreeItem): Promise<PaperTreeItem[]> {
    if (element?.children) {
      return element.children;
    }
    
    if (element) {
      return [];
    }

    try {
      const extractedTextPath = this.state.getAbsolutePath(
        this.state.getConfig().extractedTextPath
      );
      const pdfDir = path.join(this.state.getWorkspaceRoot(), 'literature', 'PDFs');
      const zoteroStoragePath = path.join(require('os').homedir(), 'Zotero', 'storage');
      
      // Get all extracted text files
      const extractedFiles = new Set<string>();
      if (fs.existsSync(extractedTextPath)) {
        fs.readdirSync(extractedTextPath)
          .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
          .forEach(f => extractedFiles.add(path.basename(f, path.extname(f))));
      }
      
      // Get all PDFs from workspace PDFs directory
      const pdfFiles = new Map<string, string>(); // basename -> full path
      if (fs.existsSync(pdfDir)) {
        fs.readdirSync(pdfDir)
          .filter(f => f.endsWith('.pdf'))
          .forEach(f => {
            const basename = path.basename(f, '.pdf');
            pdfFiles.set(basename, path.join(pdfDir, f));
          });
      }
      
      // Also scan Zotero storage for PDFs
      if (fs.existsSync(zoteroStoragePath)) {
        try {
          const storageDirs = fs.readdirSync(zoteroStoragePath);
          for (const dir of storageDirs) {
            const dirPath = path.join(zoteroStoragePath, dir);
            if (fs.statSync(dirPath).isDirectory()) {
              const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf'));
              for (const file of files) {
                const basename = path.basename(file, '.pdf');
                // Only add if not already in workspace PDFs
                if (!pdfFiles.has(basename)) {
                  pdfFiles.set(basename, path.join(dirPath, file));
                }
              }
            }
          }
        } catch (error) {
          console.error('Error scanning Zotero storage:', error);
        }
      }
      
      // Helper function to find matching PDF for an extracted text file
      const findMatchingPdf = (extractedBasename: string): string | undefined => {
        // First try exact match
        if (pdfFiles.has(extractedBasename)) {
          return pdfFiles.get(extractedBasename);
        }
        
        // Try fuzzy match - PDFs might be truncated
        // Look for PDFs that start with the same prefix (first 100 chars)
        const prefix = extractedBasename.substring(0, 100);
        for (const [pdfBasename, pdfPath] of pdfFiles) {
          if (pdfBasename.startsWith(prefix) || extractedBasename.startsWith(pdfBasename)) {
            return pdfPath;
          }
        }
        
        return undefined;
      };
      
      // Categorize papers
      const needsExtraction: PaperTreeItem[] = [];
      const extracted: PaperTreeItem[] = [];
      const extractedOnly: PaperTreeItem[] = [];
      const matchedPdfs = new Set<string>(); // Track which PDFs we've matched
      
      // Papers with extracted text - try to find matching PDFs
      for (const basename of extractedFiles) {
        const extractedPath = path.join(extractedTextPath, `${basename}.txt`);
        const mdPath = path.join(extractedTextPath, `${basename}.md`);
        const actualPath = fs.existsSync(extractedPath) ? extractedPath : 
                          (fs.existsSync(mdPath) ? mdPath : null);
        
        if (!actualPath) {
          continue;
        }
        
        const pdfPath = findMatchingPdf(basename);
        const readingStatus = this.state.readingStatusManager.getStatus(basename);
        
        if (pdfPath) {
          extracted.push(new PaperTreeItem(basename, actualPath, pdfPath, false, vscode.TreeItemCollapsibleState.None, undefined, readingStatus?.status));
          matchedPdfs.add(pdfPath);
        } else {
          extractedOnly.push(new PaperTreeItem(basename, actualPath, undefined, false, vscode.TreeItemCollapsibleState.None, undefined, readingStatus?.status));
        }
      }
      
      // PDFs that need extraction (not matched to any extracted text)
      for (const [basename, pdfPath] of pdfFiles) {
        if (!matchedPdfs.has(pdfPath)) {
          needsExtraction.push(new PaperTreeItem(basename, undefined, pdfPath, true, vscode.TreeItemCollapsibleState.None, undefined, undefined));
        }
      }
      
      // Build tree with groups
      const items: PaperTreeItem[] = [];
      
      if (needsExtraction.length > 0) {
        items.push(new PaperTreeItem(
          `⚠️ Needs Extraction (${needsExtraction.length})`,
          undefined,
          undefined,
          undefined,
          vscode.TreeItemCollapsibleState.Expanded,
          needsExtraction.sort((a, b) => a.label.localeCompare(b.label))
        ));
      }
      
      if (extracted.length > 0) {
        items.push(new PaperTreeItem(
          `✅ Extracted (${extracted.length})`,
          undefined,
          undefined,
          undefined,
          vscode.TreeItemCollapsibleState.Collapsed,
          extracted.sort((a, b) => a.label.localeCompare(b.label))
        ));
      }
      
      if (extractedOnly.length > 0) {
        items.push(new PaperTreeItem(
          `📄 Text Only (${extractedOnly.length})`,
          undefined,
          undefined,
          undefined,
          vscode.TreeItemCollapsibleState.Collapsed,
          extractedOnly.sort((a, b) => a.label.localeCompare(b.label))
        ));
      }
      
      if (items.length === 0) {
        return [new PaperTreeItem('No papers found')];
      }
      
      return items;
    } catch (error) {
      console.error('Failed to load papers:', error);
      return [new PaperTreeItem('Error loading papers')];
    }
  }
}
