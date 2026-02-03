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
import { ZoteroAvailabilityManager } from '../../services/zoteroAvailabilityManager';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';

/** Service state: all service instances and their initialization. */
export class ServiceState {
  public outlineParser: OutlineParser;
  public claimsManager: ClaimsManager;
  public embeddingService: EmbeddingService;
  public paperRanker: PaperRanker;
  public coverageAnalyzer: CoverageAnalyzer;
  public readingStatusManager: ReadingStatusManager;
  public claimExtractor: ClaimExtractor;
  public literatureIndexer: LiteratureIndexer;
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

  constructor(coreState: CoreState) {
    const { config, workspaceRoot, context } = coreState;
    const apiKey = vscode.workspace.getConfiguration('researchAssistant').get<string>('openaiApiKey') || '';
    const cfg = vscode.workspace.getConfiguration('researchAssistant');
    const cacheDir = path.join(workspaceRoot, '.cache', 'embeddings');

    this.outlineParser = new OutlineParser(coreState.getAbsolutePath(config.outlinePath));
    this.claimsManager = new ClaimsManager(coreState.getAbsolutePath(config.claimsDatabasePath));
    this.embeddingService = new EmbeddingService(apiKey, cacheDir, cfg.get<number>('embeddingCacheSize') || 100, cfg.get<string>('embeddingModel') || 'text-embedding-3-small');
    this.paperRanker = new PaperRanker(this.embeddingService, this.outlineParser.getCoreParser());
    this.coverageAnalyzer = new CoverageAnalyzer(this.claimsManager, this.embeddingService);
    this.readingStatusManager = new ReadingStatusManager(context);
    this.claimExtractor = new ClaimExtractor(this.embeddingService);
    this.configurationManager = new ConfigurationManager(context);
    this.quoteVerificationService = new QuoteVerificationService(this.claimsManager, workspaceRoot);
    this.sentenceParser = new SentenceParser();
    this.sentenceClaimQuoteLinkManager = new SentenceClaimQuoteLinkManager(this.claimsManager, workspaceRoot);
    this.autoQuoteVerifier = new AutoQuoteVerifier(this.claimsManager);
    this.pdfExtractionService = new PDFExtractionService(workspaceRoot);
    this.citationNetworkAnalyzer = new CitationNetworkAnalyzer();
    this.batchOperationHandler = new BatchOperationHandler(this.claimsManager, this.readingStatusManager, this.quoteVerificationService);
    this.exportService = new ExportService(this.sentenceClaimQuoteLinkManager, this.claimsManager, this.sentenceParser);
    this.zoteroClient = new ZoteroClient();
    this.unifiedSearchService = new UnifiedSearchService(this.zoteroClient, this.claimsManager, this.embeddingService, workspaceRoot);
    this.literatureIndexer = new LiteratureIndexer(workspaceRoot, config.extractedTextPath);
    this.verificationFeedbackLoop = new VerificationFeedbackLoop(this.literatureIndexer, apiKey, coreState.getAbsolutePath(config.extractedTextPath), workspaceRoot);
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
    const syncState = { lastSyncTimestamp: null, syncEnabled: false, syncIntervalMinutes: 15, lastSyncStatus: 'success' as const };
    this.syncManager = new SyncManager(
      this.zoteroImportManager,
      () => syncState,
      async (state) => { Object.assign(syncState, state); }
    );
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
