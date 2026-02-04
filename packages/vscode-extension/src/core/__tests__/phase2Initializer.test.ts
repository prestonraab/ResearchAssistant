import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { Phase2Initializer } from '../initializers/phase2';
import { Phase1Initializer } from '../initializers/phase1';
import { ExtensionState } from '../state';
import { setupTest } from '../../__tests__/helpers';

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createStatusBarItem: jest.fn(),
    registerTreeDataProvider: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
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

describe('Phase2Initializer', () => {
  setupTest();
  let mockPhase1: Phase1Initializer;
  let mockState: any;
  let mockStatusBarItem: any;
  let mockProviders: any;

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

    // Create mock tree providers
    mockProviders = {
      outline: {
        refresh: jest.fn()
      },
      claims: {
        refresh: jest.fn()
      },
      papers: {
        refresh: jest.fn()
      }
    };

    // Create mock Phase1Initializer
    mockPhase1 = {
      updateStatusBar: jest.fn(),
      getProviders: jest.fn().mockReturnValue(mockProviders),
      getStatusBarItem: jest.fn().mockReturnValue(mockStatusBarItem)
    } as any;

    // Create mock state
    mockState = {
      claimsManager: {
        loadClaims: (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined as any)
      },
      outlineParser: {
        parse: (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined as any)
      },
      configurationManager: {
        initialize: (jest.fn() as jest.Mock<any>).mockResolvedValue(undefined as any),
        getUserPreferences: jest.fn().mockReturnValue({})
      },
      zoteroClient: {
        initialize: jest.fn()
      }
    } as any;
  });

  describe('initialize', () => {
    test('should complete initialization in < 2 seconds', async () => {
      const initializer = new Phase2Initializer(mockPhase1);
      const startTime = Date.now();

      await initializer.initialize(mockState);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });

    test('should load claims, parse outline, and load configuration in parallel', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockState.claimsManager.loadClaims).toHaveBeenCalled();
      expect(mockState.outlineParser.parse).toHaveBeenCalled();
      expect(mockState.configurationManager.initialize).toHaveBeenCalled();
    });

    test('should update status bar during loading', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Loading data'),
        expect.any(String)
      );
    });

    test('should update status bar to ready state after loading', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });

    test('should refresh all tree views after loading', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockProviders.outline.refresh).toHaveBeenCalled();
      expect(mockProviders.claims.refresh).toHaveBeenCalled();
      expect(mockProviders.papers.refresh).toHaveBeenCalled();
    });

    test('should configure Zotero client if credentials are available', async () => {
      mockState.configurationManager.getUserPreferences = jest.fn().mockReturnValue({
        zoteroApiKey: 'test-key',
        zoteroUserId: 'test-user'
      });

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(mockState.zoteroClient.initialize).toHaveBeenCalledWith(
        'test-key',
        'test-user'
      );
    });

    test('should not configure Zotero client if credentials are missing', async () => {
      mockState.configurationManager.getUserPreferences = jest.fn().mockReturnValue({});

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(mockState.zoteroClient.initialize).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should continue if claims loading fails', async () => {
      mockState.claimsManager.loadClaims = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Claims file not found')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Should still complete and update status bar
      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });

    test('should show warning message if claims loading fails', async () => {
      mockState.claimsManager.loadClaims = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Claims file not found')
      ) as any;

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('1 operation(s) failed'),
        'View Output'
      );
    });

    test('should continue if outline parsing fails', async () => {
      mockState.outlineParser.parse = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Outline file not found')
      ) as any;

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Should still complete and update status bar
      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });

    test('should show warning message if outline parsing fails', async () => {
      (mockState.outlineParser.parse as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Outline file not found') as any
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('1 operation(s) failed'),
        'View Output'
      );
    });

    test('should continue if configuration loading fails', async () => {
      (mockState.configurationManager.initialize as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Config error') as any
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Should still complete and update status bar
      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });

    test('should show warning if multiple operations fail', async () => {
      (mockState.claimsManager.loadClaims as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Claims error') as any
      );
      (mockState.outlineParser.parse as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Outline error') as any
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('2 operation(s) failed'),
        'View Output'
      );
    });

    test('should handle all operations failing gracefully', async () => {
      (mockState.claimsManager.loadClaims as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Claims error') as any
      );
      (mockState.outlineParser.parse as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Outline error') as any
      );
      (mockState.configurationManager.initialize as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Config error') as any
      );

      const initializer = new Phase2Initializer(mockPhase1);
      
      // Should not throw
      await expect(initializer.initialize(mockState)).resolves.not.toThrow();

      // Should show warning about failures
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('3 operation(s) failed'),
        'View Output'
      );
    });

    test('should continue if tree view update fails', async () => {
      mockProviders.outline.refresh = jest.fn().mockImplementation(() => {
        throw new Error('Refresh error');
      });

      const initializer = new Phase2Initializer(mockPhase1);
      
      // Should not throw
      await expect(initializer.initialize(mockState)).resolves.not.toThrow();
    });
  });

  describe('graceful degradation', () => {
    test('should allow extension to function with failed claims loading', async () => {
      (mockState.claimsManager.loadClaims as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Claims error') as any
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Other operations should still succeed
      expect(mockState.outlineParser.parse).toHaveBeenCalled();
      expect(mockState.configurationManager.initialize).toHaveBeenCalled();
      expect(mockProviders.outline.refresh).toHaveBeenCalled();
    });

    test('should allow extension to function with failed outline parsing', async () => {
      (mockState.outlineParser.parse as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Outline error') as any
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Other operations should still succeed
      expect(mockState.claimsManager.loadClaims).toHaveBeenCalled();
      expect(mockState.configurationManager.initialize).toHaveBeenCalled();
      expect(mockProviders.claims.refresh).toHaveBeenCalled();
    });

    test('should use default configuration if loading fails', async () => {
      (mockState.configurationManager.initialize as any) = (jest.fn() as jest.Mock<any>).mockRejectedValue(
        new Error('Config error') as any
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Should still complete initialization
      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });
  });
});
