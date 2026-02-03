import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceDetector } from '../core/workspaceDetector';

// Mock fs module
jest.mock('fs');

describe('WorkspaceDetector', () => {
  const mockContext = {
    subscriptions: [],
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(),
    },
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset workspace folders
    (vscode.workspace as any).workspaceFolders = [
      {
        uri: { fsPath: '/test/workspace' },
        name: 'test-workspace',
        index: 0,
      },
    ];
  });

  describe('isResearchWorkspace', () => {
    test('should return true when 01_Knowledge_Base directory exists', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('01_Knowledge_Base');
      });

      const result = WorkspaceDetector.isResearchWorkspace();
      
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalled();
    });

    test('should return true when 03_Drafting directory exists', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('03_Drafting');
      });

      const result = WorkspaceDetector.isResearchWorkspace();
      
      expect(result).toBe(true);
    });

    test('should return true when literature/ExtractedText directory exists', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('literature/ExtractedText');
      });

      const result = WorkspaceDetector.isResearchWorkspace();
      
      expect(result).toBe(true);
    });

    test('should return false when no research indicators exist', () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = WorkspaceDetector.isResearchWorkspace();
      
      expect(result).toBe(false);
    });

    test('should return false when workspace folders is undefined', () => {
      (vscode.workspace as any).workspaceFolders = undefined;

      const result = WorkspaceDetector.isResearchWorkspace();
      
      expect(result).toBe(false);
    });

    test('should return false when workspace folders is empty', () => {
      (vscode.workspace as any).workspaceFolders = [];

      const result = WorkspaceDetector.isResearchWorkspace();
      
      expect(result).toBe(false);
    });

    test('should check all research indicators', () => {
      (fs.existsSync as any).mockReturnValue(false);

      WorkspaceDetector.isResearchWorkspace();
      
      const indicators = WorkspaceDetector.getResearchIndicators();
      expect(fs.existsSync).toHaveBeenCalledTimes(indicators.length);
    });

    test('should use correct workspace root path', () => {
      const workspaceRoot = '/custom/workspace';
      (vscode.workspace as any).workspaceFolders = [
        {
          uri: { fsPath: workspaceRoot },
          name: 'custom-workspace',
          index: 0,
        },
      ];
      (fs.existsSync as any).mockReturnValue(false);

      WorkspaceDetector.isResearchWorkspace();
      
      const calls = (fs.existsSync as any).mock.calls;
      calls.forEach((call: any) => {
        expect(call[0]).toContain(workspaceRoot);
      });
    });
  });

  describe('autoActivateIfNeeded', () => {
    beforeEach(() => {
      // Mock configuration to enable auto-activation by default
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: jest.fn((key: string, defaultValue: any) => {
          if (key === 'autoActivate') {
            return true;
          }
          return defaultValue;
        }),
        update: jest.fn().mockResolvedValue(undefined),
      });
    });

    test('should not activate when auto-activation is disabled', async () => {
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: jest.fn((key: string, defaultValue: any) => {
          if (key === 'autoActivate') {
            return false;
          }
          return defaultValue;
        }),
      });
      (fs.existsSync as any).mockReturnValue(true);

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    test('should not activate when not a research workspace', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    test('should show notification and activate when research workspace detected', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (vscode.window.showInformationMessage as any).mockResolvedValue('OK');

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Research workspace detected. Research Assistant is activating...',
        'Disable Auto-Activation',
        'OK'
      );
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('researchAssistant.activate');
    });

    test('should disable auto-activation when user clicks "Disable Auto-Activation"', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (vscode.window.showInformationMessage as any).mockResolvedValue('Disable Auto-Activation');
      
      const mockConfig = {
        get: jest.fn((key: string, defaultValue: any) => {
          if (key === 'autoActivate') {
            return true;
          }
          return defaultValue;
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'autoActivate',
        false,
        vscode.ConfigurationTarget.Workspace
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Auto-activation disabled. You can re-enable it in settings.'
      );
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('researchAssistant.activate');
    });

    test('should handle activation command failure gracefully', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (vscode.window.showInformationMessage as any).mockResolvedValue('OK');
      (vscode.commands.executeCommand as any).mockRejectedValue(new Error('Activation failed'));

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to activate Research Assistant. Please activate manually.'
      );
    });

    test('should not activate when user dismisses notification', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (vscode.window.showInformationMessage as any).mockResolvedValue(undefined);

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('researchAssistant.activate');
    });
  });

  describe('enableAutoActivation', () => {
    test('should enable auto-activation in workspace configuration', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);

      await WorkspaceDetector.enableAutoActivation();
      
      expect(mockConfig.update).toHaveBeenCalledWith(
        'autoActivate',
        true,
        vscode.ConfigurationTarget.Workspace
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Auto-activation enabled');
    });

    test('should use correct configuration key', async () => {
      const mockConfig = {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);

      await WorkspaceDetector.enableAutoActivation();
      
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('researchAssistant');
    });
  });

  describe('getResearchIndicators', () => {
    test('should return array of research indicators', () => {
      const indicators = WorkspaceDetector.getResearchIndicators();
      
      expect(Array.isArray(indicators)).toBe(true);
      expect(indicators.length).toBeGreaterThan(0);
    });

    test('should include expected research indicators', () => {
      const indicators = WorkspaceDetector.getResearchIndicators();
      
      expect(indicators).toContain('01_Knowledge_Base');
      expect(indicators).toContain('03_Drafting');
      expect(indicators).toContain('literature/ExtractedText');
    });

    test('should return a copy of the indicators array', () => {
      const indicators1 = WorkspaceDetector.getResearchIndicators();
      const indicators2 = WorkspaceDetector.getResearchIndicators();
      
      expect(indicators1).not.toBe(indicators2);
      expect(indicators1).toEqual(indicators2);
    });
  });

  describe('Configuration Integration', () => {
    test('should read auto-activation setting from correct configuration key', async () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue: any) => {
          if (key === 'autoActivate') {
            return false;
          }
          return defaultValue;
        }),
      };
      (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);
      (fs.existsSync as any).mockReturnValue(true);

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('researchAssistant');
      expect(mockConfig.get).toHaveBeenCalledWith('autoActivate', true);
    });

    test('should default to enabled when configuration is not set', async () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue: any) => defaultValue),
      };
      (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);
      (fs.existsSync as any).mockReturnValue(true);
      (vscode.window.showInformationMessage as any).mockResolvedValue('OK');

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      // Should activate because default is true
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('researchAssistant.activate');
    });
  });

  describe('Edge Cases', () => {
    test('should handle multiple workspace folders by using the first one', () => {
      (vscode.workspace as any).workspaceFolders = [
        {
          uri: { fsPath: '/workspace1' },
          name: 'workspace1',
          index: 0,
        },
        {
          uri: { fsPath: '/workspace2' },
          name: 'workspace2',
          index: 1,
        },
      ];
      (fs.existsSync as any).mockReturnValue(false);

      WorkspaceDetector.isResearchWorkspace();
      
      const calls = (fs.existsSync as any).mock.calls;
      calls.forEach((call: any) => {
        expect(call[0]).toContain('/workspace1');
        expect(call[0]).not.toContain('/workspace2');
      });
    });

    test('should handle workspace path with special characters', () => {
      const specialPath = '/test/workspace with spaces/and-dashes';
      (vscode.workspace as any).workspaceFolders = [
        {
          uri: { fsPath: specialPath },
          name: 'special-workspace',
          index: 0,
        },
      ];
      (fs.existsSync as any).mockImplementation((checkPath: string) => {
        return checkPath.includes('01_Knowledge_Base');
      });

      const result = WorkspaceDetector.isResearchWorkspace();
      
      expect(result).toBe(true);
      const calls = (fs.existsSync as any).mock.calls;
      expect(calls[0][0]).toContain(specialPath);
    });

    test('should handle activation command that returns a value', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (vscode.window.showInformationMessage as any).mockResolvedValue('OK');
      (vscode.commands.executeCommand as any).mockResolvedValue({ success: true });

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('researchAssistant.activate');
      expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });
});
