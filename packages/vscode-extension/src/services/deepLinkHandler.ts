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
      if (!annotationKey || annotationKey.trim() === '') {
        throw new Error('annotationKey is required and cannot be empty');
      }
      if (!itemKey || itemKey.trim() === '') {
        throw new Error('itemKey is required and cannot be empty');
      }

      const url = `zotero://open-pdf/library/items/${encodeURIComponent(itemKey)}?annotation=${encodeURIComponent(annotationKey)}`;
      this.getLogger().info(`Opening Zotero annotation URL: ${url}`);
      const uri = vscode.Uri.parse(url);

      await vscode.env.openExternal(uri);
      this.getLogger().info(`Opened Zotero annotation: ${annotationKey}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.getLogger().error(`Failed to open Zotero annotation: ${errorMessage}`);
      this.getLogger().error(`annotationKey: ${annotationKey}, itemKey: ${itemKey}`);

      // Show user-friendly error message
      if (errorMessage.includes('annotationKey') || errorMessage.includes('itemKey')) {
        vscode.window.showErrorMessage('Invalid annotation or item key');
      } else {
        vscode.window.showErrorMessage(
          'Failed to open PDF in Zotero. Make sure Zotero is running.',
          'Open Zotero'
        ).then((selection: string | undefined) => {
          if (selection === 'Open Zotero') {
            // Try to open Zotero application
            vscode.env.openExternal(vscode.Uri.parse('zotero://'));
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
      if (!itemKey || itemKey.trim() === '') {
        throw new Error('itemKey is required and cannot be empty');
      }
      if (pageNumber < 1) {
        throw new Error('pageNumber must be greater than 0');
      }

      const url = this.buildPageUrl(itemKey, pageNumber);
      this.getLogger().info(`Opening Zotero page URL: ${url}`);
      const uri = vscode.Uri.parse(url);

      await vscode.env.openExternal(uri);
      this.getLogger().info(`Opened Zotero PDF: ${itemKey} at page ${pageNumber}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.getLogger().error(`Failed to open Zotero PDF: ${errorMessage}`);
      this.getLogger().error(`itemKey: ${itemKey}, pageNumber: ${pageNumber}`);

      // Show user-friendly error message
      if (errorMessage.includes('itemKey') || errorMessage.includes('pageNumber')) {
        vscode.window.showErrorMessage('Invalid item key or page number');
      } else {
        vscode.window.showErrorMessage(
          'Failed to open PDF in Zotero. Make sure Zotero is running.',
          'Open Zotero'
        ).then((selection: string | undefined) => {
          if (selection === 'Open Zotero') {
            // Try to open Zotero application
            vscode.env.openExternal(vscode.Uri.parse('zotero://'));
          }
        });
      }
      return false;
    }
  }
}
