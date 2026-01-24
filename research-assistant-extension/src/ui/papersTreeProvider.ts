import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';

export class PaperTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath?: string,
    public readonly pdfPath?: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    
    this.contextValue = 'paper';
    
    if (pdfPath && fs.existsSync(pdfPath)) {
      this.iconPath = new vscode.ThemeIcon('file-pdf');
      this.tooltip = `${label}\n\nPDF: ${pdfPath}\nExtracted: ${filePath}`;
      this.command = {
        command: 'vscode.open',
        title: 'Open PDF',
        arguments: [vscode.Uri.file(pdfPath)]
      };
    } else if (filePath) {
      this.iconPath = new vscode.ThemeIcon('file-text');
      this.tooltip = `${label}\n\nExtracted text: ${filePath}\n(PDF not found)`;
      this.command = {
        command: 'vscode.open',
        title: 'Open Extracted Text',
        arguments: [vscode.Uri.file(filePath)]
      };
    } else {
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
    if (element) {
      return [];
    }

    try {
      const extractedTextPath = this.state.getAbsolutePath(
        this.state.getConfig().extractedTextPath
      );
      
      if (!fs.existsSync(extractedTextPath)) {
        return [new PaperTreeItem('No papers found')];
      }
      
      const files = fs.readdirSync(extractedTextPath)
        .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
        .sort();
      
      if (files.length === 0) {
        return [new PaperTreeItem('No papers found')];
      }
      
      // Try to find corresponding PDFs
      const pdfDir = path.join(this.state.getWorkspaceRoot(), 'literature', 'PDFs');
      
      return files.map(file => {
        const basename = path.basename(file, path.extname(file));
        const extractedPath = path.join(extractedTextPath, file);
        
        // Look for PDF with same name
        let pdfPath: string | undefined;
        if (fs.existsSync(pdfDir)) {
          const pdfFile = path.join(pdfDir, `${basename}.pdf`);
          if (fs.existsSync(pdfFile)) {
            pdfPath = pdfFile;
          }
        }
        
        return new PaperTreeItem(basename, extractedPath, pdfPath);
      });
    } catch (error) {
      console.error('Failed to load papers:', error);
      return [new PaperTreeItem('Error loading papers')];
    }
  }
}
