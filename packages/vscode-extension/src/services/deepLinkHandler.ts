import * as vscode from 'vscode';

interface MessageSelection {
  [key: string]: unknown;
}

/**
 * DeepLinkHandler manages the construction and opening of Zotero deep links.
 * It constructs zotero:// URLs for opening PDFs at specific locations and
 * handles errors when Zotero is not available.
 */
export class DeepLinkHandler {
  private getLogger() {
    try {
      // Lazy load the logger to allow mocking in tests
      const loggingService = require('../core/loggingService');
      return loggingService.getLogger();
    } catch (error) {
      // Return a no-op logger if loggingService is not available
      return {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
        dispose: () => {},
      };
    }
  }

  /**
   * Construct a zotero:// URL for opening a PDF to a specific annotation
   * @param annotationKey - The Zotero annotation key
   * @returns The deep link URL in format: zotero://open-pdf/library/items/{itemKey}?annotation={annotationKey}
   */
  buildAnnotationUrl(annotationKey: string): string {
    // Extract itemKey from annotationKey if needed
    // Zotero annotation keys are typically in format: itemKey-annotationKey
    // For now, we'll construct the URL with the annotation key directly
    // The itemKey should be passed separately in the openAnnotation method
    return `zotero://open-pdf/library/items/{itemKey}?annotation=${encodeURIComponent(annotationKey)}`;
  }

  /**
   * Construct a zotero:// URL for opening a PDF to a specific page
   * @param itemKey - The Zotero item key for the PDF
   * @param pageNumber - The page number to open (1-indexed)
   * @returns The deep link URL in format: zotero://open-pdf/library/items/{itemKey}?page={pageNumber}
   */
  buildPageUrl(itemKey: string, pageNumber: number): string {
    if (!itemKey || itemKey.trim() === '') {
      throw new Error('itemKey is required and cannot be empty');
    }
    if (pageNumber < 1) {
      throw new Error('pageNumber must be greater than 0');
    }
    return `zotero://open-pdf/library/items/${encodeURIComponent(itemKey)}?page=${pageNumber}`;
  }

