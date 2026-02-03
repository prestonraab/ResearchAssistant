import * as vscode from 'vscode';
import { jest } from '@jest/globals';
import { createMockDocument, createMockPosition, createMockRange } from './mockFactories';

/**
 * Helper functions for common VSCode testing patterns
 * These simplify common test scenarios with VSCode APIs
 */

// ============================================================================
// Document Helpers
// ============================================================================

/**
 * Create a mock document with specific text content
 */
export const createDocumentWithText = (text: string, languageId: string = 'markdown') => {
  const lines = text.split('\n');
  const mockDoc = createMockDocument({
    languageId,
    lineCount: lines.length,
    getText: jest.fn<(range?: vscode.Range) => string>((range?: vscode.Range) => {
      if (!range) return text;
      // Simple implementation for testing
      return text;
    })
  });
  
  return mockDoc;
};

/**
 * Create a mock document with claim references
 */
export const createDocumentWithClaims = (claimIds: string[]) => {
  const text = claimIds.map(id => `This sentence references ${id}.`).join('\n');
  return createDocumentWithText(text);
};

/**
 * Setup a mock document to return a specific word at a position
 */
export const setupWordAtPosition = (
  document: any,
  word: string,
  line: number = 0,
  startChar: number = 0
) => {
  const range = createMockRange(line, startChar, line, startChar + word.length);
  document.getWordRangeAtPosition = jest.fn<(position: vscode.Position, regex?: RegExp) => vscode.Range | undefined>()
    .mockReturnValue(range);
  document.getText = jest.fn<(range?: vscode.Range) => string>((r?: vscode.Range) => {
    if (r && r.start.line === line && r.start.character === startChar) {
      return word;
    }
    return '';
  });
  return { document, range };
};

// ============================================================================
// Position & Range Helpers
// ============================================================================

/**
 * Create a position at the start of a document
 */
export const startOfDocument = () => createMockPosition(0, 0);

/**
 * Create a position at a specific line
 */
export const startOfLine = (line: number) => createMockPosition(line, 0);

/**
 * Create a range spanning entire line
 */
export const entireLine = (line: number, length: number = 100) => 
  createMockRange(line, 0, line, length);

/**
 * Create a range for a word
 */
export const wordRange = (line: number, start: number, wordLength: number) =>
  createMockRange(line, start, line, start + wordLength);

// ============================================================================
// Workspace Helpers
// ============================================================================

/**
 * Setup workspace with a single folder
 */
export const setupWorkspace = (folderPath: string = '/test/workspace') => {
  const workspaceFolder = {
    uri: vscode.Uri.file(folderPath),
    name: 'test-workspace',
    index: 0
  };
  
  (vscode.workspace as any).workspaceFolders = [workspaceFolder];
  
  return workspaceFolder;
};

/**
 * Clear workspace folders
 */
export const clearWorkspace = () => {
  (vscode.workspace as any).workspaceFolders = undefined;
};

/**
 * Setup workspace configuration
 */
export const setupConfiguration = (config: Record<string, any>) => {
  (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
    get: jest.fn((key: string, defaultValue?: any) => {
      return config[key] ?? defaultValue;
    }),
    has: jest.fn((key: string) => key in config),
    update: jest.fn(),
    inspect: jest.fn()
  });
};

// ============================================================================
// Window Helpers
// ============================================================================

/**
 * Setup active text editor
 */
export const setupActiveEditor = (document?: jest.Mocked<vscode.TextDocument>) => {
  const mockDoc = document || createMockDocument();
  const mockEditor = {
    document: mockDoc,
    selection: new vscode.Selection(0, 0, 0, 0),
    selections: [new vscode.Selection(0, 0, 0, 0)],
    visibleRanges: [new vscode.Range(0, 0, 10, 0)],
    options: {},
    viewColumn: vscode.ViewColumn.One,
    edit: jest.fn<(callback: (editBuilder: vscode.TextEditorEdit) => void) => Promise<boolean>>().mockResolvedValue(true),
    insertSnippet: jest.fn().mockResolvedValue(true),
    setDecorations: jest.fn(),
    revealRange: jest.fn(),
    show: jest.fn(),
    hide: jest.fn()
  };
  
  (vscode.window as any).activeTextEditor = mockEditor;
  
  return mockEditor;
};

/**
 * Clear active text editor
 */
export const clearActiveEditor = () => {
  (vscode.window as any).activeTextEditor = undefined;
};

/**
 * Setup window to show information message and capture result
 */
export const setupInformationMessage = (response?: string) => {
  (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(response);
};

/**
 * Setup window to show error message
 */
export const setupErrorMessage = (response?: string) => {
  (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue(response);
};

/**
 * Setup quick pick with items
 */
export const setupQuickPick = <T>(items: T[], selectedItem?: T) => {
  (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(selectedItem);
  return items;
};

/**
 * Setup input box with response
 */
export const setupInputBox = (response?: string) => {
  (vscode.window.showInputBox as jest.Mock).mockResolvedValue(response);
};

// ============================================================================
// Command Helpers
// ============================================================================

/**
 * Setup command registration and capture handler
 */
export const setupCommand = (commandId: string) => {
  let handler: ((...args: any[]) => any) | undefined;
  
  (vscode.commands.registerCommand as jest.Mock).mockImplementation((id: string, h: any) => {
    if (id === commandId) {
      handler = h;
    }
    return { dispose: jest.fn() };
  });
  
  return {
    execute: (...args: any[]) => handler?.(...args),
    getHandler: () => handler
  };
};

/**
 * Mock command execution
 */
export const mockCommandExecution = (commandId: string, result?: any) => {
  (vscode.commands.executeCommand as jest.Mock).mockImplementation((id: string, ...args: any[]) => {
    if (id === commandId) {
      return Promise.resolve(result);
    }
    return Promise.resolve(undefined);
  });
};

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a message was shown to user
 */
export const expectInformationMessage = (message: string) => {
  expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
    expect.stringContaining(message),
    expect.anything()
  );
};

/**
 * Assert that an error was shown to user
 */
export const expectErrorMessage = (message: string) => {
  expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
    expect.stringContaining(message),
    expect.anything()
  );
};

/**
 * Assert that a command was registered
 */
export const expectCommandRegistered = (commandId: string) => {
  expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
    commandId,
    expect.any(Function)
  );
};
