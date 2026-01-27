import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionState } from '../core/state';
import { BulkImportService } from '../core/bulkImportService';
import { OutlineTreeProvider } from '../ui/outlineTreeProvider';
import { ClaimsTreeProvider } from '../ui/claimsTreeProvider';
import { PapersTreeProvider } from '../ui/papersTreeProvider';

export function registerBulkCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  outlineProvider: OutlineTreeProvider,
  claimsProvider: ClaimsTreeProvider,
  papersProvider: PapersTreeProvider,
  getBulkImportService: () => BulkImportService | undefined,
  autoSyncPDFs: (state: ExtensionState, papersProvider: PapersTreeProvider, logger: any) => Promise<void>,
  logger: any
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.bulkImport', async () => {
      if (!extensionState) {
        return;
      }

      const service = getBulkImportService();
      if (!service) {
        vscode.window.showErrorMessage('Bulk import service not available');
        return;
      }

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

              outlineProvider.refresh();
              claimsProvider.refresh();
              papersProvider.refresh();

              setTimeout(() => {
                autoSyncPDFs(extensionState!, papersProvider, logger);
              }, 1000);
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Bulk import failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.extractMissingFulltexts', async () => {
      if (!extensionState) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning for missing fulltexts',
            cancellable: false
          },
          async () => {
            await extensionState!.fulltextStatusManager.scanLibrary();
          }
        );

        const missing = extensionState.fulltextStatusManager.getMissingFulltexts();

        if (missing.length === 0) {
          vscode.window.showInformationMessage('All papers have extracted text!');
          return;
        }

        const result = await vscode.window.showInformationMessage(
          `Found ${missing.length} paper${missing.length !== 1 ? 's' : ''} without extracted text. Extract now?`,
          { modal: true },
          'Yes, Extract All',
          'Cancel'
        );

        if (result !== 'Yes, Extract All') {
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.fileName.includes('manuscript.md')) {
          const position = editor.selection.active;
          const sections = extensionState.outlineParser.getSections();
          const currentSection = sections.find(s =>
            s.lineStart <= position.line && s.lineEnd >= position.line
          );

          if (currentSection) {
            const sectionContext = `${currentSection.title} ${currentSection.content.join(' ')}`;
            await extensionState.fulltextStatusManager.prioritizeBySection(sectionContext);
          }
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Extracting Fulltexts',
            cancellable: false
          },
          async (progress) => {
            const result = await extensionState!.fulltextStatusManager.batchExtract(
              (extractionProgress) => {
                const timeStr = extractionProgress.estimatedTimeRemaining
                  ? ` (~${extractionProgress.estimatedTimeRemaining}s remaining)`
                  : '';

                progress.report({
                  message: `${extractionProgress.current}/${extractionProgress.total}: ${extractionProgress.currentFile}${timeStr}`,
                  increment: (1 / extractionProgress.total) * 100
                });
              }
            );

            let message = `Extraction complete!\n\n`;
            message += `Total: ${result.total}\n`;
            message += `Successful: ${result.successful}\n`;
            message += `Failed: ${result.failed}`;

            if (result.errors.length > 0 && result.errors.length <= 5) {
              message += `\n\nErrors:\n`;
              result.errors.forEach(e => {
                message += `- ${e.file}: ${e.error}\n`;
              });
            } else if (result.errors.length > 5) {
              message += `\n\n${result.errors.length} errors occurred. Check console for details.`;
              result.errors.forEach(e => {
                console.error(`Extraction error for ${e.file}:`, e.error);
              });
            }

            vscode.window.showInformationMessage(message, { modal: true });
            papersProvider.refresh();
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to extract fulltexts: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.scanFulltextStatus', async () => {
      if (!extensionState) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning library',
            cancellable: false
          },
          async () => {
            await extensionState!.fulltextStatusManager.scanLibrary();
          }
        );

        const stats = extensionState.fulltextStatusManager.getStatistics();

        let message = `Library Scan Complete\n\n`;
        message += `Total papers: ${stats.total}\n`;
        message += `With fulltext: ${stats.withFulltext}\n`;
        message += `Missing fulltext: ${stats.missingFulltext}\n`;
        message += `Missing PDF: ${stats.missingPdf}\n`;
        message += `Coverage: ${stats.coveragePercentage.toFixed(1)}%`;

        const actions = stats.missingFulltext > 0 ? ['Extract Missing'] : [];
        const result = await vscode.window.showInformationMessage(message, { modal: true }, ...actions);

        if (result === 'Extract Missing') {
          vscode.commands.executeCommand('researchAssistant.extractMissingFulltexts');
        }

        papersProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to scan library: ${error}`);
      }
    })
  );
}
