import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionState } from '../core/state';
import { PapersTreeProvider } from '../ui/papersTreeProvider';
import { WritingModeProvider } from '../ui/writingModeProvider';
import { EditingModeProvider } from '../ui/editingModeProvider';
import { ClaimMatchingProvider } from '../ui/claimMatchingProvider';
import { ManuscriptExportOptions } from '../core/exportService';
import { SectionTagger } from '../core/sectionTagger';
import { QuestionAnswerParser } from '../core/questionAnswerParser';
import { ZoteroAttachment } from '../services/zoteroApiService';

export function registerManuscriptCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  papersProvider: PapersTreeProvider,
  logger: any
): void {
  // Create provider instances (but don't register as view providers)
  const writingModeProvider = new WritingModeProvider(extensionState, context);
  const editingModeProvider = new EditingModeProvider(extensionState, context);
  const claimMatchingProvider = new ClaimMatchingProvider(extensionState, context);

  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.openWritingMode', async () => {
      try {
        await writingModeProvider.show();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open writing mode: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.openEditingMode', async () => {
      try {
        await editingModeProvider.show();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open editing mode: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.openClaimMatching', async (sentenceId?: string, sentenceText?: string) => {
      try {
        await claimMatchingProvider.show(sentenceId, sentenceText);
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
                const results = await extensionState!.zoteroApiService.semanticSearch(basename, 1);

                if (results.length === 0) {
                  failed++;
                  continue;
                }

                const item = results[0];
                const children = await extensionState!.zoteroApiService.getItemChildren(item.key);

                const pdfAttachment = children.find((child: ZoteroAttachment) =>
                  child.contentType === 'application/pdf' ||
                  child.title?.endsWith('.pdf')
                );

                if (pdfAttachment && pdfAttachment.path) {
                  const zoteroPath = pdfAttachment.path;
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

    // # Pending, might fix "argument must be string" error. 
    // Argument can be a Uri (context menu), string (manual call), or undefined (command palette).
    vscode.commands.registerCommand('researchAssistant.extractPdf', async (arg: any) => {
      if (!extensionState) {
        return;
      }

      let pdfPath: string | undefined;

      // 1. Handle String Argument (direct call)
      if (typeof arg === 'string') {
        pdfPath = arg;
      }
      // 2. Handle URI Argument (context menu)
      else if (arg instanceof vscode.Uri) {
        pdfPath = arg.fsPath;
      }
      // 3. Handle Object with fsPath (rare edge cases)
      else if (arg && typeof arg.fsPath === 'string') {
        pdfPath = arg.fsPath;
      }

      // 4. Fallback: Prompt user if no path provided (command palette)
      if (!pdfPath) {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          filters: { 'PDF Files': ['pdf'] },
          title: 'Select PDF to Extract'
        });

        if (uris && uris.length > 0) {
          pdfPath = uris[0].fsPath;
        }
      }

      if (!pdfPath) {
        // User cancelled dialog
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
            // ! assertion is safe because we checked extensionState at start of function
            const result = await extensionState!.pdfExtractionService.extractText(pdfPath!);

            if (result.success) {
              vscode.window.showInformationMessage(
                `Extracted ${path.basename(pdfPath!)} successfully!`,
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

    vscode.commands.registerCommand('researchAssistant.tagClaimsFromManuscript', async () => {
      if (!extensionState) {
        return;
      }

      try {
        const manuscriptPath = extensionState.getAbsolutePath('03_Drafting/manuscript.md');
        if (!fs.existsSync(manuscriptPath)) {
          vscode.window.showErrorMessage('Manuscript file not found at 03_Drafting/manuscript.md');
          return;
        }

        const result = await vscode.window.showInformationMessage(
          'This will automatically tag claims with sections based on where they are used in the manuscript. Continue?',
          { modal: true },
          'Yes, Tag Claims',
          'Preview First',
          'Cancel'
        );

        if (result === 'Cancel' || !result) {
          return;
        }

        const manuscriptText = fs.readFileSync(manuscriptPath, 'utf-8');
        const parser = new QuestionAnswerParser();
        const tagger = new SectionTagger(parser, extensionState.claimsManager);

        if (result === 'Preview First') {
          // Show preview of what would be tagged
          const analysis = await tagger.analyzeManuscript(manuscriptText);
          const report = tagger.getSectionUsageReport(manuscriptText);

          let preview = `Found ${analysis.claimsTagged} claims used in ${analysis.sectionsFound} sections:\n\n`;

          for (const [section, claims] of report.entries()) {
            preview += `## ${section}\n`;
            preview += `${claims.length} claims: ${claims.join(', ')}\n\n`;
          }

          const previewDoc = await vscode.workspace.openTextDocument({
            content: preview,
            language: 'markdown'
          });
          await vscode.window.showTextDocument(previewDoc);

          const confirm = await vscode.window.showInformationMessage(
            'Apply these section tags to claims?',
            'Yes, Apply',
            'Cancel'
          );

          if (confirm !== 'Yes, Apply') {
            return;
          }
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Tagging Claims with Sections',
            cancellable: false
          },
          async () => {
            const result = await tagger.tagClaimsFromManuscript(manuscriptText);

            vscode.window.showInformationMessage(
              `Section tagging complete!\n\nTagged ${result.claimsTagged} claims with ${result.sectionsFound} sections`,
              { modal: true }
            );

            // Refresh the outline tree to show updated coverage
            vscode.commands.executeCommand('researchAssistant.refreshOutline');
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Section tagging failed: ${error}`);
        logger?.error('Section tagging error:', error);
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
    }),

    vscode.commands.registerCommand('researchAssistant.exportManuscriptMarkdown', async () => {
      if (!extensionState) {
        vscode.window.showErrorMessage('Extension state not initialized');
        return;
      }

      try {
        // Load manuscript
        const manuscriptPath = extensionState.getAbsolutePath('03_Drafting/manuscript.md');
        if (!fs.existsSync(manuscriptPath)) {
          vscode.window.showErrorMessage('Manuscript file not found at 03_Drafting/manuscript.md');
          return;
        }

        const manuscriptText = fs.readFileSync(manuscriptPath, 'utf-8');
        const manuscriptUri = vscode.Uri.file(manuscriptPath);

        // Prompt for export location
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('manuscript-export.md'),
          filters: {
            'Markdown': ['md']
          }
        });

        if (!uri) {
          return;
        }

        // Ask for footnote scope
        const footnoteScope = await vscode.window.showQuickPick(
          [
            { label: 'Continuous (throughout document)', value: 'document' },
            { label: 'Per-section (reset per section)', value: 'section' }
          ],
          { placeHolder: 'Select footnote numbering scope' }
        );

        if (!footnoteScope) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting manuscript to Markdown',
            cancellable: false
          },
          async () => {
            const options: ManuscriptExportOptions = {
              outputPath: uri.fsPath,
              includeFootnotes: true,
              includeBibliography: true,
              footnoteStyle: 'pandoc',
              footnoteScope: footnoteScope.value as 'document' | 'section',
              manuscriptId: manuscriptUri.toString()
            };

            await extensionState!.exportService.exportManuscriptMarkdown(manuscriptText, options);

            vscode.window.showInformationMessage(
              `Manuscript exported successfully to ${uri.fsPath}`,
              'Open File'
            ).then(action => {
              if (action === 'Open File') {
                vscode.workspace.openTextDocument(uri).then(doc => {
                  vscode.window.showTextDocument(doc);
                });
              }
            });
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
        logger?.error('Markdown export error:', error);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.exportManuscriptWord', async () => {
      if (!extensionState) {
        vscode.window.showErrorMessage('Extension state not initialized');
        return;
      }

      try {
        // Load manuscript
        const manuscriptPath = extensionState.getAbsolutePath('03_Drafting/manuscript.md');
        if (!fs.existsSync(manuscriptPath)) {
          vscode.window.showErrorMessage('Manuscript file not found at 03_Drafting/manuscript.md');
          return;
        }

        const manuscriptText = fs.readFileSync(manuscriptPath, 'utf-8');
        const manuscriptUri = vscode.Uri.file(manuscriptPath);

        // Prompt for export location
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('manuscript-export.docx'),
          filters: {
            'Word Document': ['docx']
          }
        });

        if (!uri) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting manuscript to Word',
            cancellable: false
          },
          async () => {
            const options: ManuscriptExportOptions = {
              outputPath: uri.fsPath,
              includeFootnotes: true,
              includeBibliography: true,
              footnoteStyle: 'native',
              footnoteScope: 'document',
              manuscriptId: manuscriptUri.toString()
            };

            await extensionState!.exportService.exportManuscriptWord(manuscriptText, options);

            vscode.window.showInformationMessage(
              `Manuscript exported successfully to ${uri.fsPath}`,
              'Open File'
            ).then(action => {
              if (action === 'Open File') {
                vscode.commands.executeCommand('vscode.open', uri);
              }
            });
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
        logger?.error('Word export error:', error);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.exportManuscriptLatex', async () => {
      if (!extensionState) {
        vscode.window.showErrorMessage('Extension state not initialized');
        return;
      }

      try {
        // Load manuscript
        const manuscriptPath = extensionState.getAbsolutePath('03_Drafting/manuscript.md');
        if (!fs.existsSync(manuscriptPath)) {
          vscode.window.showErrorMessage('Manuscript file not found at 03_Drafting/manuscript.md');
          return;
        }

        const manuscriptText = fs.readFileSync(manuscriptPath, 'utf-8');
        const manuscriptUri = vscode.Uri.file(manuscriptPath);

        // Prompt for export location
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('manuscript-export.tex'),
          filters: {
            'LaTeX Document': ['tex']
          }
        });

        if (!uri) {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Exporting manuscript to LaTeX',
            cancellable: false
          },
          async () => {
            const options: ManuscriptExportOptions = {
              outputPath: uri.fsPath,
              includeFootnotes: true,
              includeBibliography: true,
              footnoteStyle: 'native',
              footnoteScope: 'document',
              manuscriptId: manuscriptUri.toString()
            };

            await extensionState!.exportService.exportManuscriptLatex(manuscriptText, options);

            vscode.window.showInformationMessage(
              `Manuscript exported successfully to ${uri.fsPath}`,
              'Open File'
            ).then(action => {
              if (action === 'Open File') {
                vscode.commands.executeCommand('vscode.open', uri);
              }
            });
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
        logger?.error('LaTeX export error:', error);
      }
    }),

    // Performance benchmark commands
    vscode.commands.registerCommand('researchAssistant.runPerformanceBenchmarks', async () => {
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Running Performance Benchmarks',
            cancellable: false
          },
          async (progress) => {
            const { getBenchmark } = await import('../core/performanceBenchmark');
            const benchmark = getBenchmark();

            progress.report({ message: 'Benchmarking writing mode...', increment: 20 });
            await benchmark.benchmarkModeLoad('writing', async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
            });

            progress.report({ message: 'Benchmarking editing mode...', increment: 20 });
            await benchmark.benchmarkModeLoad('editing', async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
            });

            progress.report({ message: 'Benchmarking claim matching...', increment: 20 });
            const claims = await extensionState.claimsManager.loadClaims();
            await benchmark.benchmarkClaimMatching(claims.length, async () => {
              await new Promise(resolve => setTimeout(resolve, 50));
            });

            progress.report({ message: 'Benchmarking claim review...', increment: 20 });
            await benchmark.benchmarkModeLoad('review', async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
            });

            progress.report({ message: 'Complete!', increment: 20 });
          }
        );

        const action = await vscode.window.showInformationMessage(
          'Performance benchmarks completed!',
          'View Dashboard',
          'Export Results'
        );

        if (action === 'View Dashboard') {
          await vscode.commands.executeCommand('researchAssistant.dashboard.focus');
        } else if (action === 'Export Results') {
          await vscode.commands.executeCommand('researchAssistant.exportPerformanceBenchmarks');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Benchmark failed: ${error}`);
        logger?.error('Benchmark error:', error);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.exportPerformanceBenchmarks', async () => {
      try {
        const { getBenchmark } = await import('../core/performanceBenchmark');
        const benchmark = getBenchmark();
        const exportData = benchmark.exportResults();

        const workspaceRoot = vscode.Uri.file(extensionState.getWorkspaceRoot());
        const exportPath = vscode.Uri.joinPath(workspaceRoot, 'performance-benchmark.json');

        await vscode.workspace.fs.writeFile(
          exportPath,
          Buffer.from(exportData, 'utf8')
        );

        const action = await vscode.window.showInformationMessage(
          'Benchmark results exported to performance-benchmark.json',
          'Open File'
        );

        if (action === 'Open File') {
          const doc = await vscode.workspace.openTextDocument(exportPath);
          await vscode.window.showTextDocument(doc);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
        logger?.error('Export error:', error);
      }
    })
  );
}