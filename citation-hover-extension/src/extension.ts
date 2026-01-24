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

interface ClaimTreeItem {
  id: string;
  label: string;
  category?: string;
  verified?: boolean;
  similarity?: number;
  collapsibleState: vscode.TreeItemCollapsibleState;
  children?: ClaimTreeItem[];
  claimData?: ClaimData;
}

class ClaimsTreeDataProvider implements vscode.TreeDataProvider<ClaimTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaimTreeItem | undefined | null | void> = new vscode.EventEmitter<ClaimTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaimTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {}

  refresh(): void {
    claimsCache = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ClaimTreeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
    
    if (element.claimData) {
      // This is a claim item
      treeItem.command = {
        command: 'citationHover.goToClaim',
        title: 'Go to Claim',
        arguments: [element.claimData]
      };
      
      // Set icon based on verification status
      if (element.verified === true) {
        treeItem.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
      } else if (element.verified === false) {
        treeItem.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
      } else {
        treeItem.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconUnset'));
      }
      
      // Add tooltip with details
      const similarity = element.similarity !== undefined ? `${(element.similarity * 100).toFixed(0)}%` : 'N/A';
      treeItem.tooltip = `${element.id}: ${element.claimData.title}\n\nCategory: ${element.claimData.category}\nSource: ${element.claimData.source}\nVerified: ${element.verified ? 'Yes' : 'No'} (${similarity})`;
      
      // Add context value for right-click menu
      treeItem.contextValue = 'claim';
    } else {
      // This is a category/status group
      treeItem.iconPath = new vscode.ThemeIcon('folder');
      treeItem.contextValue = 'group';
    }
    
    return treeItem;
  }

  async getChildren(element?: ClaimTreeItem): Promise<ClaimTreeItem[]> {
    if (!element) {
      // Root level - show status groups
      return this.getRootItems();
    } else if (element.children) {
      // Return pre-computed children
      return element.children;
    }
    return [];
  }

  private async getRootItems(): Promise<ClaimTreeItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    // Load claims if not cached
    if (!claimsCache) {
      claimsCache = await loadClaimsData(workspaceFolders[0].uri);
    }

    // Validate all claims
    for (const [id, claimData] of claimsCache) {
      if (claimData.verified === undefined) {
        await validateQuote(claimData, workspaceFolders[0].uri);
      }
    }

    // Group claims by verification status and category
    const verified: ClaimData[] = [];
    const unverified: ClaimData[] = [];
    const draft: ClaimData[] = [];

    for (const [id, claimData] of claimsCache) {
      if (claimData.verified === true) {
        verified.push(claimData);
      } else if (claimData.verified === false) {
        unverified.push(claimData);
      } else {
        draft.push(claimData);
      }
    }

    const rootItems: ClaimTreeItem[] = [];

    // Verified claims grouped by category
    if (verified.length > 0) {
      const verifiedItem: ClaimTreeItem = {
        id: 'verified',
        label: `✅ Verified (${verified.length})`,
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        children: this.groupByCategory(verified)
      };
      rootItems.push(verifiedItem);
    }

    // Unverified claims
    if (unverified.length > 0) {
      const unverifiedItem: ClaimTreeItem = {
        id: 'unverified',
        label: `❌ Unverified (${unverified.length})`,
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        children: unverified.map(claim => this.createClaimItem(claim))
      };
      rootItems.push(unverifiedItem);
    }

    // Draft claims
    if (draft.length > 0) {
      const draftItem: ClaimTreeItem = {
        id: 'draft',
        label: `⚪ Draft (${draft.length})`,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        children: draft.map(claim => this.createClaimItem(claim))
      };
      rootItems.push(draftItem);
    }

    return rootItems;
  }

  private groupByCategory(claims: ClaimData[]): ClaimTreeItem[] {
    const categories = new Map<string, ClaimData[]>();
    
    for (const claim of claims) {
      const category = claim.category || 'Other';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(claim);
    }

    const categoryIcons: { [key: string]: string } = {
      'Method': '📊',
      'Result': '📈',
      'Challenge': '⚠️',
      'Context': '📝',
      'Application': '🔧',
      'Theory': '💡'
    };

    return Array.from(categories.entries()).map(([category, claims]) => ({
      id: `category-${category}`,
      label: `${categoryIcons[category] || '📁'} ${category} (${claims.length})`,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      children: claims.map(claim => this.createClaimItem(claim))
    }));
  }

  private createClaimItem(claim: ClaimData): ClaimTreeItem {
    return {
      id: claim.id,
      label: `${claim.id}: ${claim.title.substring(0, 50)}${claim.title.length > 50 ? '...' : ''}`,
      category: claim.category,
      verified: claim.verified,
      similarity: claim.similarity,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      claimData: claim
    };
  }
}

let claimsCache: Map<string, ClaimData> | null = null;
let claimsFileWatcher: vscode.FileSystemWatcher | null = null;
let diagnosticCollection: vscode.DiagnosticCollection;
let validationCache: Map<string, boolean> = new Map();

// Import tree providers
import { ClaimsTreeProvider, SourcesTreeProvider } from './treeProviders';
import { OutlineTreeProvider } from './outlineProvider';
let claimsTreeProvider: ClaimsTreeProvider;
let sourcesTreeProvider: SourcesTreeProvider;
let outlineTreeProvider: OutlineTreeProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log('Citation Hover extension is now active');

  // Create diagnostic collection
  diagnosticCollection = vscode.languages.createDiagnosticCollection('citationHover');
  context.subscriptions.push(diagnosticCollection);

  // Create tree view providers
  claimsTreeProvider = new ClaimsTreeProvider();
  sourcesTreeProvider = new SourcesTreeProvider();
  outlineTreeProvider = new OutlineTreeProvider();
  
  const claimsTreeView = vscode.window.createTreeView('citationHoverClaims', {
    treeDataProvider: claimsTreeProvider,
    showCollapseAll: true
  });
  
  const sourcesTreeView = vscode.window.createTreeView('citationHoverSources', {
    treeDataProvider: sourcesTreeProvider
  });
  
  const outlineTreeView = vscode.window.createTreeView('citationHoverOutline', {
    treeDataProvider: outlineTreeProvider,
    showCollapseAll: true
  });
  
  context.subscriptions.push(claimsTreeView, sourcesTreeView, outlineTreeView);

  // Register hover provider for markdown files
  const hoverProvider = vscode.languages.registerHoverProvider('markdown', {
    async provideHover(document, position, token) {
      return await provideClaimHover(document, position);
    }
  });

  // Register commands
  const validateCommand = vscode.commands.registerCommand('citationHover.validateAllQuotes', async () => {
    await validateAllQuotes();
  });

  const clearCacheCommand = vscode.commands.registerCommand('citationHover.clearCache', () => {
    claimsCache = null;
    validationCache.clear();
    vscode.window.showInformationMessage('Citation Hover: Cache cleared');
  });

  const searchZoteroCommand = vscode.commands.registerCommand('citationHover.searchZotero', async () => {
    await searchZoteroForSelection();
  });

  const goToClaimCommand = vscode.commands.registerCommand('citationHover.goToClaim', async (claimData: ClaimData) => {
    await goToClaim(claimData);
  });

  const jumpToClaimCommand = vscode.commands.registerCommand('citationHover.jumpToClaim', async (claimId: string) => {
    await jumpToClaim(claimId);
  });

  const extractPdfCommand = vscode.commands.registerCommand('citationHover.extractPdf', async (itemOrPath: any) => {
    // Handle both tree item clicks and direct path calls
    let pdfPath: string;
    
    if (typeof itemOrPath === 'string') {
      pdfPath = itemOrPath;
    } else if (itemOrPath && itemOrPath.resourceUri) {
      // Tree item with resourceUri
      pdfPath = itemOrPath.resourceUri.fsPath;
    } else if (itemOrPath && itemOrPath.tooltip) {
      // Tree item with tooltip containing path
      pdfPath = itemOrPath.tooltip;
    } else {
      vscode.window.showErrorMessage('Could not determine PDF path');
      return;
    }
    
    await extractPdfText(pdfPath);
  });

  const refreshSourcesCommand = vscode.commands.registerCommand('citationHover.refreshSources', () => {
    sourcesTreeProvider.refresh();
  });

  const openExtractedTextCommand = vscode.commands.registerCommand('citationHover.openExtractedText', async (pdfBaseName: string, folder: string) => {
    await openExtractedText(pdfBaseName, folder);
  });

  const refreshTreeCommand = vscode.commands.registerCommand('citationHover.refreshTree', () => {
    claimsTreeProvider.refresh();
  });

  const showQuoteDiffCommand = vscode.commands.registerCommand('citationHover.showQuoteDiff', async (claimData: ClaimData) => {
    await showQuoteDiff(claimData);
  });

  // Outline commands
  const refreshOutlineCommand = vscode.commands.registerCommand('citationHover.refreshOutline', () => {
    outlineTreeProvider.refresh();
  });

  const jumpToOutlineSectionCommand = vscode.commands.registerCommand('citationHover.jumpToOutlineSection', async (section: any) => {
    await jumpToOutlineSection(section);
  });

  const searchForSectionCommand = vscode.commands.registerCommand('citationHover.searchForSection', async (sectionId: string) => {
    await searchForSection(sectionId);
  });

  const showSectionGapsCommand = vscode.commands.registerCommand('citationHover.showSectionGaps', async () => {
    await showSectionGaps();
  });

  // Watch for changes to claims file
  setupFileWatcher(context);

  // Clear cache when configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('citationHover')) {
        claimsCache = null;
        validationCache.clear();
        setupFileWatcher(context);
      }
    })
  );

  // Validate on file open/save
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (shouldValidateDocument(doc)) {
        validateDocumentQuotes(doc);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (shouldValidateDocument(doc)) {
        validateDocumentQuotes(doc);
      }
    })
  );

  context.subscriptions.push(
    hoverProvider, 
    validateCommand, 
    clearCacheCommand, 
    searchZoteroCommand, 
    goToClaimCommand, 
    jumpToClaimCommand,
    extractPdfCommand,
    refreshSourcesCommand,
    openExtractedTextCommand,
    refreshTreeCommand, 
    showQuoteDiffCommand,
    refreshOutlineCommand,
    jumpToOutlineSectionCommand,
    searchForSectionCommand,
    showSectionGapsCommand
  );
}

