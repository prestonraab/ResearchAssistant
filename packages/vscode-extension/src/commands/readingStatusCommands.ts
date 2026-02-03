import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { PapersTreeProvider, PaperTreeItem } from '../ui/papersTreeProvider';
import { ReadingStatus } from '../core/readingStatusManager';

export function registerReadingStatusCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  papersProvider: PapersTreeProvider
): void {
  const readingStatusManager = extensionState.readingStatusManager;

  // Helper to get paper ID from tree item
  const getPaperId = (item: PaperTreeItem): string | undefined => {
    // The label is the paper name/ID
    return item.label;
  };

  // Mark as Unread
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.markPaperUnread', async (item: PaperTreeItem) => {
      const paperId = getPaperId(item);
      if (!paperId) {
        vscode.window.showErrorMessage('Could not identify paper');
        return;
      }

      try {
        await readingStatusManager.setStatus(paperId, 'unread');
        papersProvider.refresh();
        vscode.window.showInformationMessage(`Marked "${paperId}" as unread`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update reading status: ${error}`);
      }
    })
  );

  // Mark as Some Read
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.markPaperSomeRead', async (item: PaperTreeItem) => {
      const paperId = getPaperId(item);
      if (!paperId) {
        vscode.window.showErrorMessage('Could not identify paper');
        return;
      }

      try {
        await readingStatusManager.setStatus(paperId, 'some-read');
        papersProvider.refresh();
        vscode.window.showInformationMessage(`Marked "${paperId}" as partially read`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update reading status: ${error}`);
      }
    })
  );

  // Mark as Skimmed
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.markPaperSkimmed', async (item: PaperTreeItem) => {
      const paperId = getPaperId(item);
      if (!paperId) {
        vscode.window.showErrorMessage('Could not identify paper');
        return;
      }

      try {
        await readingStatusManager.setStatus(paperId, 'skimmed');
        papersProvider.refresh();
        vscode.window.showInformationMessage(`Marked "${paperId}" as skimmed`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update reading status: ${error}`);
      }
    })
  );

  // Mark as Read
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.markPaperRead', async (item: PaperTreeItem) => {
      const paperId = getPaperId(item);
      if (!paperId) {
        vscode.window.showErrorMessage('Could not identify paper');
        return;
      }

      try {
        await readingStatusManager.setStatus(paperId, 'read');
        papersProvider.refresh();
        vscode.window.showInformationMessage(`Marked "${paperId}" as read`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update reading status: ${error}`);
      }
    })
  );

  // Mark as Deeply Read
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.markPaperDeeplyRead', async (item: PaperTreeItem) => {
      const paperId = getPaperId(item);
      if (!paperId) {
        vscode.window.showErrorMessage('Could not identify paper');
        return;
      }

      try {
        await readingStatusManager.setStatus(paperId, 'deeply-read');
        papersProvider.refresh();
        vscode.window.showInformationMessage(`Marked "${paperId}" as deeply read`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update reading status: ${error}`);
      }
    })
  );

  // Quick status picker
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.setPaperReadingStatus', async (item: PaperTreeItem) => {
      const paperId = getPaperId(item);
      if (!paperId) {
        vscode.window.showErrorMessage('Could not identify paper');
        return;
      }

      const currentStatus = readingStatusManager.getStatus(paperId);
      const statusOptions: Array<{ label: string; value: ReadingStatus; description: string }> = [
        { label: '$(circle-outline) Unread', value: 'unread', description: 'Not started' },
        { label: '$(circle-half-filled) Partially Read', value: 'some-read', description: 'Started reading' },
        { label: '$(eye) Skimmed', value: 'skimmed', description: 'Quickly reviewed' },
        { label: '$(check) Read', value: 'read', description: 'Fully read' },
        { label: '$(star-full) Deeply Read', value: 'deeply-read', description: 'Read with detailed notes' }
      ];

      const selected = await vscode.window.showQuickPick(statusOptions, {
        placeHolder: `Current status: ${currentStatus?.status || 'unread'}`,
        matchOnDescription: true
      });

      if (selected) {
        try {
          await readingStatusManager.setStatus(paperId, selected.value);
          papersProvider.refresh();
          vscode.window.showInformationMessage(`Updated reading status to: ${selected.label}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to update reading status: ${error}`);
        }
      }
    })
  );

  // Show reading statistics
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.showReadingStatistics', async () => {
      const stats = readingStatusManager.getStatistics();

      const message = `
📊 Reading Statistics

Unread: ${stats.unread}
Partially Read: ${stats.someRead}
Skimmed: ${stats.skimmed}
Read: ${stats.read}
Deeply Read: ${stats.deeplyRead}

Total Reading Time: ${stats.totalReadingTime} minutes
Average per Paper: ${stats.averageReadingTime} minutes
Total Notes: ${stats.totalNotes}
      `.trim();

      vscode.window.showInformationMessage(message, { modal: true });
    })
  );
}
