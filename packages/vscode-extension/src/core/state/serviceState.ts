import * as vscode from 'vscode';
import * as path from 'path';
import { CoreState } from './coreState';
import { OutlineParser } from '../outlineParserWrapper';
import { ClaimsManager } from '../claimsManagerWrapper';
import { EmbeddingService, PaperRanker, QuoteManager, SentenceParser, ZoteroClient, ZoteroImportManager, SyncManager } from '@research-assistant/core';
import { CoverageAnalyzer } from '../coverageAnalyzer';
import { ReadingStatusManager } from '../readingStatusManager';
import { ClaimExtractor } from '../claimExtractor';
import { PDFExtractionService } from '../pdfExtractionService';
import { CitationNetworkAnalyzer } from '../citationNetworkAnalyzer';
import { BatchOperationHandler } from '../batchOperationHandler';
import { ExportService } from '../exportService';
import { ConfigurationManager } from '../configurationManager';
import { UnifiedSearchService } from '../unifiedSearchService';
import { QuoteVerificationService } from '../quoteVerificationService';
import { AutoQuoteVerifier } from '../autoQuoteVerifier';
import { VerificationFeedbackLoop } from '../../services/verificationFeedbackLoop';
import { LiteratureIndexer } from '../../services/literatureIndexer';
import { UnifiedQuoteSearch } from '../../services/unifiedQuoteSearch';
import { ZoteroAvailabilityManager } from '../../services/zoteroAvailabilityManager';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { OrphanCitationValidator, CitationSourceMapper } from '@research-assistant/core';
import { ApiKeyValidator } from '../apiKeyValidator';
import { ZoteroLeadQueue } from '../../services/zoteroLeadQueue';

/** Service state: all service instances and their initialization. */
export class ServiceState {
  public outlineParser: OutlineParser;
  public claimsManager: ClaimsManager; // This is the wrapper class, not the interface
  public embeddingService: EmbeddingService;
  public paperRanker: PaperRanker;
  public coverageAnalyzer: CoverageAnalyzer;
  public readingStatusManager: ReadingStatusManager;
  public claimExtractor: ClaimExtractor;
  public literatureIndexer: LiteratureIndexer;
  public unifiedQuoteSearch: UnifiedQuoteSearch;
  public pdfExtractionService: PDFExtractionService;
  public citationNetworkAnalyzer: CitationNetworkAnalyzer;
  public batchOperationHandler: BatchOperationHandler;
  public exportService: ExportService;
  public configurationManager: ConfigurationManager;
  public unifiedSearchService: UnifiedSearchService;
  public quoteVerificationService: QuoteVerificationService;
  public autoQuoteVerifier: AutoQuoteVerifier;
  public verificationFeedbackLoop: VerificationFeedbackLoop;
  public zoteroAvailabilityManager: ZoteroAvailabilityManager;
  public zoteroClient: ZoteroClient;
  public quoteManager: QuoteManager;
  public sentenceClaimQuoteLinkManager: SentenceClaimQuoteLinkManager;
  public sentenceParser: SentenceParser;
  public zoteroImportManager: ZoteroImportManager;
  public syncManager: SyncManager;
  public orphanCitationValidator: OrphanCitationValidator;
  public citationSourceMapper: CitationSourceMapper;
  public zoteroLeadQueue: ZoteroLeadQueue;

