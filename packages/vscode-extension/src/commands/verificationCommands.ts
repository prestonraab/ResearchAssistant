import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { ClaimsTreeProvider } from '../ui/claimsTreeProvider';

export function registerVerificationCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  claimsProvider: ClaimsTreeProvider
): void {
  context.subscriptions.push(
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

    vscode.commands.registerCommand('researchAssistant.verifyClaimQuote', async (claimIdOrItem: string | any) => {
      if (!extensionState) {
        return;
      }

      const claimId = typeof claimIdOrItem === 'string'
        ? claimIdOrItem
        : claimIdOrItem?.claim?.id;

      if (!claimId) {
        vscode.window.showErrorMessage('Invalid claim ID');
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Verifying ${claimId}`,
            cancellable: false
          },
          async () => {
            const result = await extensionState!.autoQuoteVerifier.verifyClaimManually(claimId);

            if (result) {
              if (result.verified) {
                vscode.window.showInformationMessage(
                  `✓ Quote verified for ${claimId} (${(result.similarity * 100).toFixed(1)}% match)`
                );
                claimsProvider.refresh();
              }
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Verification failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.verifyAllUnverified', async () => {
      if (!extensionState) {
        return;
      }

      try {
        await extensionState.autoQuoteVerifier.verifyAllUnverified();
      } catch (error) {
        vscode.window.showErrorMessage(`Batch verification failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.verifyAllClaims', async () => {
      if (!extensionState) {
        return;
      }

      try {
        vscode.window.showInformationMessage('Verifying all claims... This may take a moment.');
        const result = await extensionState.mcpClient.research.verifyAllClaims(false, 0.8);

        if (result.error) {
          vscode.window.showErrorMessage(`Verification failed: ${result.error}`);
          return;
        }

        const verified = result.verified_count || 0;
        const total = result.total_count || 0;
        const problematic = result.problematic_claims || [];

        let message = `Verification complete: ${verified}/${total} claims verified`;
        if (problematic.length > 0) {
          message += `\n\n${problematic.length} claims need review:\n`;
          problematic.slice(0, 5).forEach((claim: any) => {
            message += `\n• ${claim.id}: ${claim.issue}`;
          });
          if (problematic.length > 5) {
            message += `\n\n... and ${problematic.length - 5} more`;
          }
        }

        vscode.window.showInformationMessage(message, 'View Report').then(selection => {
          if (selection === 'View Report') {
            const reportContent = JSON.stringify(result, null, 2);
            const doc = vscode.workspace.openTextDocument({
              language: 'json',
              content: reportContent
            });
            doc.then(d => vscode.window.showTextDocument(d));
          }
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Verification failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.validateClaimSupport', async (claimIdOrItem: string | any) => {
      if (!extensionState) {
        return;
      }

      const claimId = typeof claimIdOrItem === 'string'
        ? claimIdOrItem
        : claimIdOrItem?.claim?.id;

      if (!claimId) {
        vscode.window.showErrorMessage('Invalid claim ID');
        return;
      }

      try {
        const claim = extensionState.claimsManager.getClaim(claimId);
        if (!claim) {
          vscode.window.showWarningMessage(`Claim ${claimId} not found`);
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Validating support for ${claimId}`,
            cancellable: false
          },
          async () => {
            const validation = await extensionState!.claimSupportValidator.validateSupport(claim);

            let message = `**${claimId} Support Validation**\n\n`;
            message += `${validation.analysis}\n\n`;

            if (validation.suggestedQuotes && validation.suggestedQuotes.length > 0) {
              message += `**Suggested Alternative Quotes:**\n\n`;
              validation.suggestedQuotes.forEach((quote, i) => {
                message += `${i + 1}. "${quote.substring(0, 150)}${quote.length > 150 ? '...' : ''}"\n\n`;
              });
            }

            const actions = validation.suggestedQuotes && validation.suggestedQuotes.length > 0
              ? ['View Suggestions', 'Edit Claim']
              : ['Edit Claim'];

            const result = await vscode.window.showInformationMessage(message, { modal: true }, ...actions);

            if (result === 'View Suggestions' && validation.suggestedQuotes) {
              const items = validation.suggestedQuotes.map((quote, i) => ({
                label: `Quote ${i + 1}`,
                description: `${quote.substring(0, 80)}...`,
                detail: quote,
                quote
              }));

              const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a quote to use'
              });

              if (selected) {
                const replace = await vscode.window.showInformationMessage(
                  'Replace the primary quote with this suggestion?',
                  'Yes', 'No'
                );

                if (replace === 'Yes') {
                  await extensionState!.claimsManager.updateClaim(claimId, {
                    primaryQuote: {
                      text: selected.quote,
                      source: claim.primaryQuote?.source || '',
                      sourceId: claim.primaryQuote?.sourceId,
                      verified: false
                    }
                  });
                  vscode.window.showInformationMessage(`Updated primary quote for ${claimId}`);
                  claimsProvider.refresh();
                }
              }
            } else if (result === 'Edit Claim') {
              vscode.commands.executeCommand('researchAssistant.showClaimDetails', claimId);
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Validation failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.validateAllClaims', async () => {
      if (!extensionState) {
        return;
      }

      try {
        const allClaims = extensionState.claimsManager.getClaims();

        if (allClaims.length === 0) {
          vscode.window.showInformationMessage('No claims to validate');
          return;
        }

        const verifiedClaims = allClaims.filter(c => c.verified === true);

        if (verifiedClaims.length === 0) {
          vscode.window.showInformationMessage(
            `No verified claims to validate. ${allClaims.length} claims need quote verification first.`,
            'Verify Quotes'
          ).then(selection => {
            if (selection === 'Verify Quotes') {
              vscode.commands.executeCommand('researchAssistant.batchVerifyQuotes');
            }
          });
          return;
        }

        const result = await vscode.window.showInformationMessage(
          `Validate support for ${verifiedClaims.length} verified claims? (${allClaims.length - verifiedClaims.length} unverified claims will be skipped)\n\nThis may take a few minutes.`,
          { modal: true },
          'Yes, Validate Verified',
          'Cancel'
        );

        if (result !== 'Yes, Validate Verified') {
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Validating Claims',
            cancellable: false
          },
          async (progress) => {
            const validations = await extensionState!.claimSupportValidator.batchValidate(
              verifiedClaims,
              (current, total) => {
                progress.report({
                  message: `${current}/${total} verified claims validated`,
                  increment: (1 / total) * 100
                });
              }
            );

            const weakSupport = validations.filter(v => !v.supported);
            const strongSupport = validations.filter(v => v.similarity >= 0.75);
            const moderateSupport = validations.filter(v => v.supported && v.similarity < 0.75);

            let message = `**Claim Support Validation Complete**\n\n`;
            message += `Verified claims validated: ${validations.length}\n`;
            message += `Strong support (≥75%): ${strongSupport.length}\n`;
            message += `Moderate support (60-75%): ${moderateSupport.length}\n`;
            message += `Weak support (<60%): ${weakSupport.length}\n\n`;

            if (weakSupport.length > 0) {
              message += `**Claims with weak support:**\n`;
              weakSupport.slice(0, 10).forEach(v => {
                message += `- ${v.claimId} (${(v.similarity * 100).toFixed(1)}%)\n`;
              });

              if (weakSupport.length > 10) {
                message += `\n...and ${weakSupport.length - 10} more`;
              }
            }

            const actions = weakSupport.length > 0 ? ['View Weak Claims', 'Export Report'] : ['Export Report'];
            const action = await vscode.window.showInformationMessage(message, { modal: true }, ...actions);

            if (action === 'View Weak Claims') {
              const items = weakSupport.map(v => ({
                label: v.claimId,
                description: `${(v.similarity * 100).toFixed(1)}% similarity`,
                detail: v.analysis,
                validation: v
              }));

              const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `${weakSupport.length} claims with weak support`
              });

              if (selected) {
                vscode.commands.executeCommand('researchAssistant.validateClaimSupport', selected.validation.claimId);
              }
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Batch validation failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('researchAssistant.flagWeakSupport', async () => {
      if (!extensionState) {
        return;
      }

      try {
        const claims = extensionState.claimsManager.getClaims();

        if (claims.length === 0) {
          vscode.window.showInformationMessage('No claims to check');
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Checking for weak support',
            cancellable: false
          },
          async () => {
            const weakClaims = await extensionState!.claimSupportValidator.flagWeakSupport(claims);

            if (weakClaims.length === 0) {
              vscode.window.showInformationMessage('All claims have adequate support!');
              return;
            }

            const items = weakClaims.map(({ claim, validation }) => ({
              label: claim.id,
              description: `${(validation.similarity * 100).toFixed(1)}% similarity`,
              detail: claim.text.substring(0, 100) + (claim.text.length > 100 ? '...' : ''),
              claim,
              validation
            }));

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: `${weakClaims.length} claims with weak support (< 60% similarity)`
            });

            if (selected) {
              vscode.commands.executeCommand('researchAssistant.validateClaimSupport', selected.claim.id);
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to flag weak support: ${error}`);
      }
    })
  );
}