function setupFileWatcher(context: vscode.ExtensionContext) {
  if (claimsFileWatcher) {
    claimsFileWatcher.dispose();
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const searchPattern = config.get<string>('searchPattern', '**/claims_and_evidence.md');
  
  // Watch the master index file
  claimsFileWatcher = vscode.workspace.createFileSystemWatcher(searchPattern);
  
  claimsFileWatcher.onDidChange(() => {
    claimsCache = null;
    validationCache.clear();
    claimsTreeProvider.refresh();
    console.log('Claims file changed, cache cleared');
  });

  context.subscriptions.push(claimsFileWatcher);
  
  // Also watch category files in the claims directory
  const categoryFilesWatcher = vscode.workspace.createFileSystemWatcher('**/01_Knowledge_Base/claims/*.md');
  
  categoryFilesWatcher.onDidChange(() => {
    claimsCache = null;
    validationCache.clear();
    claimsTreeProvider.refresh();
    console.log('Category file changed, cache cleared');
  });
  
  categoryFilesWatcher.onDidCreate(() => {
    claimsCache = null;
    validationCache.clear();
    claimsTreeProvider.refresh();
    console.log('Category file created, cache cleared');
  });
  
  categoryFilesWatcher.onDidDelete(() => {
    claimsCache = null;
    validationCache.clear();
    claimsTreeProvider.refresh();
    console.log('Category file deleted, cache cleared');
  });

  context.subscriptions.push(categoryFilesWatcher);
}

async function provideClaimHover(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Hover | null> {
  const line = document.lineAt(position.line).text;
  const range = document.getWordRangeAtPosition(position, /C_\d+/);
  
  if (!range) {
    return null;
  }

  const claimId = document.getText(range);
  
  // Load claims data if not cached
  if (!claimsCache) {
    claimsCache = await loadClaimsData(document.uri);
  }

  const claimData = claimsCache?.get(claimId);
  
  if (!claimData) {
    return null;
  }

  // Validate quote if not already validated
  if (claimData.verified === undefined) {
    await validateQuote(claimData, document.uri);
  }

  // Build hover content
  const markdown = new vscode.MarkdownString();
  markdown.isTrusted = true;
  
  // Add verification indicator
  const verificationIcon = claimData.verified ? '✅' : claimData.verified === false ? '❌' : '⚪';
  let verificationText = '';
  
  if (claimData.verified === true) {
    verificationText = `Verified (${(claimData.similarity! * 100).toFixed(0)}% match)`;
  } else if (claimData.verified === false) {
    if (claimData.error) {
      verificationText = `⚠️ ${claimData.error}`;
    } else {
      verificationText = `⚠️ Quote not verified (${(claimData.similarity! * 100).toFixed(0)}% similarity)`;
    }
  } else {
    verificationText = 'Not validated';
  }
  
  markdown.appendMarkdown(`${verificationIcon} **${claimId}**: ${claimData.title}\n\n`);
  markdown.appendMarkdown(`**Category**: ${claimData.category}  \n`);
  markdown.appendMarkdown(`**Source**: ${claimData.source}  \n`);
  markdown.appendMarkdown(`**Verification**: ${verificationText}\n\n`);
  
  // Show the quote
  if (claimData.primaryQuote && !claimData.primaryQuote.includes('[Note:')) {
    markdown.appendMarkdown(`**Your Quote:**\n> ${claimData.primaryQuote}\n\n`);
    
    // If not verified but we have a nearest match, show it
    if (claimData.verified === false && claimData.nearestMatch && claimData.similarity && claimData.similarity > 0.5) {
      markdown.appendMarkdown(`**Nearest Match in Source** (${(claimData.similarity * 100).toFixed(0)}% similar):\n`);
      
      if (claimData.contextBefore) {
        markdown.appendMarkdown(`\n*[...context before...]*\n`);
      }
      
      markdown.appendMarkdown(`> ${claimData.nearestMatch}\n`);
      
      if (claimData.contextAfter) {
        markdown.appendMarkdown(`*[...context after...]*\n`);
      }
      
      markdown.appendMarkdown(`\n`);
    }
  } else {
    markdown.appendMarkdown(`*[Quotes to be extracted]*\n\n`);
  }
  
  if (claimData.context) {
    markdown.appendMarkdown(`---\n*Context: ${claimData.context}*`);
  }

  return new vscode.Hover(markdown, range);
}

async function findClaimsFile(workspaceFolder: vscode.WorkspaceFolder): Promise<string | null> {
  const config = vscode.workspace.getConfiguration('citationHover');
  const configuredPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
  
  // Try configured path first
  const fullPath = path.join(workspaceFolder.uri.fsPath, configuredPath);
  if (fs.existsSync(fullPath)) {
    console.log(`Found claims file at configured path: ${fullPath}`);
    return fullPath;
  }

  // Fall back to searching with glob pattern
  const searchPattern = config.get<string>('searchPattern', '**/claims_and_evidence.md');
  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, searchPattern),
    '**/node_modules/**',
    1
  );

  if (files.length > 0) {
    console.log(`Found claims file via search: ${files[0].fsPath}`);
    return files[0].fsPath;
  }

  return null;
}

async function loadClaimsData(documentUri: vscode.Uri): Promise<Map<string, ClaimData>> {
  const claims = new Map<string, ClaimData>();
  
  // Find workspace folder
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  if (!workspaceFolder) {
    return claims;
  }

  // Find claims file
  const claimsFilePath = await findClaimsFile(workspaceFolder);

  if (!claimsFilePath) {
    vscode.window.showWarningMessage(
      'Citation Hover: claims_and_evidence.md not found. Check extension settings.'
    );
    return claims;
  }

  const content = fs.readFileSync(claimsFilePath, 'utf-8');
  
  // Check if this is the new master index format (contains "Claim Categories and Files" section)
  if (content.includes('## Claim Categories and Files') || content.includes('## Quick Reference: Claim ID to File Mapping')) {
    console.log('Detected new multi-file structure, loading from category files...');
    return await loadClaimsFromCategoryFiles(workspaceFolder, claimsFilePath);
  }
  
  // Legacy single-file format - parse claims using regex
  const claimRegex = /## (C_\d+): (.+?)\n\n\*\*Category\*\*: (.+?)\s+\n\*\*Source\*\*: (.+?)\s+\n\*\*Context\*\*: (.+?)\n\n\*\*Primary Quote\*\*[^\n]*:\n> (.+?)(?=\n\n(?:\*\*Supporting|---|\n## C_))/gs;
  
  let match;
  while ((match = claimRegex.exec(content)) !== null) {
    const [, id, title, category, source, context, primaryQuote] = match;
    
    claims.set(id, {
      id,
      title: title.trim(),
      category: category.trim(),
      source: source.trim(),
      context: context.trim(),
      primaryQuote: primaryQuote.trim()
    });
  }

  console.log(`Loaded ${claims.size} claims from ${claimsFilePath}`);
  return claims;
}

