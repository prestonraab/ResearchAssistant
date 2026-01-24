// Jest setup file for global test configuration

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    registerTreeDataProvider: jest.fn(),
    createTextEditorDecorationType: jest.fn(() => ({
      key: 'mock-decoration-type',
      dispose: jest.fn(),
    })),
    createOutputChannel: jest.fn(() => ({
      append: jest.fn(),
      appendLine: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })),
    createStatusBarItem: jest.fn(() => ({
      text: '',
      tooltip: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    })),
    onDidChangeActiveTextEditor: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    onDidChangeTextEditorSelection: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    activeTextEditor: undefined,
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue: any) => defaultValue),
    })),
    workspaceFolders: [
      {
        uri: { fsPath: '/test/workspace' },
        name: 'test-workspace',
        index: 0,
      },
    ],
    onDidChangeConfiguration: jest.fn(),
    createFileSystemWatcher: jest.fn(() => ({
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  languages: {
    registerCodeLensProvider: jest.fn(),
    registerHoverProvider: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
  TreeItem: jest.fn(),
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: jest.fn((id: string) => ({ id })),
  RelativePattern: jest.fn(),
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
    parse: jest.fn((uri: string) => ({ toString: () => uri })),
  },
  Position: jest.fn().mockImplementation((line: number, character: number) => ({
    line,
    character,
    isAfter: jest.fn(),
    isAfterOrEqual: jest.fn(),
    isBefore: jest.fn(),
    isBeforeOrEqual: jest.fn(),
    isEqual: jest.fn(),
    translate: jest.fn(),
    with: jest.fn(),
  })),
  Range: jest.fn().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    isEmpty: false,
    isSingleLine: startLine === endLine,
    contains: jest.fn(),
    isEqual: jest.fn(),
    intersection: jest.fn(),
    union: jest.fn(),
    with: jest.fn(),
  })),
  MarkdownString: jest.fn().mockImplementation((value?: string) => ({
    value: value || '',
    isTrusted: false,
    supportHtml: false,
    appendText: jest.fn(function(this: any, text: string) {
      this.value += text;
      return this;
    }),
    appendMarkdown: jest.fn(function(this: any, text: string) {
      this.value += text;
      return this;
    }),
    appendCodeblock: jest.fn(function(this: any, code: string, language?: string) {
      this.value += `\`\`\`${language || ''}\n${code}\n\`\`\``;
      return this;
    }),
  })),
  Hover: jest.fn().mockImplementation((contents: any, range?: any) => ({
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
}), { virtual: true });
