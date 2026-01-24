"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcesTreeProvider = exports.ClaimsTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Claims Tree Provider
class ClaimsTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            return this.getRootItems();
        }
        return element.children || [];
    }
    async getRootItems() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }
        const config = vscode.workspace.getConfiguration('citationHover');
        const claimsPath = config.get('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
        const fullPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);
        if (!fs.existsSync(fullPath)) {
            return [new ClaimTreeItem('Claims file not found', vscode.TreeItemCollapsibleState.None)];
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        const claims = this.parseClaims(content);
        // Group by category or just return flat list
        return claims;
    }
    parseClaims(content) {
        const claims = [];
        const claimRegex = /## (C_\d+): (.+?)$/gm;
        let match;
        while ((match = claimRegex.exec(content)) !== null) {
            const id = match[1];
            const title = match[2].trim();
            const item = new ClaimTreeItem(`${id}: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`, vscode.TreeItemCollapsibleState.None);
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
exports.ClaimsTreeProvider = ClaimsTreeProvider;
class ClaimTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, children) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.children = children;
    }
}
// Sources Tree Provider
class SourcesTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            return this.getRootItems();
        }
        return element.children || [];
    }
    async getRootItems() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }
        const config = vscode.workspace.getConfiguration('citationHover');
        const zoteroStoragePath = config.get('zoteroStoragePath', '~/Zotero/storage');
        const extractedTextPath = config.get('extractedTextPath', 'literature/ExtractedText');
        const expandedZoteroPath = zoteroStoragePath.replace('~', require('os').homedir());
        const fullExtractedPath = path.join(workspaceFolders[0].uri.fsPath, extractedTextPath);
        const items = [];
        // Get extracted text filenames for matching
        const extractedFiles = new Set();
        if (fs.existsSync(fullExtractedPath)) {
            fs.readdirSync(fullExtractedPath)
                .filter(f => f.endsWith('.txt'))
                .forEach(f => extractedFiles.add(f.replace('.txt', '')));
        }
        // Get PDFs and categorize them
        const needsExtraction = [];
        const extracted = [];
        if (fs.existsSync(expandedZoteroPath)) {
            const pdfItems = await this.getZoteroPdfs(expandedZoteroPath, extractedFiles);
            for (const item of pdfItems) {
                if (item.contextValue === 'zoteroPdfExtracted') {
                    extracted.push(item);
                }
                else {
                    needsExtraction.push(item);
                }
            }
        }
        // Create groups
        if (needsExtraction.length > 0) {
            const needsItem = new SourceTreeItem(`📚 Needs Extraction (${needsExtraction.length})`, vscode.TreeItemCollapsibleState.Expanded);
            needsItem.contextValue = 'needsExtractionGroup';
            needsItem.children = needsExtraction;
            items.push(needsItem);
        }
        if (extracted.length > 0) {
            const extractedItem = new SourceTreeItem(`✅ Extracted (${extracted.length})`, vscode.TreeItemCollapsibleState.Collapsed);
            extractedItem.contextValue = 'extractedGroup';
            extractedItem.children = extracted;
            items.push(extractedItem);
        }
        return items;
    }
    countPdfs(dirPath) {
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
        }
        catch (error) {
            console.error('Error counting PDFs:', error);
        }
        return count;
    }
    async getZoteroPdfs(storagePath, extractedFiles) {
        const items = [];
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
                            const hasExtracted = Array.from(extractedFiles).some(extracted => extracted.includes(pdfBaseName) ||
                                extracted.includes(folder) ||
                                pdfBaseName.includes(extracted));
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
                            }
                            else {
                                // Add command to extract - pass path as string
                                item.command = {
                                    command: 'citationHover.extractPdf',
                                    title: 'Extract Text',
                                    arguments: [pdfPath] // Pass the string path, not the item
                                };
                            }
                            items.push(item);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error reading Zotero PDFs:', error);
        }
        return items;
    }
}
exports.SourcesTreeProvider = SourcesTreeProvider;
class SourceTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, children) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.children = children;
    }
}
//# sourceMappingURL=treeProviders.js.map