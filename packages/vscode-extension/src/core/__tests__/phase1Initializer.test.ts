import * as vscode from 'vscode';
import { Phase1Initializer } from '../initializers/phase1';
import { ExtensionState } from '../state';

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createStatusBarItem: jest.fn(),
    registerTreeDataProvider: jest.fn(),
    showInformationMessage: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  }
}));

describe('Phase1Initializer', () => {
  let mockContext: vscode.ExtensionContext;
  let mockState: ExtensionState;
  let mockStatusBarItem: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock status bar item
    mockStatusBarItem = {
      text: '',
      tooltip: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    };

    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);
    (vscode.window.registerTreeDataProvider as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (vscode.commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });

    // Create mock context
    mockContext = {
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionPath: '/test/path',
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/log',
      extensionUri: {} as any,
      environmentVariableCollection: {} as any,
      extensionMode: 3,
      storageUri: {} as any,
      globalStorageUri: {} as any,
      logUri: {} as any,
      asAbsolutePath: jest.fn(),
      secrets: {} as any,
      extension: {} as any
    };

    // Create mock state (minimal mock)
    mockState = {
      claimsManager: {
        getClaims: jest.fn().mockReturnValue([]),
        onDidChange: jest.fn()
      },
      outlineParser: {
        getSections: jest.fn().mockReturnValue([]),
        getHierarchy: jest.fn().mockReturnValue([]),
        onDidChange: jest.fn()
      },
      autoQuoteVerifier: {
        onDidVerify: jest.fn()
      },
      readingStatusManager: {
        getStatus: jest.fn()
      },
      coverageAnalyzer: {
        analyzeCoverage: jest.fn().mockReturnValue([])
      },
      getAbsolutePath: jest.fn(),
      getConfig: jest.fn().mockReturnValue({
        extractedTextPath: 'literature/ExtractedText'
      }),
      getWorkspaceRoot: jest.fn().mockReturnValue('/test/workspace')
    } as any;
  });

  describe('initialize', () => {
    it('should complete initialization in < 500ms', async () => {
      const initializer = new Phase1Initializer();
      const startTime = Date.now();

      await initializer.initialize(mockContext, mockState);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should register tree view providers', async () => {
      const initializer = new Phase1Initializer();

      await initializer.initialize(mockContext, mockState);

      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledTimes(3);
      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith(
        'researchAssistant.outline',
        expect.anything()
      );
      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith(
        'researchAssistant.claims',
        expect.anything()
      );
      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith(
        'researchAssistant.papers',
        expect.anything()
      );
    });

    it('should create and show loading status bar', async () => {
      const initializer = new Phase1Initializer();

      await initializer.initialize(mockContext, mockState);

      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Left,
        100
      );
      expect(mockStatusBarItem.text).toContain('loading');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should register command stubs', async () => {
      const initializer = new Phase1Initializer();

      await initializer.initialize(mockContext, mockState);

      // Should register at least the loading command stubs
      expect(vscode.commands.registerCommand).toHaveBeenCalled();
      
      // Verify some key commands are registered
      const registeredCommands = (vscode.commands.registerCommand as jest.Mock).mock.calls.map(
        call => call[0]
      );
      expect(registeredCommands).toContain('researchAssistant.openWritingMode');
      expect(registeredCommands).toContain('researchAssistant.openEditingMode');
      expect(registeredCommands).toContain('researchAssistant.showDashboard');
    });

    it('should add all disposables to context subscriptions', async () => {
      const initializer = new Phase1Initializer();

      await initializer.initialize(mockContext, mockState);

      // Should have subscriptions for:
      // - 3 tree providers
      // - 1 status bar
      // - 7 command stubs
      expect(mockContext.subscriptions.length).toBeGreaterThanOrEqual(11);
    });
  });

  describe('updateStatusBar', () => {
    it('should update status bar text', async () => {
      const initializer = new Phase1Initializer();
      await initializer.initialize(mockContext, mockState);

      initializer.updateStatusBar('$(book) Ready');

      expect(mockStatusBarItem.text).toBe('$(book) Ready');
    });

    it('should update status bar tooltip', async () => {
      const initializer = new Phase1Initializer();
      await initializer.initialize(mockContext, mockState);

      initializer.updateStatusBar('$(book) Ready', 'Extension is ready');

      expect(mockStatusBarItem.text).toBe('$(book) Ready');
      expect(mockStatusBarItem.tooltip).toBe('Extension is ready');
    });
  });

  describe('getProviders', () => {
    it('should return tree providers after initialization', async () => {
      const initializer = new Phase1Initializer();
      await initializer.initialize(mockContext, mockState);

      const providers = initializer.getProviders();

      expect(providers.outline).toBeDefined();
      expect(providers.claims).toBeDefined();
      expect(providers.papers).toBeDefined();
    });

    it('should throw error if called before initialization', () => {
      const initializer = new Phase1Initializer();

      expect(() => initializer.getProviders()).toThrow(
        'Phase 1 not initialized - providers not available'
      );
    });
  });

  describe('getStatusBarItem', () => {
    it('should return status bar item after initialization', async () => {
      const initializer = new Phase1Initializer();
      await initializer.initialize(mockContext, mockState);

      const statusBar = initializer.getStatusBarItem();

      expect(statusBar).toBe(mockStatusBarItem);
    });

    it('should throw error if called before initialization', () => {
      const initializer = new Phase1Initializer();

      expect(() => initializer.getStatusBarItem()).toThrow(
        'Phase 1 not initialized - status bar not available'
      );
    });
  });

  describe('command stubs', () => {
    it('should show loading message when stub commands are called', async () => {
      const initializer = new Phase1Initializer();
      await initializer.initialize(mockContext, mockState);

      // Get the registered command handler for openWritingMode
      const commandCalls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
      const writingModeCall = commandCalls.find(
        call => call[0] === 'researchAssistant.openWritingMode'
      );
      
      expect(writingModeCall).toBeDefined();
      
      // Call the stub handler
      const handler = writingModeCall![1];
      handler();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('loading')
      );
    });
  });
});
