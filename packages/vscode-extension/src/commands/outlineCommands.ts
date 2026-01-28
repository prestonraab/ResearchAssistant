import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { OutlineTreeProvider } from '../ui/outlineTreeProvider';

export function registerOutlineCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  outlineProvider: OutlineTreeProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.refreshOutline', () => {
      outlineProvider.refresh();
    }),

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

      const selectedQuery = await vscode.window.showQuickPick(coverage.suggestedQueries, {
        placeHolder: 'Select a search query or edit it',
        canPickMany: false
      });

      if (selectedQuery) {
        const finalQuery = await vscode.window.showInputBox({
          prompt: 'Edit search query if needed',
          value: selectedQuery
        });

        if (finalQuery) {
          vscode.window.showInformationMessage(`Searching for: "${finalQuery}"`);
        }
      }
    }),

    vscode.commands.registerCommand('researchAssistant.viewClaimsForSection', async (item) => {
      if (!item || !extensionState) {
        return;
      }

      const section = item.section;
      const claims = await extensionState.claimsManager.loadClaims();
      const sectionClaims = claims.filter(claim => claim.sections.includes(section.id));

      if (sectionClaims.length === 0) {
        vscode.window.showInformationMessage(`No claims found for section: ${section.title}`);
        return;
      }

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
        const claim = selected.claim;
        const source = claim.primaryQuote?.source || 'Unknown';
        const quote = claim.primaryQuote?.text || '';
        const message = `**${claim.id}** (${claim.category})\n\n${claim.text}\n\n**Source:** ${source}\n\n**Quote:** ${quote}`;
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

      const action = coverage.claimCount < 2 ? 'Search Papers' : 'View Claims';
      const result = await vscode.window.showInformationMessage(message, { modal: true }, action);

      if (result === 'Search Papers') {
        vscode.commands.executeCommand('researchAssistant.searchPapersForSection', item);
      } else if (result === 'View Claims') {
        vscode.commands.executeCommand('researchAssistant.viewClaimsForSection', item);
      }
    })
  );
}
