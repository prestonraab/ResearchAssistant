import * as vscode from 'vscode';

/**
 * Validates and manages OpenAI API key configuration
 * Provides user-facing error messages and guidance
 */
export class ApiKeyValidator {
  private static readonly CONFIG_KEY = 'researchAssistant.openaiApiKey';
  private static readonly SETTING_ID = 'openaiApiKey';
  private hasShownError = false;

  /**
   * Check if API key is configured and valid
   * Shows error message to user if missing
   */
  static async validateApiKey(): Promise<boolean> {
    const apiKey = this.getApiKey();

    if (!apiKey || apiKey.trim() === '') {
      await this.showApiKeyMissingError();
      return false;
    }

    return true;
  }

  /**
   * Get the configured API key from settings or environment
   */
  static getApiKey(): string {
    const config = vscode.workspace.getConfiguration('researchAssistant');
    return config.get<string>(this.SETTING_ID) || process.env.OPENAI_API_KEY || '';
  }

  /**
   * Show error message with action buttons
   */
  private static async showApiKeyMissingError(): Promise<void> {
    const message = 'OpenAI API key is not configured. Embedding-based features will not work.';
    const configureButton = 'Configure API Key';
    const docsButton = 'View Documentation';

    const result = await vscode.window.showErrorMessage(
      message,
      configureButton,
      docsButton
    );

    if (result === configureButton) {
      await this.openApiKeySettings();
    } else if (result === docsButton) {
      await this.openDocumentation();
    }
  }

  /**
   * Open VS Code settings to configure API key
   */
  private static async openApiKeySettings(): Promise<void> {
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      this.CONFIG_KEY
    );
  }

  /**
   * Open documentation (placeholder for now)
   */
  private static async openDocumentation(): Promise<void> {
    vscode.window.showInformationMessage(
      'To get an OpenAI API key:\n\n' +
      '1. Visit https://platform.openai.com/api-keys\n' +
      '2. Sign in or create an account\n' +
      '3. Create a new API key\n' +
      '4. Copy the key and paste it in VS Code settings (researchAssistant.openaiApiKey)\n\n' +
      'Note: Keep your API key secret and never commit it to version control.'
    );
  }

  /**
   * Check if API key is available (non-blocking, for feature detection)
   */
  static isApiKeyAvailable(): boolean {
    return !!this.getApiKey().trim();
  }

  /**
   * Get a user-friendly error message for embedding failures
   */
  static getEmbeddingErrorMessage(error: unknown): string {
    const errorStr = error instanceof Error ? error.message : String(error);

    if (errorStr.includes('401') || errorStr.includes('Unauthorized')) {
      return 'Invalid OpenAI API key. Please check your configuration in VS Code settings.';
    }

    if (errorStr.includes('429') || errorStr.includes('rate limit')) {
      return 'OpenAI API rate limit exceeded. Please try again in a moment.';
    }

    if (errorStr.includes('network') || errorStr.includes('ECONNREFUSED')) {
      return 'Network error connecting to OpenAI. Please check your internet connection.';
    }

    return `Embedding service error: ${errorStr}`;
  }
}
