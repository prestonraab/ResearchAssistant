import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { PapersTreeProvider } from '../ui/papersTreeProvider';
import { ZoteroAvailabilityManager } from '../services/zoteroAvailabilityManager';
import { DeepLinkHandler } from '../services/deepLinkHandler';

/**
 * Register Zotero integration commands for the Research Assistant extension.
 * 
 * Commands:
 * - researchAssistant.importZoteroHighlights: Import highlights from a selected paper
 * - researchAssistant.syncZoteroHighlights: Sync all Zotero highlights
 * - researchAssistant.jumpToPDF: Jump to a PDF location in Zotero (context menu)
 */
export function registerZoteroCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  papersProvider: PapersTreeProvider,
  zoteroAvailabilityManager: ZoteroAvailabilityManager,
  deepLinkHandler: DeepLinkHandler
): void {
  const logger = getLogger();

  // Command 11.1: Import Highlights from Zotero
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'researchAssistant.importZoteroHighlights',
      async (paperId?: string) => {
        try {
          // Check if Zotero is available
          const isAvailable = await zoteroAvailabilityManager.checkAvailability();
          if (!isAvailable) {
            const errorDetail = zoteroAvailabilityManager.getLastError();
            vscode.window.showErrorMessage(
              errorDetail || 'Zotero is not available. Please check your Zotero API settings.',
              'Configure Settings'
            ).then((selection) => {
              if (selection === 'Configure Settings') {
                vscode.commands.executeCommand(
                  'workbench.action.openSettings',
                  'researchAssistant.zotero'
                );
              }
            });
            return;
          }

          // If no paperId provided, show paper picker
          if (!paperId) {
            const papers = extensionState.claimsManager.getClaims(); // Placeholder - should get papers
            
            if (papers.length === 0) {
              vscode.window.showWarningMessage('No papers available for import');
              return;
            }

            if (papers.length === 1) {
              paperId = papers[0].id;
            } else {
              // Show quick pick for multiple papers
              const items = papers.map(paper => ({
                label: paper.id,
                description: paper.category || 'Paper',
                detail: paper.text.substring(0, 100) + (paper.text.length > 100 ? '...' : ''),
                paperId: paper.id
              }));

              const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Select a paper (${papers.length} available)`,
                matchOnDescription: true,
                matchOnDetail: true
              });

              if (!selected) {
                return;
              }

              paperId = selected.paperId;
            }
          }

          // Show progress notification
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Importing Zotero highlights...',
              cancellable: false
            },
            async (progress) => {
              try {
                progress.report({ increment: 25 });

                // Call ZoteroImportManager to import highlights
                const result = await extensionState.zoteroImportManager.importHighlights(
                  paperId!,
                  paperId! // Using paperId as itemKey - in production this would come from Zotero metadata
                );

                progress.report({ increment: 50 });

                // Show success notification with results
                const message = `Successfully imported ${result.imported} highlights (${result.matched} matched, ${result.unmatched} unmatched)`;
                vscode.window.showInformationMessage(
                  message,
                  'View Quotes'
                ).then((selection) => {
                  if (selection === 'View Quotes') {
                    // Open quotes view or panel
                    vscode.commands.executeCommand('researchAssistant.showClaimsPanel');
                  }
                });

                progress.report({ increment: 25 });

                logger.info(`Imported highlights for paper: ${paperId} - ${result.imported} total, ${result.matched} matched`);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`Failed to import highlights: ${errorMessage}`);
                vscode.window.showErrorMessage(
                  `Failed to import highlights: ${errorMessage}`
                );
              }
            }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Import highlights command error: ${errorMessage}`);
          vscode.window.showErrorMessage('Failed to import highlights');
        }
      }
    )
  );

  // Command 11.2: Sync Zotero Highlights
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'researchAssistant.syncZoteroHighlights',
      async () => {
        try {
          // Check if Zotero is available
          const isAvailable = await zoteroAvailabilityManager.checkAvailability();
          if (!isAvailable) {
            const errorDetail = zoteroAvailabilityManager.getLastError();
            vscode.window.showErrorMessage(
              errorDetail || 'Zotero is not available. Please check your Zotero API settings.',
              'Configure Settings'
            ).then((selection) => {
              if (selection === 'Configure Settings') {
                vscode.commands.executeCommand(
                  'workbench.action.openSettings',
                  'researchAssistant.zotero'
                );
              }
            });
            return;
          }

          // Show progress notification
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Syncing Zotero highlights...',
              cancellable: false
            },
            async (progress) => {
              try {
                progress.report({ increment: 25 });

                // Call SyncManager to sync highlights
                const result = await extensionState.syncManager.syncNow();

                progress.report({ increment: 50 });

                if (result.success) {
                  progress.report({ increment: 25 });

                  // Show success notification with results
                  const message = `Sync completed: ${result.newHighlightsCount} new highlights imported`;
                  vscode.window.showInformationMessage(
                    message,
                    'View Quotes'
                  ).then((selection) => {
                    if (selection === 'View Quotes') {
                      vscode.commands.executeCommand('researchAssistant.showClaimsPanel');
                    }
                  });

                  logger.info(`Zotero highlights sync completed: ${result.newHighlightsCount} new highlights`);
                } else {
                  const errorMessage = result.error || 'Unknown error during sync';
                  logger.error(`Sync failed: ${errorMessage}`);
                  vscode.window.showErrorMessage(
                    `Failed to sync highlights: ${errorMessage}`
                  );
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(`Failed to sync highlights: ${errorMessage}`);
                vscode.window.showErrorMessage(
                  `Failed to sync highlights: ${errorMessage}`
                );
              }
            }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Sync highlights command error: ${errorMessage}`);
          vscode.window.showErrorMessage('Failed to sync highlights');
        }
      }
    )
  );

  // Command 11.3: Jump to PDF in Zotero (context menu for quotes)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'researchAssistant.jumpToPDF',
      async (annotationKey?: string, itemKey?: string, pageNumber?: number) => {
        try {
          // Check if Zotero is available
          const isAvailable = await zoteroAvailabilityManager.checkAvailability();
          if (!isAvailable) {
            const errorDetail = zoteroAvailabilityManager.getLastError();
            vscode.window.showErrorMessage(
              errorDetail || 'Zotero is not available. Please check your Zotero API settings.',
              'Configure Settings'
            ).then((selection) => {
              if (selection === 'Configure Settings') {
                vscode.commands.executeCommand(
                  'workbench.action.openSettings',
                  'researchAssistant.zotero'
                );
              }
            });
            return;
          }

          if (!annotationKey && !itemKey) {
            vscode.window.showErrorMessage('No PDF location information available');
            return;
          }

          let success = false;

          // Try to open by annotation key first
          if (annotationKey && itemKey) {
            success = await deepLinkHandler.openAnnotation(annotationKey, itemKey);
          } else if (itemKey && pageNumber) {
            // Fall back to page number
            success = await deepLinkHandler.openPage(itemKey, pageNumber);
          }

          if (success) {
            logger.info(`Opened PDF in Zotero: annotation=${annotationKey}, item=${itemKey}, page=${pageNumber}`);
          } else {
            logger.warn(`Failed to open PDF in Zotero`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Jump to PDF command error: ${errorMessage}`);
          vscode.window.showErrorMessage('Failed to open PDF in Zotero');
        }
      }
    )
  );

  logger.info('Zotero commands registered successfully');
}

/**
 * Get the logger instance
 */
function getLogger() {
  try {
    const loggingService = require('../core/loggingService');
    return loggingService.getLogger();
  } catch (error) {
    // Return a no-op logger if loggingService is not available
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      dispose: () => {},
    };
  }
}
