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

let extensionState: ExtensionState | undefined;
let writingFeedbackDecorator: WritingFeedbackDecorator | undefined;
let readingAssistant: ReadingAssistant | undefined;
let bulkImportService: BulkImportService | undefined;
let instantSearchHandler: InstantSearchHandler | undefined;
let quickClaimExtractor: QuickClaimExtractor | undefined;
let inlineSearchProvider: InlineSearchProvider | undefined;
let claimReviewProvider: ClaimReviewProvider | undefined;
let memoryMonitorInterval: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const logger = initializeLogger('Research Assistant', LogLevel.INFO);
  const errorHandler = initializeErrorHandler();

  logger.info('Research Assistant extension is activating...');

  try {
    extensionState = new ExtensionState(context);

    try {
      await extensionState.initialize();
      logger.info('Extension state initialized successfully');
    } catch (initError) {
      logger.error('Failed to initialize extension state:', initError instanceof Error ? initError : new Error(String(initError)));
      vscode.window.showWarningMessage(
        'Research Assistant: Some features may not work. Check workspace configuration.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant');
        }
      });
    }

    // Register tree providers
    const outlineProvider = new OutlineTreeProvider(extensionState);
    const claimsProvider = new ClaimsTreeProvider(extensionState);
    const papersProvider = new PapersTreeProvider(extensionState);

    // Status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'researchAssistant.showDashboard';
    statusBarItem.text = '$(book) Research Assistant';
    statusBarItem.tooltip = 'Click for dashboard';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

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
      extensionState.mcpClient,
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
      extensionState.mcpClient,
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

    const getBulkImportService = () => {
      if (!bulkImportService && extensionState) {
        bulkImportService = new BulkImportService(
          extensionState.mcpClient,
          extensionState.claimsManager,
          extensionState.outlineParser,
          extensionState.pdfExtractionService,
          extensionState.embeddingService
        );
      }
      return bulkImportService;
    };

    logger.info('All services initialized successfully');

    const initialUsage = process.memoryUsage();
    const initialHeapMB = Math.round(initialUsage.heapUsed / 1024 / 1024);
    logger.info(`Initial memory usage: ${initialHeapMB} MB`);

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

    if (initialHeapMB > 1500) {
      logger.warn('High initial memory, trimming caches...');
      extensionState.embeddingService.trimCache(20);
      if (global.gc) {
        global.gc();
      }
    }

    const enableMemoryMonitoring = vscode.workspace.getConfiguration('researchAssistant').get<boolean>('enableMemoryMonitoring', true);
    if (enableMemoryMonitoring) {
      memoryMonitorInterval = startMemoryMonitoring(extensionState, logger);
    }

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('researchAssistant.outline', outlineProvider),
      vscode.window.registerTreeDataProvider('researchAssistant.claims', claimsProvider),
      vscode.window.registerTreeDataProvider('researchAssistant.papers', papersProvider),
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

    // Register claim review webview provider
    claimReviewProvider = new ClaimReviewProvider(extensionState, context);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        ClaimReviewProvider.viewType,
        claimReviewProvider,
        { webviewOptions: { retainContextWhenHidden: true } }
      )
    );

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
      logger
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

  writingFeedbackDecorator?.dispose();
  readingAssistant?.dispose();
  instantSearchHandler?.dispose();
  quickClaimExtractor?.dispose();
  claimReviewProvider?.dispose();
  bulkImportService = undefined;
  extensionState?.dispose();
  logger.dispose();

  logger.info('Research Assistant extension deactivated');
}
