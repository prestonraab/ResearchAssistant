// Mock vscode module
import { jest } from '@jest/globals';

export class MarkdownString {
  value: string;
  isTrusted: boolean = false;
  supportHtml: boolean = false;

  constructor(value?: string) {
    this.value = value || '';
  }

  appendText(text: string) {
    this.value += text;
    return this;
  }

  appendMarkdown(text: string) {
    this.value += text;
    return this;
  }

  appendCodeblock(code: string, language?: string) {
    this.value += `\`\`\`${language || ''}\n${code}\n\`\`\``;
    return this;
  }
}

export class EventEmitter {
  private listeners: Array<(...args: any[]) => void> = [];
  
  event = (listener: (...args: any[]) => void) => {
    this.listeners.push(listener);
    return { dispose: jest.fn<any>() };
  };
  
  fire = (...args: any[]) => {
    this.listeners.forEach(listener => listener(...args));
  };
  
  dispose = jest.fn<any>();
}

export const window = {
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
};

export const workspace = {
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
  openTextDocument: jest.fn<any>().mockResolvedValue(undefined),
  onDidOpenTextDocument: jest.fn<any>(() => ({
    dispose: jest.fn<any>(),
  })),
  onDidCloseTextDocument: jest.fn<any>(() => ({
    dispose: jest.fn<any>(),
  })),
  onDidChangeTextDocument: jest.fn<any>(() => ({
    dispose: jest.fn<any>(),
  })),
};

export const commands = {
  registerCommand: jest.fn<any>(),
  executeCommand: jest.fn<any>(),
};

export const languages = {
  registerCodeLensProvider: jest.fn<any>(),
  registerHoverProvider: jest.fn<any>(),
  registerCompletionItemProvider: jest.fn<any>(),
};

export const TreeItem = jest.fn<any>();

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export const ThemeIcon = jest.fn<any>((id: string) => ({ id }));

export const RelativePattern = jest.fn<any>();

export const Uri = {
  file: jest.fn<any>((path: string) => ({ fsPath: path, scheme: 'file' })),
  parse: jest.fn<any>((uri: string) => {
    // Parse the URI to extract scheme
    const match = uri.match(/^([a-z][a-z0-9+.-]*):(.*)$/i);
    const scheme = match ? match[1] : 'file';
    return { 
      toString: () => uri,
      scheme,
      fsPath: uri,
      authority: '',
      path: uri,
      query: '',
      fragment: ''
    };
  }),
  joinPath: jest.fn<any>((base: any, ...paths: string[]) => ({
    fsPath: `${base.fsPath}/${paths.join('/')}`,
    scheme: base.scheme || 'file'
  })),
};

export const Position = jest.fn<any>().mockImplementation((line: number, character: number) => ({
  line,
  character,
  isAfter: jest.fn<any>(),
  isAfterOrEqual: jest.fn<any>(),
  isBefore: jest.fn<any>(),
  isBeforeOrEqual: jest.fn<any>(),
  isEqual: jest.fn<any>(),
  translate: jest.fn<any>(),
  with: jest.fn<any>(),
}));

export const Range = jest.fn<any>().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
  start: { line: startLine, character: startChar },
  end: { line: endLine, character: endChar },
  isEmpty: false,
  isSingleLine: startLine === endLine,
  contains: jest.fn<any>(),
  isEqual: jest.fn<any>(),
  intersection: jest.fn<any>(),
  union: jest.fn<any>(),
  with: jest.fn<any>(),
}));

export const Hover = jest.fn<any>().mockImplementation((contents: any, range?: any) => ({
  contents: Array.isArray(contents) ? contents : [contents],
  range,
}));

export const OverviewRulerLane = {
  Left: 1,
  Center: 2,
  Right: 4,
  Full: 7,
};

export const ExtensionMode = {
  Production: 1,
  Development: 2,
  Test: 3,
};

export const EndOfLine = {
  LF: 1,
  CRLF: 2,
};

export const ProgressLocation = {
  SourceControl: 1,
  Window: 10,
  Notification: 15,
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

export const WebviewViewProvider = jest.fn<any>();

export const CompletionItem = jest.fn<any>().mockImplementation((label: string, kind?: number) => ({
  label,
  kind,
  insertText: '',
  detail: '',
  documentation: undefined,
  sortText: '',
  command: undefined
}));

export const CompletionItemKind = {
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
};

export const CompletionList = jest.fn<any>().mockImplementation((items: any, isIncomplete: any) => ({
  items,
  isIncomplete
}));

export const env = {
  openExternal: jest.fn<any>().mockResolvedValue(undefined),
};

export const Selection = jest.fn<any>().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
  anchor: { line: startLine, character: startChar },
  active: { line: endLine, character: endChar },
  start: { line: startLine, character: startChar },
  end: { line: endLine, character: endChar },
  isEmpty: startLine === endLine && startChar === endChar,
  isSingleLine: startLine === endLine,
  isReversed: false
}));
