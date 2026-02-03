import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceConfiguration {
  workspaceRoot: string;
  outlinePath: string;
  claimsDatabasePath: string;
  extractedTextPath: string;
  pdfsPath: string;
  mcpConfigPath: string;
}

export interface UserPreferences {
  citationStyle: string;
  coverageThresholds: {
    low: number;
    moderate: number;
    strong: number;
  };
  autoVerifyQuotes: boolean;
  showInlineSuggestions: boolean;
  dashboardLayout: string;
  zoteroApiKey?: string;
  zoteroUserId?: string;
}

export class ConfigurationManager {
  private static readonly CONFIG_KEY = 'researchAssistant';
  private workspaceConfig?: WorkspaceConfiguration;
  private userPreferences?: UserPreferences;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Initialize configuration
   */
  public async initialize(): Promise<void> {
    await this.detectWorkspaceConfiguration();
    await this.loadUserPreferences();
    await this.validateConfiguration();
  }

  /**
   * Detect workspace configuration
   */
  private async detectWorkspaceConfiguration(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open. Please open a workspace to use the Research Assistant.');
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Check for saved configuration first
    const savedConfig = this.context.workspaceState.get<WorkspaceConfiguration>('workspaceConfig');
    
    if (savedConfig && this.validatePaths(savedConfig)) {
      this.workspaceConfig = savedConfig;
      return;
    }

    // Detect default paths
    this.workspaceConfig = {
      workspaceRoot,
      outlinePath: path.join(workspaceRoot, '03_Drafting', 'outline.md'),
      claimsDatabasePath: path.join(workspaceRoot, '01_Knowledge_Base', 'claims_and_evidence.md'),
      extractedTextPath: path.join(workspaceRoot, 'literature', 'ExtractedText'),
      pdfsPath: path.join(workspaceRoot, 'literature', 'PDFs'),
      mcpConfigPath: path.join(workspaceRoot, '.kiro', 'settings', 'mcp.json')
    };

    // Save detected configuration
    await this.context.workspaceState.update('workspaceConfig', this.workspaceConfig);
  }

  /**
   * Validate that configured paths exist
   */
  private validatePaths(config: WorkspaceConfiguration): boolean {
    return fs.existsSync(config.workspaceRoot);
  }

  /**
   * Validate configuration and show warnings
   */
  private async validateConfiguration(): Promise<void> {
    if (!this.workspaceConfig) {
      return;
    }

    const issues: string[] = [];

    // Check outline file
    if (!fs.existsSync(this.workspaceConfig.outlinePath)) {
      issues.push(`Outline file not found: ${this.workspaceConfig.outlinePath}`);
    }

    // Check claims database
    if (!fs.existsSync(this.workspaceConfig.claimsDatabasePath)) {
      issues.push(`Claims database not found: ${this.workspaceConfig.claimsDatabasePath}`);
    }

    // Check extracted text directory
    if (!fs.existsSync(this.workspaceConfig.extractedTextPath)) {
      // Create directory if it doesn't exist
      fs.mkdirSync(this.workspaceConfig.extractedTextPath, { recursive: true });
    }

    // Check PDFs directory
    if (!fs.existsSync(this.workspaceConfig.pdfsPath)) {
      // Create directory if it doesn't exist
      fs.mkdirSync(this.workspaceConfig.pdfsPath, { recursive: true });
    }

    // Check MCP configuration
    if (!fs.existsSync(this.workspaceConfig.mcpConfigPath)) {
      issues.push(`MCP configuration not found: ${this.workspaceConfig.mcpConfigPath}`);
    }

    // Show warnings if there are issues
    if (issues.length > 0) {
      const message = `Research Assistant configuration issues:\n${issues.join('\n')}`;
      const action = await vscode.window.showWarningMessage(
        message,
        'Configure Paths',
        'Ignore'
      );

      if (action === 'Configure Paths') {
        await this.showConfigurationUI();
      }
    }
  }

  /**
   * Show configuration UI
   */
  public async showConfigurationUI(): Promise<void> {
    const options = [
      'Set Outline Path',
      'Set Claims Database Path',
      'Set Extracted Text Directory',
      'Set PDFs Directory',
      'Set MCP Config Path',
      'Reset to Defaults'
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select configuration option'
    });

    if (!selected) {
      return;
    }