  /**
   * Open a Zotero annotation in the PDF reader
   * @param annotationKey - The Zotero annotation key
   * @param itemKey - The Zotero item key for the PDF (required to construct the URL)
   * @returns True if the link was opened successfully, false otherwise
   */
  async openAnnotation(annotationKey: string, itemKey: string): Promise<boolean> {
    try {
      this.getLogger().debug(`openAnnotation called with: annotationKey="${annotationKey}", itemKey="${itemKey}"`);

      if (!annotationKey || annotationKey.trim() === '') {
        throw new Error('annotationKey is required and cannot be empty');
      }
      if (!itemKey || itemKey.trim() === '') {
        throw new Error('itemKey is required and cannot be empty');
      }

      const url = `zotero://open-pdf/library/items/${encodeURIComponent(itemKey)}?annotation=${encodeURIComponent(annotationKey)}`;
      this.getLogger().info(`Constructed Zotero annotation URL: ${url}`);
      this.getLogger().debug(`URL components - itemKey: "${itemKey}", annotationKey: "${annotationKey}"`);

      const uri = vscode.Uri.parse(url);
      this.getLogger().debug(`Parsed URI: ${uri.toString()}`);

      this.getLogger().info(`Attempting to open external URI: ${url}`);
      const result = await vscode.env.openExternal(uri);
      
      this.getLogger().info(`vscode.env.openExternal returned: ${result}`);
      this.getLogger().info(`Successfully opened Zotero annotation: annotationKey="${annotationKey}", itemKey="${itemKey}"`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      const errorName = error instanceof Error ? error.name : 'Unknown';

      this.getLogger().error(`Failed to open Zotero annotation`);
      this.getLogger().error(`Error message: ${errorMessage}`);
      this.getLogger().error(`Error name: ${errorName}`);
      this.getLogger().error(`Error stack: ${errorStack}`);
      this.getLogger().error(`Input parameters - annotationKey: "${annotationKey}", itemKey: "${itemKey}"`);
      this.getLogger().error(`Annotation key length: ${annotationKey?.length || 0}, Item key length: ${itemKey?.length || 0}`);

      // Show user-friendly error message with more details
      if (errorMessage.includes('annotationKey') || errorMessage.includes('itemKey')) {
        vscode.window.showErrorMessage(
          'Invalid annotation or item key. The annotation may have been deleted or moved in Zotero. Check the extension logs for details.',
          'Open Zotero'
        ).then((selection: string | undefined) => {
          if (selection === 'Open Zotero') {
            vscode.env.openExternal(vscode.Uri.parse('zotero://'));
          }
        });
      } else {
        vscode.window.showErrorMessage(
          `Failed to open PDF in Zotero: ${errorMessage}. Make sure Zotero is running and the PDF is available.`,
          'Open Zotero',
          'View Logs'
        ).then((selection: string | undefined) => {
          if (selection === 'Open Zotero') {
            vscode.env.openExternal(vscode.Uri.parse('zotero://'));
          } else if (selection === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
          }
        });
      }
      return false;
    }
  }

  /**
   * Open a PDF to a specific page in Zotero
   * @param itemKey - The Zotero item key for the PDF
   * @param pageNumber - The page number to open (1-indexed)
   * @returns True if the link was opened successfully, false otherwise
   */
  async openPage(itemKey: string, pageNumber: number): Promise<boolean> {
    try {
      this.getLogger().debug(`openPage called with: itemKey="${itemKey}", pageNumber=${pageNumber}`);

      if (!itemKey || itemKey.trim() === '') {
        throw new Error('itemKey is required and cannot be empty');
      }
      if (pageNumber < 1) {
        throw new Error(`pageNumber must be greater than 0, received: ${pageNumber}`);
      }
      if (!Number.isInteger(pageNumber)) {
        throw new Error(`pageNumber must be an integer, received: ${pageNumber} (type: ${typeof pageNumber})`);
      }

      const url = this.buildPageUrl(itemKey, pageNumber);
      this.getLogger().info(`Constructed Zotero page URL: ${url}`);
      this.getLogger().debug(`URL components - itemKey: "${itemKey}", pageNumber: ${pageNumber}`);

      const uri = vscode.Uri.parse(url);
      this.getLogger().debug(`Parsed URI: ${uri.toString()}`);

      this.getLogger().info(`Attempting to open external URI: ${url}`);
      const result = await vscode.env.openExternal(uri);
      
      this.getLogger().info(`vscode.env.openExternal returned: ${result}`);
      this.getLogger().info(`Successfully opened Zotero PDF: itemKey="${itemKey}", pageNumber=${pageNumber}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      const errorName = error instanceof Error ? error.name : 'Unknown';

      this.getLogger().error(`Failed to open Zotero PDF`);
      this.getLogger().error(`Error message: ${errorMessage}`);
      this.getLogger().error(`Error name: ${errorName}`);
      this.getLogger().error(`Error stack: ${errorStack}`);
      this.getLogger().error(`Input parameters - itemKey: "${itemKey}", pageNumber: ${pageNumber}`);
      this.getLogger().error(`Item key length: ${itemKey?.length || 0}, Page number type: ${typeof pageNumber}`);

      // Show user-friendly error message with more details
      if (errorMessage.includes('itemKey') || errorMessage.includes('pageNumber')) {
        vscode.window.showErrorMessage(
          'Invalid item key or page number. Please check that the PDF and page number are valid. Check the extension logs for details.',
          'Open Zotero'
        ).then((selection: string | undefined) => {
          if (selection === 'Open Zotero') {
            vscode.env.openExternal(vscode.Uri.parse('zotero://'));
          }
        });
      } else {
        vscode.window.showErrorMessage(
          `Failed to open PDF in Zotero: ${errorMessage}. Make sure Zotero is running and the PDF is available.`,
          'Open Zotero',
          'View Logs'
        ).then((selection: string | undefined) => {
          if (selection === 'Open Zotero') {
            vscode.env.openExternal(vscode.Uri.parse('zotero://'));
          } else if (selection === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
          }
        });
      }
      return false;
    }
  }
}