async function loadClaimsFromCategoryFiles(workspaceFolder: vscode.WorkspaceFolder, masterIndexPath: string): Promise<Map<string, ClaimData>> {
  const claims = new Map<string, ClaimData>();
  
  // Parse the master index to get claim ID to file mapping
  const masterContent = fs.readFileSync(masterIndexPath, 'utf-8');
  const claimToFileMap = new Map<string, string>();
  
  // Extract mapping from the Quick Reference table
  const mappingRegex = /\| (C_\d+) \| .+? \| \[`(.+?)`\]/g;
  let match;
  while ((match = mappingRegex.exec(masterContent)) !== null) {
    const [, claimId, filename] = match;
    claimToFileMap.set(claimId, filename);
  }
  
  console.log(`Found ${claimToFileMap.size} claim mappings in master index`);
  
  // Get unique category files
  const categoryFiles = new Set(claimToFileMap.values());
  const claimsDir = path.join(path.dirname(masterIndexPath), 'claims');
  
  // Load claims from each category file
  for (const categoryFile of categoryFiles) {
    const categoryFilePath = path.join(claimsDir, categoryFile);
    
    if (!fs.existsSync(categoryFilePath)) {
      console.warn(`Category file not found: ${categoryFilePath}`);
      continue;
    }
    
    const categoryContent = fs.readFileSync(categoryFilePath, 'utf-8');
    
    // Parse claims using the same regex as before
    const claimRegex = /## (C_\d+): (.+?)\n\n\*\*Category\*\*: (.+?)\s+\n\*\*Source\*\*: (.+?)\s+\n\*\*Context\*\*: (.+?)\n\n\*\*Primary Quote\*\*[^\n]*:\n> (.+?)(?=\n\n(?:\*\*Supporting|---|\n## C_))/gs;
    
    let claimMatch;
    while ((claimMatch = claimRegex.exec(categoryContent)) !== null) {
      const [, id, title, category, source, context, primaryQuote] = claimMatch;
      
      claims.set(id, {
        id,
        title: title.trim(),
        category: category.trim(),
        source: source.trim(),
        context: context.trim(),
        primaryQuote: primaryQuote.trim()
      });
    }
    
    console.log(`Loaded claims from ${categoryFile}`);
  }
  
  console.log(`Total claims loaded: ${claims.size}`);
  return claims;
}

function normalizeText(text: string): string {
  // Remove extra whitespace and normalize
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Normalize text for matching (handles Unicode characters)
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s\d]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Flexible author-year matching
function matchesAuthorYear(filename: string, authorYear: string): boolean {
  const normalizedFilename = normalizeForMatching(filename);
  const normalizedAuthorYear = normalizeForMatching(authorYear);
  
  // Direct match
  if (normalizedFilename.includes(normalizedAuthorYear)) {
    return true;
  }
  
  // Extract year from authorYear (last 4 digits)
  const yearMatch = authorYear.match(/(\d{4})/);
  if (!yearMatch) {
    return false;
  }
  const year = yearMatch[1];
  
  // Extract author part (everything before the year)
  const authorPart = authorYear.replace(/\d{4}/, '').trim();
  const normalizedAuthorPart = normalizeForMatching(authorPart);
  
  // Check if year is present
  const hasYear = normalizedFilename.includes(year);
  if (!hasYear) {
    return false;
  }
  
  // Check if author part matches (handling "et al." variations)
  const authorWords = normalizedAuthorPart.split(/\s+/).filter(w => w.length > 0);
  
  for (const word of authorWords) {
    if (word.length > 2 && normalizedFilename.includes(word)) {
      return true;
    }
  }
  
  return false;
}

function similarityScore(quote: string, window: string): number {
  // Word-based similarity matching the MCP server approach
  const quoteWords = quote.toLowerCase().split(' ').filter(w => w.length > 0);
  const windowLower = window.toLowerCase();
  
  // Count matching words
  const matchingWords = quoteWords.filter(word => windowLower.includes(word)).length;
  
  return matchingWords / quoteWords.length;
}

async function validateQuote(claimData: ClaimData, documentUri: vscode.Uri): Promise<void> {
  const cacheKey = `${claimData.id}_${claimData.source}`;
  
  // Check cache first
  if (validationCache.has(cacheKey)) {
    claimData.verified = validationCache.get(cacheKey);
    return;
  }

  // Skip placeholder quotes
  if (claimData.primaryQuote.includes('[Note:') || 
      claimData.primaryQuote.toLowerCase().includes('to be extracted')) {
    claimData.verified = undefined;
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  if (!workspaceFolder) {
    claimData.error = 'No workspace folder found';
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const extractedTextPath = config.get<string>('extractedTextPath', 'literature/ExtractedText');
  const threshold = config.get<number>('validationThreshold', 0.85);
  
  const extractedTextDir = path.join(workspaceFolder.uri.fsPath, extractedTextPath);
  
  if (!fs.existsSync(extractedTextDir)) {
    claimData.error = 'Extracted text directory not found';
    claimData.verified = false;
    claimData.similarity = 0;
    return;
  }

  // Find source file (flexible matching)
  const authorYear = claimData.source.split(' ')[0]; // Extract AuthorYear from "AuthorYear (Source ID: X)"
  const files = fs.readdirSync(extractedTextDir);
  const sourceFile = files.find(f => f.endsWith('.txt') && matchesAuthorYear(f, authorYear));
  
  if (!sourceFile) {
    claimData.error = `No source file found for ${authorYear}`;
    claimData.verified = false;
    claimData.similarity = 0;
    validationCache.set(cacheKey, false);
    return;
  }

  // Read and search source file
  const sourceFilePath = path.join(extractedTextDir, sourceFile);
  let sourceText: string;
  
  try {
    sourceText = fs.readFileSync(sourceFilePath, 'utf-8');
  } catch (err) {
    claimData.error = `Failed to read source file: ${err}`;
    claimData.verified = false;
    claimData.similarity = 0;
    return;
  }
  
  const lines = sourceText.split('\n');
  const normalizedQuote = normalizeText(claimData.primaryQuote);
  const normalizedSource = normalizeText(sourceText);
  
  // Check for exact match
  if (normalizedSource.includes(normalizedQuote)) {
    // Find the exact location to get context
    const quoteStart = normalizedSource.indexOf(normalizedQuote);
    const quoteEnd = quoteStart + normalizedQuote.length;
    
    // Find line numbers for context
    let charCount = 0;
    let startLine = 0;
    let endLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = normalizeText(lines[i]).length + 1; // +1 for newline
      if (charCount <= quoteStart && charCount + lineLength > quoteStart) {
        startLine = i;
      }
      if (charCount <= quoteEnd && charCount + lineLength >= quoteEnd) {
        endLine = i;
        break;
      }
      charCount += lineLength;
    }
    
    // Get context (2 lines before and after)
    const contextStart = Math.max(0, startLine - 2);
    const contextEnd = Math.min(lines.length - 1, endLine + 2);
    
    claimData.contextBefore = lines.slice(contextStart, startLine).join('\n').trim();
    claimData.contextAfter = lines.slice(endLine + 1, contextEnd + 1).join('\n').trim();
    claimData.verified = true;
    claimData.similarity = 1.0;
    validationCache.set(cacheKey, true);
    return;
  }

  // Fuzzy match with sliding window - matching MCP server approach
  const quoteWords = normalizedQuote.split(' ').filter(w => w.length > 0);
  const sourceWords = normalizedSource.split(' ').filter(w => w.length > 0);
  const windowSize = quoteWords.length;
  
  let bestSimilarity = 0;
  let bestMatchIndex = 0;
  let bestMatch = '';
  
  for (let i = 0; i <= sourceWords.length - windowSize; i++) {
    const window = sourceWords.slice(i, i + windowSize).join(' ');
    
    // Count matching words
    const matchingWords = quoteWords.filter(word => window.includes(word)).length;
    const similarity = matchingWords / quoteWords.length;
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatchIndex = i;
      bestMatch = window;
    }
    
    if (similarity >= 0.85) {
      break;
    }
  }

  // Find the best match in the original text to get proper context
  if (bestSimilarity > 0) {
    let wordCount = 0;
    let matchStartLine = 0;
    let matchEndLine = 0;
    
    const normalizedLines = lines.map(l => normalizeText(l));
    
    for (let i = 0; i < normalizedLines.length; i++) {
      const lineWords = normalizedLines[i].split(' ').filter(w => w.length > 0);
      
      if (wordCount <= bestMatchIndex && wordCount + lineWords.length > bestMatchIndex) {
        matchStartLine = i;
      }
      if (wordCount <= bestMatchIndex + windowSize && wordCount + lineWords.length >= bestMatchIndex + windowSize) {
        matchEndLine = i;
        break;
      }
      
      wordCount += lineWords.length;
    }
    
    // Get context (2 lines before and after)
    const contextStart = Math.max(0, matchStartLine - 2);
    const contextEnd = Math.min(lines.length - 1, matchEndLine + 2);
    
    claimData.contextBefore = lines.slice(contextStart, matchStartLine).join('\n').trim();
    claimData.contextAfter = lines.slice(matchEndLine + 1, contextEnd + 1).join('\n').trim();
    claimData.nearestMatch = lines.slice(matchStartLine, matchEndLine + 1).join('\n').trim();
  }

  claimData.verified = bestSimilarity >= threshold;
  claimData.similarity = bestSimilarity;
  validationCache.set(cacheKey, claimData.verified);
}

