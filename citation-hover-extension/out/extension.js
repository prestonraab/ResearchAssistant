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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let claimsCache = null;
let claimsFileWatcher = null;
let diagnosticCollection;
let validationCache = new Map();
function activate(context) {
    console.log('Citation Hover extension is now active');
    // Create diagnostic collection
    diagnosticCollection = vscode.languages.createDiagnosticCollection('citationHover');
    context.subscriptions.push(diagnosticCollection);
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
    // Watch for changes to claims file
    setupFileWatcher(context);
    // Clear cache when configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('citationHover')) {
            claimsCache = null;
            validationCache.clear();
            setupFileWatcher(context);
        }
    }));
    // Validate on file open/save
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (shouldValidateDocument(doc)) {
            validateDocumentQuotes(doc);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
        if (shouldValidateDocument(doc)) {
            validateDocumentQuotes(doc);
        }
    }));
    context.subscriptions.push(hoverProvider, validateCommand, clearCacheCommand);
}
function setupFileWatcher(context) {
    if (claimsFileWatcher) {
        claimsFileWatcher.dispose();
    }
    const config = vscode.workspace.getConfiguration('citationHover');
    const searchPattern = config.get('searchPattern', '**/claims_and_evidence.md');
    claimsFileWatcher = vscode.workspace.createFileSystemWatcher(searchPattern);
    claimsFileWatcher.onDidChange(() => {
        claimsCache = null;
        validationCache.clear();
        console.log('Claims file changed, cache cleared');
    });
    context.subscriptions.push(claimsFileWatcher);
}
async function provideClaimHover(document, position) {
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
    const verificationIcon = claimData.verified ? '✅' : '❌';
    const verificationText = claimData.verified
        ? `Verified (${(claimData.similarity * 100).toFixed(0)}% match)`
        : '⚠️ Quote not found in source';
    markdown.appendMarkdown(`${verificationIcon} **${claimId}**: ${claimData.title}\n\n`);
    markdown.appendMarkdown(`**Category**: ${claimData.category}  \n`);
    markdown.appendMarkdown(`**Source**: ${claimData.source}  \n`);
    markdown.appendMarkdown(`**Verification**: ${verificationText}\n\n`);
    if (claimData.primaryQuote && !claimData.primaryQuote.includes('[Note:')) {
        markdown.appendMarkdown(`> ${claimData.primaryQuote}\n\n`);
    }
    else {
        markdown.appendMarkdown(`*[Quotes to be extracted]*\n\n`);
    }
    if (claimData.context) {
        markdown.appendMarkdown(`*Context: ${claimData.context}*`);
    }
    return new vscode.Hover(markdown, range);
}
async function findClaimsFile(workspaceFolder) {
    const config = vscode.workspace.getConfiguration('citationHover');
    const configuredPath = config.get('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
    // Try configured path first
    const fullPath = path.join(workspaceFolder.uri.fsPath, configuredPath);
    if (fs.existsSync(fullPath)) {
        console.log(`Found claims file at configured path: ${fullPath}`);
        return fullPath;
    }
    // Fall back to searching with glob pattern
    const searchPattern = config.get('searchPattern', '**/claims_and_evidence.md');
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, searchPattern), '**/node_modules/**', 1);
    if (files.length > 0) {
        console.log(`Found claims file via search: ${files[0].fsPath}`);
        return files[0].fsPath;
    }
    return null;
}
async function loadClaimsData(documentUri) {
    const claims = new Map();
    // Find workspace folder
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    if (!workspaceFolder) {
        return claims;
    }
    // Find claims file
    const claimsFilePath = await findClaimsFile(workspaceFolder);
    if (!claimsFilePath) {
        vscode.window.showWarningMessage('Citation Hover: claims_and_evidence.md not found. Check extension settings.');
        return claims;
    }
    const content = fs.readFileSync(claimsFilePath, 'utf-8');
    // Parse claims using regex
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
function normalizeText(text) {
    // Remove extra whitespace and normalize
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
function similarityScore(str1, str2) {
    // Simple Levenshtein-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) {
        return 1.0;
    }
    // Check if shorter is contained in longer
    if (longer.includes(shorter)) {
        return shorter.length / longer.length;
    }
    return 0;
}
async function validateQuote(claimData, documentUri) {
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
        return;
    }
    const config = vscode.workspace.getConfiguration('citationHover');
    const extractedTextPath = config.get('extractedTextPath', 'literature/ExtractedText');
    const threshold = config.get('validationThreshold', 0.85);
    const extractedTextDir = path.join(workspaceFolder.uri.fsPath, extractedTextPath);
    if (!fs.existsSync(extractedTextDir)) {
        return;
    }
    // Find source file
    const authorYear = claimData.source.split(' ')[0]; // Extract AuthorYear from "AuthorYear (Source ID: X)"
    const files = fs.readdirSync(extractedTextDir);
    const sourceFile = files.find(f => f.includes(authorYear) && f.endsWith('.txt'));
    if (!sourceFile) {
        claimData.verified = false;
        claimData.similarity = 0;
        validationCache.set(cacheKey, false);
        return;
    }
    // Read and search source file
    const sourceFilePath = path.join(extractedTextDir, sourceFile);
    const sourceText = fs.readFileSync(sourceFilePath, 'utf-8');
    const normalizedQuote = normalizeText(claimData.primaryQuote);
    const normalizedSource = normalizeText(sourceText);
    // Check for exact match
    if (normalizedSource.includes(normalizedQuote)) {
        claimData.verified = true;
        claimData.similarity = 1.0;
        validationCache.set(cacheKey, true);
        return;
    }
    // Fuzzy match with sliding window
    const quoteWords = normalizedQuote.split(' ');
    const sourceWords = normalizedSource.split(' ');
    const windowSize = quoteWords.length;
    let bestSimilarity = 0;
    for (let i = 0; i <= sourceWords.length - windowSize; i++) {
        const window = sourceWords.slice(i, i + windowSize).join(' ');
        const similarity = similarityScore(normalizedQuote, window);
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
        }
        if (bestSimilarity >= threshold) {
            break;
        }
    }
    claimData.verified = bestSimilarity >= threshold;
    claimData.similarity = bestSimilarity;
    validationCache.set(cacheKey, claimData.verified);
}
function shouldValidateDocument(document) {
    return document.fileName.includes('claims_and_evidence.md');
}
async function validateDocumentQuotes(document) {
    const config = vscode.workspace.getConfiguration('citationHover');
    if (!config.get('showDiagnostics', true)) {
        return;
    }
    if (!claimsCache) {
        claimsCache = await loadClaimsData(document.uri);
    }
    const diagnostics = [];
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
            const diagnostic = new vscode.Diagnostic(range, `Quote for ${claimId} could not be verified in source file (${(claimData.similarity * 100).toFixed(0)}% similarity)`, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = 'Citation Hover';
            diagnostics.push(diagnostic);
        }
    }
    diagnosticCollection.set(document.uri, diagnostics);
}
async function validateAllQuotes() {
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
        const claimsPath = config.get('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
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
            }
            else if (claimData.verified === false) {
                unverified++;
            }
            else {
                skipped++;
            }
        }
        await validateDocumentQuotes(document);
        const total = verified + unverified;
        const message = `Validation complete: ${verified}/${total} verified (${skipped} skipped)`;
        if (unverified > 0) {
            vscode.window.showWarningMessage(message);
        }
        else {
            vscode.window.showInformationMessage(message);
        }
    });
}
function deactivate() {
    claimsCache = null;
    validationCache.clear();
    if (claimsFileWatcher) {
        claimsFileWatcher.dispose();
    }
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}
//# sourceMappingURL=extension.js.map