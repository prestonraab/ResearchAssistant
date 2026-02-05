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
          logger.debug(`Jump to PDF command invoked with: annotationKey=${annotationKey}, itemKey=${itemKey}, pageNumber=${pageNumber}`);

          // Check if Zotero is available
          const isAvailable = await zoteroAvailabilityManager.checkAvailability();
          if (!isAvailable) {
            const errorDetail = zoteroAvailabilityManager.getLastError();
            logger.error(`Zotero availability check failed: ${errorDetail}`);
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

          // Validate input parameters
          if (!annotationKey && !itemKey) {
            const errorMsg = 'No PDF location information available. Both annotationKey and itemKey are missing.';
            logger.error(errorMsg);
            vscode.window.showErrorMessage(errorMsg);
            return;
          }

          if (!itemKey) {
            const errorMsg = `Missing itemKey (required for opening PDF). annotationKey=${annotationKey}`;
            logger.error(errorMsg);
            vscode.window.showErrorMessage('Cannot open PDF: missing item key. The paper may not be properly linked in Zotero.');
            return;
          }

          let success = false;
          let attemptedMethod = '';

          // Try to open by annotation key first
          if (annotationKey && itemKey) {
            attemptedMethod = 'annotation';
            logger.debug(`Attempting to open PDF via annotation: annotationKey=${annotationKey}, itemKey=${itemKey}`);
            success = await deepLinkHandler.openAnnotation(annotationKey, itemKey);
          } else if (itemKey && pageNumber !== undefined && pageNumber > 0) {
            // Fall back to page number
            attemptedMethod = 'page';
            logger.debug(`Attempting to open PDF via page number: itemKey=${itemKey}, pageNumber=${pageNumber}`);
            success = await deepLinkHandler.openPage(itemKey, pageNumber);
          } else {
            const errorMsg = `Insufficient parameters for opening PDF. Method: ${annotationKey ? 'annotation' : 'page'}, itemKey=${itemKey}, pageNumber=${pageNumber}`;
            logger.error(errorMsg);
            vscode.window.showErrorMessage('Cannot open PDF: insufficient location information.');
            return;
          }

          if (success) {
            logger.info(`Successfully opened PDF in Zotero via ${attemptedMethod}: annotationKey=${annotationKey}, itemKey=${itemKey}, pageNumber=${pageNumber}`);
          } else {
            logger.warn(`Failed to open PDF in Zotero via ${attemptedMethod}. annotationKey=${annotationKey}, itemKey=${itemKey}, pageNumber=${pageNumber}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
          logger.error(`Jump to PDF command error: ${errorMessage}`);
          logger.error(`Stack trace: ${errorStack}`);
          logger.error(`Parameters: annotationKey=${annotationKey}, itemKey=${itemKey}, pageNumber=${pageNumber}`);
          vscode.window.showErrorMessage(`Failed to open PDF in Zotero: ${errorMessage}`);
        }
      }
    )
  );

  // Command 11.4: Add Paper to Zotero (used by lead queue)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'researchAssistant.addPaperToZotero',
      async (paperData?: {
        title: string;
        authors: string[] | string;
        year: number;
        abstract: string;
        url: string;
        doi?: string;
      }) => {
        try {
          // Check if Zotero is available
          const isAvailable = await zoteroAvailabilityManager.checkAvailability();
          if (!isAvailable) {
            const errorDetail = zoteroAvailabilityManager.getLastError();
            throw new Error(errorDetail || 'Zotero is not available');
          }

          if (!paperData) {
            throw new Error('No paper data provided');
          }

          logger.debug(`Adding paper to Zotero: ${paperData.title}`);

          // Parse authors
          let creators: Array<{ creatorType: string; firstName?: string; lastName?: string; name?: string }> = [];
          if (Array.isArray(paperData.authors)) {
            creators = paperData.authors.map(author => {
              // If author is in "Last, First" format, split it
              if (typeof author === 'string' && author.includes(',')) {
                const [lastName, firstName] = author.split(',').map(s => s.trim());
                return { creatorType: 'author', firstName, lastName };
              }
              // Otherwise treat as full name
              return { creatorType: 'author', name: author };
            });
          } else if (typeof paperData.authors === 'string') {
            // Parse comma-separated string
            creators = paperData.authors.split(',').map(author => ({
              creatorType: 'author',
              name: author.trim()
            }));
          }

          // Create item in Zotero
          const itemKey = await extensionState.zoteroClient.createItem({
            itemType: 'journalArticle',
            title: paperData.title,
            creators: creators,
            abstractNote: paperData.abstract,
            date: paperData.year.toString(),
            DOI: paperData.doi,
            url: paperData.url
          });

          logger.info(`Successfully added paper to Zotero: ${itemKey}`);
          
          // Trigger backfill verification for this item
          vscode.commands.executeCommand('researchAssistant.checkZoteroLeadBackfill', itemKey);
          
          return itemKey;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to add paper to Zotero: ${errorMessage}`);
          throw error;
        }
      }
    )
  );

  // Command 11.5: Check for lead backfill (triggered when paper added to Zotero)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'researchAssistant.checkZoteroLeadBackfill',
      async (itemKey?: string) => {
        try {
          if (!extensionState.zoteroLeadQueue) {
            return;
          }

          logger.debug(`Checking for lead backfill: ${itemKey || 'all leads'}`);

          // Get all leads from queue
          const leads = extensionState.zoteroLeadQueue.getLeads();
          
          if (leads.length === 0) {
            return;
          }

          // Check if any leads can be upgraded
          for (const lead of leads) {
            try {
              // Get the item from Zotero
              const items = await extensionState.zoteroClient.getItems();
              const matchedItem = items.find((item: any) => 
                item.title === lead.title || 
                (itemKey && item.key === itemKey)
              );

              if (!matchedItem) {
                continue;
              }

              // Check if item has PDF attachment
              const attachments = await extensionState.zoteroClient.getPdfAttachments(matchedItem.key);
              const pdfAttachment = attachments.length > 0 ? attachments[0] : null;

              if (!pdfAttachment) {
                logger.debug(`No PDF found for lead: ${lead.title}`);
                continue;
              }

              logger.info(`Found PDF for lead: ${lead.title}, triggering backfill verification`);

              // Trigger backfill verification
              await vscode.commands.executeCommand(
                'researchAssistant.backfillLeadVerification',
                lead.id,
                matchedItem.key,
                pdfAttachment.key
              );

            } catch (error) {
              logger.warn(`Error checking lead ${lead.title}:`, error);
              // Continue with next lead
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to check lead backfill: ${errorMessage}`);
        }
      }
    )
  );

  // Command 11.6: Backfill lead verification (upgrade abstract to verified quote)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'researchAssistant.backfillLeadVerification',
      async (leadId: string, itemKey: string, attachmentKey: string) => {
        try {
          if (!extensionState.zoteroLeadQueue) {
            return;
          }

          const lead = extensionState.zoteroLeadQueue.getLead(leadId);
          if (!lead) {
            logger.warn(`Lead not found: ${leadId}`);
            return;
          }

          logger.info(`Backfilling verification for lead: ${lead.title}`);

          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Verifying ${lead.title}...`,
              cancellable: false
            },
            async (progress) => {
              try {
                progress.report({ message: 'Extracting PDF text...' });

                // Get the claim
                const claim = extensionState.claimsManager.getClaim(lead.claimId);
                if (!claim) {
                  logger.warn(`Claim not found for lead: ${lead.claimId}`);
                  return;
                }

                // Extract text from Zotero PDF
                // Note: This requires the PDF to be in local Zotero storage
                // We'll use the literature indexer to find the extracted text
                const fileName = lead.title.replace(/[^a-zA-Z0-9]/g, '_');
                
                progress.report({ message: 'Searching for evidence...' });

                // Search for evidence in the extracted text
                const snippets = await extensionState.verificationFeedbackLoop.searchLiteratureSnippets(
                  claim.text,
                  10
                );

                // Filter to snippets from this paper
                const paperSnippets = snippets.filter(s => 
                  s.fileName.includes(fileName) || s.fileName.includes(lead.title)
                );

                if (paperSnippets.length === 0) {
                  logger.info(`No snippets found for ${lead.title}, keeping as abstract lead`);
                  return;
                }

                progress.report({ message: 'Verifying evidence...' });

                // Verify snippets
                const verifications = await Promise.all(
                  paperSnippets.map(snippet => 
                    extensionState.verificationFeedbackLoop.verifySnippet(claim.text, snippet, 0)
                  )
                );

                // Find best match
                const bestMatch = verifications
                  .map((v, i) => ({ verification: v, snippet: paperSnippets[i] }))
                  .filter(item => item.verification.supports)
                  .sort((a, b) => b.verification.confidence - a.verification.confidence)[0];

                if (!bestMatch) {
                  logger.info(`No supporting evidence found for ${lead.title}, keeping as abstract lead`);
                  return;
                }

                // Update the quote in the claim
                const quoteIndex = claim.supportingQuotes.findIndex(q => 
                  q.text === lead.quoteText && q.source.includes('[Web Lead]')
                );

                if (quoteIndex >= 0) {
                  // Upgrade the quote
                  claim.supportingQuotes[quoteIndex] = {
                    text: bestMatch.snippet.text,
                    source: lead.title,
                    verified: true,
                    confidence: bestMatch.verification.confidence,
                    metadata: {
                      sourceFile: bestMatch.snippet.fileName,
                      startLine: bestMatch.snippet.startLine,
                      endLine: bestMatch.snippet.endLine
                    }
                  };

                  await extensionState.claimsManager.updateClaim(lead.claimId, claim);

                  logger.info(`Upgraded lead to verified quote: ${lead.title} (confidence: ${bestMatch.verification.confidence.toFixed(2)})`);

                  vscode.window.showInformationMessage(
                    `✓ Upgraded "${lead.title}" from abstract to verified evidence (${Math.round(bestMatch.verification.confidence * 100)}% confidence)`,
                    'View Claim'
                  ).then(action => {
                    if (action === 'View Claim') {
                      vscode.commands.executeCommand('researchAssistant.reviewClaim', lead.claimId);
                    }
                  });

                  // Remove from lead queue
                  await extensionState.zoteroLeadQueue.removeLead(leadId);
                }
              } catch (error) {
                logger.error(`Error in backfill verification:`, error);
              }
            }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to backfill lead verification: ${errorMessage}`);
        }
      }
    )
  );

  // Test Zotero API Configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.testZoteroApi', async () => {
      const cfg = vscode.workspace.getConfiguration('researchAssistant');
      const apiKey = cfg.get<string>('zoteroApiKey') || '';
      const userId = cfg.get<string>('zoteroUserId') || '';
      
      const zoteroApiService = (extensionState as any).zoteroApiService;
      const isConfigured = zoteroApiService && zoteroApiService.isConfigured();
      
      const diagnostics = [
        `🔍 Zotero API Configuration Test`,
        ``,
        `Settings:`,
        `• API Key: ${apiKey ? `✅ Set (${apiKey.length} chars)` : '❌ Not set'}`,
        `• User ID: ${userId ? `✅ Set (${userId})` : '❌ Not set'}`,
        ``,
        `Service State:`,
        `• ZoteroApiService exists: ${zoteroApiService ? '✅ Yes' : '❌ No'}`,
        `• isConfigured(): ${isConfigured ? '✅ Yes' : '❌ No'}`,
        ``
      ].join('\n');
      
      if (isConfigured && zoteroApiService) {
        try {
          await vscode.window.showInformationMessage(diagnostics + '\n\nTesting connection...', { modal: true });
          const testResult = await zoteroApiService.testConnection();
          vscode.window.showInformationMessage(
            diagnostics + `\n\nConnection Test: ${testResult ? '✅ Success' : '❌ Failed'}`,
            { modal: true }
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            diagnostics + `\n\n❌ Connection Test Failed:\n${error}`,
            { modal: true }
          );
        }
      } else {
        vscode.window.showWarningMessage(diagnostics, { modal: true }, 'Open Settings').then(action => {
          if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant.zotero');
          }
        });
      }
    })
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
