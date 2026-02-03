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
import { initializeLogger, getLogger, LogLevel } from './core/loggingService';
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

export async function activate(context: vscode.ExtensionContext) {
  const logger = initializeLogger('Research Assistant', LogLevel.INFO);
  const errorHandler = initializeErrorHandler();

  logger.info('Research Assistant extension is activating...');

  try {
    // Check if this is a research workspace and handle auto-activation
    await WorkspaceDetector.autoActivateIfNeeded(context);

    // Phase 1: Core UI initialization (< 500ms target)
    const phase1Start = Date.now();
    logger.info('[Phase1] Starting core UI initialization...');
    
    try {
      extensionState = new ExtensionState(context);
      const phase1Initializer = new Phase1Initializer();
      await phase1Initializer.initialize(context, extensionState);
      
      const phase1Duration = Date.now() - phase1Start;
      logger.info(`[Phase1] Initialization completed in ${phase1Duration}ms`);

      // Get providers from Phase 1
      const { outline: outlineProvider, claims: claimsProvider, papers: papersProvider } = phase1Initializer.getProviders();
      const statusBarItem = phase1Initializer.getStatusBarItem();

      // Phase 2: Data loading (< 2s target)
      const phase2Start = Date.now();
      logger.info('[Phase2] Starting data loading...');
      
      try {
        const phase2Initializer = new Phase2Initializer(phase1Initializer);
        await phase2Initializer.initialize(extensionState);
        
        const phase2Duration = Date.now() - phase2Start;
        logger.info(`[Phase2] Initialization completed in ${phase2Duration}ms`);
      } catch (phase2Error) {
        const phase2Duration = Date.now() - phase2Start;
        logger.error(`[Phase2] Initialization failed after ${phase2Duration}ms:`, phase2Error instanceof Error ? phase2Error : new Error(String(phase2Error)));
        
        // Update status bar to show degraded state
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

      // Phase 3: Optional services (async, non-blocking)
      const phase3Start = Date.now();
      logger.info('[Phase3] Starting optional service initialization (async)...');
      
      try {
        phase3Initializer = new Phase3Initializer();
        // Don't await - let it run in background
        phase3Initializer.initialize(extensionState).then(() => {
          const phase3Duration = Date.now() - phase3Start;
          logger.info(`[Phase3] Initialization completed in ${phase3Duration}ms`);
        }).catch(phase3Error => {
          const phase3Duration = Date.now() - phase3Start;
          logger.error(`[Phase3] Initialization failed after ${phase3Duration}ms:`, phase3Error instanceof Error ? phase3Error : new Error(String(phase3Error)));
        });
      } catch (phase3Error) {
        logger.error('[Phase3] Failed to start initialization:', phase3Error instanceof Error ? phase3Error : new Error(String(phase3Error)));
      }

      // Update status bar with claim counts
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

      extensionState.claimsManager.onDidChange(updateStatusBar);
      updateStatusBar();

      // Register virtual document provider
      const claimDocumentProvider = new ClaimDocumentProvider(extensionState);
      context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('research-claim', claimDocumentProvider)
      );

      // Register providers
      const claimHoverProvider = new ClaimHoverProvider(extensionState);
      const claimCompletionProvider = new ClaimCompletionProvider(extensionState);

      inlineSearchProvider = new InlineSearchProvider(
        extensionState.zoteroApiService,
        extensionState.manuscriptContextDetector,
        extensionState.getWorkspaceRoot(),
        extensionState.getAbsolutePath(extensionState.getConfig().extractedTextPath),
        context
      );
      const inlineSearchCommands = inlineSearchProvider.registerCommands();
      context.subscriptions.push(...inlineSearchCommands);

      writingFeedbackDecorator = new WritingFeedbackDecorator(extensionState);

      readingAssistant = new ReadingAssistant(
        extensionState.claimExtractor,
        extensionState.readingStatusManager,
        extensionState.claimsManager,
        extensionState.getAbsolutePath(extensionState.getConfig().extractedTextPath)
      );

      instantSearchHandler = new InstantSearchHandler(
        extensionState.zoteroApiService,
        extensionState.manuscriptContextDetector,
        extensionState.getWorkspaceRoot(),
        extensionState.getAbsolutePath(extensionState.getConfig().extractedTextPath)
      );
      instantSearchHandler.registerContextMenu();

      quickClaimExtractor = new QuickClaimExtractor(
        extensionState.claimsManager,
        extensionState.claimExtractor,
        extensionState.outlineParser,
        extensionState.embeddingService,
        extensionState.getAbsolutePath(extensionState.getConfig().extractedTextPath)
      );
      const quickClaimCommands = quickClaimExtractor.registerCommands();
      context.subscriptions.push(...quickClaimCommands);

      // Initialize Zotero managers
      deepLinkHandler = new DeepLinkHandler();
      zoteroAvailabilityManager = new ZoteroAvailabilityManager(extensionState.zoteroApiService);
      await zoteroAvailabilityManager.initialize();

      // Task 12.1: Run page number backfill on extension activation
      // Run in background to avoid blocking, show progress for large collections
      setTimeout(async () => {
        if (!extensionState) {
          return;
        }
        
        try {
          logger.info('Starting page number backfill process...');
          
          // Show progress notification for large collections
          const quoteCount = extensionState.quoteManager.getQuoteCount();
          
          if (quoteCount > 0) {
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
          } else {
            logger.info('No quotes to backfill');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Page number backfill initialization failed: ${errorMessage}`);
        }
      }, 2000); // Delay to allow other initialization to complete

      const getBulkImportService = () => {
        if (!bulkImportService && extensionState) {
          bulkImportService = new BulkImportService(
            extensionState.zoteroApiService,
            extensionState.claimsManager,
            extensionState.outlineParser,
            extensionState.pdfExtractionService,
            extensionState.embeddingService
          );
        }
        return bulkImportService;
      };

      logger.info('All services initialized successfully');

      // Log initial memory usage
      const initialUsage = process.memoryUsage();
      const initialHeapMB = Math.round(initialUsage.heapUsed / 1024 / 1024);
      logger.info(`Initial memory usage: ${initialHeapMB} MB`);

      // Schedule background tasks
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
        extensionState.embeddingService.trimCache(20);
        if (global.gc) {
          global.gc();
        }
      }

      // Start continuous memory monitoring if enabled
      const enableMemoryMonitoring = vscode.workspace.getConfiguration('researchAssistant').get<boolean>('enableMemoryMonitoring', true);
      if (enableMemoryMonitoring) {
        memoryMonitorInterval = startMemoryMonitoring(extensionState, logger);
      }

      // Register language providers (hover, completion)
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

      // Create claim review provider (no longer registered as webview view provider)
      claimReviewProvider = new ClaimReviewProvider(extensionState, context);

      // Register all commands
      registerAllCommands(
        context,
        extensionState,
        outlineProvider,
        claimsProvider,
        papersProvider,
        claimDocumentProvider,
        claimReviewProvider,
        getBulkImportService,
        autoSyncPDFs,
        logger,
        zoteroAvailabilityManager,
        deepLinkHandler
      );

      // Watch for configuration changes
      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
          if (e.affectsConfiguration('researchAssistant')) {
            logger.info('Configuration changed, reloading...');
            extensionState?.reloadConfiguration();
          }
        })
      );

      logger.info('Research Assistant extension activated successfully');
      vscode.window.showInformationMessage('Research Assistant is ready!');

    } catch (phase1Error) {
      const phase1Duration = Date.now() - phase1Start;
      logger.error(`[Phase1] Initialization failed after ${phase1Duration}ms:`, phase1Error instanceof Error ? phase1Error : new Error(String(phase1Error)));
      
      errorHandler.handleError(phase1Error, {
        operation: 'activate-phase1',
        component: 'Extension'
      });
      throw phase1Error;
    }

  } catch (error) {
    errorHandler.handleError(error, {
      operation: 'activate',
      component: 'Extension'
    });
    throw error;
  }
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
