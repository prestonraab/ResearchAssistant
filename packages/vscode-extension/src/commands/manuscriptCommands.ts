import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionState } from '../core/state';
import { PapersTreeProvider } from '../ui/papersTreeProvider';
import { WritingModeProvider } from '../ui/writingModeProvider';
import { EditingModeProvider } from '../ui/editingModeProvider';
import { ClaimMatchingProvider } from '../ui/claimMatchingProvider';

export function registerManuscriptCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  papersProvider: PapersTreeProvider,
  logger: any
): void {
  // Register writing mode provider
  const writingModeProvider = new WritingModeProvider(extensionState, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WritingModeProvider.viewType,
      writingModeProvider
    )
  );

  // Register editing mode provider
  const editingModeProvider = new EditingModeProvider(extensionState, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      EditingModeProvider.viewType,
      editingModeProvider
    )
  );

  // Register claim matching provider
  const claimMatchingProvider = new ClaimMatchingProvider(extensionState, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ClaimMatchingProvider.viewType,
      claimMatchingProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.openWritingMode', async () => {
      try {
        // Show the writing mode view
        await vscode.commands.executeCommand(
          'workbench.view.extension.researchAssistant-sidebar'
        );
        await vscode.commands.executeCommand(
          `${WritingModeProvider.viewType}.focus`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open writing mode: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.openEditingMode', async () => {
      try {
        // Show the editing mode view
        await vscode.commands.executeCommand(
          'workbench.view.extension.researchAssistant-sidebar'
        );
        await vscode.commands.executeCommand(
          `${EditingModeProvider.viewType}.focus`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open editing mode: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.openClaimMatching', async (sentenceId?: string, sentenceText?: string) => {
      try {
        // Show the claim matching view
        await vscode.commands.executeCommand(
          'workbench.view.extension.researchAssistant-sidebar'
        );
        await vscode.commands.executeCommand(
          `${ClaimMatchingProvider.viewType}.focus`
        );

        // If sentence provided, open for that sentence
        if (sentenceId && sentenceText) {
          await claimMatchingProvider.openForSentence(sentenceId, sentenceText);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open claim matching: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.activate', async () => {
      if (!extensionState) {
        vscode.window.showErrorMessage('Extension state not initialized!');
        return;
      }

      const diagnostics = [
        `Workspace: ${extensionState.getWorkspaceRoot()}`,
        `Outline: ${extensionState.getConfig().outlinePath}`,
        `Claims: ${extensionState.getConfig().claimsDatabasePath}`,
        `Sections: ${extensionState.outlineParser.getSections().length}`,
        `Claims: ${extensionState.claimsManager.getClaims().length}`,
        `API Key: ${extensionState.embeddingService ? 'configured' : 'missing'}`
      ].join('\n');

      vscode.window.showInformationMessage(
        `Research Assistant Status:\n\n${diagnostics}`,
        { modal: true }
      );
    }),

    vscode.commands.registerCommand('researchAssistant.analyzeCoverage', async () => {
      if (extensionState) {
        await extensionState.analyzeCoverage();
        vscode.window.showInformationMessage('Coverage analysis complete');
      }
    }),

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

    vscode.commands.registerCommand('researchAssistant.syncPDFsFromZotero', async () => {
      if (!extensionState) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Syncing PDFs from Zotero',
            cancellable: false
          },
          async (progress) => {
            const extractedTextPath = extensionState!.getAbsolutePath(
              extensionState!.getConfig().extractedTextPath
            );
            const pdfDir = path.join(extensionState!.getWorkspaceRoot(), 'literature', 'PDFs');

            if (!fs.existsSync(pdfDir)) {
              fs.mkdirSync(pdfDir, { recursive: true });
            }

            const files = fs.readdirSync(extractedTextPath)
              .filter(f => f.endsWith('.txt') || f.endsWith('.md'));

            let downloaded = 0;
            let skipped = 0;
            let failed = 0;

            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const basename = path.basename(file, path.extname(file));
              const pdfPath = path.join(pdfDir, `${basename}.pdf`);

              progress.report({
                message: `Processing ${basename} (${i + 1}/${files.length})`,
                increment: (1 / files.length) * 100
              });

              if (fs.existsSync(pdfPath)) {
                skipped++;
                continue;
              }

              try {
                const results = await extensionState!.mcpClient.zotero.semanticSearch(basename, 1);

                if (results.length === 0) {
                  failed++;
                  continue;
                }

                const item = results[0];
                const children = await extensionState!.mcpClient.zotero.getItemChildren(item.itemKey);

                const pdfAttachment = children.find((child: any) =>
                  child.data?.contentType === 'application/pdf' ||
                  child.data?.filename?.endsWith('.pdf')
                );

                if (pdfAttachment && pdfAttachment.data?.path) {
                  const zoteroPath = pdfAttachment.data.path;
                  if (fs.existsSync(zoteroPath)) {
                    fs.copyFileSync(zoteroPath, pdfPath);
                    downloaded++;
                  } else {
                    failed++;
                  }
                } else {
                  failed++;
                }
              } catch (error) {
                console.error(`Failed to sync PDF for ${basename}:`, error);
                failed++;
              }

              await new Promise(resolve => setTimeout(resolve, 100));
            }

            vscode.window.showInformationMessage(
              `PDF sync complete!\n\nDownloaded: ${downloaded}\nSkipped (already exists): ${skipped}\nFailed: ${failed}`
            );

            papersProvider.refresh();
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`PDF sync failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.extractPdf', async (pdfPath: string) => {
      if (!extensionState) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Extracting ${path.basename(pdfPath)}`,
            cancellable: false
          },
          async () => {
            const result = await extensionState!.pdfExtractionService.extractText(pdfPath);

            if (result.success) {
              vscode.window.showInformationMessage(
                `Extracted ${path.basename(pdfPath)} successfully!`,
                'Open Text'
              ).then(action => {
                if (action === 'Open Text' && result.outputPath) {
                  vscode.workspace.openTextDocument(result.outputPath).then(doc => {
                    vscode.window.showTextDocument(doc);
                  });
                }
              });

              papersProvider.refresh();
            } else {
              vscode.window.showErrorMessage(`Extraction failed: ${result.error}`);
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`PDF extraction failed: ${error}`);
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
            const sections = extensionState!.outlineParser.getHierarchy();
            const claims = extensionState!.claimsManager.getClaims();

            let processed = 0;
            let associated = 0;

            for (const claim of claims) {
              progress.report({
                message: `Processing ${claim.id}...`,
                increment: (1 / claims.length) * 100
              });

              const claimWords = new Set(
                claim.text.toLowerCase()
                  .split(/\s+/)
                  .filter(w => w.length > 3)
              );

              const sectionScores: Array<{ section: any; score: number }> = [];

              for (const section of sections) {
                if (section.children.length > 3) {
                  continue;
                }

                const sectionText = `${section.title} ${section.content.join(' ')}`.toLowerCase();

                let matches = 0;
                for (const word of claimWords) {
                  if (sectionText.includes(word)) {
                    matches++;
                  }
                }

                const score = matches / claimWords.size;

                if (score > 0.2) {
                  sectionScores.push({ section, score });
                }
              }

              sectionScores.sort((a, b) => b.score - a.score);
              const topMatches = sectionScores.slice(0, 3);

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
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Association failed: ${error}`);
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

            if (selected && selected.type === 'section') {
              const outlinePath = extensionState!.getAbsolutePath(extensionState!.getConfig().outlinePath);
              const document = await vscode.workspace.openTextDocument(outlinePath);
              const editor = await vscode.window.showTextDocument(document);
              const position = new vscode.Position(selected.item.lineStart, 0);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
      }
    })
  );
}
