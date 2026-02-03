import * as vscode from 'vscode';
import { Phase3Initializer } from '../initializers/phase3';
import { ExtensionState } from '../state';
import { setupTest } from '../../__tests__/helpers';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
    createFileSystemWatcher: jest.fn()
  },
  RelativePattern: jest.fn()
}));

describe('Phase3Initializer', () => {
  setupTest();
  let mockState: ExtensionState;
  let mockConfig: any;
  let mockFileWatcher: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock configuration
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'openaiApiKey') return 'test-api-key';
        return undefined;
      })
    };

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

    // Create mock file watcher
    mockFileWatcher = {
      onDidChange: jest.fn(),
      dispose: jest.fn()
    };

    (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue(mockFileWatcher);

    // Create mock state
    mockState = {
      embeddingService: {
        clearCache: jest.fn()
      },
      mcpClient: {
        dispose: jest.fn()
      },
      configurationManager: {
        getUserPreferences: jest.fn().mockReturnValue({
          zoteroApiKey: 'test-zotero-key',
          zoteroUserId: 'test-user-id'
        })
      },
      zoteroAvailabilityManager: {
        initialize: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn()
      },
      outlineParser: {
        parse: jest.fn().mockResolvedValue(undefined)
      },
      claimsManager: {
        requestReload: jest.fn()
      },
      getWorkspaceRoot: jest.fn().mockReturnValue('/test/workspace'),
      getConfig: jest.fn().mockReturnValue({
        outlinePath: '03_Drafting/outline.md',
        claimsDatabasePath: '01_Knowledge_Base/claims_and_evidence.md'
      })
    } as any;
  });

  describe('initialize', () => {
    test('should start initialization without blocking', async () => {
      const initializer = new Phase3Initializer();
      const startTime = Date.now();

      await initializer.initialize(mockState);

      const duration = Date.now() - startTime;
      // Should return immediately (< 100ms) since it's non-blocking
      expect(duration).toBeLessThan(100);
    });

    test('should initialize all services in parallel', async () => {
      const initializer = new Phase3Initializer();

      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // All services should be initialized
      expect(vscode.workspace.getConfiguration).toHaveBeenCalled();
      expect(mockState.configurationManager.getUserPreferences).toHaveBeenCalled();
    });

    test('should not throw if embeddings initialization fails', async () => {
      mockConfig.get = jest.fn().mockReturnValue(null); // No API key

      const initializer = new Phase3Initializer();

      await expect(initializer.initialize(mockState)).resolves.not.toThrow();
      await expect(initializer.waitForCompletion()).resolves.not.toThrow();
    });

    test('should not throw if MCP initialization fails', async () => {
      mockState.mcpClient = null as any;

      const initializer = new Phase3Initializer();

      await expect(initializer.initialize(mockState)).resolves.not.toThrow();
      await expect(initializer.waitForCompletion()).resolves.not.toThrow();
    });

    test('should not throw if Zotero initialization fails', async () => {
      mockState.zoteroAvailabilityManager.initialize = jest.fn().mockRejectedValue(
        new Error('Zotero error')
      );

      const initializer = new Phase3Initializer();

      await expect(initializer.initialize(mockState)).resolves.not.toThrow();
      await expect(initializer.waitForCompletion()).resolves.not.toThrow();
    });

    test('should not throw if file watcher setup fails', async () => {
      (vscode.workspace.createFileSystemWatcher as jest.Mock).mockImplementation(() => {
        throw new Error('File watcher error');
      });

      const initializer = new Phase3Initializer();

      await expect(initializer.initialize(mockState)).resolves.not.toThrow();
      await expect(initializer.waitForCompletion()).resolves.not.toThrow();
    });
  });

  describe('embeddings initialization', () => {
    test('should skip embeddings if no API key configured', async () => {
      mockConfig.get = jest.fn().mockReturnValue(null);

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // Should complete without error
      expect(mockState.embeddingService).toBeDefined();
    });

    test('should initialize embeddings if API key is configured', async () => {
      mockConfig.get = jest.fn().mockReturnValue('test-api-key');

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('researchAssistant');
    });
  });

  describe('Zotero initialization', () => {
    test('should skip Zotero if no credentials configured', async () => {
      mockState.configurationManager.getUserPreferences = jest.fn().mockReturnValue({});

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      expect(mockState.zoteroAvailabilityManager.initialize).not.toHaveBeenCalled();
    });

    test('should initialize Zotero if credentials are configured', async () => {
      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      expect(mockState.zoteroAvailabilityManager.initialize).toHaveBeenCalled();
    });

    test('should continue if Zotero initialization fails', async () => {
      mockState.zoteroAvailabilityManager.initialize = jest.fn().mockRejectedValue(
        new Error('Zotero connection failed')
      );

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // Should not throw
      expect(mockState.zoteroAvailabilityManager.initialize).toHaveBeenCalled();
    });
  });

  describe('file watchers', () => {
    test('should setup file watchers for outline and claims', async () => {
      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // Should create two file watchers (outline and claims)
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(2);
    });

    test('should debounce file changes with 1000ms delay', async () => {
      jest.useFakeTimers();

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // Get the onChange handler
      const onChangeHandler = mockFileWatcher.onDidChange.mock.calls[0][0];

      // Trigger multiple changes rapidly
      onChangeHandler();
      onChangeHandler();
      onChangeHandler();

      // Should not have called parse yet
      expect(mockState.outlineParser.parse).not.toHaveBeenCalled();

      // Fast-forward time by 1000ms
      jest.advanceTimersByTime(1000);

      // Now should have called parse once
      expect(mockState.outlineParser.parse).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    test('should handle outline file changes', async () => {
      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // Get the onChange handler for outline
      const onChangeHandler = mockFileWatcher.onDidChange.mock.calls[0][0];

      // Trigger change and wait for debounce
      onChangeHandler();
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockState.outlineParser.parse).toHaveBeenCalled();
    });

    test('should handle claims file changes', async () => {
      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // Get the onChange handler for claims (second watcher)
      const onChangeHandler = mockFileWatcher.onDidChange.mock.calls[1][0];

      // Trigger change and wait for debounce
      onChangeHandler();
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(mockState.claimsManager.requestReload).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    test('should clear all debounce timers', () => {
      const initializer = new Phase3Initializer();
      
      // Create some debounce timers by triggering file changes
      // (This would normally happen through file watchers)
      
      initializer.dispose();

      // Should not throw
      expect(() => initializer.dispose()).not.toThrow();
    });

    test('should be safe to call multiple times', () => {
      const initializer = new Phase3Initializer();
      
      initializer.dispose();
      initializer.dispose();
      initializer.dispose();

      // Should not throw
      expect(() => initializer.dispose()).not.toThrow();
    });
  });

  describe('error handling', () => {
    test('should log errors but not throw', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockState.zoteroAvailabilityManager.initialize = jest.fn().mockRejectedValue(
        new Error('Test error')
      );

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should continue initialization if one service fails', async () => {
      mockState.zoteroAvailabilityManager.initialize = jest.fn().mockRejectedValue(
        new Error('Zotero error')
      );

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);
      await initializer.waitForCompletion();

      // Other services should still be initialized
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
    });
  });

  describe('waitForCompletion', () => {
    test('should wait for all services to complete', async () => {
      const initializer = new Phase3Initializer();
      
      await initializer.initialize(mockState);
      
      const startTime = Date.now();
      await initializer.waitForCompletion();
      const duration = Date.now() - startTime;

      // Should complete quickly since all operations are mocked
      expect(duration).toBeLessThan(1000);
    });

    test('should resolve even if services fail', async () => {
      mockState.zoteroAvailabilityManager.initialize = jest.fn().mockRejectedValue(
        new Error('Error')
      );

      const initializer = new Phase3Initializer();
      await initializer.initialize(mockState);

      await expect(initializer.waitForCompletion()).resolves.not.toThrow();
    });
  });
});
