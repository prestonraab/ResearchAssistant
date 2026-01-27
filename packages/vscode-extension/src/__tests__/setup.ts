// Jest setup file for global test configuration
import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Create EventEmitter constructor mock
class MockEventEmitter {
  private listeners: Array<(...args: any[]) => void> = [];
  
  event = (listener: (...args: any[]) => void) => {
    this.listeners.push(listener);
    return { dispose: jest.fn() };
  };
  
  fire = (...args: any[]) => {
    this.listeners.forEach(listener => listener(...args));
  };
  
  dispose = jest.fn();
}

// Export vscode mock
export const vscode = {
  window: {
    showInformationMessage: jest.fn<any>().mockResolvedValue(undefined),
    showErrorMessage: jest.fn<any>().mockResolvedValue(undefined),
    showWarningMessage: jest.fn<any>().mockResolvedValue(undefined),
    registerTreeDataProvider: jest.fn<any>(),
    createTextEditorDecorationType: jest.fn<any>(() => ({
      key: 'mock-decoration-type',
      dispose: jest.fn<any>(),
    })),
    createOutputChannel: jest.fn<any>(() => ({
      append: jest.fn<any>(),
      appendLine: jest.fn<any>(),
      clear: jest.fn<any>(),
      show: jest.fn<any>(),
      hide: jest.fn<any>(),
      dispose: jest.fn<any>(),
    })),
    createStatusBarItem: jest.fn<any>(() => ({
      text: '',
      tooltip: '',
      show: jest.fn<any>(),
      hide: jest.fn<any>(),
      dispose: jest.fn<any>(),
    })),
    onDidChangeActiveTextEditor: jest.fn<any>(() => ({
      dispose: jest.fn<any>(),
    })),
    onDidChangeTextEditorSelection: jest.fn<any>(() => ({
      dispose: jest.fn<any>(),
    })),
    activeTextEditor: undefined,
    showQuickPick: jest.fn<any>().mockResolvedValue(undefined),
    showInputBox: jest.fn<any>().mockResolvedValue(undefined),
    withProgress: jest.fn<any>((options: any, task: any) => task({ report: jest.fn<any>() })),
  },
  workspace: {
    getConfiguration: jest.fn<any>(() => ({
      get: jest.fn<any>((key: string, defaultValue: any) => defaultValue),
    })),
    workspaceFolders: [
      {
        uri: { fsPath: '/test/workspace' },
        name: 'test-workspace',
        index: 0,
      },
    ],
    onDidChangeConfiguration: jest.fn<any>(),
    createFileSystemWatcher: jest.fn<any>(() => ({
      onDidChange: jest.fn<any>(),
      onDidCreate: jest.fn<any>(),
      onDidDelete: jest.fn<any>(),
      dispose: jest.fn<any>(),
    })),
  },
  commands: {
    registerCommand: jest.fn<any>(),
    executeCommand: jest.fn<any>(),
  },
  languages: {
    registerCodeLensProvider: jest.fn<any>(),
    registerHoverProvider: jest.fn<any>(),
    registerCompletionItemProvider: jest.fn<any>(),
  },
  EventEmitter: MockEventEmitter,
  TreeItem: jest.fn<any>(),
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: jest.fn<any>((id: string) => ({ id })),
  RelativePattern: jest.fn<any>(),
  Uri: {
    file: jest.fn<any>((path: string) => ({ fsPath: path })),
    parse: jest.fn<any>((uri: string) => ({ toString: () => uri })),
    joinPath: jest.fn<any>((base: any, ...paths: string[]) => ({
      fsPath: `${base.fsPath}/${paths.join('/')}`
    })),
  },
  Position: jest.fn<any>().mockImplementation((line: number, character: number) => ({
    line,
    character,
    isAfter: jest.fn<any>(),
    isAfterOrEqual: jest.fn<any>(),
    isBefore: jest.fn<any>(),
    isBeforeOrEqual: jest.fn<any>(),
    isEqual: jest.fn<any>(),
    translate: jest.fn<any>(),
    with: jest.fn<any>(),
  })),
  Range: jest.fn<any>().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    isEmpty: false,
    isSingleLine: startLine === endLine,
    contains: jest.fn<any>(),
    isEqual: jest.fn<any>(),
    intersection: jest.fn<any>(),
    union: jest.fn<any>(),
    with: jest.fn<any>(),
  })),
  MarkdownString: jest.fn<any>().mockImplementation((value?: string) => ({
    value: value || '',
    isTrusted: false,
    supportHtml: false,
    appendText: jest.fn<any>(function(this: any, text: string) {
      this.value += text;
      return this;
    }),
    appendMarkdown: jest.fn<any>(function(this: any, text: string) {
      this.value += text;
      return this;
    }),
    appendCodeblock: jest.fn<any>(function(this: any, code: string, language?: string) {
      this.value += `\`\`\`${language || ''}\n${code}\n\`\`\``;
      return this;
    }),
  })),
  Hover: jest.fn<any>().mockImplementation((contents: any, range?: any) => ({
    contents: Array.isArray(contents) ? contents : [contents],
    range,
  })),
  OverviewRulerLane: {
    Left: 1,
    Center: 2,
    Right: 4,
    Full: 7,
  },
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3,
  },
  EndOfLine: {
    LF: 1,
    CRLF: 2,
  },
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15,
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  WebviewViewProvider: jest.fn<any>(),
  CompletionItem: jest.fn<any>().mockImplementation((label: string, kind?: number) => ({
    label,
    kind,
    insertText: '',
    detail: '',
    documentation: undefined,
    sortText: '',
    command: undefined
  })),
  CompletionItemKind: {
    Text: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Unit: 10,
    Value: 11,
    Enum: 12,
    Keyword: 13,
    Snippet: 14,
    Color: 15,
    File: 16,
    Reference: 17,
    Folder: 18,
    EnumMember: 19,
    Constant: 20,
    Struct: 21,
    Event: 22,
    Operator: 23,
    TypeParameter: 24,
  },
};

// Make vscode available as default export for jest.mock
export default vscode;
