/**
 * Error handling utilities for immersive modes
 * Provides error boundaries, retry logic, and user-friendly error messages
 */

import * as vscode from 'vscode';

export interface ErrorContext {
  operation: string;
  component: string;
  context?: string;
  details?: Record<string, any>;
}

/**
 * Execute operation with error boundary
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  errorContext: ErrorContext,
  showUserMessage: boolean = true
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[${errorContext.component}] ${errorContext.operation} failed:`, {
      error: errorMessage,
      context: errorContext.context,
      details: errorContext.details
    });

    if (showUserMessage) {
      vscode.window.showErrorMessage(
        `Failed to ${errorContext.operation}: ${errorMessage}`,
        'Retry',
        'Dismiss'
      ).then(action => {
        if (action === 'Retry') {
          withErrorBoundary(operation, errorContext, showUserMessage);
        }
      });
    }

    return null;
  }
}

/**
 * Execute operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    onRetry
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);
        onRetry?.(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Execute operation with timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Validate input and throw user-friendly error
 */
export function validateInput(
  value: any,
  validator: (v: any) => boolean,
  errorMessage: string
): void {
  if (!validator(value)) {
    throw new Error(errorMessage);
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(
  json: string,
  defaultValue: T
): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return defaultValue;
  }
}

/**
 * Safe file read with error handling
 */
export async function safeFileRead(
  filePath: string,
  defaultValue: string = ''
): Promise<string> {
  try {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder().decode(content);
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
    return defaultValue;
  }
}

/**
 * Safe file write with error handling
 */
export async function safeFileWrite(
  filePath: string,
  content: string
): Promise<boolean> {
  try {
    const uri = vscode.Uri.file(filePath);
    const bytes = new TextEncoder().encode(content);
    await vscode.workspace.fs.writeFile(uri, bytes);
    return true;
  } catch (error) {
    console.error(`Failed to write file ${filePath}:`, error);
    return false;
  }
}

/**
 * Create user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: Error | string): string {
  const message = error instanceof Error ? error.message : String(error);

  // Map common errors to user-friendly messages
  const errorMap: Record<string, string> = {
    'ENOENT': 'File not found',
    'EACCES': 'Permission denied',
    'EISDIR': 'Is a directory',
    'ENOTDIR': 'Not a directory',
    'EEXIST': 'File already exists',
    'EMFILE': 'Too many open files',
    'ENOMEM': 'Out of memory',
    'ETIMEDOUT': 'Operation timed out',
    'ECONNREFUSED': 'Connection refused',
    'ECONNRESET': 'Connection reset'
  };

  for (const [code, friendlyMessage] of Object.entries(errorMap)) {
    if (message.includes(code)) {
      return friendlyMessage;
    }
  }

  // Return original message if no mapping found
  return message;
}

/**
 * Log error with context
 */
export function logError(
  error: Error | string,
  context: ErrorContext
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context.component}] ${context.operation}`, {
    message,
    stack,
    context: context.context,
    details: context.details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Assert condition and throw error
 */
export function assert(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Debounce function to prevent rapid repeated calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Throttle function to limit call frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= delayMs) {
      func(...args);
      lastCallTime = now;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        func(...args);
        lastCallTime = Date.now();
        timeoutId = null;
      }, delayMs - timeSinceLastCall);
    }
  };
}
