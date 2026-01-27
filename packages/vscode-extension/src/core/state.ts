import * as vscode from 'vscode';
import * as path from 'path';
import { OutlineParser } from './outlineParserWrapper';
import { ClaimsManager } from './claimsManagerWrapper';
import { MCPClientManager } from '../mcp/mcpClient';
import { EmbeddingService, PaperRanker } from '@research-assistant/core';
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
import { AutoQuoteVerifier } from './autoQuoteVerifier';
import { FulltextStatusManager } from './fulltextStatusManager';
import { ManuscriptContextDetector } from './manuscriptContextDetector';
import { ClaimSupportValidator } from './claimSupportValidator';

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
  private fileWatchers: vscode.FileSystemWatcher[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
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
  public autoQuoteVerifier: AutoQuoteVerifier;
  public fulltextStatusManager: FulltextStatusManager;
  public manuscriptContextDetector: ManuscriptContextDetector;
  public claimSupportValidator: ClaimSupportValidator;

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
    
    // Initialize EmbeddingService with OpenAI API key from settings
    const config = vscode.workspace.getConfiguration('researchAssistant');
    const apiKey = config.get<string>('openaiApiKey');
    
    if (!apiKey) {
      vscode.window.showErrorMessage(
        'OpenAI API key not configured. Please set researchAssistant.openaiApiKey in settings.',
        'Open Settings'
      ).then(action => {
        if (action === 'Open Settings') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'researchAssistant.openaiApiKey'
          );
        }
      });
    }
    
    const cacheDir = path.join(this.workspaceRoot, '.cache', 'embeddings');
    const embeddingModel = config.get<string>('embeddingModel') || 'text-embedding-3-small';
    const maxCacheSize = config.get<number>('embeddingCacheSize') || 1000;
    
    this.embeddingService = new EmbeddingService(
      apiKey || '',
      cacheDir,
      maxCacheSize,
      embeddingModel
    );
    this.paperRanker = new PaperRanker(this.embeddingService, this.outlineParser.getCoreParser());
    this.coverageAnalyzer = new CoverageAnalyzer(this.claimsManager, this.embeddingService);
    this.readingStatusManager = new ReadingStatusManager(context);
    this.claimExtractor = new ClaimExtractor(this.embeddingService);
    this.configurationManager = new ConfigurationManager(context);
    this.quoteVerificationService = new QuoteVerificationService(this.mcpClient, this.claimsManager);
    this.autoQuoteVerifier = new AutoQuoteVerifier(this.claimsManager, this.mcpClient);
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
    this.fulltextStatusManager = new FulltextStatusManager(
      this.mcpClient,
      this.pdfExtractionService,
      this.outlineParser,
      this.workspaceRoot
    );
    this.manuscriptContextDetector = new ManuscriptContextDetector(
      this.workspaceRoot,
      this.claimsManager,
      this.config.coverageThresholds
    );
    this.claimSupportValidator = new ClaimSupportValidator(
      this.embeddingService,
      this.mcpClient,
      this.getAbsolutePath(this.config.extractedTextPath)
    );
    
    // Hook up auto-verification to claim save events (Requirement 43.1)
    this.claimsManager.onClaimSaved((claim) => {
      this.autoQuoteVerifier.verifyOnSave(claim);
    });
  }

  async initialize(): Promise<void> {
    // DON'T load data on startup - use lazy loading instead
    // Just set up file watchers
    this.setupFileWatchers();
    
    // Log when background loading starts
    console.log('[ResearchAssistant] Starting background data load...');
    
    // Parse outline in background (non-blocking)
    this.outlineParser.parse()
      .then(() => console.log('[ResearchAssistant] Outline parsed'))
      .catch(error => console.error('Failed to parse outline:', error));
    
    // Load claims in background (non-blocking) with delay
    setTimeout(() => {
      this.claimsManager.loadClaims()
        .then(() => console.log('[ResearchAssistant] Claims loaded'))
        .catch(error => console.error('Failed to load claims:', error));
    }, 2000); // Delay claims loading by 2 seconds
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
    // Watch outline file
    const outlineWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, this.config.outlinePath)
    );
    
    outlineWatcher.onDidChange(() => {
      // Clear existing timer
      const existingTimer = this.debounceTimers.get('outline');
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer to parse after 500ms of inactivity
      const timer = setTimeout(() => {
        this.outlineParser.parse().catch(error => {
          console.error('Error parsing outline:', error);
        });
        this.debounceTimers.delete('outline');
      }, 500);
      
      this.debounceTimers.set('outline', timer);
    });

    // Watch claims database
    const claimsWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, this.config.claimsDatabasePath)
    );
    
    claimsWatcher.onDidChange(() => {
      // Clear existing timer
      const existingTimer = this.debounceTimers.get('claims');
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Set new timer to reload after 500ms of inactivity
      const timer = setTimeout(() => {
        this.claimsManager.loadClaims().catch(error => {
          console.error('Error loading claims:', error);
        });
        this.debounceTimers.delete('claims');
      }, 500);
      
      this.debounceTimers.set('claims', timer);
    });

    this.fileWatchers.push(outlineWatcher, claimsWatcher);
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
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Dispose file watchers
    for (const watcher of this.fileWatchers) {
      watcher.dispose();
    }
    this.fileWatchers = [];
    
    // Cleanup resources
    this.mcpClient.dispose();
    this.embeddingService.clearCache();
    this.positionMapper?.dispose();
    this.manuscriptContextDetector.dispose();
  }
}