function shouldValidateDocument(document: vscode.TextDocument): boolean {
  return document.fileName.includes('claims_and_evidence.md') || 
         document.fileName.includes('01_Knowledge_Base/claims/');
}

async function validateDocumentQuotes(document: vscode.TextDocument): Promise<void> {
  const config = vscode.workspace.getConfiguration('citationHover');
  if (!config.get<boolean>('showDiagnostics', true)) {
    return;
  }

  if (!claimsCache) {
    claimsCache = await loadClaimsData(document.uri);
  }

  const diagnostics: vscode.Diagnostic[] = [];
  const text = document.getText();
  
  // Find all claim sections
  const claimRegex = /## (C_\d+):/g;
  let match;
  
  while ((match = claimRegex.exec(text)) !== null) {
    const claimId = match[1];
    const claimData = claimsCache.get(claimId);
    
    if (claimData && claimData.verified === undefined) {
      await validateQuote(claimData, document.uri);
    }
    
    if (claimData && claimData.verified === false) {
      const line = document.positionAt(match.index).line;
      const range = new vscode.Range(line, 0, line, match[0].length);
      
      let message = `Quote for ${claimId} could not be verified`;
      
      if (claimData.error) {
        message += `: ${claimData.error}`;
      } else if (claimData.similarity !== undefined) {
        message += ` in source file (${(claimData.similarity * 100).toFixed(0)}% similarity)`;
        
        if (claimData.nearestMatch && claimData.similarity > 0.5) {
          message += `. Hover to see nearest match.`;
        }
      }
      
      const diagnostic = new vscode.Diagnostic(
        range,
        message,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'Citation Hover';
      diagnostics.push(diagnostic);
    }
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

async function searchZoteroForSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  // Get selected text or current line
  let searchText = '';
  const selection = editor.selection;
  
  if (!selection.isEmpty) {
    searchText = editor.document.getText(selection);
  } else {
    // Use current line if no selection
    const line = editor.document.lineAt(selection.active.line);
    searchText = line.text;
  }

  searchText = searchText.trim();
  
  if (!searchText) {
    vscode.window.showErrorMessage('No text selected');
    return;
  }

  // Limit search text length for display
  const displayText = searchText.length > 100 
    ? searchText.substring(0, 100) + '...' 
    : searchText;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Searching Zotero for: "${displayText}"`,
    cancellable: false
  }, async (progress) => {
    try {
      // Call Zotero MCP semantic search
      const config = vscode.workspace.getConfiguration('citationHover');
      const resultLimit = config.get<number>('zoteroSearchLimit', 5);
      
      progress.report({ message: 'Querying Zotero library...' });
      
      // Execute MCP command via VS Code's command palette
      // Note: This requires the Zotero MCP server to be configured
      const results = await executeZoteroSearch(searchText, resultLimit);
      
      if (!results || results.length === 0) {
        vscode.window.showInformationMessage('No relevant papers found in Zotero library');
        return;
      }

      progress.report({ message: 'Displaying results...' });
      
      // Show results in a new document
      await displaySearchResults(searchText, results);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Zotero search failed: ${errorMsg}`);
    }
  });
}

async function executeZoteroSearch(query: string, limit: number): Promise<any[]> {
  // Call Zotero MCP via the mcp_zotero_zotero_semantic_search tool
  // Since VS Code extensions can't directly call MCP tools, we'll use a workaround:
  // 1. Write query to a temp file
  // 2. Use a Python/Node script to call MCP
  // 3. Read results from temp file
  
  // For a simpler approach, we'll shell out to call the MCP server
  const { execSync } = require('child_process');
  const os = require('os');
  const tmpDir = os.tmpdir();
  const queryFile = path.join(tmpDir, 'zotero-query.json');
  const resultFile = path.join(tmpDir, 'zotero-results.json');
  
  try {
    // Write query
    fs.writeFileSync(queryFile, JSON.stringify({ query, limit }));
    
    // Get workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No workspace folder open');
    }
    
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(workspaceRoot, 'call_zotero_mcp.py');
    
    // Check if helper script exists
    if (!fs.existsSync(scriptPath)) {
      throw new Error('Zotero MCP helper script not found. Please create call_zotero_mcp.py in workspace root.');
    }
    
    // Call helper script
    execSync(`python3 "${scriptPath}" "${queryFile}" "${resultFile}"`, {
      cwd: workspaceRoot,
      timeout: 30000 // 30 second timeout
    });
    
    // Read results
    if (!fs.existsSync(resultFile)) {
      throw new Error('No results returned from Zotero search');
    }
    
    const resultsJson = fs.readFileSync(resultFile, 'utf-8');
    const results = JSON.parse(resultsJson);
    
    // Clean up temp files
    try {
      fs.unlinkSync(queryFile);
      fs.unlinkSync(resultFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return results;
    
  } catch (error) {
    // Clean up on error
    try {
      if (fs.existsSync(queryFile)) fs.unlinkSync(queryFile);
      if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    throw error;
  }
}

async function displaySearchResults(query: string, results: any[]): Promise<void> {
  // Create interactive webview panel instead of static markdown
  const panel = vscode.window.createWebviewPanel(
    'zoteroSearchResults',
    'Zotero Search Results',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getSearchResultsHtml(query, results);
  
  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'addToClaims':
          await addResultToClaims(message.item);
          break;
        case 'copyBibTeX':
          await copyBibTeX(message.itemKey);
          break;
        case 'viewFullText':
          await viewFullText(message.itemKey);
          break;
        case 'openInZotero':
          await openInZotero(message.itemKey);
          break;
      }
    },
    undefined,
    []
  );
}