    switch (selected) {
      case 'Set Outline Path':
        await this.setOutlinePath();
        break;
      case 'Set Claims Database Path':
        await this.setClaimsDatabasePath();
        break;
      case 'Set Extracted Text Directory':
        await this.setExtractedTextPath();
        break;
      case 'Set PDFs Directory':
        await this.setPdfsPath();
        break;
      case 'Set MCP Config Path':
        await this.setMcpConfigPath();
        break;
      case 'Reset to Defaults':
        await this.resetToDefaults();
        break;
    }
  }

  /**
   * Set outline path
   */
  private async setOutlinePath(): Promise<void> {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'Markdown': ['md'] },
      title: 'Select Outline File'
    });

    if (uri && uri[0] && this.workspaceConfig) {
      this.workspaceConfig.outlinePath = uri[0].fsPath;
      await this.saveConfiguration();
      vscode.window.showInformationMessage('Outline path updated');
    }
  }

  /**
   * Set claims database path
   */
  private async setClaimsDatabasePath(): Promise<void> {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'Markdown': ['md'] },
      title: 'Select Claims Database File'
    });

    if (uri && uri[0] && this.workspaceConfig) {
      this.workspaceConfig.claimsDatabasePath = uri[0].fsPath;
      await this.saveConfiguration();
      vscode.window.showInformationMessage('Claims database path updated');
    }
  }

  /**
   * Set extracted text path
   */
  private async setExtractedTextPath(): Promise<void> {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select Extracted Text Directory'
    });

    if (uri && uri[0] && this.workspaceConfig) {
      this.workspaceConfig.extractedTextPath = uri[0].fsPath;
      await this.saveConfiguration();
      vscode.window.showInformationMessage('Extracted text path updated');
    }
  }

  /**
   * Set PDFs path
   */
  private async setPdfsPath(): Promise<void> {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select PDFs Directory'
    });

    if (uri && uri[0] && this.workspaceConfig) {
      this.workspaceConfig.pdfsPath = uri[0].fsPath;
      await this.saveConfiguration();
      vscode.window.showInformationMessage('PDFs path updated');
    }
  }

  /**
   * Set MCP config path
   */
  private async setMcpConfigPath(): Promise<void> {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'JSON': ['json'] },
      title: 'Select MCP Configuration File'
    });

    if (uri && uri[0] && this.workspaceConfig) {
      this.workspaceConfig.mcpConfigPath = uri[0].fsPath;
      await this.saveConfiguration();
      vscode.window.showInformationMessage('MCP config path updated');
    }
  }

  /**
   * Reset to default paths
   */
  private async resetToDefaults(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'Reset all paths to defaults?',
      { modal: true },
      'Reset'
    );

    if (confirm === 'Reset') {
      await this.detectWorkspaceConfiguration();
      vscode.window.showInformationMessage('Configuration reset to defaults');
    }
  }

  /**
   * Save configuration
   */
  private async saveConfiguration(): Promise<void> {
    await this.context.workspaceState.update('workspaceConfig', this.workspaceConfig);
  }

  /**
   * Load user preferences
   */
  private async loadUserPreferences(): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_KEY);

    this.userPreferences = {
      citationStyle: config.get('citationStyle', 'APA'),
      coverageThresholds: {
        low: config.get('coverageThresholds.low', 3),
        moderate: config.get('coverageThresholds.moderate', 6),
        strong: config.get('coverageThresholds.strong', 7)
      },
      autoVerifyQuotes: config.get('autoVerifyQuotes', false),
      showInlineSuggestions: config.get('showInlineSuggestions', true),
      dashboardLayout: config.get('dashboardLayout', 'default'),
      zoteroApiKey: config.get('zoteroApiKey', ''),
      zoteroUserId: config.get('zoteroUserId', '')
    };
  }

  /**
   * Get workspace configuration
   */
  public getWorkspaceConfig(): WorkspaceConfiguration {
    if (!this.workspaceConfig) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.workspaceConfig;
  }

  /**
   * Get user preferences
   */
  public getUserPreferences(): UserPreferences {
    if (!this.userPreferences) {
      throw new Error('Preferences not loaded. Call initialize() first.');
    }
    return this.userPreferences;
  }

  /**
   * Update user preference
   */
  public async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_KEY);
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    
    if (this.userPreferences) {
      this.userPreferences[key] = value;
    }
  }

  /**
   * Check if MCP is configured
   */
  public isMCPConfigured(): boolean {
    if (!this.workspaceConfig) {
      return false;
    }
    return fs.existsSync(this.workspaceConfig.mcpConfigPath);
  }

  /**
   * Get MCP configuration
   */
  public getMCPConfig(): any {
    if (!this.workspaceConfig) {
      throw new Error('Configuration not initialized');
    }

    if (!fs.existsSync(this.workspaceConfig.mcpConfigPath)) {
      throw new Error('MCP configuration file not found');
    }

    const content = fs.readFileSync(this.workspaceConfig.mcpConfigPath, 'utf-8');
    return JSON.parse(content);
  }
}
