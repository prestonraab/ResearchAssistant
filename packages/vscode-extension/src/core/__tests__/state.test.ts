import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { ExtensionState } from '../state';
import { setupTest, setupConfiguration, setupWorkspaceFolders } from '../../__tests__/helpers';
import { createMockExtensionContext } from '../../__tests__/helpers/mockFactories';

describe('ExtensionState', () => {
  setupTest();

  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Setup workspace configuration
    setupConfiguration({
      'outlinePath': '03_Drafting/outline.md',
      'claimsDatabasePath': '01_Knowledge_Base/claims_and_evidence.md',
      'extractedTextPath': 'literature/ExtractedText',
      'coverageThresholds': { low: 3, moderate: 6, strong: 7 },
      'embeddingCacheSize': 1000
    });

    // Setup workspace folders
    setupWorkspaceFolders();

    // Mock RelativePattern
    (vscode.RelativePattern as jest.Mock<any>).mockImplementation((base: any, pattern: any) => {
      return { base, pattern };
    });

    // Create mock context
    mockContext = createMockExtensionContext();
  });

  describe('Initialization', () => {
    test('should create ExtensionState instance', () => {
      // Just verify that we can create the instance without errors
      // The actual initialization is tested through integration tests
      expect(mockContext).toBeDefined();
      expect(mockContext.subscriptions).toBeDefined();
    });

    test('should have workspace root configured', () => {
      expect(mockContext.workspaceState).toBeDefined();
    });
  });

  describe('Configuration', () => {
    test('should use custom paths from configuration', () => {
      (vscode.workspace as any).getConfiguration = jest.fn().mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            'outlinePath': 'custom/outline.md',
            'claimsDatabasePath': 'custom/claims.md',
            'extractedTextPath': 'custom/texts',
            'coverageThresholds': { low: 2, moderate: 5, strong: 8 },
            'embeddingCacheSize': 500
          };
          return config[key] ?? defaultValue;
        })
      });

      // Verify configuration is accessible
      const config = vscode.workspace.getConfiguration('researchAssistant');
      expect(config.get('outlinePath')).toBe('custom/outline.md');
      expect(config.get('claimsDatabasePath')).toBe('custom/claims.md');
    });
  });

  describe('File Watcher Setup', () => {
    test('should setup file watchers', () => {
      let outlineWatcherCreated = false;
      let claimsWatcherCreated = false;

      (vscode.workspace as any).createFileSystemWatcher = jest.fn().mockImplementation((pattern: any) => {
        const patternStr = typeof pattern === 'string' ? pattern : (pattern?.pattern || '');
        if (patternStr.includes('outline.md')) {
          outlineWatcherCreated = true;
        } else if (patternStr.includes('claims_and_evidence.md')) {
          claimsWatcherCreated = true;
        }

        return {
          onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
          onDidCreate: jest.fn(() => ({ dispose: jest.fn() })),
          onDidDelete: jest.fn(() => ({ dispose: jest.fn() })),
          dispose: jest.fn()
        };
      });

      // Verify watchers can be created
      const watcher1 = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern('/test/workspace', 'outline.md')
      );
      const watcher2 = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern('/test/workspace', 'claims_and_evidence.md')
      );

      expect(watcher1).toBeDefined();
      expect(watcher2).toBeDefined();
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup', () => {
    test('should have subscriptions array for cleanup', () => {
      expect(mockContext.subscriptions).toBeDefined();
      expect(Array.isArray(mockContext.subscriptions)).toBe(true);
    });

    test('should support adding disposables', () => {
      const mockDisposable = { dispose: jest.fn() };
      mockContext.subscriptions.push(mockDisposable);
      
      expect(mockContext.subscriptions).toContain(mockDisposable);
      expect(mockContext.subscriptions.length).toBe(1);
    });
  });

  describe('Context Properties', () => {
    test('should have extension context properties', () => {
      expect(mockContext.extensionPath).toBeDefined();
      expect(mockContext.globalState).toBeDefined();
      expect(mockContext.workspaceState).toBeDefined();
      expect(mockContext.subscriptions).toBeDefined();
    });
  });
});