function getSearchResultsHtml(query: string, results: any[]): string {
  const resultsHtml = results.map((item, index) => {
    const authors = item.creators && item.creators.length > 0
      ? item.creators.map((c: any) => c.lastName || c.name).join(', ')
      : 'Unknown authors';
    
    const year = item.date ? extractYear(item.date) : 'n.d.';
    const authorYear = `${getFirstAuthor(item)}${year}`;
    const relevance = item.similarity ? (item.similarity * 100).toFixed(0) : '?';
    const abstract = item.abstractNote || 'No abstract available';
    const tags = item.tags && item.tags.length > 0
      ? item.tags.map((t: any) => t.tag || t).join(', ')
      : '';
    
    return `
      <div class="result-card">
        <div class="result-header">
          <div class="result-number">${index + 1}</div>
          <div class="result-title-section">
            <h3 class="result-title">${escapeHtml(item.title || 'Untitled')}</h3>
            <div class="result-meta">
              <span class="authors">${escapeHtml(authors)}</span>
              <span class="year">${escapeHtml(year)}</span>
              <span class="relevance" title="Semantic similarity score">
                <span class="relevance-bar" style="width: ${relevance}%"></span>
                ${relevance}% relevant
              </span>
            </div>
          </div>
        </div>
        
        <div class="result-abstract">
          <details>
            <summary>Abstract</summary>
            <p>${escapeHtml(abstract)}</p>
          </details>
        </div>
        
        ${tags ? `<div class="result-tags">${escapeHtml(tags)}</div>` : ''}
        
        <div class="result-actions">
          <button class="btn btn-primary" onclick="addToClaims(${index})">
            ➕ Add to Claims
          </button>
          <button class="btn btn-secondary" onclick="viewFullText('${escapeHtml(item.key || '')}')">
            📄 View Full Text
          </button>
          <button class="btn btn-secondary" onclick="copyBibTeX('${escapeHtml(item.key || '')}')">
            📋 Copy Citation
          </button>
          <button class="btn btn-secondary" onclick="openInZotero('${escapeHtml(item.key || '')}')">
            🔗 Open in Zotero
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zotero Search Results</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
          line-height: 1.6;
        }
        
        .header {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--vscode-panel-border);
        }
        
        .header h1 {
          margin: 0 0 10px 0;
          color: var(--vscode-foreground);
        }
        
        .query {
          font-size: 1.1em;
          color: var(--vscode-descriptionForeground);
          font-style: italic;
        }
        
        .result-count {
          margin-top: 10px;
          color: var(--vscode-descriptionForeground);
        }
        
        .result-card {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 20px;
          transition: box-shadow 0.2s;
        }
        
        .result-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .result-header {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .result-number {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        
        .result-title-section {
          flex: 1;
        }
        
        .result-title {
          margin: 0 0 8px 0;
          font-size: 1.2em;
          color: var(--vscode-foreground);
        }
        
        .result-meta {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          align-items: center;
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
        }
        
        .authors {
          font-weight: 500;
        }
        
        .year {
          color: var(--vscode-descriptionForeground);
        }
        
        .relevance {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 2px 8px;
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          border-radius: 12px;
          font-size: 0.85em;
        }
        
        .relevance-bar {
          height: 4px;
          background-color: var(--vscode-progressBar-background);
          border-radius: 2px;
          display: inline-block;
        }
        
        .result-abstract {
          margin: 15px 0;
        }
        
        .result-abstract details {
          cursor: pointer;
        }
        
        .result-abstract summary {
          color: var(--vscode-textLink-foreground);
          font-weight: 500;
          padding: 5px 0;
          user-select: none;
        }
        
        .result-abstract summary:hover {
          color: var(--vscode-textLink-activeForeground);
        }
        
        .result-abstract p {
          margin: 10px 0;
          padding: 10px;
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          color: var(--vscode-foreground);
        }
        
        .result-tags {
          margin: 10px 0;
          font-size: 0.85em;
          color: var(--vscode-descriptionForeground);
        }
        
        .result-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid var(--vscode-panel-border);
        }
        
        .btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
          transition: opacity 0.2s;
        }
        
        .btn:hover {
          opacity: 0.8;
        }
        
        .btn-primary {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          font-weight: 500;
        }
        
        .btn-secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        
        .no-results {
          text-align: center;
          padding: 40px;
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔍 Zotero Search Results</h1>
        <div class="query">"${escapeHtml(query)}"</div>
        <div class="result-count">${results.length} relevant papers found</div>
      </div>
      
      ${results.length > 0 ? resultsHtml : '<div class="no-results">No results found</div>'}
      
      <script>
        const vscode = acquireVsCodeApi();
        const results = ${JSON.stringify(results)};
        
        function addToClaims(index) {
          vscode.postMessage({
            command: 'addToClaims',
            item: results[index]
          });
        }
        
        function viewFullText(itemKey) {
          vscode.postMessage({
            command: 'viewFullText',
            itemKey: itemKey
          });
        }
        
        function copyBibTeX(itemKey) {
          vscode.postMessage({
            command: 'copyBibTeX',
            itemKey: itemKey
          });
        }
        
        function openInZotero(itemKey) {
          vscode.postMessage({
            command: 'openInZotero',
            itemKey: itemKey
          });
        }
      </script>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function extractYear(dateString: string): string {
  const match = dateString.match(/\d{4}/);
  return match ? match[0] : dateString;
}

function getFirstAuthor(item: any): string {
  if (!item.creators || item.creators.length === 0) {
    return 'Unknown';
  }
  const first = item.creators[0];
  return first.lastName || first.name || 'Unknown';
}

async function addResultToClaims(item: any): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
  const fullPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);

  if (!fs.existsSync(fullPath)) {
    vscode.window.showErrorMessage('claims_and_evidence.md not found');
    return;
  }

  // Read current claims to get next ID
  const content = fs.readFileSync(fullPath, 'utf-8');
  const claimIds = Array.from(content.matchAll(/## (C_\d+):/g)).map(m => m[1]);
  const nextId = getNextClaimId(claimIds);

  // Extract info from item
  const authors = item.creators && item.creators.length > 0
    ? item.creators.map((c: any) => c.lastName || c.name).join(', ')
    : 'Unknown';
  const year = item.date ? extractYear(item.date) : 'n.d.';
  const firstAuthor = getFirstAuthor(item);
  const authorYear = `${firstAuthor}${year}`;
  const title = item.title || 'Untitled';
  const abstract = item.abstractNote || '';

  // Prompt user for claim details
  const claimTitle = await vscode.window.showInputBox({
    prompt: 'Enter claim title',
    placeHolder: 'Brief description of the claim',
    value: title.substring(0, 100)
  });

  if (!claimTitle) {
    return; // User cancelled
  }

  const category = await vscode.window.showQuickPick(
    ['Method', 'Result', 'Challenge', 'Context', 'Application', 'Theory'],
    { placeHolder: 'Select claim category' }
  );

  if (!category) {
    return;
  }

  const context = await vscode.window.showInputBox({
    prompt: 'Enter context/nuance (optional)',
    placeHolder: 'Additional context about this claim'
  });

  // Create new claim entry
  const newClaim = `
## ${nextId}: ${claimTitle}

**Category**: ${category}  
**Source**: ${authorYear} (Source ID: TBD)  
**Context**: ${context || 'TBD'}

**Primary Quote**:
> [Note: Extract specific quote from paper]

**Supporting Quotes**:
> [Note: Add supporting quotes if needed]

**Notes**:
- Title: ${title}
- Authors: ${authors}
- Year: ${year}
${abstract ? `- Abstract: ${abstract.substring(0, 200)}...` : ''}
- Zotero Key: ${item.key || 'N/A'}

---
`;

  // Append to claims file
  fs.appendFileSync(fullPath, newClaim);

  // Open claims file and navigate to new claim
  const doc = await vscode.workspace.openTextDocument(fullPath);
  const editor = await vscode.window.showTextDocument(doc);
  
  // Find the new claim position
  const text = doc.getText();
  const claimPos = text.indexOf(`## ${nextId}:`);
  if (claimPos !== -1) {
    const position = doc.positionAt(claimPos);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  vscode.window.showInformationMessage(`Added ${nextId} to claims`);
  
  // Clear cache so new claim is picked up
  claimsCache = null;
}

function getNextClaimId(existingIds: string[]): string {
  if (existingIds.length === 0) {
    return 'C_01';
  }
  
  // Extract numbers and find max
  const numbers = existingIds.map(id => {
    const match = id.match(/C_(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });
  
  const maxNum = Math.max(...numbers);
  const nextNum = maxNum + 1;
  
  return `C_${nextNum.toString().padStart(2, '0')}`;
}

async function copyBibTeX(itemKey: string): Promise<void> {
  try {
    // This would call Zotero MCP to get BibTeX
    // For now, show a message
    await vscode.env.clipboard.writeText(`@article{${itemKey},\n  // BibTeX entry\n}`);
    vscode.window.showInformationMessage('Citation copied to clipboard');
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to copy citation: ${error}`);
  }
}

async function viewFullText(itemKey: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const extractedTextPath = config.get<string>('extractedTextPath', 'literature/ExtractedText');
  const extractedTextDir = path.join(workspaceFolders[0].uri.fsPath, extractedTextPath);

  if (!fs.existsSync(extractedTextDir)) {
    vscode.window.showErrorMessage('Extracted text directory not found');
    return;
  }

  // Try to find matching file
  const files = fs.readdirSync(extractedTextDir);
  const matchingFile = files.find(f => f.includes(itemKey) || f.endsWith('.txt'));

  if (matchingFile) {
    const filePath = path.join(extractedTextDir, matchingFile);
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  } else {
    vscode.window.showWarningMessage('Full text not found. Extract it first.');
  }
}

async function openInZotero(itemKey: string): Promise<void> {
  if (!itemKey) {
    vscode.window.showErrorMessage('No Zotero item key available');
    return;
  }

  // Zotero deep link format: zotero://select/library/items/ITEMKEY
  const zoteroUrl = `zotero://select/library/items/${itemKey}`;
  
  try {
    await vscode.env.openExternal(vscode.Uri.parse(zoteroUrl));
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open Zotero: ${error}`);
  }
}

async function goToClaim(claimData: ClaimData): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
  const masterIndexPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);

  if (!fs.existsSync(masterIndexPath)) {
    vscode.window.showErrorMessage('claims_and_evidence.md not found');
    return;
  }

  // Check if this is the new multi-file structure
  const masterContent = fs.readFileSync(masterIndexPath, 'utf-8');
  let targetFilePath = masterIndexPath;
  
  if (masterContent.includes('## Claim Categories and Files') || masterContent.includes('## Quick Reference: Claim ID to File Mapping')) {
    // New structure - find the category file for this claim
    const mappingRegex = new RegExp(`\\| ${claimData.id} \\| .+? \\| \\[\`(.+?)\`\\]`);
    const match = masterContent.match(mappingRegex);
    
    if (match) {
      const categoryFile = match[1];
      const claimsDir = path.join(path.dirname(masterIndexPath), 'claims');
      targetFilePath = path.join(claimsDir, categoryFile);
      
      if (!fs.existsSync(targetFilePath)) {
        vscode.window.showErrorMessage(`Category file not found: ${categoryFile}`);
        return;
      }
    } else {
      vscode.window.showWarningMessage(`Could not find ${claimData.id} in master index, opening master file`);
    }
  }

  const doc = await vscode.workspace.openTextDocument(targetFilePath);
  const editor = await vscode.window.showTextDocument(doc);

  // Find the claim position
  const text = doc.getText();
  const claimPos = text.indexOf(`## ${claimData.id}:`);
  
  if (claimPos !== -1) {
    const position = doc.positionAt(claimPos);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }
}

async function showQuoteDiff(claimData: ClaimData): Promise<void> {
  // Create a webview panel showing the diff
  const panel = vscode.window.createWebviewPanel(
    'quoteDiff',
    `Quote Verification: ${claimData.id}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getQuoteDiffHtml(claimData);
  
  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'replaceQuote':
          await replaceQuoteInClaims(claimData, message.newQuote);
          panel.dispose();
          break;
        case 'goToClaim':
          await goToClaim(claimData);
          break;
      }
    },
    undefined,
    []
  );
}

function getQuoteDiffHtml(claimData: ClaimData): string {
  const yourQuote = claimData.primaryQuote || '';
  const sourceQuote = claimData.nearestMatch || '';
  const similarity = claimData.similarity !== undefined ? (claimData.similarity * 100).toFixed(0) : '0';
  
  // Simple word-level diff
  const yourWords = yourQuote.split(/\s+/);
  const sourceWords = sourceQuote.split(/\s+/);
  
  let diffHtml = '';
  if (claimData.verified === false && sourceQuote) {
    diffHtml = generateDiffHtml(yourWords, sourceWords);
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quote Verification</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
          line-height: 1.6;
        }
        
        .header {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--vscode-panel-border);
        }
        
        .status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.9em;
          font-weight: 500;
          margin-left: 10px;
        }
        
        .status-verified {
          background-color: var(--vscode-testing-iconPassed);
          color: white;
        }
        
        .status-unverified {
          background-color: var(--vscode-testing-iconFailed);
          color: white;
        }
        
        .similarity {
          font-size: 1.2em;
          margin: 10px 0;
          color: var(--vscode-descriptionForeground);
        }
        
        .quote-section {
          margin: 20px 0;
          padding: 15px;
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 4px solid var(--vscode-textBlockQuote-border);
          border-radius: 4px;
        }
        
        .quote-section h3 {
          margin-top: 0;
          color: var(--vscode-foreground);
        }
        
        .quote-text {
          font-size: 1.05em;
          line-height: 1.8;
          margin: 10px 0;
        }
        
        .diff-view {
          margin: 20px 0;
          padding: 15px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
        }
        
        .diff-view h3 {
          margin-top: 0;
        }
        
        .word-removed {
          background-color: rgba(255, 0, 0, 0.3);
          text-decoration: line-through;
          padding: 2px 4px;
          border-radius: 2px;
        }
        
        .word-added {
          background-color: rgba(0, 255, 0, 0.3);
          padding: 2px 4px;
          border-radius: 2px;
        }
        
        .word-same {
          color: var(--vscode-foreground);
        }
        
        .context {
          margin: 15px 0;
          padding: 10px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
        }
        
        .actions {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid var(--vscode-panel-border);
          display: flex;
          gap: 10px;
        }
        
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.95em;
          transition: opacity 0.2s;
        }
        
        .btn:hover {
          opacity: 0.8;
        }
        
        .btn-primary {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          font-weight: 500;
        }
        
        .btn-secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(claimData.id)}: ${escapeHtml(claimData.title)}</h1>
        <div>
          <strong>Source:</strong> ${escapeHtml(claimData.source)}
          <span class="status ${claimData.verified ? 'status-verified' : 'status-unverified'}">
            ${claimData.verified ? '✅ Verified' : '❌ Unverified'}
          </span>
        </div>
        <div class="similarity">Similarity: ${similarity}%</div>
      </div>
      
      <div class="quote-section">
        <h3>Your Quote</h3>
        <div class="quote-text">${escapeHtml(yourQuote)}</div>
      </div>
      
      ${sourceQuote ? `
        <div class="quote-section">
          <h3>Source Text (Nearest Match)</h3>
          <div class="quote-text">${escapeHtml(sourceQuote)}</div>
        </div>
        
        ${diffHtml ? `
          <div class="diff-view">
            <h3>Differences</h3>
            <div class="quote-text">${diffHtml}</div>
          </div>
        ` : ''}
        
        ${claimData.contextBefore ? `
          <div class="context">
            <strong>Context Before:</strong><br>
            ${escapeHtml(claimData.contextBefore)}
          </div>
        ` : ''}
        
        ${claimData.contextAfter ? `
          <div class="context">
            <strong>Context After:</strong><br>
            ${escapeHtml(claimData.contextAfter)}
          </div>
        ` : ''}
      ` : `
        <div class="quote-section">
          <h3>⚠️ Source Text Not Found</h3>
          <p>${claimData.error || 'Could not find matching text in source file.'}</p>
        </div>
      `}
      
      <div class="actions">
        ${sourceQuote && !claimData.verified ? `
          <button class="btn btn-primary" onclick="replaceQuote()">
            Replace with Source Quote
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="goToClaim()">
          Go to Claim in File
        </button>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        
        function replaceQuote() {
          vscode.postMessage({
            command: 'replaceQuote',
            newQuote: ${JSON.stringify(sourceQuote)}
          });
        }
        
        function goToClaim() {
          vscode.postMessage({
            command: 'goToClaim'
          });
        }
      </script>
    </body>
    </html>
  `;
}

function generateDiffHtml(yourWords: string[], sourceWords: string[]): string {
  // Simple LCS-based diff
  const lcs = longestCommonSubsequence(yourWords, sourceWords);
  const lcsSet = new Set(lcs);
  
  let html = '<div>';
  
  // Show your quote with removals
  html += '<div style="margin-bottom: 15px;"><strong>Your version:</strong><br>';
  for (const word of yourWords) {
    if (lcsSet.has(word)) {
      html += `<span class="word-same">${escapeHtml(word)} </span>`;
    } else {
      html += `<span class="word-removed">${escapeHtml(word)} </span>`;
    }
  }
  html += '</div>';
  
  // Show source quote with additions
  html += '<div><strong>Source version:</strong><br>';
  for (const word of sourceWords) {
    if (lcsSet.has(word)) {
      html += `<span class="word-same">${escapeHtml(word)} </span>`;
    } else {
      html += `<span class="word-added">${escapeHtml(word)} </span>`;
    }
  }
  html += '</div>';
  
  html += '</div>';
  return html;
}

function longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1].toLowerCase() === arr2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1].toLowerCase() === arr2[j - 1].toLowerCase()) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

async function replaceQuoteInClaims(claimData: ClaimData, newQuote: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
  const fullPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);

  if (!fs.existsSync(fullPath)) {
    vscode.window.showErrorMessage('claims_and_evidence.md not found');
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  
  // Find and replace the quote
  const claimRegex = new RegExp(`(## ${claimData.id}:.*?\\*\\*Primary Quote\\*\\*[^\\n]*:\\n> )([^\\n]+)`, 's');
  const match = content.match(claimRegex);
  
  if (match) {
    content = content.replace(claimRegex, `$1${newQuote}`);
    fs.writeFileSync(fullPath, content);
    
    vscode.window.showInformationMessage(`Updated quote for ${claimData.id}`);
    
    // Clear cache and refresh
    claimsCache = null;
    validationCache.clear();
    claimsTreeProvider.refresh();
  } else {
    vscode.window.showErrorMessage(`Could not find quote for ${claimData.id}`);
  }
}

// Jump to claim function
async function jumpToClaim(claimId: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
  const masterIndexPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);

  if (!fs.existsSync(masterIndexPath)) {
    vscode.window.showErrorMessage('claims_and_evidence.md not found');
    return;
  }

  // Check if this is the new multi-file structure
  const masterContent = fs.readFileSync(masterIndexPath, 'utf-8');
  let targetFilePath = masterIndexPath;
  
  if (masterContent.includes('## Claim Categories and Files') || masterContent.includes('## Quick Reference: Claim ID to File Mapping')) {
    // New structure - find the category file for this claim
    const mappingRegex = new RegExp(`\\| ${claimId} \\| .+? \\| \\[\`(.+?)\`\\]`);
    const match = masterContent.match(mappingRegex);
    
    if (match) {
      const categoryFile = match[1];
      const claimsDir = path.join(path.dirname(masterIndexPath), 'claims');
      targetFilePath = path.join(claimsDir, categoryFile);
      
      if (!fs.existsSync(targetFilePath)) {
        vscode.window.showErrorMessage(`Category file not found: ${categoryFile}`);
        return;
      }
    } else {
      vscode.window.showWarningMessage(`Could not find ${claimId} in master index, opening master file`);
    }
  }

  const doc = await vscode.workspace.openTextDocument(targetFilePath);
  const editor = await vscode.window.showTextDocument(doc);

  // Find claim position
  const text = doc.getText();
  const claimPos = text.indexOf(`## ${claimId}:`);
  
  if (claimPos !== -1) {
    const position = doc.positionAt(claimPos);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }
}

// Extract PDF text function
async function extractPdfText(pdfPath: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Extracting text from ${path.basename(pdfPath)}`,
    cancellable: false
  }, async (progress) => {
    try {
      progress.report({ message: 'Running docling extraction...' });

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const extractScript = path.join(workspaceRoot, 'extract_with_docling.py');

      if (!fs.existsSync(extractScript)) {
        vscode.window.showErrorMessage('extract_with_docling.py not found in workspace root');
        return;
      }

      // Call extraction script with --pdf flag
      const { execSync } = require('child_process');
      const output = execSync(`python3 "${extractScript}" --pdf "${pdfPath}"`, {
        cwd: workspaceRoot,
        timeout: 120000, // 2 minute timeout
        encoding: 'utf-8'
      });

      console.log('Extraction output:', output);

      progress.report({ message: 'Extraction complete' });

      // Refresh sources tree
      if (sourcesTreeProvider) {
        sourcesTreeProvider.refresh();
      }

      vscode.window.showInformationMessage(`Extracted text from ${path.basename(pdfPath)}`);

      // Ask if user wants to open the extracted file
      const config = vscode.workspace.getConfiguration('citationHover');
      const extractedTextPath = config.get<string>('extractedTextPath', 'literature/ExtractedText');
      const extractedDir = path.join(workspaceRoot, extractedTextPath);
      
      // Find the newly created file (most recent .txt file)
      if (fs.existsSync(extractedDir)) {
        const files = fs.readdirSync(extractedDir)
          .filter(f => f.endsWith('.txt'))
          .map(f => ({
            name: f,
            path: path.join(extractedDir, f),
            mtime: fs.statSync(path.join(extractedDir, f)).mtime
          }))
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        if (files.length > 0) {
          const openFile = await vscode.window.showInformationMessage(
            'Open extracted text?',
            'Yes',
            'No'
          );

          if (openFile === 'Yes') {
            const doc = await vscode.workspace.openTextDocument(files[0].path);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          }
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Extraction failed: ${errorMsg}`);
    }
  });
}

// Open extracted text function
async function openExtractedText(pdfBaseName: string, folder: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const extractedTextPath = config.get<string>('extractedTextPath', 'literature/ExtractedText');
  const extractedDir = path.join(workspaceFolders[0].uri.fsPath, extractedTextPath);

  if (!fs.existsSync(extractedDir)) {
    vscode.window.showErrorMessage('Extracted text directory not found');
    return;
  }

  // Find matching extracted file
  const files = fs.readdirSync(extractedDir).filter(f => f.endsWith('.txt'));
  const matchingFile = files.find(f => 
    f.includes(pdfBaseName) || 
    f.includes(folder) ||
    pdfBaseName.includes(f.replace('.txt', ''))
  );

  if (matchingFile) {
    const filePath = path.join(extractedDir, matchingFile);
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  } else {
    vscode.window.showWarningMessage('Could not find extracted text file');
  }
}

async function validateAllQuotes(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Validating quotes",
    cancellable: false
  }, async (progress) => {
    progress.report({ message: "Loading claims..." });
    
    const config = vscode.workspace.getConfiguration('citationHover');
    const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
    const fullPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);
    
    if (!fs.existsSync(fullPath)) {
      vscode.window.showErrorMessage('claims_and_evidence.md not found');
      return;
    }

    const document = await vscode.workspace.openTextDocument(fullPath);
    
    if (!claimsCache) {
      claimsCache = await loadClaimsData(document.uri);
    }

    progress.report({ message: "Validating quotes..." });
    
    let verified = 0;
    let unverified = 0;
    let skipped = 0;
    
    for (const [id, claimData] of claimsCache) {
      await validateQuote(claimData, document.uri);
      
      if (claimData.verified === true) {
        verified++;
      } else if (claimData.verified === false) {
        unverified++;
      } else {
        skipped++;
      }
    }

    await validateDocumentQuotes(document);
    
    const total = verified + unverified;
    const message = `Validation complete: ${verified}/${total} verified (${skipped} skipped)`;
    
    if (unverified > 0) {
      vscode.window.showWarningMessage(message);
    } else {
      vscode.window.showInformationMessage(message);
    }
  });
}

