import * as vscode from 'vscode';
import * as path from 'path';
import { OutlineParser } from './outlineParser';
import { ClaimsManager } from './claimsManager';
import { MCPClientManager } from '../mcp/mcpClient';
import { EmbeddingService } from './embeddingService';
import { PaperRanker } from './paperRanker';
import { CoverageAnalyzer } from './coverageAnalyzer';
import { ReadingStatusManager } from './readingStatusManager';
import { ClaimExtractor } from './claimExtractor';
import { PositionMapper } from './positionMapper';
import { PDFExtractionService } from './pdfExtractionService';
import { CitationNetworkAnalyzer } from './citationNetworkAnalyzer';
import { BatchOperationHandler } from './batchOperationHandler';
import { ExportService } from './exportService';
import { ConfigurationManager } from './configurationManager';
import { UnifiedSearchService } from './unifiedSearchService';
import { QuoteVerificationService } from './quoteVerificationService';

export interface ExtensionConfig {
  outlinePath: string;
  claimsDatabasePath: string;
  extractedTextPath: string;
  coverageThresholds: {
    low: number;
    moderate: number;
    strong: number;
  };
  embeddingCacheSize: number;
}

export class ExtensionState {
  private context: vscode.ExtensionContext;
  private config: ExtensionConfig;
  private workspaceRoot: string;
  
  public outlineParser: OutlineParser;
  public claimsManager: ClaimsManager;
  public mcpClient: MCPClientManager;
  public embeddingService: EmbeddingService;
  public paperRanker: PaperRanker;
  public coverageAnalyzer: CoverageAnalyzer;
  public readingStatusManager: ReadingStatusManager;
  public claimExtractor: ClaimExtractor;
  public positionMapper?: PositionMapper;
  public pdfExtractionService: PDFExtractionService;
  public citationNetworkAnalyzer: CitationNetworkAnalyzer;
  public batchOperationHandler: BatchOperationHandler;
  public exportService: ExportService;
  public configurationManager: ConfigurationManager;
  public unifiedSearchService: UnifiedSearchService;
  public quoteVerificationService: QuoteVerificationService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Get workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder found. Please open a workspace to use Research Assistant.');
    }
    this.workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Load configuration
    this.config = this.loadConfiguration();

    // Initialize components
    this.outlineParser = new OutlineParser(this.getAbsolutePath(this.config.outlinePath));
    this.claimsManager = new ClaimsManager(this.getAbsolutePath(this.config.claimsDatabasePath));
    this.mcpClient = new MCPClientManager();
    this.embeddingService = new EmbeddingService(this.config.embeddingCacheSize);
    this.paperRanker = new PaperRanker(this.embeddingService);
    this.coverageAnalyzer = new CoverageAnalyzer();
    this.readingStatusManager = new ReadingStatusManager(context);
    this.claimExtractor = new ClaimExtractor(this.embeddingService);
    this.configurationManager = new ConfigurationManager(context);
    this.quoteVerificationService = new QuoteVerificationService(this.mcpClient, this.claimsManager);
    this.pdfExtractionService = new PDFExtractionService(this.mcpClient, this.workspaceRoot);
    this.citationNetworkAnalyzer = new CitationNetworkAnalyzer();
    this.batchOperationHandler = new BatchOperationHandler(
      this.claimsManager,
      this.readingStatusManager,
      this.quoteVerificationService
    );
    this.exportService = new ExportService();
    this.unifiedSearchService = new UnifiedSearchService(
      this.mcpClient,
      this.claimsManager,
      this.embeddingService,
      this.workspaceRoot
    );
  }

  async initialize(): Promise<void> {
    // Load initial data
    await this.outlineParser.parse();
    await this.claimsManager.loadClaims();
    
    // Set up file watchers
    this.setupFileWatchers();
  }

  /**
   * Initialize the position mapper with the claims panel provider.
   * This should be called after the claims panel provider is created.
   */
  initializePositionMapper(claimsPanelProvider: any): void {
    const draftingPath = this.config.outlinePath.split('/')[0]; // Extract '03_Drafting'
    this.positionMapper = new PositionMapper(
      this.outlineParser,
      claimsPanelProvider,
      this.claimsManager,
      draftingPath
    );
  }

  private loadConfiguration(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('researchAssistant');
    return {
      outlinePath: config.get<string>('outlinePath', '03_Drafting/outline.md'),
      claimsDatabasePath: config.get<string>('claimsDatabasePath', '01_Knowledge_Base/claims_and_evidence.md'),
      extractedTextPath: config.get<string>('extractedTextPath', 'literature/ExtractedText'),
      coverageThresholds: config.get('coverageThresholds', { low: 3, moderate: 6, strong: 7 }),
      embeddingCacheSize: config.get<number>('embeddingCacheSize', 1000)
    };
  }

  reloadConfiguration(): void {
    this.config = this.loadConfiguration();
    // Reinitialize components with new paths if needed
    this.outlineParser.updatePath(this.getAbsolutePath(this.config.outlinePath));
    this.claimsManager.updatePath(this.getAbsolutePath(this.config.claimsDatabasePath));
  }

  private setupFileWatchers(): void {
    // Debounce timers
    let outlineDebounceTimer: NodeJS.Timeout | undefined;
    let claimsDebounceTimer: NodeJS.Timeout | undefined;
    
    // Watch outline file
    const outlineWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, this.config.outlinePath)
    );
    
    outlineWatcher.onDidChange(() => {
      // Clear existing timer
      if (outlineDebounceTimer) {
        clearTimeout(outlineDebounceTimer);
      }
      
      // Set new timer to parse after 500ms of inactivity
      outlineDebounceTimer = setTimeout(() => {
        this.outlineParser.parse().catch(error => {
          console.error('Error parsing outline:', error);
        });
      }, 500);
    });

    // Watch claims database
    const claimsWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, this.config.claimsDatabasePath)
    );
    
    claimsWatcher.onDidChange(() => {
      // Clear existing timer
      if (claimsDebounceTimer) {
        clearTimeout(claimsDebounceTimer);
      }
      
      // Set new timer to reload after 500ms of inactivity
      claimsDebounceTimer = setTimeout(() => {
        this.claimsManager.loadClaims().catch(error => {
          console.error('Error loading claims:', error);
        });
      }, 500);
    });

    this.context.subscriptions.push(outlineWatcher, claimsWatcher);
  }

  getAbsolutePath(relativePath: string): string {
    return path.join(this.workspaceRoot, relativePath);
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  getConfig(): ExtensionConfig {
    return this.config;
  }

  async analyzeCoverage(): Promise<void> {
    // Placeholder for coverage analysis
    // Will be implemented in later tasks
    console.log('Analyzing coverage...');
  }

  dispose(): void {
    // Cleanup resources
    this.mcpClient.dispose();
    this.positionMapper?.dispose();
  }
}
