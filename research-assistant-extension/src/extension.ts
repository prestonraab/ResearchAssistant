import * as vscode from 'vscode';
import { ExtensionState } from './core/state';
import { OutlineTreeProvider } from './ui/outlineTreeProvider';
import { ClaimsTreeProvider } from './ui/claimsTreeProvider';
import { PapersTreeProvider } from './ui/papersTreeProvider';
import { ClaimsPanelProvider } from './ui/claimsPanelProvider';
import { DashboardProvider } from './ui/dashboardProvider';
import { ClaimHoverProvider } from './ui/claimHoverProvider';
import { ClaimCompletionProvider } from './ui/claimCompletionProvider';
import { WritingFeedbackDecorator } from './ui/writingFeedbackDecorator';
import { ReadingAssistant } from './core/readingAssistant';
import { BulkImportService } from './core/bulkImportService';
import { initializeLogger, getLogger, LogLevel } from './core/loggingService';
import { initializeErrorHandler, getErrorHandler } from './core/errorHandler';

let extensionState: ExtensionState | undefined;
let writingFeedbackDecorator: WritingFeedbackDecorator | undefined;
let readingAssistant: ReadingAssistant | undefined;
let bulkImportService: BulkImportService | undefined;
let memoryMonitorInterval: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext) {
  // Initialize logging and error handling
  const logger = initializeLogger('Research Assistant', LogLevel.INFO);
  const errorHandler = initializeErrorHandler();
  
  logger.info('Research Assistant extension is activating...');

  try {
    // Initialize extension state with error handling
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
      // Continue with partial initialization
    }

    // Register tree providers
    const outlineProvider = new OutlineTreeProvider(extensionState);
    const claimsProvider = new ClaimsTreeProvider(extensionState);
    const papersProvider = new PapersTreeProvider(extensionState);

    // Status bar for dashboard metrics (lightweight alternative to webview)
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'researchAssistant.showDashboard';
    statusBarItem.text = '$(book) Research Assistant';
    statusBarItem.tooltip = 'Click for dashboard';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Update status bar with metrics
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

    // Claims panel webview and dashboard webview are DISABLED due to memory leaks
    // Using tree views and status bar instead

    // Initialize position mapper for writing support (DISABLED)
    // extensionState.initializePositionMapper(claimsPanelProvider);

    // Register hover provider for claim references
    const claimHoverProvider = new ClaimHoverProvider(extensionState);

    // Register completion provider for claim references
    const claimCompletionProvider = new ClaimCompletionProvider(extensionState);

    // Register writing feedback decorator
    writingFeedbackDecorator = new WritingFeedbackDecorator(extensionState);

    // Register reading assistant
    readingAssistant = new ReadingAssistant(
      extensionState.claimExtractor,
      extensionState.readingStatusManager,
      extensionState.claimsManager,
      extensionState.getAbsolutePath(extensionState.getConfig().extractedTextPath)
    );

    // Register bulk import service (lazy initialization)
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

    // Immediate memory check
    const initialUsage = process.memoryUsage();
    const initialHeapMB = Math.round(initialUsage.heapUsed / 1024 / 1024);
    logger.info(`Initial memory usage: ${initialHeapMB} MB`);
    
    // Log memory every 5 seconds for first 5 minutes to track any delayed spikes
    let memoryCheckCount = 0;
    const earlyMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
      logger.info(`Memory at ${(memoryCheckCount + 1) * 5}s: ${heapMB} MB`);
      
      memoryCheckCount++;
      if (memoryCheckCount >= 60) { // Stop after 5 minutes (300 seconds)
        clearInterval(earlyMonitor);
        logger.info('Extended memory monitoring complete');
      }
    }, 5000);
    
    // If already high, trim caches immediately
    if (initialHeapMB > 1500) {
      logger.warn('High initial memory, trimming caches...');
      extensionState.embeddingService.trimCache(20);
      if (global.gc) {
        global.gc();
      }
    }

    // Start memory monitoring if enabled
    const enableMemoryMonitoring = vscode.workspace.getConfiguration('researchAssistant').get<boolean>('enableMemoryMonitoring', true);
    if (enableMemoryMonitoring) {
      startMemoryMonitoring(extensionState, logger);
    }

  // Activate decorator for currently active editor
  if (vscode.window.activeTextEditor) {
    // DISABLED: Decorator causes memory issues
    // writingFeedbackDecorator.activate(vscode.window.activeTextEditor);
  }

  // Activate decorator when editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      // DISABLED: Decorator causes memory issues
      // if (editor && writingFeedbackDecorator) {
      //   writingFeedbackDecorator.activate(editor);
      // }
    })
  );

  // Update decorations when text changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      // DISABLED: Decorator causes memory issues
      // const editor = vscode.window.activeTextEditor;
      // if (editor && editor.document === event.document && writingFeedbackDecorator) {
      //   writingFeedbackDecorator.onDidChangeTextDocument(event, editor);
      // }
    })
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('researchAssistant.outline', outlineProvider),
    vscode.window.registerTreeDataProvider('researchAssistant.claims', claimsProvider),
    vscode.window.registerTreeDataProvider('researchAssistant.papers', papersProvider),
    // DISABLED - testing memory leak
    // vscode.window.registerWebviewViewProvider(ClaimsPanelProvider.viewType, claimsPanelProvider),
    // vscode.window.registerWebviewViewProvider(DashboardProvider.viewType, dashboardProvider),
    vscode.languages.registerHoverProvider('markdown', claimHoverProvider),
    vscode.languages.registerCompletionItemProvider(
      'markdown',
      claimCompletionProvider,
      'C', '_' // Trigger on 'C' and '_' characters
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.activate', async () => {
      vscode.window.showInformationMessage('Research Assistant activated!');
    }),
    vscode.commands.registerCommand('researchAssistant.showClaimDetails', async (claimId: string) => {
      if (!extensionState) {
        return;
      }
      
      try {
        const claim = extensionState.claimsManager.getClaim(claimId);
        
        if (!claim) {
          vscode.window.showWarningMessage(`Claim ${claimId} not found`);
          return;
        }
        
        // Open in new untitled document instead of modal popup
        const content = [
          `# ${claim.id}: ${claim.text}`,
          '',
          `**Category**: ${claim.category}`,
          `**Source**: ${claim.source}`,
          `**Verified**: ${claim.verified ? 'Yes' : 'No'}`,
          '',
          claim.context ? `**Context**: ${claim.context}\n` : '',
          claim.primaryQuote ? `## Primary Quote\n\n> ${claim.primaryQuote}\n` : '',
          claim.supportingQuotes && claim.supportingQuotes.length > 0 
            ? `## Supporting Quotes\n\n${claim.supportingQuotes.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}\n`
            : '',
          claim.sections && claim.sections.length > 0
            ? `## Used in Sections\n\n${claim.sections.join(', ')}`
            : ''
        ].filter(Boolean).join('\n');
        
        const doc = await vscode.workspace.openTextDocument({
          content,
          language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (error) {
        console.error('Failed to show claim details:', error);
        vscode.window.showErrorMessage('Failed to show claim details');
      }
    }),
    vscode.commands.registerCommand('researchAssistant.refreshOutline', () => {
      outlineProvider.refresh();
    }),
    vscode.commands.registerCommand('researchAssistant.refreshClaims', () => {
      claimsProvider.refresh();
    }),
    // DISABLED - webview memory leak, replaced with Quick Pick
    // vscode.commands.registerCommand('researchAssistant.showClaimsPanel', () => {
    //   claimsPanelProvider.showAllClaims();
    // }),
    vscode.commands.registerCommand('researchAssistant.showClaimsPanel', async () => {
      if (!extensionState) {
        return;
      }
      
      const claims = extensionState.claimsManager.getClaims();
      const items = claims.map(claim => ({
        label: claim.id,
        description: claim.category,
        detail: claim.text.substring(0, 100) + (claim.text.length > 100 ? '...' : ''),
        claim
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `${claims.length} claims`,
        matchOnDescription: true,
        matchOnDetail: true
      });
      
      if (selected) {
        const msg = `**${selected.claim.id}** (${selected.claim.category})\n\n${selected.claim.text}\n\n**Source:** ${selected.claim.source}`;
        vscode.window.showInformationMessage(msg, { modal: true });
      }
    }),
    vscode.commands.registerCommand('researchAssistant.analyzeCoverage', async () => {
      if (extensionState) {
        await extensionState.analyzeCoverage();
        vscode.window.showInformationMessage('Coverage analysis complete');
      }
    }),
    // DISABLED - webview memory leak, replaced with Quick Pick
    // vscode.commands.registerCommand('researchAssistant.showDashboard', async () => {
    //   dashboardProvider.refresh();
    //   vscode.window.showInformationMessage('Dashboard refreshed');
    // }),
    vscode.commands.registerCommand('researchAssistant.showDashboard', async () => {
      if (!extensionState) {
        return;
      }
      
      const claims = extensionState.claimsManager.getClaims();
      const verified = claims.filter(c => c.verified).length;
      const sections = extensionState.outlineParser.getSections();
      
      const items = [
        {
          label: '$(book) Claims',
          description: `${claims.length} total, ${verified} verified`,
          action: 'claims'
        },
        {
          label: '$(list-tree) Outline',
          description: `${sections.length} sections`,
          action: 'outline'
        },
        {
          label: '$(refresh) Refresh Data',
          description: 'Reload claims and outline',
          action: 'refresh'
        }
      ];
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Research Assistant Dashboard'
      });
      
      if (selected?.action === 'claims') {
        vscode.commands.executeCommand('researchAssistant.showClaimsPanel');
      } else if (selected?.action === 'outline') {
        vscode.commands.executeCommand('researchAssistant.refreshOutline');
      } else if (selected?.action === 'refresh') {
        await extensionState.claimsManager.loadClaims();
        await extensionState.outlineParser.parse();
        vscode.window.showInformationMessage('Data refreshed');
      }
    }),
    
    // Outline context menu commands
    vscode.commands.registerCommand('researchAssistant.searchPapersForSection', async (item) => {
      if (!item || !extensionState) {
        return;
      }
      
      const section = item.section;
      const coverage = outlineProvider.getCoverageForSection(section.id);
      
      if (!coverage || coverage.suggestedQueries.length === 0) {
        vscode.window.showWarningMessage('No search queries available for this section');
        return;
      }
      
      // Show quick pick for suggested queries
      const selectedQuery = await vscode.window.showQuickPick(coverage.suggestedQueries, {
        placeHolder: 'Select a search query or edit it',
        canPickMany: false
      });
      
      if (selectedQuery) {
        // Allow user to edit the query
        const finalQuery = await vscode.window.showInputBox({
          prompt: 'Edit search query if needed',
          value: selectedQuery
        });
        
        if (finalQuery) {
          vscode.window.showInformationMessage(`Searching for: "${finalQuery}"`);
          // TODO: Execute search via Zotero MCP when implemented
          // For now, just show the query
        }
      }
    }),
    
    vscode.commands.registerCommand('researchAssistant.viewClaimsForSection', async (item) => {
      if (!item || !extensionState) {
        return;
      }
      
      const section = item.section;
      
      // Show claims in the panel (DISABLED - webview memory leak)
      // claimsPanelProvider.showClaimsForSection(section.id);
      
      // Also show quick pick for immediate access
      const claims = await extensionState.claimsManager.loadClaims();
      const sectionClaims = claims.filter(claim => claim.sections.includes(section.id));
      
      if (sectionClaims.length === 0) {
        vscode.window.showInformationMessage(`No claims found for section: ${section.title}`);
        return;
      }
      
      // Show claims in a quick pick
      const claimItems = sectionClaims.map(claim => ({
        label: claim.id,
        description: claim.category,
        detail: claim.text.substring(0, 100) + (claim.text.length > 100 ? '...' : ''),
        claim
      }));
      
      const selected = await vscode.window.showQuickPick(claimItems, {
        placeHolder: `${sectionClaims.length} claim${sectionClaims.length !== 1 ? 's' : ''} for ${section.title}`,
        canPickMany: false
      });
      
      if (selected) {
        // Show full claim details
        const claim = selected.claim;
        const message = `**${claim.id}** (${claim.category})\n\n${claim.text}\n\n**Source:** ${claim.source}\n\n**Quote:** ${claim.primaryQuote}`;
        vscode.window.showInformationMessage(message, { modal: true });
      }
    }),
    
    vscode.commands.registerCommand('researchAssistant.analyzeGapForSection', async (item) => {
      if (!item || !extensionState) {
        return;
      }
      
      const section = item.section;
      const coverage = outlineProvider.getCoverageForSection(section.id);
      
      if (!coverage) {
        vscode.window.showWarningMessage('Coverage data not available');
        return;
      }
      
      // Build gap analysis message
      let message = `**Gap Analysis for: ${section.title}**\n\n`;
      message += `**Coverage Level:** ${coverage.coverageLevel}\n`;
      message += `**Claims:** ${coverage.claimCount}\n\n`;
      
      if (coverage.claimCount < 2) {
        message += `⚠️ This section needs more supporting evidence (minimum 2 claims recommended).\n\n`;
        message += `**Suggested Search Queries:**\n`;
        coverage.suggestedQueries.forEach((query, i) => {
          message += `${i + 1}. ${query}\n`;
        });
      } else if (coverage.coverageLevel === 'low') {
        message += `ℹ️ This section has minimal coverage. Consider adding more claims.\n\n`;
        message += `**Suggested Search Queries:**\n`;
        coverage.suggestedQueries.forEach((query, i) => {
          message += `${i + 1}. ${query}\n`;
        });
      } else if (coverage.coverageLevel === 'moderate') {
        message += `✓ This section has adequate coverage.\n`;
      } else {
        message += `✓✓ This section has strong coverage!\n`;
      }
      
      // Show in information message
      const action = coverage.claimCount < 2 ? 'Search Papers' : 'View Claims';
      const result = await vscode.window.showInformationMessage(message, { modal: true }, action);
      
      if (result === 'Search Papers') {
        vscode.commands.executeCommand('researchAssistant.searchPapersForSection', item);
      } else if (result === 'View Claims') {
        vscode.commands.executeCommand('researchAssistant.viewClaimsForSection', item);
      }
    }),

    // Hover provider quick action commands
    vscode.commands.registerCommand('researchAssistant.goToSource', async (source: string) => {
      if (!extensionState) {
        return;
      }
      
      // Find papers with this source
      const claims = extensionState.claimsManager.findClaimsBySource(source);
      
      if (claims.length === 0) {
        vscode.window.showInformationMessage(`No claims found for source: ${source}`);
        return;
      }
      
      // Show information about the source
      vscode.window.showInformationMessage(
        `Source: ${source}\n\nFound ${claims.length} claim${claims.length !== 1 ? 's' : ''} from this source.`,
        'View Claims'
      ).then(selection => {
        if (selection === 'View Claims') {
          // Show claims in quick pick
          const claimItems = claims.map(claim => ({
            label: claim.id,
            description: claim.category,
            detail: claim.text.substring(0, 100) + (claim.text.length > 100 ? '...' : ''),
            claim
          }));
          
          vscode.window.showQuickPick(claimItems, {
            placeHolder: `Claims from ${source}`
          });
        }
      });
    }),

    vscode.commands.registerCommand('researchAssistant.viewAllQuotes', async (claimId: string) => {
      if (!extensionState) {
        return;
      }
      
      const claim = extensionState.claimsManager.getClaim(claimId);
      
      if (!claim) {
        vscode.window.showWarningMessage(`Claim ${claimId} not found`);
        return;
      }
      
      // Build message with all quotes
      let message = `**${claim.id}: ${claim.text}**\n\n`;
      message += `**Source:** ${claim.source}\n\n`;
      
      if (claim.primaryQuote) {
        message += `**Primary Quote:**\n> "${claim.primaryQuote}"\n\n`;
      }
      
      if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
        message += `**Supporting Quotes (${claim.supportingQuotes.length}):**\n\n`;
        claim.supportingQuotes.forEach((quote, i) => {
          message += `${i + 1}. "${quote}"\n\n`;
        });
      }
      
      vscode.window.showInformationMessage(message, { modal: true });
    }),

    vscode.commands.registerCommand('researchAssistant.findSimilarClaims', async (claimId: string) => {
      if (!extensionState) {
        return;
      }
      
      const claim = extensionState.claimsManager.getClaim(claimId);
      
      if (!claim) {
        vscode.window.showWarningMessage(`Claim ${claimId} not found`);
        return;
      }
      
      // Find similar claims
      const similarClaims = await extensionState.claimsManager.detectSimilarClaims(claim.text, 0.7);
      
      // Filter out the original claim
      const otherClaims = similarClaims.filter(sc => sc.claim.id !== claimId);
      
      if (otherClaims.length === 0) {
        vscode.window.showInformationMessage(`No similar claims found for ${claimId}`);
        return;
      }
      
      // Show similar claims in quick pick
      const claimItems = otherClaims.map(sc => ({
        label: sc.claim.id,
        description: `${(sc.similarity * 100).toFixed(0)}% similar - ${sc.claim.category}`,
        detail: sc.claim.text.substring(0, 100) + (sc.claim.text.length > 100 ? '...' : ''),
        claim: sc.claim
      }));
      
      const selected = await vscode.window.showQuickPick(claimItems, {
        placeHolder: `Similar claims to ${claimId} (${otherClaims.length} found)`
      });
      
      if (selected) {
        // Show full claim details
        const message = `**${selected.claim.id}** (${selected.claim.category})\n\n${selected.claim.text}\n\n**Source:** ${selected.claim.source}\n\n**Quote:** ${selected.claim.primaryQuote}`;
        vscode.window.showInformationMessage(message, { modal: true });
      }
    }),

    vscode.commands.registerCommand('researchAssistant.showClaimSections', async (claimId: string) => {
      if (!extensionState) {
        return;
      }
      
      const claim = extensionState.claimsManager.getClaim(claimId);
      
      if (!claim) {
        vscode.window.showWarningMessage(`Claim ${claimId} not found`);
        return;
      }
      
      if (!claim.sections || claim.sections.length === 0) {
        vscode.window.showInformationMessage(`Claim ${claimId} is not associated with any outline sections`);
        return;
      }
      
      // Get section details from outline parser
      const sections = await extensionState.outlineParser.parse();
      const claimSections = sections.filter(s => claim.sections.includes(s.id));
      
      if (claimSections.length === 0) {
        vscode.window.showInformationMessage(`Sections for ${claimId} not found in current outline`);
        return;
      }
      
      // Show sections in quick pick
      const sectionItems = claimSections.map(section => ({
        label: section.title,
        description: `Level ${section.level}`,
        detail: section.content.join(', ').substring(0, 100),
        section
      }));
      
      const selected = await vscode.window.showQuickPick(sectionItems, {
        placeHolder: `Sections using ${claimId} (${claimSections.length})`
      });
      
      if (selected) {
        // Navigate to section in outline file
        const outlinePath = extensionState.getAbsolutePath(extensionState.getConfig().outlinePath);
        const document = await vscode.workspace.openTextDocument(outlinePath);
        const editor = await vscode.window.showTextDocument(document);
        
        // Jump to section line
        const position = new vscode.Position(selected.section.lineStart, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.insertClaimReference', async (claimId: string) => {
      if (!extensionState) {
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const claim = extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        vscode.window.showWarningMessage(`Claim ${claimId} not found`);
        return;
      }

      // Ask user what to insert
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: 'Reference only',
            description: `Insert just "${claimId}"`,
            value: 'reference'
          },
          {
            label: 'Full claim text',
            description: 'Insert claim text with citation',
            value: 'full'
          },
          {
            label: 'Claim with quote',
            description: 'Insert claim text and primary quote',
            value: 'quote'
          }
        ],
        {
          placeHolder: 'What would you like to insert?'
        }
      );

      if (!choice) {
        return;
      }

      let textToInsert = '';

      switch (choice.value) {
        case 'reference':
          // Just the claim ID (already inserted by completion)
          return;
        
        case 'full':
          // Claim text with citation
          textToInsert = `${claim.text} (${claim.source})`;
          break;
        
        case 'quote':
          // Claim text with quote
          textToInsert = `${claim.text} (${claim.source}). `;
          if (claim.primaryQuote) {
            textToInsert += `"${claim.primaryQuote}"`;
          }
          break;
      }

      // Insert the text at cursor position
      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, textToInsert);
      });
    }),

    // Bulk import commands
    vscode.commands.registerCommand('researchAssistant.bulkImport', async () => {
      if (!extensionState) {
        return;
      }

      const service = getBulkImportService();
      if (!service) {
        vscode.window.showErrorMessage('Bulk import service not available');
        return;
      }

      // Ask user what to import
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: 'Import from Zotero Collection',
            description: 'Import papers from a specific Zotero collection',
            value: 'collection'
          },
          {
            label: 'Import Recent Papers',
            description: 'Import recently added papers from Zotero',
            value: 'recent'
          },
          {
            label: 'Extract PDFs from Directory',
            description: 'Extract text from all PDFs in a directory',
            value: 'pdfs'
          }
        ],
        {
          placeHolder: 'What would you like to import?'
        }
      );

      if (!choice) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Bulk Import',
            cancellable: false
          },
          async (progress) => {
            service.setProgressCallback((importProgress) => {
              progress.report({
                message: importProgress.message,
                increment: (importProgress.current / importProgress.total) * 100
              });
            });

            let result;

            switch (choice.value) {
              case 'collection':
                // Get collections from Zotero
                const collections = await extensionState!.mcpClient.zotero.getCollections();
                const selectedCollection = await vscode.window.showQuickPick(
                  collections.map((c: any) => ({
                    label: c.name,
                    description: c.key,
                    key: c.key
                  })),
                  { placeHolder: 'Select a collection to import' }
                );

                if (!selectedCollection) {
                  return;
                }

                result = await service.importFromCollection(selectedCollection.key);
                break;

              case 'recent':
                const limitStr = await vscode.window.showInputBox({
                  prompt: 'How many recent papers to import?',
                  value: '50',
                  validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 1000) {
                      return 'Please enter a number between 1 and 1000';
                    }
                    return null;
                  }
                });

                if (!limitStr) {
                  return;
                }

                result = await service.importRecentPapers(parseInt(limitStr));
                break;

              case 'pdfs':
                const uris = await vscode.window.showOpenDialog({
                  canSelectFiles: false,
                  canSelectFolders: true,
                  canSelectMany: false,
                  title: 'Select PDF Directory'
                });

                if (!uris || uris.length === 0) {
                  return;
                }

                const extracted = await service.extractAllPDFs(uris[0].fsPath);
                vscode.window.showInformationMessage(`Extracted ${extracted} PDFs`);
                return;
            }

            if (result) {
              let message = `Import complete!\n\n`;
              message += `Papers imported: ${result.papersImported}\n`;
              message += `Texts extracted: ${result.textsExtracted}\n`;
              message += `Claims parsed: ${result.claimsParsed}\n`;
              message += `Sections analyzed: ${result.sectionsAnalyzed}`;

              if (result.errors.length > 0) {
                message += `\n\nErrors: ${result.errors.length}`;
              }

              vscode.window.showInformationMessage(message, { modal: true });

              // Refresh views
              outlineProvider.refresh();
              claimsProvider.refresh();
              papersProvider.refresh();
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Bulk import failed: ${error}`);
      }
    }),

    // Batch operations commands
    vscode.commands.registerCommand('researchAssistant.batchVerifyQuotes', async () => {
      if (!extensionState) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Verifying Quotes',
            cancellable: false
          },
          async (progress) => {
            const result = await extensionState!.quoteVerificationService.verifyAllClaims();
            
            let message = `Quote verification complete!\n\n`;
            message += `Total claims: ${result.totalClaims}\n`;
            message += `Verified: ${result.verified}\n`;
            message += `Failed: ${result.failed}\n`;
            message += `Errors: ${result.errors}`;

            if (result.failures.length > 0) {
              message += `\n\nFirst 5 failures:\n`;
              result.failures.slice(0, 5).forEach((f: any) => {
                message += `- ${f.claimId}: ${f.similarity.toFixed(2)}\n`;
              });
            }

            vscode.window.showInformationMessage(message, { modal: true });
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Quote verification failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.exportCoverage', async () => {
      if (!extensionState) {
        return;
      }

      try {
        const format = await vscode.window.showQuickPick(
          ['Markdown', 'CSV'],
          { placeHolder: 'Select export format' }
        );

        if (!format) {
          return;
        }

        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`coverage-report.${format.toLowerCase()}`),
          filters: {
            [format]: [format.toLowerCase()]
          }
        });

        if (!uri) {
          return;
        }

        await extensionState.exportService.exportCoverageReport(
          uri.fsPath,
          format.toLowerCase() as 'markdown' | 'csv'
        );

        vscode.window.showInformationMessage(`Coverage report exported to ${uri.fsPath}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.searchAll', async () => {
      if (!extensionState) {
        return;
      }

      const query = await vscode.window.showInputBox({
        prompt: 'Search across papers, claims, and drafts',
        placeHolder: 'Enter search query...'
      });

      if (!query) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Searching',
            cancellable: false
          },
          async () => {
            const results = await extensionState!.unifiedSearchService.search(query);

            // Show results in quick pick
            const items = [
              ...(results.get('paper') || []).map((r: any) => ({
                label: `📄 ${r.title}`,
                description: `Paper - ${r.score.toFixed(2)} relevance`,
                detail: r.snippet?.substring(0, 100),
                type: 'paper',
                item: r
              })),
              ...(results.get('claim') || []).map((r: any) => ({
                label: `📋 ${r.title}`,
                description: `Claim - ${r.score.toFixed(2)} relevance`,
                detail: r.snippet,
                type: 'claim',
                item: r
              })),
              ...(results.get('draft') || []).map((r: any) => ({
                label: `📖 ${r.title}`,
                description: `Draft - ${r.score.toFixed(2)} relevance`,
                detail: r.snippet?.substring(0, 100),
                type: 'section',
                item: r
              }))
            ];

            if (items.length === 0) {
              vscode.window.showInformationMessage('No results found');
              return;
            }

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: `${items.length} results for "${query}"`
            });

            if (selected) {
              // Navigate to selected item
              if (selected.type === 'section') {
                const outlinePath = extensionState!.getAbsolutePath(extensionState!.getConfig().outlinePath);
                const document = await vscode.workspace.openTextDocument(outlinePath);
                const editor = await vscode.window.showTextDocument(document);
                const position = new vscode.Position(selected.item.lineStart, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
              } else if (selected.type === 'claim') {
                // DISABLED - webview memory leak
                // claimsPanelProvider.showClaim(selected.item.id);
                vscode.window.showInformationMessage(`Claim: ${selected.item.id}`);
              }
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.associateClaimsWithSections', async () => {
      if (!extensionState) {
        return;
      }

      try {
        const result = await vscode.window.showInformationMessage(
          'This will analyze all claims and associate them with relevant outline sections based on semantic similarity. Continue?',
          { modal: true },
          'Yes, Associate Claims',
          'Cancel'
        );

        if (result !== 'Yes, Associate Claims') {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Associating Claims with Sections',
            cancellable: false
          },
          async (progress) => {
            const sections = extensionState!.outlineParser.getSections();
            const claims = extensionState!.claimsManager.getClaims();
            
            let processed = 0;
            let associated = 0;

            for (const claim of claims) {
              progress.report({
                message: `Processing ${claim.id}...`,
                increment: (1 / claims.length) * 100
              });

              // Find best matching sections using simple keyword matching
              const claimWords = new Set(
                claim.text.toLowerCase()
                  .split(/\s+/)
                  .filter(w => w.length > 3) // Only words longer than 3 chars
              );

              const sectionScores: Array<{ section: any; score: number }> = [];

              for (const section of sections) {
                // Only consider leaf sections (no children) or sections with few children
                if (section.children.length > 3) {
                  continue;
                }

                const sectionText = `${section.title} ${section.content.join(' ')}`.toLowerCase();
                const sectionWords = sectionText.split(/\s+/);
                
                // Count matching words
                let matches = 0;
                for (const word of claimWords) {
                  if (sectionText.includes(word)) {
                    matches++;
                  }
                }

                const score = matches / claimWords.size;
                
                if (score > 0.2) { // At least 20% word overlap
                  sectionScores.push({ section, score });
                }
              }

              // Sort by score and take top matches
              sectionScores.sort((a, b) => b.score - a.score);
              const topMatches = sectionScores.slice(0, 3); // Top 3 matches

              // Add section associations
              for (const match of topMatches) {
                if (!claim.sections.includes(match.section.id)) {
                  await extensionState!.claimsManager.addSectionToClaim(claim.id, match.section.id);
                  associated++;
                }
              }

              processed++;
            }

            vscode.window.showInformationMessage(
              `Association complete!\n\nProcessed ${processed} claims\nCreated ${associated} section associations`,
              { modal: true }
            );

            // Refresh views
            outlineProvider.refresh();
            claimsProvider.refresh();
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Association failed: ${error}`);
      }
    })
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

function startMemoryMonitoring(state: ExtensionState, logger: any): void {
  // Monitor memory every 60 seconds (less aggressive)
  memoryMonitorInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    // Log cache stats
    const embeddingStats = state.embeddingService.getCacheStats();
    const mcpStats = state.mcpClient.getCacheStats();
    
    // Only log if usage is concerning (>50%)
    if (heapUsedMB > heapTotalMB * 0.5) {
      logger.info(`Memory: ${heapUsedMB}/${heapTotalMB} MB | Embeddings: ${embeddingStats.size}/${embeddingStats.maxSize} | MCP: ${mcpStats.size}`);
    }
    
    // If heap usage exceeds 70%, trigger aggressive cleanup
    if (heapUsedMB > heapTotalMB * 0.7) {
      logger.warn(`High memory usage (${heapUsedMB}MB), triggering cleanup...`);
      
      // Aggressive cache trimming
      state.embeddingService.trimCache(50); // Keep only 50 most valuable
      state.mcpClient.clearCache();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Garbage collection triggered');
      }
      
      const newUsage = process.memoryUsage();
      const newHeapUsedMB = Math.round(newUsage.heapUsed / 1024 / 1024);
      logger.info(`Memory after cleanup: ${newHeapUsedMB} MB (freed ${heapUsedMB - newHeapUsedMB} MB)`);
    }
  }, 60000); // Every 60 seconds
}

export function deactivate() {
  const logger = getLogger();
  logger.info('Research Assistant extension is deactivating...');
  
  // Stop memory monitoring
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = undefined;
  }
  
  // Dispose all resources
  writingFeedbackDecorator?.dispose();
  readingAssistant?.dispose();
  bulkImportService = undefined; // Clear reference
  extensionState?.dispose();
  logger.dispose();
  
  logger.info('Research Assistant extension deactivated');
}
