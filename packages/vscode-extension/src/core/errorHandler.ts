import * as vscode from 'vscode';
import { getLogger } from './loggingService';

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

export interface ErrorContext {
  operation: string;
  component: string;
  details?: Record<string, unknown>;
}

/**
 * Centralized error handling service
 */
export class ErrorHandler {
  private logger = getLogger();

  /**
   * Handle an error with appropriate logging and user notification
   */
  handleError(
    error: Error | unknown,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    showToUser: boolean = true
  ): void {
    const errorMessage = this.formatErrorMessage(error, context);
    
    // Log the error
    this.logger.error(errorMessage, error instanceof Error ? error : undefined, context);

    // Show to user if requested
    if (showToUser) {
      this.showErrorToUser(errorMessage, severity);
    }
  }

  /**
   * Wrap an async operation with error handling
   */
  async wrapAsync<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  /**
   * Wrap a sync operation with error handling
   */
  wrapSync<T>(
    operation: () => T,
    context: ErrorContext,
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  /**
   * Handle MCP connection errors specifically
   */
  handleMCPError(
    error: Error | unknown,
    serverName: string,
    operation: string
  ): void {
    const context: ErrorContext = {
      operation,
      component: 'MCP',
      details: { serverName }
    };

    const message = `MCP ${serverName} error during ${operation}`;
    this.logger.error(message, error instanceof Error ? error : undefined, context);

    // Show user-friendly message
    vscode.window.showErrorMessage(
      `${serverName} is unavailable. Some features may not work. Check the output panel for details.`,
      'Show Logs'
    ).then(selection => {
      if (selection === 'Show Logs') {
        this.logger.show();
      }
    });
  }

  /**
   * Handle file system errors
   */
  handleFileSystemError(
    error: Error | unknown,
    filePath: string,
    operation: string
  ): void {
    const context: ErrorContext = {
      operation,
      component: 'FileSystem',
      details: { filePath }
    };

    this.handleError(error, context, ErrorSeverity.ERROR, true);
  }

  /**
   * Handle validation errors
   */
  handleValidationError(
    message: string,
    details?: Record<string, unknown>
  ): void {
    const context: ErrorContext = {
      operation: 'validation',
      component: 'Validation',
      details
    };

    this.logger.warn(message, details);
    vscode.window.showWarningMessage(message);
  }

  private formatErrorMessage(error: Error | unknown, context: ErrorContext): string {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `[${context.component}] ${context.operation} failed: ${errorMsg}`;
  }

  private showErrorToUser(message: string, severity: ErrorSeverity): void {
    const userMessage = this.getUserFriendlyMessage(message);

    switch (severity) {
      case ErrorSeverity.INFO:
        vscode.window.showInformationMessage(userMessage);
        break;
      case ErrorSeverity.WARNING:
        vscode.window.showWarningMessage(userMessage);
        break;
      case ErrorSeverity.ERROR:
        vscode.window.showErrorMessage(userMessage, 'Show Logs').then(selection => {
          if (selection === 'Show Logs') {
            this.logger.show();
          }
        });
        break;
    }
  }

  private getUserFriendlyMessage(technicalMessage: string): string {
    // Map technical errors to user-friendly messages
    if (technicalMessage.includes('ENOENT')) {
      return 'File not found. Please check your configuration.';
    }
    if (technicalMessage.includes('EACCES')) {
      return 'Permission denied. Please check file permissions.';
    }
    if (technicalMessage.includes('timeout')) {
      return 'Operation timed out. Please try again.';
    }
    if (technicalMessage.includes('MCP')) {
      return 'External service unavailable. Some features may not work.';
    }
    
    // Return original message if no mapping found
    return technicalMessage;
  }
}

// Global error handler instance
let globalErrorHandler: ErrorHandler | undefined;

export function initializeErrorHandler(): ErrorHandler {
  globalErrorHandler = new ErrorHandler();
  return globalErrorHandler;
}

export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}
