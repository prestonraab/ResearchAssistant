import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';

export class PaperTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath?: string,
    public readonly pdfPath?: string,
    public readonly needsExtraction?: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly children?: PaperTreeItem[]
  ) {
    super(label, collapsibleState);
    
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
      this.tooltip = `${label}\n\nPDF: ${pdfPath}\nExtracted: ${filePath}`;
      this.command = {
        command: 'vscode.open',
        title: 'Open PDF',
        arguments: [vscode.Uri.file(pdfPath)]
      };
    } else if (filePath) {
      // Only extracted text exists
      this.contextValue = 'extractedOnly';
      this.iconPath = new vscode.ThemeIcon('file-text');
      this.tooltip = `${label}\n\nExtracted text: ${filePath}\n(PDF not found)`;
      this.command = {
        command: 'vscode.open',
        title: 'Open Extracted Text',
        arguments: [vscode.Uri.file(filePath)]
      };
    } else {
      this.contextValue = 'paper';
      this.iconPath = new vscode.ThemeIcon('file');
    }
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
      
      // Get all extracted text files
      const extractedFiles = new Set<string>();
      if (fs.existsSync(extractedTextPath)) {
        fs.readdirSync(extractedTextPath)
          .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
          .forEach(f => extractedFiles.add(path.basename(f, path.extname(f))));
      }
      
      // Get all PDFs
      const pdfFiles = new Set<string>();
      if (fs.existsSync(pdfDir)) {
        fs.readdirSync(pdfDir)
          .filter(f => f.endsWith('.pdf'))
          .forEach(f => pdfFiles.add(path.basename(f, '.pdf')));
      }
      
      // Categorize papers
      const needsExtraction: PaperTreeItem[] = [];
      const extracted: PaperTreeItem[] = [];
      const extractedOnly: PaperTreeItem[] = [];
      
      // PDFs that need extraction
      for (const basename of pdfFiles) {
        if (!extractedFiles.has(basename)) {
          const pdfPath = path.join(pdfDir, `${basename}.pdf`);
          needsExtraction.push(new PaperTreeItem(basename, undefined, pdfPath, true));
        }
      }
      
      // Papers with both PDF and extracted text
      for (const basename of extractedFiles) {
        const extractedPath = path.join(extractedTextPath, `${basename}.txt`);
        if (!fs.existsSync(extractedPath)) {
          // Try .md extension
          const mdPath = path.join(extractedTextPath, `${basename}.md`);
          if (fs.existsSync(mdPath)) {
            const pdfPath = pdfFiles.has(basename) ? path.join(pdfDir, `${basename}.pdf`) : undefined;
            if (pdfPath) {
              extracted.push(new PaperTreeItem(basename, mdPath, pdfPath, false));
            } else {
              extractedOnly.push(new PaperTreeItem(basename, mdPath));
            }
          }
        } else {
          const pdfPath = pdfFiles.has(basename) ? path.join(pdfDir, `${basename}.pdf`) : undefined;
          if (pdfPath) {
            extracted.push(new PaperTreeItem(basename, extractedPath, pdfPath, false));
          } else {
            extractedOnly.push(new PaperTreeItem(basename, extractedPath));
          }
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
