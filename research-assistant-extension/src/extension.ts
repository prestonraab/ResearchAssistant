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

export async function activate(context: vscode.ExtensionContext) {
  // Initialize logging and error handling
  const logger = initializeLogger('Research Assistant', LogLevel.INFO);
  const errorHandler = initializeErrorHandler();
  
  logger.info('Research Assistant extension is activating...');

  try {
    // Initialize extension state
    extensionState = new ExtensionState(context);
    await extensionState.initialize();
    
    logger.info('Extension state initialized successfully');

    // Register tree providers
    const outlineProvider = new OutlineTreeProvider(extensionState);
    const claimsProvider = new ClaimsTreeProvider(extensionState);
    const papersProvider = new PapersTreeProvider(extensionState);

    // Register claims panel webview provider
    const claimsPanelProvider = new ClaimsPanelProvider(context.extensionUri, extensionState);

    // Register dashboard webview provider
    const dashboardProvider = new DashboardProvider(context.extensionUri, extensionState);

    // Initialize position mapper for writing support
    extensionState.initializePositionMapper(claimsPanelProvider);

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

    // Register bulk import service
    bulkImportService = new BulkImportService(
      extensionState.mcpClient,
      extensionState.claimsManager,
      extensionState.outlineParser,
      extensionState.pdfExtractionService,
      extensionState.embeddingService
    );

    logger.info('All services initialized successfully');

  // Activate decorator for currently active editor
  if (vscode.window.activeTextEditor) {
    writingFeedbackDecorator.activate(vscode.window.activeTextEditor);
  }

  // Activate decorator when editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && writingFeedbackDecorator) {
        writingFeedbackDecorator.activate(editor);
      }
    })
  );

  // Update decorations when text changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document && writingFeedbackDecorator) {
        writingFeedbackDecorator.onDidChangeTextDocument(event, editor);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('researchAssistant.outline', outlineProvider),
    vscode.window.registerTreeDataProvider('researchAssistant.claims', claimsProvider),
    vscode.window.registerTreeDataProvider('researchAssistant.papers', papersProvider),
    vscode.window.registerWebviewViewProvider(ClaimsPanelProvider.viewType, claimsPanelProvider),
    vscode.window.registerWebviewViewProvider(DashboardProvider.viewType, dashboardProvider),
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
    vscode.commands.registerCommand('researchAssistant.refreshOutline', () => {
      outlineProvider.refresh();
    }),
    vscode.commands.registerCommand('researchAssistant.refreshClaims', () => {
      claimsProvider.refresh();
    }),
    vscode.commands.registerCommand('researchAssistant.showClaimsPanel', () => {
      claimsPanelProvider.showAllClaims();
    }),
    vscode.commands.registerCommand('researchAssistant.analyzeCoverage', async () => {
      if (extensionState) {
        await extensionState.analyzeCoverage();
        vscode.window.showInformationMessage('Coverage analysis complete');
      }
    }),
    vscode.commands.registerCommand('researchAssistant.showDashboard', async () => {
      dashboardProvider.refresh();
      vscode.window.showInformationMessage('Dashboard refreshed');
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
      
      // Show claims in the panel
      claimsPanelProvider.showClaimsForSection(section.id);
      
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
      if (!extensionState || !bulkImportService) {
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
            bulkImportService!.setProgressCallback((importProgress) => {
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

                result = await bulkImportService!.importFromCollection(selectedCollection.key);
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

                result = await bulkImportService!.importRecentPapers(parseInt(limitStr));
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

                const extracted = await bulkImportService!.extractAllPDFs(uris[0].fsPath);
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
                claimsPanelProvider.showClaim(selected.item.id);
              }
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
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

export function deactivate() {
  const logger = getLogger();
  logger.info('Research Assistant extension is deactivating...');
  
  writingFeedbackDecorator?.dispose();
  readingAssistant?.dispose();
  extensionState?.dispose();
  logger.dispose();
  
  logger.info('Research Assistant extension deactivated');
}