export function deactivate() {
  claimsCache = null;
  validationCache.clear();
  if (claimsFileWatcher) {
    claimsFileWatcher.dispose();
  }
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}


// Outline-related functions
async function jumpToOutlineSection(section: any): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const outlinePath = config.get<string>('outlineFilePath', '03_Drafting/outline.md');
  const fullPath = path.join(workspaceFolders[0].uri.fsPath, outlinePath);

  if (!fs.existsSync(fullPath)) {
    vscode.window.showErrorMessage('Outline file not found');
    return;
  }

  const doc = await vscode.workspace.openTextDocument(fullPath);
  const editor = await vscode.window.showTextDocument(doc);

  // Jump to line number
  if (section.lineNumber !== undefined) {
    const position = new vscode.Position(section.lineNumber, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }
}

async function searchForSection(sectionId: string): Promise<void> {
  const section = outlineTreeProvider.getSection(sectionId);
  if (!section) {
    return;
  }

  if (section.suggestedSearches.length === 0) {
    vscode.window.showInformationMessage('No suggested searches for this section');
    return;
  }

  // Show quick pick of suggested searches
  const selected = await vscode.window.showQuickPick(section.suggestedSearches, {
    placeHolder: `Search Zotero for: ${section.title}`
  });

  if (!selected) {
    return;
  }

  // Execute search
  await executeZoteroSearchWithQuery(selected, section);
}

