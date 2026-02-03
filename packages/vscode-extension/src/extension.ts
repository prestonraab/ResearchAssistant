import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionState } from './core/state';
import { OutlineTreeProvider } from './ui/outlineTreeProvider';
import { ClaimsTreeProvider } from './ui/claimsTreeProvider';
import { PapersTreeProvider } from './ui/papersTreeProvider';
import { ClaimHoverProvider } from './ui/claimHoverProvider';
import { ClaimCompletionProvider } from './ui/claimCompletionProvider';
import { InlineSearchProvider } from './ui/inlineSearchProvider';
import { WritingFeedbackDecorator } from './ui/writingFeedbackDecorator';
import { ClaimDocumentProvider } from './ui/claimDocumentProvider';
import { ClaimReviewProvider } from './ui/claimReviewProvider';
import { ReadingAssistant } from './core/readingAssistant';
import { BulkImportService } from './core/bulkImportService';
import { InstantSearchHandler } from './core/instantSearchHandler';
import { QuickClaimExtractor } from './core/quickClaimExtractor';
import { initializeLogger, getLogger, LogLevel, Logger } from './core/loggingService';
import { initializeErrorHandler, getErrorHandler } from './core/errorHandler';
import { registerAllCommands } from './commands';
import { startMemoryMonitoring, stopMemoryMonitoring } from './services/memoryMonitoring';
import { autoScanFulltexts, autoSyncPDFs } from './services/autoSync';
import { ZoteroAvailabilityManager } from './services/zoteroAvailabilityManager';
import { DeepLinkHandler } from './services/deepLinkHandler';
import { WorkspaceDetector } from './core/workspaceDetector';
import { Phase1Initializer } from './core/initializers/phase1';
import { Phase2Initializer } from './core/initializers/phase2';
import { Phase3Initializer } from './core/initializers/phase3';

let extensionState: ExtensionState | undefined;
let writingFeedbackDecorator: WritingFeedbackDecorator | undefined;
let readingAssistant: ReadingAssistant | undefined;
let bulkImportService: BulkImportService | undefined;
let instantSearchHandler: InstantSearchHandler | undefined;
let quickClaimExtractor: QuickClaimExtractor | undefined;
let inlineSearchProvider: InlineSearchProvider | undefined;
let claimReviewProvider: ClaimReviewProvider | undefined;
let zoteroAvailabilityManager: ZoteroAvailabilityManager | undefined;
let deepLinkHandler: DeepLinkHandler | undefined;
let memoryMonitorInterval: NodeJS.Timeout | undefined;
let phase3Initializer: Phase3Initializer | undefined;

/**
 * Initialize Phase 2 with error handling and status bar updates.
 * Loads essential data (claims, outline, config) in parallel.
 * @param phase1Initializer - The Phase 1 initializer instance
 * @param logger - Logger instance for logging
 */
async function initializePhase2(
  phase1Initializer: Phase1Initializer,
  logger: Logger
): Promise<void> {
  const phase2Start = Date.now();
  logger.info('[Phase2] Starting data loading...');
  
  try {
    const phase2Initializer = new Phase2Initializer(phase1Initializer);
    await phase2Initializer.initialize(extensionState!);
    
    const phase2Duration = Date.now() - phase2Start;
    logger.info(`[Phase2] Initialization completed in ${phase2Duration}ms`);
  } catch (phase2Error) {
    const phase2Duration = Date.now() - phase2Start;
    logger.error(`[Phase2] Initialization failed after ${phase2Duration}ms:`, phase2Error instanceof Error ? phase2Error : new Error(String(phase2Error)));
    
    phase1Initializer.updateStatusBar('$(warning) Research Assistant (Limited)', 'Some features unavailable');
    
    vscode.window.showWarningMessage(
      'Research Assistant: Some features may not work. Check workspace configuration.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant');
      }
    });
  }
}

