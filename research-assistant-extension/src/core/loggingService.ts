import * as vscode from 'vscode';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Centralized logging service for the extension
 */
export class LoggingService {
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel;

  constructor(name: string = 'Research Assistant', logLevel: LogLevel = LogLevel.INFO) {
    this.outputChannel = vscode.window.createOutputChannel(name);
    this.logLevel = logLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message, error, ...args);
      if (error) {
        this.outputChannel.appendLine(`  Stack: ${error.stack}`);
      }
    }
  }

  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    this.outputChannel.appendLine(formattedMessage);
    
    if (args.length > 0) {
      args.forEach(arg => {
        if (typeof arg === 'object') {
          this.outputChannel.appendLine(`  ${JSON.stringify(arg, null, 2)}`);
        } else {
          this.outputChannel.appendLine(`  ${arg}`);
        }
      });
    }
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Global logger instance
let globalLogger: LoggingService | undefined;

export function initializeLogger(name?: string, logLevel?: LogLevel): LoggingService {
  globalLogger = new LoggingService(name, logLevel);
  return globalLogger;
}

export function getLogger(): LoggingService {
  if (!globalLogger) {
    globalLogger = new LoggingService();
  }
  return globalLogger;
}