  constructor(coreState: CoreState) {
    const { config, workspaceRoot, context } = coreState;
    const apiKey = ApiKeyValidator.getApiKey();
    const cfg = vscode.workspace.getConfiguration('researchAssistant');
    const cacheDir = path.join(workspaceRoot, '.cache', 'embeddings');

    // Log API key status
    if (!apiKey || apiKey.trim() === '') {
      console.warn('[ServiceState] OpenAI API key not configured - embedding features will be disabled');
    } else {
      console.log('[ServiceState] OpenAI API key configured');
    }

    this.outlineParser = new OutlineParser(coreState.getAbsolutePath(config.outlinePath));
    this.claimsManager = new ClaimsManager(coreState.getAbsolutePath(config.claimsDatabasePath)) as any;
    this.embeddingService = new EmbeddingService(apiKey, cacheDir, cfg.get<number>('embeddingCacheSize') || 100, cfg.get<string>('embeddingModel') || 'text-embedding-3-small') as any;
    this.paperRanker = new PaperRanker(this.embeddingService, this.outlineParser.getCoreParser());
    this.coverageAnalyzer = new CoverageAnalyzer(this.claimsManager as any, this.embeddingService as any);
    this.readingStatusManager = new ReadingStatusManager(context);
    this.claimExtractor = new ClaimExtractor(this.embeddingService);
    this.configurationManager = new ConfigurationManager(context);
    this.sentenceParser = new SentenceParser();
    this.sentenceClaimQuoteLinkManager = new SentenceClaimQuoteLinkManager(this.claimsManager, workspaceRoot);
    this.pdfExtractionService = new PDFExtractionService(workspaceRoot);
    this.citationNetworkAnalyzer = new CitationNetworkAnalyzer();
    this.zoteroClient = new ZoteroClient();
    this.unifiedSearchService = new UnifiedSearchService(this.zoteroClient, this.claimsManager, this.embeddingService, workspaceRoot);
    
    // Initialize shared literature indexer and unified quote search (single instance for all services)
    this.literatureIndexer = new LiteratureIndexer(workspaceRoot, this.embeddingService, config.extractedTextPath);
    this.unifiedQuoteSearch = new UnifiedQuoteSearch(this.literatureIndexer, workspaceRoot);
    
    // Services that depend on unifiedQuoteSearch
    this.quoteVerificationService = new QuoteVerificationService(this.claimsManager, workspaceRoot, this.embeddingService, this.unifiedQuoteSearch);
    this.autoQuoteVerifier = new AutoQuoteVerifier(this.claimsManager, this.embeddingService, this.unifiedQuoteSearch);
    this.verificationFeedbackLoop = new VerificationFeedbackLoop(this.literatureIndexer, apiKey, coreState.getAbsolutePath(config.extractedTextPath), workspaceRoot);
    
    this.batchOperationHandler = new BatchOperationHandler(this.claimsManager, this.readingStatusManager, this.quoteVerificationService);
    this.exportService = new ExportService(this.sentenceClaimQuoteLinkManager, this.claimsManager, this.sentenceParser);
    this.zoteroAvailabilityManager = new ZoteroAvailabilityManager(this.zoteroClient);
    this.quoteManager = new QuoteManager();
    this.claimsManager.onClaimSaved((claim) => this.autoQuoteVerifier.verifyOnSave(claim));
    
    // Initialize Zotero import and sync managers
    this.zoteroImportManager = new ZoteroImportManager(
      this.zoteroClient as any, // ZoteroClient implements ZoteroMCPClient interface
      this.claimExtractor as any, // ClaimExtractor implements FuzzyMatcherService interface
      this.quoteManager
    );
    
    // Initialize sync manager with state getters/setters
    const syncState: any = { lastSyncTimestamp: null, syncEnabled: false, syncIntervalMinutes: 15, lastSyncStatus: 'success' as const };
    this.syncManager = new SyncManager(
      this.zoteroImportManager,
      () => syncState,
      async (state: any) => { Object.assign(syncState, state); }
    );

    // Initialize orphan citation services
    this.citationSourceMapper = new CitationSourceMapper(workspaceRoot);
    this.orphanCitationValidator = new OrphanCitationValidator(this.citationSourceMapper, this.claimsManager as any);
    
    // Initialize Zotero lead queue
    this.zoteroLeadQueue = new ZoteroLeadQueue(workspaceRoot);
    
    // Load source mappings asynchronously (fire and forget)
    this.citationSourceMapper.loadSourceMappings().catch(error => {
      console.error('[ServiceState] Failed to load source mappings:', error);
    });
  }

  updatePaths(coreState: CoreState): void {
    this.outlineParser.updatePath(coreState.getAbsolutePath(coreState.config.outlinePath));
    this.claimsManager.updatePath(coreState.getAbsolutePath(coreState.config.claimsDatabasePath));
  }

  dispose(): void {
    this.embeddingService.clearCache();
    this.zoteroAvailabilityManager.dispose();
  }
}