async function executeZoteroSearchWithQuery(query: string, section: any): Promise<void> {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Searching Zotero: "${query}"`,
    cancellable: false
  }, async (progress) => {
    try {
      const config = vscode.workspace.getConfiguration('citationHover');
      const resultLimit = config.get<number>('zoteroSearchLimit', 5);
      
      progress.report({ message: 'Querying Zotero library...' });
      
      const results = await executeZoteroSearch(query, resultLimit);
      
      if (!results || results.length === 0) {
        vscode.window.showInformationMessage(`No papers found for "${query}"`);
        return;
      }

      progress.report({ message: 'Displaying results...' });
      
      // Show results with section context
      await displaySearchResultsWithSection(query, results, section);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Zotero search failed: ${errorMsg}`);
    }
  });
}

async function displaySearchResultsWithSection(query: string, results: any[], section: any): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'zoteroSearchResults',
    `Zotero Search: ${section.title}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getSearchResultsHtmlWithSection(query, results, section);
  
  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'addToClaims':
          await addResultToClaimsWithSection(message.item, section);
          break;
        case 'copyBibTeX':
          await copyBibTeX(message.itemKey);
          break;
        case 'viewFullText':
          await viewFullText(message.itemKey);
          break;
        case 'openInZotero':
          await openInZotero(message.itemKey);
          break;
      }
    },
    undefined,
    []
  );
}

function getSearchResultsHtmlWithSection(query: string, results: any[], section: any): string {
  const sectionInfo = section ? `
    <div class="section-context">
      <strong>📖 For outline section:</strong> ${escapeHtml(section.title)}<br>
      <strong>Coverage:</strong> ${section.linkedClaims?.length || 0} claims currently linked
    </div>
  ` : '';

  const resultsHtml = results.map((item, index) => {
    const authors = item.creators && item.creators.length > 0
      ? item.creators.map((c: any) => c.lastName || c.name).join(', ')
      : 'Unknown authors';
    
    const year = item.date ? extractYear(item.date) : 'n.d.';
    const relevance = item.similarity ? (item.similarity * 100).toFixed(0) : '?';
    const abstract = item.abstractNote || 'No abstract available';
    
    return `
      <div class="result-card">
        <div class="result-header">
          <div class="result-number">${index + 1}</div>
          <div class="result-title-section">
            <h3 class="result-title">${escapeHtml(item.title || 'Untitled')}</h3>
            <div class="result-meta">
              <span class="authors">${escapeHtml(authors)}</span>
              <span class="year">${escapeHtml(year)}</span>
              <span class="relevance">${relevance}% relevant</span>
            </div>
          </div>
        </div>
        
        <div class="result-abstract">
          <details>
            <summary>Abstract</summary>
            <p>${escapeHtml(abstract)}</p>
          </details>
        </div>
        
        <div class="result-actions">
          <button class="btn btn-primary" onclick="addToClaims(${index})">
            ➕ Add to Claims (for this section)
          </button>
          <button class="btn btn-secondary" onclick="viewFullText('${escapeHtml(item.key || '')}')">
            📄 View Full Text
          </button>
          <button class="btn btn-secondary" onclick="openInZotero('${escapeHtml(item.key || '')}')">
            🔗 Open in Zotero
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
          line-height: 1.6;
        }
        .header {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid var(--vscode-panel-border);
        }
        .section-context {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 4px solid var(--vscode-textBlockQuote-border);
          padding: 12px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .result-card {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .result-header {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
        }
        .result-number {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        .result-title {
          margin: 0 0 8px 0;
          font-size: 1.2em;
        }
        .result-meta {
          display: flex;
          gap: 15px;
          font-size: 0.9em;
          color: var(--vscode-descriptionForeground);
        }
        .result-abstract details {
          cursor: pointer;
        }
        .result-abstract summary {
          color: var(--vscode-textLink-foreground);
          font-weight: 500;
          padding: 5px 0;
        }
        .result-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid var(--vscode-panel-border);
        }
        .btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }
        .btn-primary {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          font-weight: 500;
        }
        .btn-secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔍 Zotero Search Results</h1>
        <div class="query">"${escapeHtml(query)}"</div>
        <div>${results.length} papers found</div>
      </div>
      
      ${sectionInfo}
      ${resultsHtml}
      
      <script>
        const vscode = acquireVsCodeApi();
        const results = ${JSON.stringify(results)};
        
        function addToClaims(index) {
          vscode.postMessage({
            command: 'addToClaims',
            item: results[index]
          });
        }
        
        function viewFullText(itemKey) {
          vscode.postMessage({
            command: 'viewFullText',
            itemKey: itemKey
          });
        }
        
        function openInZotero(itemKey) {
          vscode.postMessage({
            command: 'openInZotero',
            itemKey: itemKey
          });
        }
      </script>
    </body>
    </html>
  `;
}

async function addResultToClaimsWithSection(item: any, section: any): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const config = vscode.workspace.getConfiguration('citationHover');
  const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
  const fullPath = path.join(workspaceFolders[0].uri.fsPath, claimsPath);

  if (!fs.existsSync(fullPath)) {
    vscode.window.showErrorMessage('claims_and_evidence.md not found');
    return;
  }

  // Read current claims to get next ID
  const content = fs.readFileSync(fullPath, 'utf-8');
  const claimIds = Array.from(content.matchAll(/## (C_\d+):/g)).map(m => m[1]);
  const nextId = getNextClaimId(claimIds);

  // Extract info from item
  const authors = item.creators && item.creators.length > 0
    ? item.creators.map((c: any) => c.lastName || c.name).join(', ')
    : 'Unknown';
  const year = item.date ? extractYear(item.date) : 'n.d.';
  const firstAuthor = getFirstAuthor(item);
  const authorYear = `${firstAuthor}${year}`;
  const title = item.title || 'Untitled';
  const abstract = item.abstractNote || '';

  // Pre-fill claim title with section context
  const suggestedTitle = section 
    ? `[For: ${section.title}] ${title.substring(0, 60)}`
    : title.substring(0, 100);

  const claimTitle = await vscode.window.showInputBox({
    prompt: 'Enter claim title',
    placeHolder: 'Brief description of the claim',
    value: suggestedTitle
  });

  if (!claimTitle) {
    return;
  }

  const category = await vscode.window.showQuickPick(
    ['Method', 'Result', 'Challenge', 'Context', 'Application', 'Theory'],
    { placeHolder: 'Select claim category' }
  );

  if (!category) {
    return;
  }

  const context = await vscode.window.showInputBox({
    prompt: 'Enter context/nuance (optional)',
    placeHolder: 'Additional context about this claim',
    value: section ? `Related to outline section: ${section.title}` : ''
  });

  // Create new claim entry
  const newClaim = `
## ${nextId}: ${claimTitle}

**Category**: ${category}  
**Source**: ${authorYear} (Source ID: TBD)  
**Context**: ${context || 'TBD'}
${section ? `**Outline Section**: ${section.id} - ${section.title}` : ''}

**Primary Quote**:
> [Note: Extract specific quote from paper]

**Supporting Quotes**:
> [Note: Add supporting quotes if needed]

**Notes**:
- Title: ${title}
- Authors: ${authors}
- Year: ${year}
${abstract ? `- Abstract: ${abstract.substring(0, 200)}...` : ''}
- Zotero Key: ${item.key || 'N/A'}

---
`;

  fs.appendFileSync(fullPath, newClaim);

  const doc = await vscode.workspace.openTextDocument(fullPath);
  const editor = await vscode.window.showTextDocument(doc);
  
  const text = doc.getText();
  const claimPos = text.indexOf(`## ${nextId}:`);
  if (claimPos !== -1) {
    const position = doc.positionAt(claimPos);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }

  vscode.window.showInformationMessage(`Added ${nextId} for section: ${section.title}`);
  
  claimsCache = null;
  outlineTreeProvider.refresh();
}

