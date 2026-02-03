import * as vscode from 'vscode';
import { Phase2Initializer } from '../initializers/phase2';
import { Phase1Initializer } from '../initializers/phase1';
import { ExtensionState } from '../state';

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
  let mockPhase1: Phase1Initializer;
  let mockState: ExtensionState;
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
        loadClaims: jest.fn().mockResolvedValue(undefined)
      },
      outlineParser: {
        parse: jest.fn().mockResolvedValue(undefined)
      },
      configurationManager: {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserPreferences: jest.fn().mockReturnValue({})
      },
      zoteroApiService: {
        initialize: jest.fn()
      }
    } as any;
  });

  describe('initialize', () => {
    it('should complete initialization in < 2 seconds', async () => {
      const initializer = new Phase2Initializer(mockPhase1);
      const startTime = Date.now();

      await initializer.initialize(mockState);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });

    it('should load claims, parse outline, and load configuration in parallel', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockState.claimsManager.loadClaims).toHaveBeenCalled();
      expect(mockState.outlineParser.parse).toHaveBeenCalled();
      expect(mockState.configurationManager.initialize).toHaveBeenCalled();
    });

    it('should update status bar during loading', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Loading data'),
        expect.any(String)
      );
    });

    it('should update status bar to ready state after loading', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });

    it('should refresh all tree views after loading', async () => {
      const initializer = new Phase2Initializer(mockPhase1);

      await initializer.initialize(mockState);

      expect(mockProviders.outline.refresh).toHaveBeenCalled();
      expect(mockProviders.claims.refresh).toHaveBeenCalled();
      expect(mockProviders.papers.refresh).toHaveBeenCalled();
    });

    it('should configure Zotero API service if credentials are available', async () => {
      mockState.configurationManager.getUserPreferences = jest.fn().mockReturnValue({
        zoteroApiKey: 'test-key',
        zoteroUserId: 'test-user'
      });

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(mockState.zoteroApiService.initialize).toHaveBeenCalledWith(
        'test-key',
        'test-user'
      );
    });

    it('should not configure Zotero API service if credentials are missing', async () => {
      mockState.configurationManager.getUserPreferences = jest.fn().mockReturnValue({});

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(mockState.zoteroApiService.initialize).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue if claims loading fails', async () => {
      mockState.claimsManager.loadClaims = jest.fn().mockRejectedValue(
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

    it('should show warning message if claims loading fails', async () => {
      mockState.claimsManager.loadClaims = jest.fn().mockRejectedValue(
        new Error('Claims file not found')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Could not load claims database'),
        'View Output'
      );
    });

    it('should continue if outline parsing fails', async () => {
      mockState.outlineParser.parse = jest.fn().mockRejectedValue(
        new Error('Outline file not found')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Should still complete and update status bar
      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });

    it('should show warning message if outline parsing fails', async () => {
      mockState.outlineParser.parse = jest.fn().mockRejectedValue(
        new Error('Outline file not found')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Could not parse outline'),
        'View Output'
      );
    });

    it('should continue if configuration loading fails', async () => {
      mockState.configurationManager.initialize = jest.fn().mockRejectedValue(
        new Error('Config error')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Should still complete and update status bar
      expect(mockPhase1.updateStatusBar).toHaveBeenCalledWith(
        expect.stringContaining('Research Assistant'),
        expect.stringContaining('ready')
      );
    });

    it('should show warning if multiple operations fail', async () => {
      mockState.claimsManager.loadClaims = jest.fn().mockRejectedValue(
        new Error('Claims error')
      );
      mockState.outlineParser.parse = jest.fn().mockRejectedValue(
        new Error('Outline error')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('2 operation(s) failed'),
        'View Output'
      );
    });

    it('should handle all operations failing gracefully', async () => {
      mockState.claimsManager.loadClaims = jest.fn().mockRejectedValue(
        new Error('Claims error')
      );
      mockState.outlineParser.parse = jest.fn().mockRejectedValue(
        new Error('Outline error')
      );
      mockState.configurationManager.initialize = jest.fn().mockRejectedValue(
        new Error('Config error')
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

    it('should continue if tree view update fails', async () => {
      mockProviders.outline.refresh = jest.fn().mockImplementation(() => {
        throw new Error('Refresh error');
      });

      const initializer = new Phase2Initializer(mockPhase1);
      
      // Should not throw
      await expect(initializer.initialize(mockState)).resolves.not.toThrow();
    });
  });

  describe('graceful degradation', () => {
    it('should allow extension to function with failed claims loading', async () => {
      mockState.claimsManager.loadClaims = jest.fn().mockRejectedValue(
        new Error('Claims error')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Other operations should still succeed
      expect(mockState.outlineParser.parse).toHaveBeenCalled();
      expect(mockState.configurationManager.initialize).toHaveBeenCalled();
      expect(mockProviders.outline.refresh).toHaveBeenCalled();
    });

    it('should allow extension to function with failed outline parsing', async () => {
      mockState.outlineParser.parse = jest.fn().mockRejectedValue(
        new Error('Outline error')
      );

      const initializer = new Phase2Initializer(mockPhase1);
      await initializer.initialize(mockState);

      // Other operations should still succeed
      expect(mockState.claimsManager.loadClaims).toHaveBeenCalled();
      expect(mockState.configurationManager.initialize).toHaveBeenCalled();
      expect(mockProviders.claims.refresh).toHaveBeenCalled();
    });

    it('should use default configuration if loading fails', async () => {
      mockState.configurationManager.initialize = jest.fn().mockRejectedValue(
        new Error('Config error')
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