/**
 * Initialize Phase 3 asynchronously (non-blocking).
 * Loads optional services like embeddings, MCP, Zotero.
 * @param logger - Logger instance for logging
 */
function initializePhase3Async(logger: Logger): void {
  const phase3Start = Date.now();
  logger.info('[Phase3] Starting optional service initialization (async)...');
  
  try {
    phase3Initializer = new Phase3Initializer();
    phase3Initializer.initialize(extensionState!).then(() => {
      const phase3Duration = Date.now() - phase3Start;
      logger.info(`[Phase3] Initialization completed in ${phase3Duration}ms`);
    }).catch(phase3Error => {
      const phase3Duration = Date.now() - phase3Start;
      logger.error(`[Phase3] Initialization failed after ${phase3Duration}ms:`, phase3Error instanceof Error ? phase3Error : new Error(String(phase3Error)));
    });
  } catch (phase3Error) {
    logger.error('[Phase3] Failed to start initialization:', phase3Error instanceof Error ? phase3Error : new Error(String(phase3Error)));
  }
}

/**
 * Setup status bar with claim counts and change listener.
 * @param statusBarItem - The status bar item to configure
 */
function setupStatusBar(statusBarItem: vscode.StatusBarItem): void {
  statusBarItem.command = 'researchAssistant.showDashboard';
  statusBarItem.tooltip = 'Click for dashboard';

  const updateStatusBar = async () => {
    if (!extensionState) {
      return;
    }
    const claims = extensionState.claimsManager.getClaims();
    const verified = claims.filter(c => c.verified).length;
    statusBarItem.text = `$(book) ${claims.length} claims (${verified} verified)`;
  };

  extensionState!.claimsManager.onDidChange(updateStatusBar);
  updateStatusBar();
}

/**
 * Register all UI providers (hover, completion, inline search, etc.).
 * @param context - Extension context for subscriptions
 * @returns Object containing initialized providers
 */
function registerUIProviders(context: vscode.ExtensionContext): {
  claimHoverProvider: ClaimHoverProvider;
  claimCompletionProvider: ClaimCompletionProvider;
  claimDocumentProvider: ClaimDocumentProvider;
} {
  const claimDocumentProvider = new ClaimDocumentProvider(extensionState!);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('research-claim', claimDocumentProvider)
  );

  const claimHoverProvider = new ClaimHoverProvider(extensionState!);
  const claimCompletionProvider = new ClaimCompletionProvider(extensionState!);

  inlineSearchProvider = new InlineSearchProvider(
    extensionState!.zoteroClient,
    extensionState!.manuscriptContextDetector,
    extensionState!.getWorkspaceRoot(),
    extensionState!.getAbsolutePath(extensionState!.getConfig().extractedTextPath),
    context
  );
  const inlineSearchCommands = inlineSearchProvider.registerCommands();
  context.subscriptions.push(...inlineSearchCommands);

  return { claimHoverProvider, claimCompletionProvider, claimDocumentProvider };
}

/**
 * Initialize core services (writing feedback, reading assistant, etc.).
 * @param context - Extension context for subscriptions
 */
function initializeCoreServices(context: vscode.ExtensionContext): void {
  writingFeedbackDecorator = new WritingFeedbackDecorator(extensionState!);

  readingAssistant = new ReadingAssistant(
    extensionState!.claimExtractor,
    extensionState!.readingStatusManager,
    extensionState!.claimsManager,
    extensionState!.getAbsolutePath(extensionState!.getConfig().extractedTextPath)
  );

  instantSearchHandler = new InstantSearchHandler(
    extensionState!.zoteroClient,
    extensionState!.manuscriptContextDetector,
    extensionState!.getWorkspaceRoot(),
    extensionState!.getAbsolutePath(extensionState!.getConfig().extractedTextPath)
  );
  instantSearchHandler.registerContextMenu();

  quickClaimExtractor = new QuickClaimExtractor(
    extensionState!.claimsManager,
    extensionState!.claimExtractor,
    extensionState!.outlineParser,
    extensionState!.embeddingService,
    extensionState!.getAbsolutePath(extensionState!.getConfig().extractedTextPath)
  );
  const quickClaimCommands = quickClaimExtractor.registerCommands();
  context.subscriptions.push(...quickClaimCommands);
}