async function showSectionGaps(): Promise<void> {
  const sections = outlineTreeProvider.getAllSections();
  
  if (sections.length === 0) {
    vscode.window.showInformationMessage('No outline sections found');
    return;
  }

  // Analyze gaps
  const gaps = sections
    .filter(s => s.coverage === 'none' || s.coverage === 'partial')
    .sort((a, b) => a.lineNumber - b.lineNumber);

  if (gaps.length === 0) {
    vscode.window.showInformationMessage('✅ All sections have good coverage!');
    return;
  }

  // Create gap report
  const panel = vscode.window.createWebviewPanel(
    'sectionGaps',
    'Research Gaps Analysis',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getGapReportHtml(sections, gaps);
}

function getGapReportHtml(allSections: any[], gaps: any[]): string {
  const totalSections = allSections.length;
  const goodCoverage = allSections.filter(s => s.coverage === 'good').length;
  const partialCoverage = allSections.filter(s => s.coverage === 'partial').length;
  const noCoverage = allSections.filter(s => s.coverage === 'none').length;

  const gapsHtml = gaps.map(section => {
    const icon = section.coverage === 'none' ? '❌' : '⚠️';
    const status = section.coverage === 'none' ? 'No claims' : 'Needs more claims';
    
    return `
      <div class="gap-card ${section.coverage}">
        <div class="gap-header">
          <span class="gap-icon">${icon}</span>
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <div class="gap-status">${status} (${section.linkedClaims.length} claims, ${section.questions.length} questions)</div>
          </div>
        </div>
        
        ${section.questions.length > 0 ? `
          <div class="gap-questions">
            <strong>Questions to answer:</strong>
            <ul>
              ${section.questions.slice(0, 3).map((q: string) => `<li>${escapeHtml(q)}</li>`).join('')}
              ${section.questions.length > 3 ? `<li><em>...and ${section.questions.length - 3} more</em></li>` : ''}
            </ul>
          </div>
        ` : ''}
        
        ${section.suggestedSearches.length > 0 ? `
          <div class="gap-searches">
            <strong>🔍 Suggested searches:</strong>
            <ul>
              ${section.suggestedSearches.map((s: string) => `<li><code>${escapeHtml(s)}</code></li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
          line-height: 1.6;
        }
        .header {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--vscode-panel-border);
        }
        .stats {
          display: flex;
          gap: 20px;
          margin: 20px 0;
        }
        .stat-card {
          flex: 1;
          padding: 15px;
          border-radius: 6px;
          text-align: center;
        }
        .stat-card.good {
          background-color: rgba(0, 255, 0, 0.1);
          border: 1px solid rgba(0, 255, 0, 0.3);
        }
        .stat-card.partial {
          background-color: rgba(255, 165, 0, 0.1);
          border: 1px solid rgba(255, 165, 0, 0.3);
        }
        .stat-card.none {
          background-color: rgba(255, 0, 0, 0.1);
          border: 1px solid rgba(255, 0, 0, 0.3);
        }
        .stat-number {
          font-size: 2em;
          font-weight: bold;
        }
        .gap-card {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .gap-card.none {
          border-left: 4px solid rgba(255, 0, 0, 0.5);
        }
        .gap-card.partial {
          border-left: 4px solid rgba(255, 165, 0, 0.5);
        }
        .gap-header {
          display: flex;
          gap: 15px;
          align-items: start;
          margin-bottom: 15px;
        }
        .gap-icon {
          font-size: 1.5em;
        }
        .gap-header h3 {
          margin: 0 0 5px 0;
        }
        .gap-status {
          color: var(--vscode-descriptionForeground);
          font-size: 0.9em;
        }
        .gap-questions, .gap-searches {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid var(--vscode-panel-border);
        }
        ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        code {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Research Gaps Analysis</h1>
        <p>Coverage overview for your outline sections</p>
      </div>
      
      <div class="stats">
        <div class="stat-card good">
          <div class="stat-number">${goodCoverage}</div>
          <div>✅ Good Coverage</div>
        </div>
        <div class="stat-card partial">
          <div class="stat-number">${partialCoverage}</div>
          <div>⚠️ Partial Coverage</div>
        </div>
        <div class="stat-card none">
          <div class="stat-number">${noCoverage}</div>
          <div>❌ No Coverage</div>
        </div>
      </div>
      
      <h2>Sections Needing Attention (${gaps.length})</h2>
      ${gapsHtml}
      
      ${gaps.length === 0 ? '<p style="text-align: center; padding: 40px;">🎉 All sections have good coverage!</p>' : ''}
    </body>
    </html>
  `;
}
