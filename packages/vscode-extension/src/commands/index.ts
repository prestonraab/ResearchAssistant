import * as vscode from 'vscode';
import { ExtensionState } from '../core/state';
import { OutlineTreeProvider } from '../ui/outlineTreeProvider';
import { ClaimsTreeProvider } from '../ui/claimsTreeProvider';
import { PapersTreeProvider } from '../ui/papersTreeProvider';
import { ClaimDocumentProvider } from '../ui/claimDocumentProvider';
import { ClaimReviewProvider } from '../ui/claimReviewProvider';
import { BulkImportService } from '../core/bulkImportService';
import { registerOutlineCommands } from './outlineCommands';
import { registerClaimCommands } from './claimCommands';
import { registerVerificationCommands } from './verificationCommands';
import { registerBulkCommands } from './bulkCommands';
import { registerManuscriptCommands } from './manuscriptCommands';
import { registerReadingStatusCommands } from './readingStatusCommands';

export function registerAllCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState,
  outlineProvider: OutlineTreeProvider,
  claimsProvider: ClaimsTreeProvider,
  papersProvider: PapersTreeProvider,
  claimDocumentProvider: ClaimDocumentProvider,
  claimReviewProvider: ClaimReviewProvider | undefined,
  getBulkImportService: () => BulkImportService | undefined,
  autoSyncPDFs: (state: ExtensionState, papersProvider: PapersTreeProvider, logger: any) => Promise<void>,
  logger: any
): void {
  registerOutlineCommands(context, extensionState, outlineProvider);
  registerClaimCommands(context, extensionState, claimsProvider, claimDocumentProvider, claimReviewProvider);
  registerVerificationCommands(context, extensionState, claimsProvider);
  registerBulkCommands(context, extensionState, outlineProvider, claimsProvider, papersProvider, getBulkImportService, autoSyncPDFs, logger);
  registerManuscriptCommands(context, extensionState, papersProvider, logger);
  registerReadingStatusCommands(context, extensionState, papersProvider);
}