/**
 * Initialize Zotero-related managers.
 */
async function initializeZoteroManagers(): Promise<void> {
  deepLinkHandler = new DeepLinkHandler();
  zoteroAvailabilityManager = new ZoteroAvailabilityManager(extensionState!.zoteroClient);
  await zoteroAvailabilityManager.initialize();
}

/**
 * Schedule page number backfill task to run in background.
 * @param logger - Logger instance for logging
 */
function schedulePageNumberBackfill(logger: Logger): void {
  setTimeout(async () => {
    if (!extensionState) {
      return;
    }
    
    try {
      logger.info('Starting page number backfill process...');
      const quoteCount = extensionState.quoteManager.getQuoteCount();
      
      if (quoteCount > 0) {
        await runPageNumberBackfill(logger, quoteCount);
      } else {
        logger.info('No quotes to backfill');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Page number backfill initialization failed: ${errorMessage}`);
    }
  }, 2000);
}

/**
 * Run page number backfill with progress notification.
 * @param logger - Logger instance for logging
 * @param quoteCount - Number of quotes to process
 */
async function runPageNumberBackfill(logger: Logger, quoteCount: number): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Backfilling page numbers for ${quoteCount} quotes...`,
      cancellable: false
    },
    async (progress) => {
      if (!extensionState) {
        return;
      }
      
      try {
        progress.report({ increment: 0 });
        const updated = await extensionState.quoteManager.backfillPageNumbers();
        progress.report({ increment: 100 });
        
        if (updated > 0) {
          logger.info(`Backfill completed: ${updated} quotes updated with page numbers`);
          vscode.window.showInformationMessage(
            `Page number backfill completed: ${updated} quotes updated`
          );
        } else {
          logger.info('Backfill completed: no quotes needed updating');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Page number backfill failed: ${errorMessage}`);
        vscode.window.showWarningMessage(
          `Page number backfill encountered an error: ${errorMessage}`
        );
      }
    }
  );
}

/**
 * Create lazy getter for BulkImportService.
 * @returns Function that returns BulkImportService instance
 */
function createBulkImportServiceGetter(): () => BulkImportService | undefined {
  return () => {
    if (!bulkImportService && extensionState) {
      bulkImportService = new BulkImportService(
        extensionState.zoteroClient,
        extensionState.claimsManager,
        extensionState.outlineParser,
        extensionState.pdfExtractionService,
        extensionState.embeddingService
      );
    }
    return bulkImportService;
  };
}

/**
 * Schedule background tasks (fulltext scan, PDF sync).
 * @param papersProvider - Papers tree provider for updates
 * @param logger - Logger instance for logging
 */
function scheduleBackgroundTasks(
  papersProvider: PapersTreeProvider,
  logger: Logger
): void {
  setTimeout(() => {
    if (extensionState) {
      autoScanFulltexts(extensionState, papersProvider, logger);
    }
  }, 3000);

  setTimeout(() => {
    if (extensionState) {
      autoSyncPDFs(extensionState, papersProvider, logger);
    }
  }, 5000);
}

/**
 * Setup memory monitoring (early monitoring + continuous).
 * @param logger - Logger instance for logging
 * @param initialHeapMB - Initial heap usage in MB
 */
function setupMemoryMonitoring(logger: Logger, initialHeapMB: number): void {
  // Extended memory monitoring for first 5 minutes
  let memoryCheckCount = 0;
  const earlyMonitor = setInterval(() => {
    const usage = process.memoryUsage();
    const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
    logger.info(`Memory at ${(memoryCheckCount + 1) * 5}s: ${heapMB} MB`);

    memoryCheckCount++;
    if (memoryCheckCount >= 60) {
      clearInterval(earlyMonitor);
      logger.info('Extended memory monitoring complete');
    }
  }, 5000);

  // Trim caches if initial memory is high
  if (initialHeapMB > 1500) {
    logger.warn('High initial memory, trimming caches...');
    extensionState!.embeddingService.trimCache(20);
    if (global.gc) {
      global.gc();
    }
  }

  // Start continuous memory monitoring if enabled
  const enableMemoryMonitoring = vscode.workspace.getConfiguration('researchAssistant').get<boolean>('enableMemoryMonitoring', true);
  if (enableMemoryMonitoring) {
    memoryMonitorInterval = startMemoryMonitoring(extensionState!, logger);
  }
}

/**
 * Register language providers (hover, completion).
 * @param context - Extension context for subscriptions
 * @param claimHoverProvider - Hover provider instance
 * @param claimCompletionProvider - Completion provider instance
 */
function registerLanguageProviders(
  context: vscode.ExtensionContext,
  claimHoverProvider: ClaimHoverProvider,
  claimCompletionProvider: ClaimCompletionProvider
): void {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('markdown', claimHoverProvider),
    vscode.languages.registerCompletionItemProvider(
      'markdown',
      claimCompletionProvider,
      'C', '_'
    ),
    vscode.languages.registerCompletionItemProvider(
      'markdown',
      inlineSearchProvider!,
      '[', ' '
    )
  );
}

/**
 * Setup configuration change watcher.
 * @param context - Extension context for subscriptions
 * @param logger - Logger instance for logging
 */
function setupConfigurationWatcher(
  context: vscode.ExtensionContext,
  logger: Logger
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('researchAssistant')) {
        logger.info('Configuration changed, reloading...');
        extensionState?.reloadConfiguration();
      }
    })
  );
}

/**
 * Activate the Research Assistant extension.
 * Uses phased initialization for optimal startup performance.
 * NFR-3: All functions < 50 lines, Cyclomatic complexity < 10
 * @param context - VS Code extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = initializeLogger('Research Assistant', LogLevel.INFO);
  const errorHandler = initializeErrorHandler();

  logger.info('Research Assistant extension is activating...');

  try {
    await WorkspaceDetector.autoActivateIfNeeded(context);
    await runPhasedInitialization(context, logger, errorHandler);
  } catch (error) {
    errorHandler.handleError(error, {
      operation: 'activate',
      component: 'Extension'
    });
    throw error;
  }
}

/**
 * Run the phased initialization process.
 * Phase 1: Core UI (< 500ms), Phase 2: Data loading (< 2s), Phase 3: Optional services (async)
 * @param context - VS Code extension context
 * @param logger - Logger instance
 * @param errorHandler - Error handler instance
 */
/**
 * Complete post-initialization setup (commands, monitoring, watchers).
 * @param context - VS Code extension context
 * @param providers - Tree providers from Phase 1
 * @param uiProviders - UI providers (hover, completion, document)
 * @param logger - Logger instance
 */
function completeInitialization(
  context: vscode.ExtensionContext,
  providers: { outlineProvider: OutlineTreeProvider; claimsProvider: ClaimsTreeProvider; papersProvider: PapersTreeProvider },
  uiProviders: { claimHoverProvider: ClaimHoverProvider; claimCompletionProvider: ClaimCompletionProvider; claimDocumentProvider: ClaimDocumentProvider },
  logger: Logger
): void {
  const getBulkImportService = createBulkImportServiceGetter();

  // Memory monitoring setup
  const initialUsage = process.memoryUsage();
  const initialHeapMB = Math.round(initialUsage.heapUsed / 1024 / 1024);
  logger.info(`Initial memory usage: ${initialHeapMB} MB`);

  scheduleBackgroundTasks(providers.papersProvider, logger);
  setupMemoryMonitoring(logger, initialHeapMB);

  // Register providers and commands
  registerLanguageProviders(context, uiProviders.claimHoverProvider, uiProviders.claimCompletionProvider);
  claimReviewProvider = new ClaimReviewProvider(extensionState!, context);

  registerAllCommands(
    context,
    extensionState!,
    providers.outlineProvider,
    providers.claimsProvider,
    providers.papersProvider,
    uiProviders.claimDocumentProvider,
    claimReviewProvider,
    getBulkImportService,
    autoSyncPDFs,
    logger,
    zoteroAvailabilityManager,
    deepLinkHandler
  );

  setupConfigurationWatcher(context, logger);
}

/**
 * Run the phased initialization process.
 * Phase 1: Core UI (< 500ms), Phase 2: Data loading (< 2s), Phase 3: Optional services (async)
 * @param context - VS Code extension context
 * @param logger - Logger instance
 * @param errorHandler - Error handler instance
 */
async function runPhasedInitialization(
  context: vscode.ExtensionContext,
  logger: Logger,
  errorHandler: ReturnType<typeof initializeErrorHandler>
): Promise<void> {
  const phase1Start = Date.now();
  logger.info('[Phase1] Starting core UI initialization...');
  
  try {
    // Phase 1: Core UI initialization
    extensionState = new ExtensionState(context);
    const phase1Initializer = new Phase1Initializer();
    await phase1Initializer.initialize(context, extensionState);
    
    const phase1Duration = Date.now() - phase1Start;
    logger.info(`[Phase1] Initialization completed in ${phase1Duration}ms`);

    // Get providers from Phase 1
    const { outline: outlineProvider, claims: claimsProvider, papers: papersProvider } = phase1Initializer.getProviders();
    const statusBarItem = phase1Initializer.getStatusBarItem();

    // Phase 2 & 3: Data loading and optional services
    await initializePhase2(phase1Initializer, logger);
    initializePhase3Async(logger);

    // Setup UI and services
    setupStatusBar(statusBarItem);
    const uiProviders = registerUIProviders(context);
    initializeCoreServices(context);
    await initializeZoteroManagers();
    schedulePageNumberBackfill(logger);

    logger.info('All services initialized successfully');

    // Complete initialization
    completeInitialization(
      context,
      { outlineProvider, claimsProvider, papersProvider },
      uiProviders,
      logger
    );

    logger.info('Research Assistant extension activated successfully');
    vscode.window.showInformationMessage('Research Assistant is ready!');

  } catch (phase1Error) {
    handlePhase1Error(phase1Error, phase1Start, logger, errorHandler);
  }
}

/**
 * Handle Phase 1 initialization errors.
 * @param error - The error that occurred
 * @param phase1Start - Start timestamp for duration calculation
 * @param logger - Logger instance
 * @param errorHandler - Error handler instance
 */
function handlePhase1Error(
  error: unknown,
  phase1Start: number,
  logger: Logger,
  errorHandler: ReturnType<typeof initializeErrorHandler>
): never {
  const phase1Duration = Date.now() - phase1Start;
  logger.error(`[Phase1] Initialization failed after ${phase1Duration}ms:`, error instanceof Error ? error : new Error(String(error)));
  
  errorHandler.handleError(error, {
    operation: 'activate-phase1',
    component: 'Extension'
  });
  throw error;
}

export function deactivate() {
  const logger = getLogger();
  logger.info('Research Assistant extension is deactivating...');

  if (memoryMonitorInterval) {
    stopMemoryMonitoring(memoryMonitorInterval);
    memoryMonitorInterval = undefined;
  }

  // Dispose Phase 3 initializer if it exists
  phase3Initializer?.dispose();
  phase3Initializer = undefined;

  writingFeedbackDecorator?.dispose();
  readingAssistant?.dispose();
  instantSearchHandler?.dispose();
  quickClaimExtractor?.dispose();
  claimReviewProvider?.dispose();
  zoteroAvailabilityManager?.dispose();
  bulkImportService = undefined;
  extensionState?.dispose();
  logger.dispose();

  logger.info('Research Assistant extension deactivated');
}
