import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { ClaimsTreeProvider } from '../ui/claimsTreeProvider';
import { ClaimDocumentProvider } from '../ui/claimDocumentProvider';
import { ClaimReviewProvider } from '../ui/claimReviewProvider';

export function registerClaimCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  claimsProvider: ClaimsTreeProvider,
  claimDocumentProvider: ClaimDocumentProvider,
  claimReviewProvider?: ClaimReviewProvider
): void {
  context.subscriptions.push(
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

        // Use new claim review provider if available
        if (claimReviewProvider) {
          await claimReviewProvider.openClaim(claimId);
        } else {
          await claimDocumentProvider.openClaim(claimId);
        }
      } catch (error) {
        console.error('Failed to show claim details:', error);
        vscode.window.showErrorMessage('Failed to show claim details');
      }
    }),

    vscode.commands.registerCommand('researchAssistant.openClaimReview', async (claimId?: string) => {
      if (!extensionState) {
        return;
      }

      try {
        // If no claimId provided, show quick pick
        if (!claimId) {
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
            claimId = selected.claim.id;
          } else {
            return;
          }
        }

        // Open claim review
        if (claimReviewProvider) {
          await claimReviewProvider.openClaim(claimId);
        } else {
          vscode.window.showErrorMessage('Claim review provider not available');
        }
      } catch (error) {
        console.error('Failed to open claim review:', error);
        vscode.window.showErrorMessage('Failed to open claim review');
      }
    }),

    vscode.commands.registerCommand('researchAssistant.refreshClaims', () => {
      claimsProvider.refresh();
    }),

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

    vscode.commands.registerCommand('researchAssistant.goToSource', async (source: string) => {
      if (!extensionState) {
        return;
      }

      const claims = extensionState.claimsManager.findClaimsBySource(source);

      if (claims.length === 0) {
        vscode.window.showInformationMessage(`No claims found for source: ${source}`);
        return;
      }

      vscode.window.showInformationMessage(
        `Source: ${source}\n\nFound ${claims.length} claim${claims.length !== 1 ? 's' : ''} from this source.`,
        'View Claims'
      ).then(selection => {
        if (selection === 'View Claims') {
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

      const similarClaims = await extensionState.claimsManager.detectSimilarClaims(claim.text, 0.7);
      const otherClaims = similarClaims.filter(sc => sc.claim.id !== claimId);

      if (otherClaims.length === 0) {
        vscode.window.showInformationMessage(`No similar claims found for ${claimId}`);
        return;
      }

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

      const sections = await extensionState.outlineParser.parse();
      const claimSections = sections.filter(s => claim.sections.includes(s.id));

      if (claimSections.length === 0) {
        vscode.window.showInformationMessage(`Sections for ${claimId} not found in current outline`);
        return;
      }

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
        const outlinePath = extensionState.getAbsolutePath(extensionState.getConfig().outlinePath);
        const document = await vscode.workspace.openTextDocument(outlinePath);
        const editor = await vscode.window.showTextDocument(document);

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
          return;

        case 'full':
          textToInsert = `${claim.text} (${claim.source})`;
          break;

        case 'quote':
          textToInsert = `${claim.text} (${claim.source}). `;
          if (claim.primaryQuote) {
            textToInsert += `"${claim.primaryQuote}"`;
          }
          break;
      }

      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, textToInsert);
      });
    })
  );
}
