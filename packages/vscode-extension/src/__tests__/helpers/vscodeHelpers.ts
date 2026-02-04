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
 * @deprecated Use createDocumentWithClaims from minimalMocks.ts instead
 */
export const createDocumentWithClaimsLegacy = (claimIds: string[]) => {
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
 * @deprecated Use startOfDocument from minimalMocks.ts instead
 */
export const startOfDocumentLegacy = () => createMockPosition(0, 0);

/**
 * Create a position at a specific line
 * @deprecated Use startOfLine from minimalMocks.ts instead
 */
export const startOfLineLegacy = (line: number) => createMockPosition(line, 0);

/**
 * Create a range spanning entire line
 * @deprecated Use entireLine from minimalMocks.ts instead
 */
export const entireLineLegacy = (line: number, length: number = 100) => 
  createMockRange(line, 0, line, length);

/**
 * Create a range for a word
 * @deprecated Use wordRange from minimalMocks.ts instead
 */
export const wordRangeLegacy = (line: number, start: number, wordLength: number) =>
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
 * Setup workspace configuration with custom values
 * @deprecated Use setupConfiguration from testSetup.ts instead
 */
export const setupWorkspaceConfigurationLegacy = (config: Record<string, any>) => {
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
 * Setup active text editor with a mock document
 * @deprecated Use setupActiveEditor from testSetup.ts instead
 */
export const setupActiveTextEditorLegacy = (document?: jest.Mocked<vscode.TextDocument>) => {
  const mockDoc = document || createMockDocument();
  const mockEditor = {
    document: mockDoc,
    selection: new vscode.Selection(0, 0, 0, 0),
    selections: [new vscode.Selection(0, 0, 0, 0)],
    visibleRanges: [new vscode.Range(0, 0, 10, 0)],
    options: {},
    viewColumn: vscode.ViewColumn.One,
    edit: jest.fn<any>().mockResolvedValue(true),
    insertSnippet: jest.fn<any>().mockResolvedValue(true),
    setDecorations: jest.fn<any>(),
    revealRange: jest.fn<any>(),
    show: jest.fn<any>(),
    hide: jest.fn<any>()
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
  (vscode.window.showInformationMessage as jest.Mock<any>).mockResolvedValue(response);
};

/**
 * Setup window to show error message
 */
export const setupErrorMessage = (response?: string) => {
  (vscode.window.showErrorMessage as jest.Mock<any>).mockResolvedValue(response);
};

/**
 * Setup quick pick with items
 */
export const setupQuickPick = <T>(items: T[], selectedItem?: T) => {
  (vscode.window.showQuickPick as jest.Mock<any>).mockResolvedValue(selectedItem);
  return items;
};

/**
 * Setup input box with response
 */
export const setupInputBox = (response?: string) => {
  (vscode.window.showInputBox as jest.Mock<any>).mockResolvedValue(response);
};

// ============================================================================
// Command Helpers
// ============================================================================

/**
 * Setup command registration and capture handler
 */
export const setupCommand = (commandId: string) => {
  let handler: ((...args: any[]) => any) | undefined;
  
  (vscode.commands.registerCommand as jest.Mock<any>).mockImplementation((id: string, h: any) => {
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
  (vscode.commands.executeCommand as jest.Mock<any>).mockImplementation((id: string, ...args: any[]) => {
    if (id === commandId) {
      return Promise.resolve(result);
    }
    return Promise.resolve(undefined);
  });
};

// ============================================================================
// Assertion Helpers (use testSetup.ts versions for more options)
// ============================================================================

/**
 * Assert that a command was registered
 */
export const expectCommandRegistered = (commandId: string) => {
  expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
    commandId,
    expect.any(Function)
  );
};

/**
 * Setup multiple commands at once
 */
export const setupCommands = (commandIds: string[]) => {
  const handlers: Record<string, any> = {};
  
  (vscode.commands.registerCommand as jest.Mock<any>).mockImplementation((id: string, h: any) => {
    if (commandIds.includes(id)) {
      handlers[id] = h;
    }
    return { dispose: jest.fn() };
  });
  
  return {
    execute: (commandId: string, ...args: any[]) => handlers[commandId]?.(...args),
    getHandler: (commandId: string) => handlers[commandId]
  };
};

/**
 * Setup multiple quick picks
 */
export const setupMultipleQuickPicks = <T>(items: T[][], selectedItems?: T[]) => {
  let callCount = 0;
  (vscode.window.showQuickPick as jest.Mock<any>).mockImplementation(() => {
    const selected = selectedItems?.[callCount] ?? items[callCount]?.[0];
    callCount++;
    return Promise.resolve(selected);
  });
  return items;
};

/**
 * Setup file dialog
 */
export const setupFileDialog = (selectedUri?: vscode.Uri) => {
  (vscode.window.showOpenDialog as jest.Mock<any>).mockResolvedValue(
    selectedUri ? [selectedUri] : undefined
  );
};

/**
 * Setup save dialog
 */
export const setupSaveDialog = (selectedUri?: vscode.Uri) => {
  (vscode.window.showSaveDialog as jest.Mock<any>).mockResolvedValue(selectedUri);
};

/**
 * Setup folder dialog
 */
export const setupFolderDialog = (selectedUri?: vscode.Uri) => {
  (vscode.window.showOpenDialog as jest.Mock<any>).mockResolvedValue(
    selectedUri ? [selectedUri] : undefined
  );
};

/**
 * Setup status bar item
 */
export const setupStatusBarItem = (text: string = 'Test') => {
  const mockStatusBar = {
    text,
    tooltip: '',
    command: '',
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  };
  
  (vscode.window.createStatusBarItem as jest.Mock<any>).mockReturnValue(mockStatusBar);
  return mockStatusBar;
};

/**
 * Setup output channel
 */
export const setupOutputChannel = (name: string = 'Test') => {
  const mockChannel = {
    name,
    append: jest.fn(),
    appendLine: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  };
  
  (vscode.window.createOutputChannel as jest.Mock<any>).mockReturnValue(mockChannel);
  return mockChannel;
};

/**
 * Setup webview panel
 */
export const setupWebviewPanel = (title: string = 'Test') => {
  const mockPanel = {
    title,
    viewType: 'test',
    webview: {
      html: '',
      onDidReceiveMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      postMessage: jest.fn()
    },
    onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    reveal: jest.fn(),
    dispose: jest.fn()
  };
  
  (vscode.window.createWebviewPanel as jest.Mock<any>).mockReturnValue(mockPanel);
  return mockPanel;
};

/**
 * Setup tree view
 */
export const setupTreeView = (viewId: string = 'test') => {
  const mockTreeView = {
    onDidExpandElement: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidCollapseElement: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeSelection: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeVisibility: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    selection: [],
    visible: true,
    reveal: jest.fn(),
    dispose: jest.fn()
  };
  
  (vscode.window.createTreeView as jest.Mock<any>).mockReturnValue(mockTreeView);
  return mockTreeView;
};

/**
 * Setup progress indicator
 */
export const setupProgress = () => {
  (vscode.window.withProgress as jest.Mock<any>).mockImplementation(
    async (options: any, task: any) => {
      const progress = {
        report: jest.fn()
      };
      return task(progress, { isCancellationRequested: false });
    }
  );
};

/**
 * Setup notification with action
 */
export const setupNotificationWithAction = (action: string, result?: any) => {
  (vscode.window.showInformationMessage as jest.Mock<any>).mockResolvedValue(action);
  return action;
};

/**
 * Setup multiple notifications
 */
export const setupMultipleNotifications = (responses: string[]) => {
  let callCount = 0;
  (vscode.window.showInformationMessage as jest.Mock<any>).mockImplementation(() => {
    const response = responses[callCount];
    callCount++;
    return Promise.resolve(response);
  });
};

/**
 * Setup text editor with selection
 */
export const setupTextEditorWithSelection = (
  text: string,
  startLine: number = 0,
  startChar: number = 0,
  endLine: number = 0,
  endChar: number = 0
) => {
  const mockDoc = createDocumentWithText(text);
  const mockEditor = {
    document: mockDoc,
    selection: new vscode.Selection(startLine, startChar, endLine, endChar),
    selections: [new vscode.Selection(startLine, startChar, endLine, endChar)],
    visibleRanges: [new vscode.Range(0, 0, 10, 0)],
    options: {},
    viewColumn: vscode.ViewColumn.One,
    edit: jest.fn<any>().mockResolvedValue(true),
    insertSnippet: jest.fn<any>().mockResolvedValue(true),
    setDecorations: jest.fn<any>(),
    revealRange: jest.fn<any>(),
    show: jest.fn<any>(),
    hide: jest.fn<any>()
  };
  
  (vscode.window as any).activeTextEditor = mockEditor;
  return mockEditor;
};

/**
 * Setup text editor with multiple selections
 */
export const setupTextEditorWithMultipleSelections = (
  text: string,
  selections: Array<{ startLine: number; startChar: number; endLine: number; endChar: number }>
) => {
  const mockDoc = createDocumentWithText(text);
  const mockSelections = selections.map(
    s => new vscode.Selection(s.startLine, s.startChar, s.endLine, s.endChar)
  );
  
  const mockEditor = {
    document: mockDoc,
    selection: mockSelections[0],
    selections: mockSelections,
    visibleRanges: [new vscode.Range(0, 0, 10, 0)],
    options: {},
    viewColumn: vscode.ViewColumn.One,
    edit: jest.fn<any>().mockResolvedValue(true),
    insertSnippet: jest.fn<any>().mockResolvedValue(true),
    setDecorations: jest.fn<any>(),
    revealRange: jest.fn<any>(),
    show: jest.fn<any>(),
    hide: jest.fn<any>()
  };
  
  (vscode.window as any).activeTextEditor = mockEditor;
  return mockEditor;
};

/**
 * Setup workspace folders with multiple folders
 */
export const setupMultipleWorkspaceFolders = (folderPaths: string[]) => {
  const folders = folderPaths.map((path, index) => ({
    uri: vscode.Uri.file(path),
    name: `workspace-${index}`,
    index
  }));
  
  (vscode.workspace as any).workspaceFolders = folders;
  return folders;
};

/**
 * Setup file system watcher
 */
export const setupFileSystemWatcher = (pattern: string = '**/*') => {
  const mockWatcher = {
    onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    ignoreChangeEvents: false,
    ignoreCreateEvents: false,
    ignoreDeleteEvents: false,
    dispose: jest.fn()
  };
  
  (vscode.workspace.createFileSystemWatcher as jest.Mock<any>).mockReturnValue(mockWatcher);
  return mockWatcher;
};

/**
 * Setup text document change event
 */
export const setupTextDocumentChangeEvent = (
  document: vscode.TextDocument,
  changes: Array<{ range: vscode.Range; text: string }>
) => {
  return {
    document,
    contentChanges: changes
  };
};

/**
 * Setup text document save event
 */
export const setupTextDocumentSaveEvent = (document: vscode.TextDocument) => {
  return { document };
};

/**
 * Setup extension context with storage paths
 */
export const setupExtensionContextWithStorage = (
  globalStoragePath: string = '/test/global-storage',
  workspaceStoragePath: string = '/test/workspace-storage'
) => {
  const mockContext = {
    subscriptions: [],
    extensionPath: '/test/extension',
    globalState: {
      get: jest.fn(),
      update: jest.fn<() => Thenable<void>>().mockResolvedValue(undefined),
      keys: jest.fn().mockReturnValue([]),
      setKeysForSync: jest.fn()
    },
    workspaceState: {
      get: jest.fn(),
      update: jest.fn<() => Thenable<void>>().mockResolvedValue(undefined),
      keys: jest.fn().mockReturnValue([]),
      setKeysForSync: jest.fn()
    },
    extensionUri: vscode.Uri.file('/test/extension'),
    storagePath: workspaceStoragePath,
    globalStoragePath,
    logPath: '/test/logs',
    extensionMode: vscode.ExtensionMode.Test,
    asAbsolutePath: jest.fn((path: string) => `/test/extension/${path}`),
    storageUri: vscode.Uri.file(workspaceStoragePath),
    globalStorageUri: vscode.Uri.file(globalStoragePath),
    logUri: vscode.Uri.file('/test/logs'),
    extension: {},
    secrets: {
      get: jest.fn(),
      store: jest.fn<() => Thenable<void>>().mockResolvedValue(undefined),
      delete: jest.fn<() => Thenable<void>>().mockResolvedValue(undefined),
      onDidChange: jest.fn()
    }
  };
  
  return mockContext;
};
