import * as vscode from 'vscode';
import { ExtensionState } from './core/state';
import { OutlineTreeProvider } from './ui/outlineTreeProvider';
import { ClaimsTreeProvider } from './ui/claimsTreeProvider';
import { PapersTreeProvider } from './ui/papersTreeProvider';

let extensionState: ExtensionState | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Research Assistant extension is now active');

  // Initialize extension state
  extensionState = new ExtensionState(context);
  await extensionState.initialize();

  // Register tree providers
  const outlineProvider = new OutlineTreeProvider(extensionState);
  const claimsProvider = new ClaimsTreeProvider(extensionState);
  const papersProvider = new PapersTreeProvider(extensionState);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('researchAssistant.outline', outlineProvider),
    vscode.window.registerTreeDataProvider('researchAssistant.claims', claimsProvider),
    vscode.window.registerTreeDataProvider('researchAssistant.papers', papersProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('researchAssistant.activate', async () => {
      vscode.window.showInformationMessage('Research Assistant activated!');
    }),
    vscode.commands.registerCommand('researchAssistant.refreshOutline', () => {
      outlineProvider.refresh();
    }),
    vscode.commands.registerCommand('researchAssistant.refreshClaims', () => {
      claimsProvider.refresh();
    }),
    vscode.commands.registerCommand('researchAssistant.analyzeCoverage', async () => {
      if (extensionState) {
        await extensionState.analyzeCoverage();
        vscode.window.showInformationMessage('Coverage analysis complete');
      }
    }),
    vscode.commands.registerCommand('researchAssistant.showDashboard', async () => {
      vscode.window.showInformationMessage('Dashboard feature coming soon');
    })
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('researchAssistant')) {
        extensionState?.reloadConfiguration();
      }
    })
  );
}

export function deactivate() {
  extensionState?.dispose();
}
